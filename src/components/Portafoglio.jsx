import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIE, fmtDT } from '../constants';
import { dbLoadLeads, dbUpdateLead, dbInsertLeads, dbDeleteLeads } from '../supabase';

const CAMPO_VUOTO = {
  azienda: '', nome: '', telefono: '', cellulare: '', email: '', categoria: '', citta: '', provincia: '',
  codice_cliente_sap: '', stato_amministrativo: '', prossima_scadenza: '', prodotti_attivi: [], nota_libera: '',
};

const OPZIONI_ORDINE = [
  { v: 'scadenza', l: 'Prossima scadenza' },
  { v: 'valore_desc', l: 'Valore cliente (dal più alto)' },
  { v: 'azienda', l: 'Azienda (A-Z)' },
];

export default function Portafoglio({ showToast }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fProdotto, setFProdotto] = useState('');
  const [fScadenza, setFScadenza] = useState('');
  const [fLista, setFLista] = useState('');
  const [mostraUsciti, setMostraUsciti] = useState(false);
  const [ordine, setOrdine] = useState('scadenza');
  const [selected, setSelected] = useState(null); // lead in modifica, oppure {isNew:true} per la creazione
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => dbLoadLeads().then(data => {
    setLeads((data || []).filter(l => l.codice_cliente_sap || l.lista === 'Portafoglio'));
    setLoading(false);
  });
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);

  const prodottiUnici = useMemo(() => {
    const set = new Set();
    leads.forEach(l => (l.prodotti_attivi || []).forEach(p => p?.nome && set.add(p.nome)));
    return [...set].sort((a, b) => a.localeCompare(b, 'it'));
  }, [leads]);

  const listeUniche = useMemo(() => {
    const set = new Set();
    leads.forEach(l => l.lista && set.add(l.lista));
    return [...set].sort((a, b) => a.localeCompare(b, 'it'));
  }, [leads]);

  const filtered = useMemo(() => {
    let arr = leads.filter(l => {
      if (!mostraUsciti && l.portafoglio_uscito) return false;
      if (q && !((l.azienda || '') + (l.nome || '') + (l.telefono || '') + (l.cellulare || '') + (l.email || '')).toLowerCase().includes(q.toLowerCase())) return false;
      if (fProdotto && !(l.prodotti_attivi || []).some(p => p.nome === fProdotto)) return false;
      if (fLista && l.lista !== fLista) return false;
      if (fScadenza) {
        if (!l.prossima_scadenza) return false;
        const giorni = (new Date(l.prossima_scadenza) - new Date(today)) / (1000 * 60 * 60 * 24);
        if (giorni < 0 || giorni > Number(fScadenza)) return false;
      }
      return true;
    });
    if (ordine === 'valore_desc') arr = arr.sort((a, b) => (Number(b.valore_cliente) || 0) - (Number(a.valore_cliente) || 0));
    else if (ordine === 'azienda') arr = arr.sort((a, b) => (a.azienda || '').localeCompare(b.azienda || '', 'it'));
    else arr = arr.sort((a, b) => (a.prossima_scadenza || '9999-99-99').localeCompare(b.prossima_scadenza || '9999-99-99'));
    return arr;
  }, [leads, q, fProdotto, fScadenza, fLista, mostraUsciti, ordine, today]);

  const totValore = filtered.reduce((s, l) => s + (Number(l.valore_cliente) || 0), 0);
  const inScadenza60 = leads.filter(l => !l.portafoglio_uscito && l.prossima_scadenza && (new Date(l.prossima_scadenza) - new Date(today)) / 86400000 <= 60 && (new Date(l.prossima_scadenza) - new Date(today)) / 86400000 >= 0).length;
  const bloccati = leads.filter(l => !l.portafoglio_uscito && l.stato_amministrativo).length;
  const riattivabili = leads.filter(l => !l.portafoglio_uscito && (l.prodotti_attivi || []).length === 0).length;

  // ── Apertura scheda: modifica esistente o nuova ────────────
  const apriModifica = (l) => {
    setSelected(l);
    setForm({
      azienda: l.azienda || '', nome: l.nome || '', telefono: l.telefono || '', cellulare: l.cellulare || '', email: l.email || '',
      categoria: l.categoria || '', citta: l.citta || '', provincia: l.provincia || '',
      codice_cliente_sap: l.codice_cliente_sap || '', stato_amministrativo: l.stato_amministrativo || '',
      prossima_scadenza: l.prossima_scadenza || '', prodotti_attivi: l.prodotti_attivi || [],
      nota_libera: l.nota_libera || '',
    });
  };
  const apriNuovo = () => { setSelected({ isNew: true }); setForm({ ...CAMPO_VUOTO }); };
  const chiudi = () => { setSelected(null); setForm(null); };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const fProd = (i, k, v) => setForm(p => ({ ...p, prodotti_attivi: p.prodotti_attivi.map((pr, idx) => idx === i ? { ...pr, [k]: v } : pr) }));
  const fRimuoviProd = (i) => setForm(p => ({ ...p, prodotti_attivi: p.prodotti_attivi.filter((_, idx) => idx !== i) }));
  const fAggiungiProd = () => setForm(p => ({ ...p, prodotti_attivi: [...p.prodotti_attivi, { nome: '', importo: 0 }] }));
  const valoreForm = (form?.prodotti_attivi || []).reduce((s, p) => s + (Number(p.importo) || 0), 0);

  const salva = async () => {
    if (!form.azienda.trim()) { showToast('Inserisci almeno il nome azienda', '', 'info'); return; }
    setSaving(true);
    const fields = {
      azienda: form.azienda.trim() || null, nome: form.nome.trim() || null,
      telefono: form.telefono.trim() || null, cellulare: form.cellulare.trim() || null, email: form.email.trim() || null,
      categoria: form.categoria || null, citta: form.citta.trim() || null, provincia: form.provincia.trim() || null,
      codice_cliente_sap: form.codice_cliente_sap.trim() || null,
      stato_amministrativo: form.stato_amministrativo.trim() || null,
      prossima_scadenza: form.prossima_scadenza || null,
      prodotti_attivi: form.prodotti_attivi.filter(p => p.nome.trim()),
      valore_cliente: valoreForm,
      nota_libera: form.nota_libera.trim() || null,
    };
    if (selected.isNew) {
      const nuovo = {
        ...fields, stato: 'Da chiamare', lista: 'Portafoglio', fonte: 'Portafoglio', tentativi: 0,
        portafoglio_uscito: false,
        note_storia: [{ id: 'manuale-' + Date.now(), date: new Date().toISOString(), esito: 'Import', testo: 'Anagrafica inserita manualmente da Marco nella pagina Portafoglio.' }],
      };
      const ids = await dbInsertLeads([nuovo]);
      setSaving(false);
      if (ids === null) { showToast('Errore durante il salvataggio', '', 'info'); return; }
      showToast('Cliente aggiunto', fields.azienda);
    } else {
      const ok = await dbUpdateLead(selected.id, fields);
      setSaving(false);
      if (!ok) { showToast('Errore durante il salvataggio', '', 'info'); return; }
      showToast('Modifiche salvate', fields.azienda);
    }
    chiudi();
    load();
  };

  const elimina = async () => {
    if (!window.confirm(`Eliminare definitivamente ${selected.azienda || 'questo cliente'} dal portafoglio?`)) return;
    await dbDeleteLeads([selected.id]);
    chiudi();
    load();
    showToast('Cliente eliminato', '', 'info');
  };

  if (loading) return (
    <>
      <div className="topbar"><span className="page-title">Portafoglio</span></div>
      <div className="content"><div className="empty">Caricamento...</div></div>
    </>
  );

  return (
    <>
      <div className="topbar">
        <span className="page-title">Portafoglio <span className="text-muted fs-12">({filtered.length})</span></span>
        <button className="btn btn-primary" onClick={apriNuovo}>+ Nuovo cliente</button>
      </div>
      <div className="content">

        <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="metric-card"><div className="metric-label">Clienti</div><div className="metric-value">{filtered.length}</div></div>
          <div className="metric-card"><div className="metric-label">Valore complessivo</div><div className="metric-value" style={{ color: '#1B7A3E' }}>€{totValore.toLocaleString('it-IT')}</div></div>
          <div className="metric-card"><div className="metric-label">In scadenza (60gg)</div><div className="metric-value" style={{ color: '#E07B1A' }}>{inScadenza60}</div></div>
          <div className="metric-card"><div className="metric-label">Candidati riattivazione</div><div className="metric-value" style={{ color: '#7B68EE' }}>{riattivabili}</div></div>
          <div className="metric-card"><div className="metric-label">Bloccati / precontenzioso</div><div className="metric-value" style={{ color: bloccati > 0 ? '#A32D2D' : 'inherit' }}>{bloccati}</div></div>
        </div>

        <div className="search-bar">
          <input className="form-control" style={{ flex: 1, maxWidth: 240 }} placeholder="Cerca azienda, referente, telefono, email..." value={q} onChange={e => setQ(e.target.value)} />
          {prodottiUnici.length > 0 && (
            <select className="form-control" style={{ width: 200 }} value={fProdotto} onChange={e => setFProdotto(e.target.value)}>
              <option value="">Tutti i prodotti</option>
              {prodottiUnici.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <select className="form-control" style={{ width: 180 }} value={fScadenza} onChange={e => setFScadenza(e.target.value)}>
            <option value="">Qualsiasi scadenza</option>
            <option value="30">In scadenza entro 30gg</option>
            <option value="60">In scadenza entro 60gg</option>
            <option value="90">In scadenza entro 90gg</option>
          </select>
          {listeUniche.length > 1 && (
            <select className="form-control" style={{ width: 190 }} value={fLista} onChange={e => setFLista(e.target.value)}>
              <option value="">Tutte le campagne</option>
              {listeUniche.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          <select className="form-control" style={{ width: 200 }} value={ordine} onChange={e => setOrdine(e.target.value)}>
            {OPZIONI_ORDINE.map(o => <option key={o.v} value={o.v}>Ordina: {o.l}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={mostraUsciti} onChange={e => setMostraUsciti(e.target.checked)} /> Mostra usciti
          </label>
        </div>

        <div className="table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Azienda / Referente</th><th>Telefono / Cellulare</th><th>Prodotti attivi</th>
                <th>Valore</th><th>Prossima scadenza</th><th>Stato amm.vo</th><th>Ultima attività</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} className="empty">Nessun cliente con questi filtri</td></tr> : filtered.map(l => {
                const giorni = l.prossima_scadenza ? (new Date(l.prossima_scadenza) - new Date(today)) / 86400000 : null;
                const scadenzaVicina = giorni !== null && giorni <= 60 && giorni >= 0;
                const ultimaAttivita = (l.note_storia || []).slice(-1)[0];
                const senzaProdotti = (l.prodotti_attivi || []).length === 0;
                return (
                  <tr key={l.id} onClick={() => apriModifica(l)} style={{ cursor: 'pointer', ...(l.portafoglio_uscito ? { opacity: .55 } : {}) }}>
                    <td>
                      <span className="fw-600">{l.azienda || '—'}</span>
                      {l.nome && <div className="fs-11 text-muted">{l.nome}</div>}
                      {l.portafoglio_uscito && <div className="fs-11" style={{ color: '#A32D2D', fontWeight: 600 }}>📤 Uscito dal portafoglio</div>}
                    </td>
                    <td className="fs-12">
                      {l.telefono || '—'}
                      {l.cellulare && <div className="fs-11" style={{ color: '#0078D4' }}>📱 {l.cellulare}</div>}
                    </td>
                    <td>
                      {senzaProdotti ? (
                        <span style={{ background: '#7B68EE18', color: '#7B68EE', borderRadius: 10, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>🔄 Candidato riattivazione</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 260 }}>
                          {l.prodotti_attivi.slice(0, 4).map((p, i) => (
                            <span key={i} title={p.importo ? `€${Number(p.importo).toLocaleString('it-IT')}` : ''} style={{ background: 'var(--accent-lt)', color: 'var(--accent-dk)', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.nome}</span>
                          ))}
                          {l.prodotti_attivi.length > 4 && <span className="fs-11 text-muted" style={{ fontWeight: 700 }}>+{l.prodotti_attivi.length - 4}</span>}
                        </div>
                      )}
                    </td>
                    <td className="fs-12">{l.valore_cliente ? <span style={{ fontWeight: 600, color: '#185FA5' }}>€{Number(l.valore_cliente).toLocaleString('it-IT')}</span> : '—'}</td>
                    <td className="fs-12" style={scadenzaVicina ? { color: '#E07B1A', fontWeight: 700 } : {}}>
                      {l.prossima_scadenza ? new Date(l.prossima_scadenza + 'T12:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      {l.stato_amministrativo
                        ? <span style={{ background: '#A32D2D18', color: '#A32D2D', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>⚠ {l.stato_amministrativo}</span>
                        : <span className="text-muted fs-12">—</span>}
                    </td>
                    <td className="fs-11" style={{ maxWidth: 200 }}>
                      {ultimaAttivita ? (
                        <>
                          <div className="text-muted">{fmtDT(ultimaAttivita.date)}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ultimaAttivita.esito}{ultimaAttivita.testo ? `: ${ultimaAttivita.testo}` : ''}</div>
                        </>
                      ) : <span className="text-muted">Mai lavorato</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SCHEDA / MODIFICA / NUOVO CLIENTE ── */}
      {selected && form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={chiudi}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.isNew ? '+ Nuovo cliente' : (form.azienda || 'Modifica cliente')}</div>
              <button className="btn btn-sm" onClick={chiudi}>✕</button>
            </div>

            <div className="card-title" style={{ marginBottom: 8 }}>Anagrafica</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Azienda *</label><input className="form-control" value={form.azienda} onChange={e => f('azienda', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Referente</label><input className="form-control" value={form.nome} onChange={e => f('nome', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Telefono</label><input className="form-control" value={form.telefono} onChange={e => f('telefono', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Cellulare</label><input className="form-control" value={form.cellulare} onChange={e => f('cellulare', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={form.email} onChange={e => f('email', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Categoria</label>
                <select className="form-control" value={form.categoria} onChange={e => f('categoria', e.target.value)}>
                  <option value="">— nessuna —</option>
                  {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Città</label><input className="form-control" value={form.citta} onChange={e => f('citta', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Provincia</label><input className="form-control" value={form.provincia} onChange={e => f('provincia', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Codice Cliente SAP</label><input className="form-control" value={form.codice_cliente_sap} onChange={e => f('codice_cliente_sap', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Prossima scadenza</label><input className="form-control" type="date" value={form.prossima_scadenza} onChange={e => f('prossima_scadenza', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Stato amministrativo</label><input className="form-control" placeholder="Es. Bloccato Sole, Precontenzioso..." value={form.stato_amministrativo} onChange={e => f('stato_amministrativo', e.target.value)} /></div>

            <div className="card-title" style={{ marginTop: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              Prodotti attivi
              <span className="text-muted" style={{ fontWeight: 400, fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>— valore totale: <strong style={{ color: '#1B7A3E' }}>€{valoreForm.toLocaleString('it-IT')}</strong></span>
            </div>
            {form.prodotti_attivi.length === 0 && <div className="fs-12 text-muted" style={{ marginBottom: 8 }}>Nessun prodotto</div>}
            {form.prodotti_attivi.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <input className="form-control" style={{ flex: 2 }} placeholder="Nome prodotto" value={p.nome} onChange={e => fProd(i, 'nome', e.target.value)} />
                <input className="form-control" style={{ flex: 1 }} type="number" placeholder="€ annuo" value={p.importo} onChange={e => fProd(i, 'importo', Number(e.target.value) || 0)} />
                <button className="btn btn-sm btn-danger" onClick={() => fRimuoviProd(i)}>×</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={fAggiungiProd} style={{ marginBottom: 14 }}>+ Aggiungi prodotto</button>

            {!selected.isNew && (selected.note_istruzioni || []).length > 0 && (
              <>
                <div className="card-title" style={{ marginTop: 14, marginBottom: 8 }}>Istruzioni date a Rosanna (storico)</div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 14 }}>
                  {[...selected.note_istruzioni].reverse().map(n => (
                    <div key={n.id} style={{ fontSize: 12.5, marginBottom: 6 }}>
                      <span className="text-muted">{fmtDT(n.date)}:</span> {n.testo}
                    </div>
                  ))}
                </div>
              </>
            )}

            {!selected.isNew && (
              <>
                <div className="card-title" style={{ marginTop: 14, marginBottom: 8 }}>Attività svolta {(selected.note_storia || []).length > 0 && `(${selected.note_storia.length})`}</div>
                {(selected.note_storia || []).length === 0 ? (
                  <div className="fs-12 text-muted" style={{ marginBottom: 14 }}>Nessuna attività registrata finora.</div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
                    {[...selected.note_storia].reverse().map(h => (
                      <div key={h.id} style={{ borderLeft: '3px solid var(--accent)', padding: '4px 10px', marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{h.esito || 'Nota'} <span className="text-muted" style={{ fontWeight: 400 }}>— {fmtDT(h.date)}</span></div>
                        {h.testo && <div style={{ fontSize: 13 }}>{h.testo}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label className="form-label">📝 Nota libera <span className="text-muted" style={{ fontWeight: 400 }}>(modificabile anche da Rosanna)</span></label>
              <textarea className="form-control" style={{ minHeight: 70 }} value={form.nota_libera} onChange={e => f('nota_libera', e.target.value)} placeholder="Osservazioni sempre aggiornabili su questo cliente." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              {!selected.isNew ? <button className="btn" style={{ color: '#A32D2D', borderColor: '#A32D2D55' }} onClick={elimina}>🗑 Elimina</button> : <span />}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={chiudi} disabled={saving}>Annulla</button>
                <button className="btn btn-primary" onClick={salva} disabled={saving}>{saving ? '⏳ Salvataggio...' : 'Salva'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
