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
  nome: '', linea_prodotto: '', data_inizio: '', data_fine: '',
  tipi_target: [], tipi_premio: [], target_individuale: '',
  premio_regole: [], cap_premio: '', premio_area_pct: '',
  premio_manuale: '', note: '', stato: 'attivo',
};

// Il cuore del calcolo: legge SOLO quello che il canvass stesso dichiara (periodo, linea,
// quali tipi contano per il target, quali per il premio, le percentuali) — non assume nulla
// di specifico su "come funzionano i canvass in generale", perché ognuno ha la sua logica.
export function calcolaAvanzamento(cv, contacts) {
  let fatturatoTarget = 0;
  const fatturatoPerTipo = {};
  (contacts || []).forEach(c => {
    getContratti(c).filter(ct => ct.tipo !== 'Rinnovo').forEach(ct => {
      if (!ct.dataInizio || ct.dataInizio < cv.data_inizio || ct.dataInizio > cv.data_fine) return;
      (ct.prodotti || []).forEach(p => {
        if (cv.linea_prodotto && p.categoria !== cv.linea_prodotto) return;
        const imp = Number(p.importo) || 0;
        if ((cv.tipi_target || []).includes(p.tipoDettaglio)) fatturatoTarget += imp;
        if ((cv.tipi_premio || []).includes(p.tipoDettaglio)) {
          fatturatoPerTipo[p.tipoDettaglio] = (fatturatoPerTipo[p.tipoDettaglio] || 0) + imp;
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
    if (cv.cap_premio) premioStimato = Math.min(premioStimato, Number(cv.cap_premio));
  }
  if (cv.premio_manuale) premioStimato = Number(cv.premio_manuale);
  return { fatturatoTarget, fatturatoPerTipo, pct, raggiunto, premioStimato, target };
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
    target_individuale: cv.target_individuale ?? '', cap_premio: cv.cap_premio ?? '',
    premio_area_pct: cv.premio_area_pct ?? '', premio_manuale: cv.premio_manuale ?? '',
    premio_regole: cv.premio_regole || [],
  });
  const apriNuovo = () => { setSelected({ isNew: true }); setForm({ ...CANVASS_VUOTO }); };
  const chiudi = () => { setSelected(null); setForm(null); };

  const fx = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const addRegola = () => setForm(p => ({ ...p, premio_regole: [...(p.premio_regole || []), { tipo: '', pct: '' }] }));
  const updRegola = (i, k, v) => setForm(p => ({ ...p, premio_regole: p.premio_regole.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const delRegola = (i) => setForm(p => ({ ...p, premio_regole: p.premio_regole.filter((_, idx) => idx !== i) }));

  const salva = async () => {
    if (!form.nome.trim()) { showToast('Dai un nome al canvass', '', 'info'); return; }
    if (!form.data_inizio || !form.data_fine) { showToast('Inserisci le date di inizio e fine', '', 'info'); return; }
    setSaving(true);
    const payload = {
      ...(selected.isNew ? {} : { id: selected.id }),
      nome: form.nome.trim(), linea_prodotto: form.linea_prodotto || null,
      data_inizio: form.data_inizio, data_fine: form.data_fine,
      tipi_target: form.tipi_target, tipi_premio: form.tipi_premio,
      target_individuale: Number(form.target_individuale) || 0,
      premio_regole: form.premio_regole.filter(r => r.tipo && r.pct !== ''),
      cap_premio: form.cap_premio === '' ? null : Number(form.cap_premio),
      premio_area_pct: form.premio_area_pct === '' ? null : Number(form.premio_area_pct),
      note: form.note || null, stato: form.stato || 'attivo',
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
                {selected.linea_prodotto && ` · ${selected.linea_prodotto}`}
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
              <label className="form-label">Linea di prodotto (categoria)</label>
              <select className="form-control" value={form.linea_prodotto} onChange={e => fx('linea_prodotto', e.target.value)}>
                <option value="">— qualsiasi —</option>
                {PRODOTTI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target individuale (€)</label>
              <input className="form-control" type="number" value={form.target_individuale} onChange={e => fx('target_individuale', e.target.value)} placeholder="Il valore già calcolato, soglia minima inclusa se prevista" />
            </div>

            <div className="form-group">
              <label className="form-label">Tipi che contano per il target</label>
              <TagInput value={form.tipi_target} onChange={v => fx('tipi_target', v)} placeholder="Es. Abbonamento, One Shot, Su commessa... Invio per aggiungere" />
            </div>
            <div className="form-group">
              <label className="form-label">Tipi che contano per il premio (di solito un sottoinsieme)</label>
              <TagInput value={form.tipi_premio} onChange={v => fx('tipi_premio', v)} placeholder="Es. Abbonamento, Laboratorio... Invio per aggiungere" />
            </div>

            <div className="card-title" style={{ marginTop: 14, marginBottom: 8 }}>Regole premio (% per tipo)</div>
            {form.premio_regole.length === 0 && <div className="fs-12 text-muted" style={{ marginBottom: 8 }}>Nessuna regola — il premio stimato resterà €0</div>}
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
