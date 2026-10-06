import React, { useState, useEffect } from 'react';
import { PRODOTTI, getContratti, fmtEur, fmt, uid } from '../constants';
import { dbLoadCanvass, dbSaveCanvass, dbDeleteCanvass } from '../supabase';

// Replica minimale di TagInput (quello di Modal.jsx non è esportato) — stesso comportamento:
// Invio o virgola per aggiungere, Backspace per rimuovere l'ultimo.
function TagInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const tags = value || [];
  const addTag = () => {
    const t = draft.trim();
    if (!t) return;
    if (!tags.some(x => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setDraft('');
  };
  const removeTag = (i) => onChange(tags.filter((_, idx) => idx !== i));
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
  };
  return (
    <div className="form-control" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 40, height: 'auto', padding: '6px 8px' }}>
      {tags.map((t, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-lt)', color: 'var(--accent-dk)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {t}
          <span style={{ cursor: 'pointer', fontWeight: 800 }} onClick={() => removeTag(i)}>×</span>
        </span>
      ))}
      <input style={{ border: 'none', outline: 'none', flex: 1, minWidth: 100, fontSize: 13, fontFamily: 'inherit', background: 'transparent' }}
        value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={handleKeyDown} onBlur={addTag} placeholder={tags.length ? '' : placeholder} />
    </div>
  );
}

const CANVASS_VUOTO = {
  nome: '', linee_prodotto: [], data_inizio: '', data_fine: '',
  tipi_target: [], nomi_target: [], tipi_premio: [], tipi_esclusi_premio: [], target_individuale: '',
  premio_regole: [], premio_pct_flat: '', cap_premio: '', premio_area_pct: '',
  premio_manuale: '', note: '', stato: 'attivo',
  gettone_attivo: false, gettone_prodotto_a: '', gettone_prodotto_b: '',
  gettone_mesi_lookback: 6, gettone_scaglioni: [],
};

