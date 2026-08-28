import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { CATEGORIE, DEFAULT_BRAND, fmtDT } from '../constants';
import { dbLoadLeads, dbUpdateLead } from '../supabase';
Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend);

const BLU = '#0078D4';

export const ESITI_CHIAMATA = [
  { name: 'Non risponde',         icon: '📵', color: '#E07B1A', tipo: 'semplice' },
  { name: 'Richiamare',           icon: '🔄', color: '#4DA6E8', tipo: 'richiamo' },
  { name: 'Non interessato',      icon: '❌', color: '#A32D2D', tipo: 'noninteressato' },
  { name: 'Appuntamento fissato', icon: '✅', color: '#1B7A3E', tipo: 'appuntamento' },
  { name: 'Numero errato',        icon: '🚫', color: '#888888', tipo: 'semplice' },
  { name: 'Da non richiamare',    icon: '⛔', color: '#5A6B7E', tipo: 'semplice' },
  { name: 'Già cliente',          icon: '💼', color: '#2E7D32', tipo: 'semplice' },
];

export default function OperatorView({ profile, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fCategoria, setFCategoria] = useState('');
  const [fLista, setFLista] = useState('');
  const [selected, setSelected] = useState(null);
  const [esitoOpen, setEsitoOpen] = useState(null); // esito in compilazione
  const [nota, setNota] = useState('');
  const [dataRichiamo, setDataRichiamo] = useState('');
  const [ricontatto, setRicontatto] = useState('6m'); // 6m / 12m / mai
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const chartRef = useRef(); const chartC = useRef();

  const today = new Date().toISOString().slice(0, 10);

  // Tema: la postazione nasce blu, indipendente dal localStorage del browser
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', BLU);
    document.title = 'SalesPRO — Telemarketing';
  }, []);

  const load = useCallback(async () => {
    const data = await dbLoadLeads();
    if (data === null) { setToast({ msg: 'Errore di caricamento. Riprova o avvisa Marco.', type: 'err' }); setLeads([]); }
    else setLeads(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // ── Code di lavoro ─────────────────────────────────────────
  const matchFiltri = l =>
    (!fCategoria || l.categoria === fCategoria) &&
    (!fLista || l.lista === fLista);

  const richiami = leads.filter(l => l.stato === 'Richiamare' && l.data_richiamo && l.data_richiamo <= today && matchFiltri(l));
  const riconatti = leads.filter(l => l.stato === 'Non interessato' && l.non_interessato_fino_a && l.non_interessato_fino_a <= today && matchFiltri(l));
  const daChiamare = leads.filter(l => (l.stato === 'Da chiamare' || l.stato === 'Non risponde') && matchFiltri(l));
  const richiamiFuturi = leads.filter(l => l.stato === 'Richiamare' && (!l.data_richiamo || l.data_richiamo > today) && matchFiltri(l));

  const liste = [...new Set(leads.map(l => l.lista).filter(Boolean))].sort();
  const categoriePresenti = CATEGORIE.filter(c => leads.some(l => l.categoria === c));

  // ── Contatori del giorno ───────────────────────────────────
  const esitiOggi = leads.reduce((n, l) => n + (l.note_storia || []).filter(h => (h.date || '').slice(0, 10) === today).length, 0);
  const apptOggi = leads.reduce((n, l) => n + (l.note_storia || []).filter(h => (h.date || '').slice(0, 10) === today && h.esito === 'Appuntamento fissato').length, 0);

  // ── Grafico: chiamate ultimi 5 giorni lavorativi ───────────
  useEffect(() => {
    const giorni = []; const d = new Date();
    while (giorni.length < 5) { if (d.getDay() !== 0 && d.getDay() !== 6) giorni.unshift(d.toISOString().slice(0, 10)); d.setDate(d.getDate() - 1); }
    const chiamate = giorni.map(g => leads.reduce((n, l) => n + (l.note_storia || []).filter(h => (h.date || '').slice(0, 10) === g).length, 0));
    const appt = giorni.map(g => leads.reduce((n, l) => n + (l.note_storia || []).filter(h => (h.date || '').slice(0, 10) === g && h.esito === 'Appuntamento fissato').length, 0));
    const labels = giorni.map(g => new Date(g + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }));
    if (chartRef.current) {
      chartC.current?.destroy();
      chartC.current = new Chart(chartRef.current, { type: 'bar', data: { labels, datasets: [
        { label: 'Chiamate', data: chiamate, backgroundColor: '#89C4F4', borderRadius: 4 },
        { label: 'Appuntamenti', data: appt, backgroundColor: '#0050A0', borderRadius: 4 },
      ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { ticks: { stepSize: 1 }, grid: { color: 'rgba(0,120,212,0.06)' } } } } });
    }
    return () => chartC.current?.destroy();
  }, [leads]);

  // ── Registrazione esito ────────────────────────────────────
  const apriEsito = (esito) => {
    setEsitoOpen(esito); setNota(''); setDataRichiamo(''); setRicontatto('6m');
  };

  const registraEsito = async () => {
    if (!selected || !esitoOpen || saving) return;
    const e = esitoOpen;
    if (e.tipo === 'richiamo' && !dataRichiamo) { showToast('Indica la data di richiamo', 'err'); return; }
    setSaving(true);
    const nowIso = new Date().toISOString();
    const entry = { id: Date.now().toString(36), date: nowIso, esito: e.name, testo: nota.trim() };
    const fields = {
      stato: e.name === 'Non risponde' ? 'Non risponde' : e.name,
      tentativi: (selected.tentativi || 0) + 1,
      ultimo_contatto: nowIso,
      note_storia: [...(selected.note_storia || []), entry],
      data_richiamo: e.tipo === 'richiamo' ? dataRichiamo : null,
      non_interessato_fino_a: null,
    };
    if (e.tipo === 'noninteressato') {
      if (ricontatto !== 'mai') {
        const d = new Date(); d.setMonth(d.getMonth() + (ricontatto === '6m' ? 6 : 12));
        fields.non_interessato_fino_a = d.toISOString().slice(0, 10);
      }
    }
    const ok = await dbUpdateLead(selected.id, fields);
    setSaving(false);
    if (!ok) { showToast('Salvataggio non riuscito. Riprova.', 'err'); return; }
    setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, ...fields } : l));
    setSelected(null); setEsitoOpen(null);
    showToast(e.name === 'Appuntamento fissato' ? '🎉 Appuntamento registrato!' : `Esito registrato: ${e.name}`);
  };

  // ── Componenti interni ─────────────────────────────────────
  const RigaLead = ({ l, evidenzia }) => (
    <div onClick={() => { setSelected(l); setEsitoOpen(null); }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--r)', cursor: 'pointer', marginBottom: 6,
        background: evidenzia ? '#FDF3E7' : 'var(--bg2, #fff)', border: `1px solid ${evidenzia ? '#E07B1A' : 'var(--border, #e3e6ea)'}` }}>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.azienda || l.nome || '—'}</div>
        <div className="text-muted fs-12" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome && l.azienda ? l.nome + ' · ' : ''}{l.categoria || ''}{l.citta ? ' · ' + l.citta : ''}</div>
      </div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: BLU }}>{l.telefono || '—'}</div>
      <div className="fs-12 text-muted" style={{ width: 90, textAlign: 'right' }}>
        {evidenzia ? <span style={{ color: '#E07B1A', fontWeight: 700 }}>{l.stato === 'Richiamare' ? '🔄 Richiamo' : '📅 Ricontatto'}</span>
          : (l.tentativi > 0 ? `${l.tentativi} tentativ${l.tentativi === 1 ? 'o' : 'i'}` : 'mai chiamato')}
      </div>
    </div>
  );

  const Sezione = ({ titolo, items, evidenzia, vuoto }) => (
    <div className="card">
      <div className="card-title">{titolo} {items.length > 0 && <span style={{ color: BLU }}>({items.length})</span>}</div>
      {items.length === 0 ? <div className="empty" style={{ padding: '10px 0' }}>{vuoto}</div>
        : items.map(l => <RigaLead key={l.id} l={l} evidenzia={evidenzia} />)}
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #f0efe9', borderTop: `3px solid ${BLU}`, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 40px', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Intestazione */}
      <div style={{ background: BLU, color: 'white', borderRadius: '0 0 14px 14px', padding: '18px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Ciao {profile?.nome || ''} 👋</div>
          <div style={{ fontSize: 12, opacity: .85 }}>{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,.15)', color: 'white', border: '1px solid rgba(255,255,255,.4)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Esci</button>
      </div>

      {/* Contatori del giorno */}
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        <div className="metric-card"><div className="metric-label">Chiamate oggi</div><div className="metric-value" style={{ color: BLU }}>{esitiOggi}</div><div className="metric-sub">esiti registrati</div></div>
        <div className="metric-card"><div className="metric-label">Appuntamenti oggi</div><div className="metric-value" style={{ color: '#1B7A3E' }}>{apptOggi}</div><div className="metric-sub">fissati 🎯</div></div>
        <div className="metric-card"><div className="metric-label">In coda</div><div className="metric-value">{daChiamare.length + richiami.length + riconatti.length}</div><div className="metric-sub">da lavorare</div></div>
      </div>

      {/* Grafico settimana */}
      <div className="card">
        <div className="card-title">La tua settimana</div>
        <div style={{ height: 160, position: 'relative' }}><canvas ref={chartRef} /></div>
      </div>

      {/* Filtri */}
      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="fs-12 text-muted" style={{ fontWeight: 700 }}>Filtra:</span>
        <select className="form-control" style={{ width: 220, fontSize: 13 }} value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {categoriePresenti.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-control" style={{ width: 220, fontSize: 13 }} value={fLista} onChange={e => setFLista(e.target.value)}>
          <option value="">Tutte le liste</option>
          {liste.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {(fCategoria || fLista) && <button className="btn btn-sm" onClick={() => { setFCategoria(''); setFLista(''); }}>✕ Azzera</button>}
      </div>

      {/* Code di lavoro */}
      {richiami.length > 0 && <Sezione titolo="🔄 Richiami di oggi" items={richiami} evidenzia vuoto="" />}
      {riconatti.length > 0 && <Sezione titolo="📅 Da ricontattare (erano non interessati)" items={riconatti} evidenzia vuoto="" />}
      <Sezione titolo="📞 Da chiamare" items={daChiamare} vuoto="Nessun lead in coda con questi filtri 🎉" />
      {richiamiFuturi.length > 0 && <Sezione titolo="⏳ Richiami programmati (prossimi giorni)" items={richiamiFuturi} vuoto="" />}

      {/* Scheda chiamata */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setSelected(null); setEsitoOpen(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{selected.azienda || selected.nome || '—'}</div>
                <div className="text-muted fs-12">{selected.nome && selected.azienda ? selected.nome + ' · ' : ''}{selected.categoria || ''}{selected.citta ? ' · ' + selected.citta : ''}{selected.provincia ? ' (' + selected.provincia + ')' : ''}</div>
              </div>
              <button className="btn btn-sm" onClick={() => { setSelected(null); setEsitoOpen(null); }}>✕</button>
            </div>

            <a href={'tel:' + (selected.telefono || '').replace(/\s/g, '')} style={{ display: 'block', textAlign: 'center', background: BLU, color: 'white', borderRadius: 10, padding: '14px 10px', fontSize: 24, fontWeight: 700, textDecoration: 'none', margin: '14px 0' }}>
              📞 {selected.telefono || 'Nessun numero'}
            </a>
            {selected.email && <div className="fs-12 text-muted" style={{ textAlign: 'center', marginBottom: 10 }}>✉ {selected.email}</div>}
            <div className="fs-12 text-muted" style={{ textAlign: 'center', marginBottom: 14 }}>
              Lista: <strong>{selected.lista || '—'}</strong> · Tentativi: <strong>{selected.tentativi || 0}</strong>{selected.ultimo_contatto ? <> · Ultimo: <strong>{fmtDT(selected.ultimo_contatto)}</strong></> : null}
            </div>

            {/* Esiti */}
            {!esitoOpen ? (
              <>
                <div className="card-title" style={{ marginBottom: 8 }}>Com'è andata la chiamata?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
                  {ESITI_CHIAMATA.map(e => (
                    <button key={e.name} onClick={() => apriEsito(e)}
                      style={{ background: e.color + '15', border: `1.5px solid ${e.color}`, color: e.color, borderRadius: 10, padding: '12px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {e.icon} {e.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ background: esitoOpen.color + '0d', border: `1px solid ${esitoOpen.color}55`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, color: esitoOpen.color, marginBottom: 10 }}>{esitoOpen.icon} {esitoOpen.name}</div>

                {esitoOpen.tipo === 'richiamo' && (
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Quando richiamare? *</label>
                    <input type="date" className="form-control" min={today} value={dataRichiamo} onChange={e => setDataRichiamo(e.target.value)} />
                  </div>
                )}

                {esitoOpen.tipo === 'noninteressato' && (
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Ricontattabile tra:</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['6m', '6 mesi'], ['12m', '12 mesi'], ['mai', 'Mai più']].map(([v, lab]) => (
                        <button key={v} onClick={() => setRicontatto(v)}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${ricontatto === v ? BLU : 'var(--border,#dde)'}`, background: ricontatto === v ? BLU + '15' : 'white', color: ricontatto === v ? BLU : 'inherit' }}>
                          {lab}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {esitoOpen.tipo === 'appuntamento' && (
                  <div style={{ background: '#1B7A3E15', border: '1px solid #1B7A3E55', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>
                    🎯 Ricorda di inviare il link per la prenotazione:<br />
                    <a href={DEFAULT_BRAND.callink} target="_blank" rel="noreferrer" style={{ color: '#1B7A3E', fontWeight: 700, fontSize: 12, wordBreak: 'break-all' }}>{DEFAULT_BRAND.callink}</a>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Nota {esitoOpen.tipo === 'noninteressato' ? '(motivo, prodotto concorrente, scadenze...)' : '(facoltativa)'}</label>
                  <textarea className="form-control" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Es. richiamare dopo le 15, chiedere del titolare..." />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setEsitoOpen(null)} disabled={saving}>← Indietro</button>
                  <button className="btn btn-primary" onClick={registraEsito} disabled={saving}>{saving ? '⏳ Salvataggio...' : 'Registra esito'}</button>
                </div>
              </div>
            )}

            {/* Storico */}
            {(selected.note_storia || []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>Storico</div>
                {[...selected.note_storia].reverse().map(h => {
                  const e = ESITI_CHIAMATA.find(x => x.name === h.esito);
                  return (
                    <div key={h.id} style={{ borderLeft: `3px solid ${e?.color || BLU}`, padding: '4px 10px', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: e?.color || 'inherit' }}>{e?.icon || '📝'} {h.esito || 'Nota'} <span className="text-muted" style={{ fontWeight: 400 }}>— {fmtDT(h.date)}</span></div>
                      {h.testo && <div style={{ fontSize: 13 }}>{h.testo}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'err' ? '#A32D2D' : '#1B7A3E', color: 'white', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 100, boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