// Le linee valide di un canvass — nuovo campo linee_prodotto (array), con compatibilità
// verso i canvass creati prima (campo singolo linea_prodotto). Array vuoto = qualsiasi linea.
export function getLinee(cv) {
  if (cv.linee_prodotto && cv.linee_prodotto.length) return cv.linee_prodotto;
  if (cv.linea_prodotto) return [cv.linea_prodotto];
  return [];
}
// Somma/sottrae mesi a una data ISO (YYYY-MM-DD), restituendo di nuovo una data ISO.
function addMesi(dataIso, n) {
  const d = new Date(dataIso + 'T12:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

// Il cuore del calcolo: legge SOLO quello che il canvass stesso dichiara (periodo, linee,
// quali tipi contano per il target, quali per il premio, le percentuali) — non assume nulla
// di specifico su "come funzionano i canvass in generale", perché ognuno ha la sua logica.
// Un prodotto corrisponde a una "parola chiave" se TUTTE le parole di quella chiave sono
// presenti nel suo nome, in qualsiasi ordine — "Top AI" prende "TOP24 FISCO GOLD AI" anche se
// "FISCO GOLD" sta in mezzo, non serve che la frase sia scritta identica e consecutiva.
function nomeCorrisponde(nome, parolaChiave) {
  const n = (nome || '').toLowerCase();
  return parolaChiave.toLowerCase().split(/\s+/).filter(Boolean).every(w => n.includes(w));
}
// Un prodotto qualifica se il suo Tipo è in tipiList, OPPURE il suo nome corrisponde a una
// delle parole chiave in nomiList — due strade indipendenti per intercettarlo, utile quando
// non si vuole (o non si può) taggare ogni singolo contratto a mano.
function prodottoQualifica(p, tipiList, nomiList) {
  if ((tipiList || []).length && tipiList.includes(p.tipoDettaglio)) return true;
  if ((nomiList || []).length && nomiList.some(k => nomeCorrisponde(p.nome, k))) return true;
  return false;
}

export function calcolaAvanzamento(cv, contacts) {
  const linee = getLinee(cv);
  // Se non configuri NÉ tipi NÉ parole chiave, di proposito non conta nulla — un default
  // "conta tutto" sarebbe silenzioso e rischioso: meglio restare a zero (visibile, segnala
  // che manca una configurazione) piuttosto che gonfiare un numero senza che nessuno se ne accorga.
  const haTipiPremio = (cv.tipi_premio || []).length > 0;
  let fatturatoTarget = 0;
  let fatturatoPremiabileTotale = 0;
  const fatturatoPerTipo = {};
  (contacts || []).forEach(c => {
    getContratti(c).filter(ct => ct.tipo !== 'Rinnovo').forEach(ct => {
      if (!ct.dataInizio || ct.dataInizio < cv.data_inizio || ct.dataInizio > cv.data_fine) return;
      (ct.prodotti || []).forEach(p => {
        if (linee.length && !linee.includes(p.categoria)) return;
        const imp = Number(p.importo) || 0;
        if (!prodottoQualifica(p, cv.tipi_target, cv.nomi_target)) return;
        fatturatoTarget += imp;
        const inPremio = haTipiPremio
          ? cv.tipi_premio.includes(p.tipoDettaglio)
          : !((cv.tipi_esclusi_premio || []).includes(p.tipoDettaglio));
        if (inPremio) {
          fatturatoPremiabileTotale += imp;
          if (p.tipoDettaglio) fatturatoPerTipo[p.tipoDettaglio] = (fatturatoPerTipo[p.tipoDettaglio] || 0) + imp;
        }
      });
    });
  });
  const target = Number(cv.target_individuale) || 0;
  const pct = target > 0 ? (fatturatoTarget / target) * 100 : 0;
  const raggiunto = target > 0 && pct >= 100;
  let premioStimato = 0;
  if (raggiunto) {
    (cv.premio_regole || []).forEach(r => {
      premioStimato += (fatturatoPerTipo[r.tipo] || 0) * (Number(r.pct) || 0) / 100;
    });
    if (cv.premio_pct_flat) premioStimato += fatturatoPremiabileTotale * Number(cv.premio_pct_flat) / 100;
    if (cv.cap_premio) premioStimato = Math.min(premioStimato, Number(cv.cap_premio));
  }
  if (cv.premio_manuale) premioStimato = Number(cv.premio_manuale);
  return { fatturatoTarget, fatturatoPremiabileTotale, fatturatoPerTipo, pct, raggiunto, premioStimato, target };
}

// Gettone premio per nuovi clienti con ordine in bundle (es. Canvass 15/2026): un meccanismo
// a parte rispetto alle "regole premio" percentuali — qui si contano CLIENTI, non fatturato,
// con un importo che cresce a scaglioni dal 3° cliente in poi. Attivo solo se il canvass ha
// un gettone_config; se raggiunto/non raggiunto il target non cambia il conteggio in sé,
// ma la regola aziendale è che il gettone scatta solo a target già raggiunto — quindi lo
// mostriamo sempre calcolato, ed è l'interfaccia a dire chiaramente se è già sbloccato o no.
export function calcolaGettoni(cv, contacts) {
  const gc = cv.gettone_config;
  if (!gc || !gc.prodotto_a || !gc.prodotto_b) return { dettaglio: [], totale: 0 };
  const linee = getLinee(cv);
  const mesiLookback = Number(gc.mesi_lookback) || 6;
  const sogliaInf = addMesi(cv.data_inizio, -mesiLookback);
  const a = gc.prodotto_a.toLowerCase(), b = gc.prodotto_b.toLowerCase();

  const candidati = [];
  (contacts || []).forEach(c => {
    getContratti(c).filter(ct => ct.tipo !== 'Rinnovo').forEach(ct => {
      if (!ct.dataInizio || ct.dataInizio < cv.data_inizio || ct.dataInizio > cv.data_fine) return;
      const prodotti = ct.prodotti || [];
      const haA = prodotti.some(p => (p.nome || '').toLowerCase().includes(a));
      const haB = prodotti.some(p => (p.nome || '').toLowerCase().includes(b));
      if (!haA || !haB) return;
      // "Nuovo cliente": nessun ALTRO contratto, su una delle linee valide, nei mesi di lookback precedenti.
      const giaCliente = getContratti(c).some(ct2 => {
        if (ct2 === ct || !ct2.dataInizio) return false;
        if (ct2.dataInizio < sogliaInf || ct2.dataInizio >= cv.data_inizio) return false;
        return (ct2.prodotti || []).some(p => !linee.length || linee.includes(p.categoria));
      });
      if (giaCliente) return;
      candidati.push({ contattoId: c.id, nome: c.nome, azienda: c.azienda, data: ct.dataInizio });
    });
  });
  candidati.sort((x, y) => x.data.localeCompare(y.data));

  const scaglioni = [...(gc.scaglioni || [])].sort((x, y) => (Number(x.daCliente) || 0) - (Number(y.daCliente) || 0));
  let totale = 0;
  const dettaglio = candidati.map((cand, i) => {
    const n = i + 1;
    const applicabile = scaglioni.filter(s => (Number(s.daCliente) || 0) <= n).slice(-1)[0];
    const importo = applicabile ? Number(applicabile.importo) || 0 : 0;
    totale += importo;
    return { ...cand, n, importo };
  });
  return { dettaglio, totale };
}

export function statoDisplay(cv, today) {
  if (cv.stato === 'archiviato') return { label: 'Archiviato', color: '#8A95A3', bg: '#EEF1F5' };
  if (today < cv.data_inizio) return { label: 'Non ancora iniziato', color: '#0078D4', bg: '#EBF4FC' };
  if (today > cv.data_fine) return { label: 'Scaduto — da archiviare', color: '#E07B1A', bg: '#FEF3E2' };
  return { label: 'Attivo', color: '#1B7A3E', bg: '#E8F5EE' };
}

function CanvassCard({ cv, contacts, today, onClick }) {
  const { pct, raggiunto, premioStimato } = calcolaAvanzamento(cv, contacts);
  const st = statoDisplay(cv, today);
  const barColor = raggiunto ? '#1B7A3E' : pct >= 70 ? '#0078D4' : pct >= 40 ? '#E07B1A' : '#C0392B';
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{cv.nome}</div>
          <div className="fs-12 text-muted">{fmt(cv.data_inizio, { day: '2-digit', month: 'short', year: 'numeric' })} — {fmt(cv.data_fine, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
        <span className="badge" style={{ background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
        <span className="text-muted">Target individuale</span>
        <span style={{ fontWeight: 800, color: barColor }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ background: 'var(--bg3)', borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor, borderRadius: 20, transition: 'width .5s ease' }} />
      </div>
      {raggiunto
        ? <div className="fs-12" style={{ fontWeight: 700, color: '#1B7A3E' }}>🎉 Premio stimato: {fmtEur(premioStimato)}</div>
        : <div className="fs-12 text-muted">Premio sbloccato al 100% del target</div>}
    </div>
  );
}

export default function Canvass({ contacts, showToast }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('attivi');
  const [selected, setSelected] = useState(null); // canvass in visualizzazione/modifica, oppure {isNew:true}
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const load = () => dbLoadCanvass().then(rows => { setLista(rows); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = lista.filter(cv => {
    const st = statoDisplay(cv, today);
    if (filtro === 'attivi') return st.label === 'Attivo';
    if (filtro === 'archiviati') return cv.stato === 'archiviato';
    return true;
  });

  const apriDettaglio = (cv) => { setSelected(cv); setForm(null); };
  const apriModifica = (cv) => setForm({
    ...CANVASS_VUOTO, ...cv,
    linee_prodotto: getLinee(cv),
    target_individuale: cv.target_individuale ?? '', cap_premio: cv.cap_premio ?? '',
    premio_area_pct: cv.premio_area_pct ?? '', premio_manuale: cv.premio_manuale ?? '',
    premio_regole: cv.premio_regole || [], tipi_esclusi_premio: cv.tipi_esclusi_premio || [],
    nomi_target: cv.nomi_target || [],
    premio_pct_flat: cv.premio_pct_flat ?? '',
    gettone_attivo: !!cv.gettone_config,
    gettone_prodotto_a: cv.gettone_config?.prodotto_a || '',
    gettone_prodotto_b: cv.gettone_config?.prodotto_b || '',
    gettone_mesi_lookback: cv.gettone_config?.mesi_lookback ?? 6,
    gettone_scaglioni: cv.gettone_config?.scaglioni || [],
  });
  const apriNuovo = () => { setSelected({ isNew: true }); setForm({ ...CANVASS_VUOTO }); };
  const chiudi = () => { setSelected(null); setForm(null); };

  const fx = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const addRegola = () => setForm(p => ({ ...p, premio_regole: [...(p.premio_regole || []), { tipo: '', pct: '' }] }));
  const updRegola = (i, k, v) => setForm(p => ({ ...p, premio_regole: p.premio_regole.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const delRegola = (i) => setForm(p => ({ ...p, premio_regole: p.premio_regole.filter((_, idx) => idx !== i) }));
  const toggleLinea = (l) => setForm(p => ({ ...p, linee_prodotto: p.linee_prodotto.includes(l) ? p.linee_prodotto.filter(x => x !== l) : [...p.linee_prodotto, l] }));
  const addScaglione = () => setForm(p => ({ ...p, gettone_scaglioni: [...(p.gettone_scaglioni || []), { daCliente: '', importo: '' }] }));
  const updScaglione = (i, k, v) => setForm(p => ({ ...p, gettone_scaglioni: p.gettone_scaglioni.map((s, idx) => idx === i ? { ...s, [k]: v } : s) }));
  const delScaglione = (i) => setForm(p => ({ ...p, gettone_scaglioni: p.gettone_scaglioni.filter((_, idx) => idx !== i) }));

  const salva = async () => {
    if (!form.nome.trim()) { showToast('Dai un nome al canvass', '', 'info'); return; }
    if (!form.data_inizio || !form.data_fine) { showToast('Inserisci le date di inizio e fine', '', 'info'); return; }
    setSaving(true);
    const gettoneValido = form.gettone_attivo && form.gettone_prodotto_a.trim() && form.gettone_prodotto_b.trim();
    const payload = {
      ...(selected.isNew ? {} : { id: selected.id }),
      nome: form.nome.trim(), linea_prodotto: null, linee_prodotto: form.linee_prodotto,
      data_inizio: form.data_inizio, data_fine: form.data_fine,
      tipi_target: form.tipi_target, nomi_target: form.nomi_target,
      tipi_premio: form.tipi_premio, tipi_esclusi_premio: form.tipi_esclusi_premio,
      target_individuale: Number(form.target_individuale) || 0,
      premio_regole: form.premio_regole.filter(r => r.tipo && r.pct !== ''),
      premio_pct_flat: form.premio_pct_flat === '' ? null : Number(form.premio_pct_flat),
      cap_premio: form.cap_premio === '' ? null : Number(form.cap_premio),
      premio_area_pct: form.premio_area_pct === '' ? null : Number(form.premio_area_pct),
      note: form.note || null, stato: form.stato || 'attivo',
      gettone_config: gettoneValido ? {
        prodotto_a: form.gettone_prodotto_a.trim(), prodotto_b: form.gettone_prodotto_b.trim(),
        mesi_lookback: Number(form.gettone_mesi_lookback) || 6,
        scaglioni: form.gettone_scaglioni.filter(s => s.daCliente !== '' && s.importo !== '')
          .map(s => ({ daCliente: Number(s.daCliente), importo: Number(s.importo) })),
      } : null,
    };
    const saved = await dbSaveCanvass(payload);
    setSaving(false);
    if (!saved) { showToast('Errore durante il salvataggio', '', 'info'); return; }
    showToast('Canvass salvato', form.nome);
    chiudi(); load();
  };

  const archivia = async (cv) => {
    setSaving(true);
    const saved = await dbSaveCanvass({ ...cv, stato: 'archiviato' });
    setSaving(false);
    if (saved) { showToast('Canvass archiviato', cv.nome); chiudi(); load(); }
  };
  const riattiva = async (cv) => {
    const saved = await dbSaveCanvass({ ...cv, stato: 'attivo' });
    if (saved) { showToast('Canvass riattivato', cv.nome); chiudi(); load(); }
  };
  const elimina = async (cv) => {
    if (!window.confirm(`Eliminare definitivamente "${cv.nome}"? Non è recuperabile.`)) return;
    const ok = await dbDeleteCanvass(cv.id);
    if (ok) { showToast('Canvass eliminato', '', 'info'); chiudi(); load(); }
  };

  if (loading) return (<><div className="topbar"><span className="page-title">Canvass</span></div><div className="content"><div className="empty">Caricamento...</div></div></>);

  return (
    <>
      <div className="topbar">
        <span className="page-title">Canvass</span>
        <button className="btn btn-primary" onClick={apriNuovo}>+ Nuovo canvass</button>
      </div>
      <div className="content">
        <div className="search-bar">
          {[['attivi', 'Attivi'], ['tutti', 'Tutti'], ['archiviati', 'Archiviati']].map(([k, l]) => (
            <button key={k} className={`btn btn-sm${filtro === k ? ' btn-primary' : ''}`} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">{filtro === 'attivi' ? 'Nessun canvass attivo al momento' : 'Nessun canvass qui'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {filtered.map(cv => <CanvassCard key={cv.id} cv={cv} contacts={contacts} today={today} onClick={() => apriDettaglio(cv)} />)}
          </div>
        )}
      </div>

      {/* ── DETTAGLIO ── */}
      {selected && !selected.isNew && !form && (() => {
        const { fatturatoTarget, fatturatoPerTipo, pct, raggiunto, premioStimato, target } = calcolaAvanzamento(selected, contacts);
        const gettoni = selected.gettone_config ? calcolaGettoni(selected, contacts) : null;
        const st = statoDisplay(selected, today);
        const barColor = raggiunto ? '#1B7A3E' : pct >= 70 ? '#0078D4' : pct >= 40 ? '#E07B1A' : '#C0392B';
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={chiudi}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.nome}</div>
                <button className="btn btn-sm" onClick={chiudi}>✕</button>
              </div>
              <div className="fs-12 text-muted" style={{ marginBottom: 14 }}>
                {fmt(selected.data_inizio, { day: '2-digit', month: 'short', year: 'numeric' })} — {fmt(selected.data_fine, { day: '2-digit', month: 'short', year: 'numeric' })}
                {getLinee(selected).length > 0 && ` · ${getLinee(selected).join(', ')}`}
                {' · '}<span style={{ color: st.color, fontWeight: 700 }}>{st.label}</span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Target individuale</span>
                  <span style={{ fontWeight: 800, color: barColor }}>{fmtEur(fatturatoTarget)} / {fmtEur(target)} — {Math.round(pct)}%</span>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 20, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor, borderRadius: 20 }} />
                </div>
              </div>

              <div style={{ background: raggiunto ? '#E8F5EE' : 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 14 }}>
                {raggiunto ? (
                  <>
                    <div style={{ fontWeight: 700, color: '#1B7A3E', marginBottom: 6 }}>🎉 Target raggiunto — premio stimato: {fmtEur(premioStimato)}</div>
                    {selected.premio_pct_flat && <div className="fs-12 text-muted">Fatturato premiabile: {fmtEur(calcolaAvanzamento(selected, contacts).fatturatoPremiabileTotale)} × {selected.premio_pct_flat}% = {fmtEur(calcolaAvanzamento(selected, contacts).fatturatoPremiabileTotale * selected.premio_pct_flat / 100)}</div>}
                    {(selected.premio_regole || []).filter(r => r.tipo).map((r, i) => (
                      <div key={i} className="fs-12 text-muted">{r.tipo}: {fmtEur(fatturatoPerTipo[r.tipo] || 0)} × {r.pct}% = {fmtEur((fatturatoPerTipo[r.tipo] || 0) * r.pct / 100)}</div>
                    ))}
                    {selected.cap_premio && <div className="fs-11 text-muted" style={{ marginTop: 4 }}>Tetto massimo: {fmtEur(selected.cap_premio)}</div>}
                  </>
                ) : (
                  <div className="fs-13 text-muted">Premio non ancora sbloccato — manca {fmtEur(Math.max(0, target - fatturatoTarget))} al 100% del target.</div>
                )}
                {selected.premio_area_pct && pct >= 80 && (
                  <div className="fs-12" style={{ marginTop: 8, color: '#0078D4' }}>ℹ️ Sei almeno all'80% individuale: se l'area raggiunge il suo target, hai diritto anche al bonus di area (+{selected.premio_area_pct}%) — da verificare separatamente, non calcolato qui.</div>
                )}
              </div>

              {gettoni && (
                <div style={{ background: raggiunto ? '#E8F5EE' : 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>🎟️ Gettone nuovi clienti in bundle</div>
                  {!raggiunto && <div className="fs-12 text-muted" style={{ marginBottom: 8 }}>Scatta solo a target individuale raggiunto — qui sotto il conteggio calcolato comunque, come anteprima.</div>}
                  {gettoni.dettaglio.length === 0
                    ? <div className="fs-12 text-muted">Nessun cliente nuovo in bundle finora in questo periodo.</div>
                    : gettoni.dettaglio.map(d => (
                      <div key={d.contattoId + d.data} className="fs-12" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span>#{d.n} — {d.nome}{d.azienda ? ` (${d.azienda})` : ''} — {fmt(d.data, { day: '2-digit', month: 'short' })}</span>
                        <span style={{ fontWeight: 700, color: d.importo > 0 ? '#1B7A3E' : 'var(--text3)' }}>{d.importo > 0 ? fmtEur(d.importo) : '—'}</span>
                      </div>
                    ))}
                  <div className="fs-13" style={{ fontWeight: 800, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    Totale gettoni{raggiunto ? '' : ' (se il target verrà raggiunto)'}: {fmtEur(gettoni.totale)}
                  </div>
                </div>
              )}

              {selected.note && <div className="fs-12 text-muted" style={{ marginBottom: 14, whiteSpace: 'pre-wrap' }}>📝 {selected.note}</div>}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14, flexWrap: 'wrap' }}>
                <button className="btn" style={{ color: '#A32D2D', borderColor: '#A32D2D55' }} onClick={() => elimina(selected)}>🗑 Elimina</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.stato === 'archiviato'
                    ? <button className="btn" onClick={() => riattiva(selected)}>↩️ Riattiva</button>
                    : <button className="btn" onClick={() => archivia(selected)}>📦 Archivia</button>}
                  <button className="btn btn-primary" onClick={() => apriModifica(selected)}>✏️ Modifica</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── CREAZIONE / MODIFICA ── */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={chiudi}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.isNew ? '+ Nuovo canvass' : `Modifica — ${form.nome || ''}`}</div>
              <button className="btn btn-sm" onClick={chiudi}>✕</button>
            </div>

            <div className="form-group"><label className="form-label">Nome *</label><input className="form-control" value={form.nome} onChange={e => fx('nome', e.target.value)} placeholder='Es. Canvass 16/2026 Education' /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Data inizio *</label><input className="form-control" type="date" value={form.data_inizio} onChange={e => fx('data_inizio', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Data fine *</label><input className="form-control" type="date" value={form.data_fine} onChange={e => fx('data_fine', e.target.value)} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Linee di prodotto (categorie) <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— nessuna selezionata = qualsiasi</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PRODOTTI.map(p => {
                  const sel = form.linee_prodotto.includes(p);
                  return (
                    <button key={p} type="button" onClick={() => toggleLinea(p)}
                      className="btn btn-sm" style={sel ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target individuale (€)</label>
              <input className="form-control" type="number" value={form.target_individuale} onChange={e => fx('target_individuale', e.target.value)} placeholder="Il valore già calcolato, soglia minima inclusa se prevista" />
            </div>

            <div className="form-group">
              <label className="form-label">Tipi che contano per il target <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— dal campo "Tipo" del prodotto, se lo usi</span></label>
              <TagInput value={form.tipi_target} onChange={v => fx('tipi_target', v)} placeholder="Es. Abbonamento, One Shot... Invio per aggiungere" />
            </div>
            <div className="form-group">
              <label className="form-label">Oppure: parole chiave nel nome del prodotto <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— un prodotto conta se il suo nome contiene TUTTE le parole di una chiave, in qualsiasi ordine</span></label>
              <TagInput value={form.nomi_target} onChange={v => fx('nomi_target', v)} placeholder='Es. "Top AI" prende anche "TOP24 FISCO GOLD AI" — Invio per aggiungere' />
              <div className="fs-11 text-muted" style={{ marginTop: 4 }}>Conta come target un prodotto che corrisponde ad ALMENO UNA tra Tipi e parole chiave sopra. Se entrambi i campi restano vuoti, nessun prodotto conta — meglio accorgersene subito che gonfiare un numero senza saperlo.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Tipi che contano per il premio <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— vuoto = stessi del target (vedi sotto per le eccezioni)</span></label>
              <TagInput value={form.tipi_premio} onChange={v => fx('tipi_premio', v)} placeholder="Lascia vuoto, oppure Es. Abbonamento, Laboratorio... Invio per aggiungere" />
            </div>
            {form.tipi_premio.length === 0 && (
              <div className="form-group">
                <label className="form-label">Tipi da escludere dal premio <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— contano per il target ma non generano premio (es. Newsletter)</span></label>
                <TagInput value={form.tipi_esclusi_premio} onChange={v => fx('tipi_esclusi_premio', v)} placeholder="Solo le eccezioni — i prodotti vanno taggati con questo Tipo" />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Percentuale premio unica <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— se il canvass ha un'unica aliquota (non diversa per tipo), usa questa invece delle regole sotto</span></label>
              <input className="form-control" type="number" value={form.premio_pct_flat} onChange={e => fx('premio_pct_flat', e.target.value)} placeholder="Es. 15 — si applica a tutto il fatturato premiabile" />
            </div>

            <div className="card-title" style={{ marginTop: 14, marginBottom: 8 }}>Regole premio per tipo <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— solo se l'aliquota cambia da tipo a tipo</span></div>
            {form.premio_regole.length === 0 && <div className="fs-12 text-muted" style={{ marginBottom: 8 }}>Nessuna regola per tipo</div>}
            {form.premio_regole.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input className="form-control" style={{ flex: 2 }} placeholder="Tipo (deve corrispondere a uno di sopra)" value={r.tipo} onChange={e => updRegola(i, 'tipo', e.target.value)} />
                <input className="form-control" style={{ flex: 1 }} type="number" placeholder="%" value={r.pct} onChange={e => updRegola(i, 'pct', e.target.value)} />
                <button className="btn btn-sm btn-danger" onClick={() => delRegola(i)}>×</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={addRegola} style={{ marginBottom: 14 }}>+ Aggiungi regola</button>

            <div className="form-row">
              <div className="form-group"><label className="form-label">Tetto massimo premio (€)</label><input className="form-control" type="number" value={form.cap_premio} onChange={e => fx('cap_premio', e.target.value)} placeholder="Facoltativo" /></div>
              <div className="form-group"><label className="form-label">Premio di area (%)</label><input className="form-control" type="number" value={form.premio_area_pct} onChange={e => fx('premio_area_pct', e.target.value)} placeholder="Solo informativo, facoltativo" /></div>
            </div>

            <div className="form-group">
              <label className="form-label">Premio manuale (€) <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>— se compilato, sovrascrive il calcolo automatico</span></label>
              <input className="form-control" type="number" value={form.premio_manuale} onChange={e => fx('premio_manuale', e.target.value)} placeholder="Lascia vuoto per usare il calcolo automatico" />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input type="checkbox" checked={form.gettone_attivo} onChange={e => fx('gettone_attivo', e.target.checked)} id="gettone-toggle" />
              <label htmlFor="gettone-toggle" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>🎟️ Attiva gettone premio per nuovi clienti in bundle</label>
            </div>
            {form.gettone_attivo && (
              <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 14, marginBottom: 14 }}>
                <div className="fs-12 text-muted" style={{ marginBottom: 10 }}>Un cliente conta come "in bundle" se, nello stesso contratto, ha almeno un prodotto il cui nome contiene il primo testo <strong>e</strong> almeno uno che contiene il secondo. "Nuovo cliente" = nessun altro contratto, sulle linee sopra, nei mesi di tolleranza precedenti.</div>
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Prodotto A (testo da cercare nel nome)</label><input className="form-control" value={form.gettone_prodotto_a} onChange={e => fx('gettone_prodotto_a', e.target.value)} placeholder="Es. Banca Dati AI" /></div>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Prodotto B (testo da cercare nel nome)</label><input className="form-control" value={form.gettone_prodotto_b} onChange={e => fx('gettone_prodotto_b', e.target.value)} placeholder="Es. Software Valore24 AI" /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Mesi di tolleranza per "nuovo cliente"</label>
                  <input className="form-control" style={{ maxWidth: 120 }} type="number" value={form.gettone_mesi_lookback} onChange={e => fx('gettone_mesi_lookback', e.target.value)} />
                </div>
                <div className="form-label" style={{ marginBottom: 6 }}>Scaglioni (dal cliente N° in poi, importo €)</div>
                {form.gettone_scaglioni.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <span className="fs-12 text-muted">dal</span>
                    <input className="form-control" style={{ width: 70 }} type="number" placeholder="N°" value={s.daCliente} onChange={e => updScaglione(i, 'daCliente', e.target.value)} />
                    <span className="fs-12 text-muted">cliente →</span>
                    <input className="form-control" style={{ width: 90 }} type="number" placeholder="€" value={s.importo} onChange={e => updScaglione(i, 'importo', e.target.value)} />
                    <button className="btn btn-sm btn-danger" onClick={() => delScaglione(i)}>×</button>
                  </div>
                ))}
                <button className="btn btn-sm" onClick={addScaglione}>+ Aggiungi scaglione</button>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea className="form-control" style={{ minHeight: 70 }} value={form.note} onChange={e => fx('note', e.target.value)} placeholder="Regole particolari che non rientrano nei campi sopra (es. bonus area all'80%, pagamento anticipato, soglia minima...)" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button className="btn" onClick={() => selected.isNew ? chiudi() : setForm(null)} disabled={saving}>Annulla</button>
              <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? '⏳ Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
