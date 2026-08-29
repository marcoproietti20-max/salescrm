import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, ArcElement, DoughnutController, LineController, LineElement, PointElement, BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { FONTI, CATEGORIE, fmtDT } from '../constants';
import { dbLoadLeads, dbInsertLeads, dbUpdateLead, dbDeleteLeads, normPhone, supabase, dbLoadImportBatches, dbCreateImportBatch, dbUndoImportBatch } from '../supabase';
import { ESITI_CHIAMATA } from './OperatorView';
Chart.register(ArcElement, DoughnutController, LineController, LineElement, PointElement, BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend);

const CAMPI_LEAD = [
  { key: 'azienda',   label: 'Azienda / Studio', kw: ['azienda', 'ragione', 'studio', 'denominaz', 'societ', 'ditta'] },
  { key: 'nome',      label: 'Referente',        kw: ['referente', 'nome', 'contatto', 'titolare'] },
  { key: 'telefono',  label: 'Telefono',         kw: ['tel', 'cell', 'phone'] },
  { key: 'telefono2', label: 'Telefono 2',       kw: ['telefono2', 'telefono 2', 'tel2', 'tel 2', 'cellulare'] },
  { key: 'telefono3', label: 'Telefono 3',       kw: ['telefono3', 'telefono 3', 'tel3', 'tel 3'] },
  { key: 'email',     label: 'Email',            kw: ['mail', 'pec'] },
  { key: 'categoria', label: 'Categoria',        kw: ['categoria', 'tipolog', 'professione', 'attivit'] },
  { key: 'citta',     label: 'Città',            kw: ['citt', 'comune', 'localit', 'city'] },
  { key: 'provincia', label: 'Provincia',        kw: ['prov', 'pr.'] },
  // Campi avanzati — solo per file già lavorati (storico, esiti). Lasciali vuoti per una lista grezza mai chiamata.
  { key: 'stato',        label: 'Stato (avanzato)',            kw: ['stato'], avanzato: true },
  { key: 'tentativi',    label: 'Tentativi (avanzato)',         kw: ['tentativi'], avanzato: true },
  { key: 'data_richiamo', label: 'Data richiamo (avanzato)',    kw: ['data_richiamo', 'data richiamo'], avanzato: true },
  { key: 'non_interessato_fino_a', label: 'Ricontattabile dal (avanzato)', kw: ['non_interessato', 'ricontattabile'], avanzato: true },
  { key: 'ultimo_contatto', label: 'Ultimo contatto (avanzato)', kw: ['ultimo_contatto', 'ultimo contatto'], avanzato: true },
  { key: 'note_storia',  label: 'Storico chiamate (avanzato)',  kw: ['note_storia', 'storico'], avanzato: true },
];

const STATO_COLORS = { 'Da chiamare': '#0078D4', ...Object.fromEntries(ESITI_CHIAMATA.map(e => [e.name, e.color])) };
// Voci "di servizio" nello storico (import, riattivazione, storico ordini) NON sono chiamate vere: vanno sempre escluse dai conteggi
const ESITI_VALIDI = new Set(ESITI_CHIAMATA.map(e => e.name));

export default function Telemarketing({ contacts, showToast }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  // Import
  const [fileRows, setFileRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState({});
  const [nomeLista, setNomeLista] = useState('');
  const [fonteDefault, setFonteDefault] = useState('Telemarketing Rosanna');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [report, setReport] = useState(null);
  const [batches, setBatches] = useState([]);
  const fileRef = useRef();
  // Vista lead
  const [fStato, setFStato] = useState('');
  const [fLista, setFLista] = useState('');
  const [fCategoria, setFCategoria] = useState('');
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [bulkProgress, setBulkProgress] = useState(null);
  const [listaDaEliminare, setListaDaEliminare] = useState('');
  const chartRef = useRef(); const chartC = useRef();
  const trendRef = useRef(); const trendC = useRef();
  const catRef = useRef(); const catC = useRef();
  const catTrendRef = useRef(); const catTrendC = useRef();
  const qualRef = useRef(); const qualC = useRef();
  const [apptStats, setApptStats] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const data = await dbLoadLeads();
    setLeads(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    dbLoadImportBatches().then(b => setBatches(b || []));
  }, []);

  useEffect(() => {
    supabase.rpc('get_appuntamenti_stats').then(({ data, error }) => {
      if (error) { console.error('get_appuntamenti_stats:', error); setApptStats([]); }
      else setApptStats(data || []);
    });
  }, []);

  // ── Lettura file ───────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setReport(null);
    try {
      let rows = [];
      if (file.name.endsWith('.csv')) {
        const Papa = await import('papaparse');
        const text = await file.text();
        let r = Papa.default.parse(text, { header: true, skipEmptyLines: true, delimiter: ',' });
        rows = r.data;
        if (rows.length === 0 || Object.keys(rows[0]).length <= 1) {
          r = Papa.default.parse(text, { header: true, skipEmptyLines: true, delimiter: ';' });
          rows = r.data;
        }
      } else {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      }
      if (!rows.length) { showToast('File vuoto o non leggibile', '', 'info'); return; }
      const cols = Object.keys(rows[0]);
      // Auto-riconoscimento colonne
      const autoMap = {};
      CAMPI_LEAD.forEach(f => {
        const hit = cols.find(c => f.kw.some(k => c.toLowerCase().includes(k)));
        if (hit && !Object.values(autoMap).includes(hit)) autoMap[f.key] = hit;
      });
      setFileRows(rows); setFileName(file.name); setMapping(autoMap);
      setNomeLista(file.name.replace(/\.(csv|xlsx|xls)$/i, ''));
    } catch (err) { showToast('Errore lettura file', err.message, 'info'); }
    e.target.value = '';
  };

  // ── Template di mappatura ──────────────────────────────────
  const templates = JSON.parse(localStorage.getItem('crm_tmk_templates') || '{}');
  const salvaTemplate = () => {
    const n = prompt('Nome del template (es. "Formato Sole24Ore"):');
    if (!n) return;
    const t = { ...templates, [n]: mapping };
    localStorage.setItem('crm_tmk_templates', JSON.stringify(t));
    showToast('Template salvato', n);
  };

  // ── Import con deduplica ───────────────────────────────────
  const g = (row, key) => mapping[key] ? String(row[mapping[key]] ?? '').trim() : '';

  const VALID_STATI = new Set(['Da chiamare', ...ESITI_CHIAMATA.map(e => e.name)]);
  const parseDataSicura = (v) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 16) : null);
  const parseStorico = (v, fallbackStato, oggi) => {
    if (v) {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* non era JSON valido: lo trattiamo come nota unica sotto */ }
      return [{ id: 'imp-' + Math.random().toString(36).slice(2, 8), date: oggi, esito: 'Import', testo: String(v) }];
    }
    return [];
  };

  const doImport = async () => {
    if (!fileRows || importing) return;
    if (!nomeLista.trim()) { showToast('Dai un nome alla lista', '', 'info'); return; }
    if (!mapping.telefono && !mapping.email) { showToast('Mappa almeno Telefono o Email', 'Servono per la deduplica', 'info'); return; }
    setImporting(true);
    setImportProgress({ fase: 'elaborazione', done: 0, total: fileRows.length });

    try {
      // Indici esistenti
      const leadByPhone = {}, leadByEmail = {};
      leads.forEach(l => {
        if (l.telefono_norm) leadByPhone[l.telefono_norm] = l;
        if (l.email) leadByEmail[l.email.toLowerCase()] = l;
      });
      const contactPhones = new Set(), contactEmails = new Set();
      (contacts || []).forEach(c => {
        const p = normPhone(c.telefono); if (p) contactPhones.add(p);
        if (c.email) contactEmails.add(c.email.toLowerCase());
      });

      const r = { totale: fileRows.length, importati: 0, riattivati: 0, giaLavorati: 0, inLavorazione: 0, appFissati: 0, giaClienti: 0, giaContatti: 0, dupFile: 0, senzaRecapiti: 0 };
      const toInsert = [];
      const seenPhone = new Set(), seenEmail = new Set();
      const riattivazioni = [];

      // Elaborazione a blocchi: lascia respirare il browser ogni 1000 righe, così l'interfaccia resta viva e la barra avanza davvero
      const CHUNK = 1000;
      for (let start = 0; start < fileRows.length; start += CHUNK) {
        const slice = fileRows.slice(start, start + CHUNK);
        for (const row of slice) {
          const tel = g(row, 'telefono'); const telN = normPhone(tel);
          const em = g(row, 'email').toLowerCase();
          if (!telN && !em) { r.senzaRecapiti++; continue; }
          if ((telN && seenPhone.has(telN)) || (em && seenEmail.has(em))) { r.dupFile++; continue; }
          if (telN) seenPhone.add(telN); if (em) seenEmail.add(em);
          if ((telN && contactPhones.has(telN)) || (em && contactEmails.has(em))) { r.giaContatti++; continue; }
          const ex = (telN && leadByPhone[telN]) || (em && leadByEmail[em]) || null;
          if (ex) {
            if (ex.stato === 'Non interessato') {
              if (ex.non_interessato_fino_a && ex.non_interessato_fino_a <= today) { riattivazioni.push(ex); r.riattivati++; }
              else r.giaLavorati++;
            }
            else if (ex.stato === 'Numero errato' || ex.stato === 'Da non richiamare') r.giaLavorati++;
            else if (ex.stato === 'Già cliente') r.giaClienti++;
            else if (ex.stato === 'Appuntamento fissato') r.appFissati++;
            else r.inLavorazione++;
            continue;
          }
          const statoFile = g(row, 'stato');
          const statoFinale = VALID_STATI.has(statoFile) ? statoFile : 'Da chiamare';
          const tentativiFile = parseInt(g(row, 'tentativi'), 10);
          const oggiIso = new Date().toISOString();
          toInsert.push({
            nome: g(row, 'nome') || null, azienda: g(row, 'azienda') || null,
            telefono: tel || null, telefono_norm: telN || null,
            telefono2: g(row, 'telefono2') || null, telefono3: g(row, 'telefono3') || null,
            email: em || null,
            categoria: g(row, 'categoria') || null, citta: g(row, 'citta') || null, provincia: g(row, 'provincia') || null,
            stato: statoFinale, lista: nomeLista.trim(), fonte: fonteDefault,
            tentativi: Number.isFinite(tentativiFile) ? tentativiFile : 0,
            data_richiamo: statoFinale === 'Richiamare' ? (parseDataSicura(g(row, 'data_richiamo')) || null) : null,
            non_interessato_fino_a: statoFinale === 'Non interessato' ? (parseDataSicura(g(row, 'non_interessato_fino_a')) || null) : null,
            ultimo_contatto: parseDataSicura(g(row, 'ultimo_contatto')) || null,
            note_storia: parseStorico(g(row, 'note_storia'), statoFinale, oggiIso),
          });
          r.importati++;
        }
        setImportProgress({ fase: 'elaborazione', done: Math.min(start + CHUNK, fileRows.length), total: fileRows.length });
        await new Promise(resolve => setTimeout(resolve, 0)); // cede il controllo al browser tra un blocco e l'altro
      }

      // Scritture — a lotti, per non superare i limiti di dimensione delle richieste
      const BATCH_SIZE = 500;
      let insertedIds = [];
      if (toInsert.length) {
        const totalBatches = Math.ceil(toInsert.length / BATCH_SIZE);
        for (let b = 0; b < totalBatches; b++) {
          const chunk = toInsert.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
          setImportProgress({ fase: 'scrittura', done: b * BATCH_SIZE, total: toInsert.length });
          const ids = await dbInsertLeads(chunk);
          if (ids === null) {
            showToast('Errore di scrittura su Supabase', `Import interrotto dopo ${insertedIds.length} lead su ${toInsert.length}. I lead già scritti restano nel database — puoi annullarli dalla card "Importazioni recenti" se necessario.`, 'info');
            setImporting(false); setImportProgress(null);
            return;
          }
          insertedIds.push(...ids);
        }
        setImportProgress({ fase: 'scrittura', done: toInsert.length, total: toInsert.length });
      }
      for (const ex of riattivazioni) {
        const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date: new Date().toISOString(), esito: 'Riattivato', testo: `Ricomparso nella lista "${nomeLista.trim()}" — riattivato per ricontatto` };
        await dbUpdateLead(ex.id, { stato: 'Da chiamare', non_interessato_fino_a: null, note_storia: [...(ex.note_storia || []), entry] });
      }

      // Registro il lotto per un eventuale annullamento (solo i lead NUOVI, non le riattivazioni)
      if (insertedIds.length) {
        await dbCreateImportBatch(nomeLista.trim(), insertedIds);
        const b = await dbLoadImportBatches();
        setBatches(b || []);
      }

      await load();
      setReport(r); setFileRows(null); setFileName('');
      setImporting(false); setImportProgress(null);
      showToast('Importazione completata', `${r.importati} nuovi, ${r.riattivati} riattivati`);
    } catch (err) {
      console.error('Errore import:', err);
      showToast('Errore imprevisto durante l\'importazione', err?.message || 'Controlla la console (F12) per il dettaglio tecnico', 'info');
      setImporting(false); setImportProgress(null);
    }
  };

  const annullaImport = async (batch) => {
    if (!window.confirm(`Annullare l'importazione "${batch.lista}"? Verranno eliminati ${batch.count} lead appena importati (le riattivazioni di lead già esistenti non vengono toccate).`)) return;
    const ok = await dbUndoImportBatch(batch);
    if (!ok) { showToast('Errore durante l\'annullamento', '', 'info'); return; }
    await load();
    const b = await dbLoadImportBatches();
    setBatches(b || []);
    showToast('Importazione annullata', `${batch.count} lead rimossi`, 'info');
  };

  // ── Report di resa per lista (arricchito) ──────────────────
  const liste = [...new Set(leads.map(l => l.lista).filter(Boolean))].sort();
  const SCARTO_STATI = ['Numero errato', 'Già cliente'];
  const resa = liste.map(nome => {
    const ls = leads.filter(l => l.lista === nome);
    const lavorati = ls.filter(l => (l.tentativi || 0) > 0).length;
    const appt = ls.filter(l => (l.note_storia || []).some(h => h.esito === 'Appuntamento fissato')).length;
    const risposte = ls.filter(l => (l.note_storia || []).some(h => ESITI_VALIDI.has(h.esito) && h.esito !== 'Non risponde' && h.esito !== 'Numero errato')).length;
    const scarti = ls.filter(l => SCARTO_STATI.includes(l.stato)).length;
    return {
      nome, totale: ls.length, lavorati, appt,
      conv: lavorati > 0 ? Math.round(appt / lavorati * 100) : 0,
      tassoRisposta: lavorati > 0 ? Math.round(risposte / lavorati * 100) : 0,
      tassoScarto: ls.length > 0 ? Math.round(scarti / ls.length * 100) : 0,
    };
  });

  useEffect(() => {
    if (chartRef.current && resa.length) {
      chartC.current?.destroy();
      chartC.current = new Chart(chartRef.current, { type: 'bar', data: { labels: resa.map(x => x.nome), datasets: [
        { label: 'Da lavorare', data: resa.map(x => x.totale - x.lavorati), backgroundColor: '#C2DEFA', borderRadius: 4 },
        { label: 'Chiamati', data: resa.map(x => x.lavorati - x.appt), backgroundColor: '#4DA6E8', borderRadius: 4 },
        { label: 'Appuntamenti', data: resa.map(x => x.appt), backgroundColor: '#0050A0', borderRadius: 4 },
      ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,120,212,0.06)' } } } } });
    }
    return () => chartC.current?.destroy();
  }, [leads]);

  // ── Andamento mensile (6 mesi) chiamate/appuntamenti + conversione ──
  const mesiEtichette = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); });
  const tuttiEsitiAdmin = [];
  leads.forEach(l => (l.note_storia || []).forEach(h => tuttiEsitiAdmin.push(h)));
  const trendMensile = mesiEtichette.map(m => {
    const esitiM = tuttiEsitiAdmin.filter(h => (h.date || '').slice(0, 7) === m && ESITI_VALIDI.has(h.esito));
    const chiamate = esitiM.length;
    const appt = esitiM.filter(h => h.esito === 'Appuntamento fissato').length;
    const conversazioni = esitiM.filter(h => h.esito !== 'Non risponde' && h.esito !== 'Numero errato').length;
    return { m, chiamate, appt, conv: conversazioni > 0 ? Math.round(appt / conversazioni * 100) : 0 };
  });
  const haStoricoMensile = trendMensile.some(x => x.chiamate > 0);

  useEffect(() => {
    if (!trendRef.current || !haStoricoMensile) { trendC.current?.destroy(); trendC.current = null; return; }
    trendC.current?.destroy();
    const labels = trendMensile.map(x => new Date(x.m + '-01T12:00').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }));
    trendC.current = new Chart(trendRef.current, { data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Chiamate', data: trendMensile.map(x => x.chiamate), backgroundColor: '#C2DEFA', borderRadius: 4, order: 2, yAxisID: 'y' },
        { type: 'bar', label: 'Appuntamenti', data: trendMensile.map(x => x.appt), backgroundColor: '#0050A0', borderRadius: 4, order: 2, yAxisID: 'y' },
        { type: 'line', label: 'Conversione %', data: trendMensile.map(x => x.conv), borderColor: '#1B7A3E', backgroundColor: '#1B7A3E', borderWidth: 2, tension: .3, pointRadius: 3, order: 1, yAxisID: 'y1' },
      ],
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { x: { grid: { display: false } }, y: { position: 'left', ticks: { stepSize: 1 }, grid: { color: 'rgba(0,120,212,0.06)' } }, y1: { position: 'right', min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { display: false } } } } });
    return () => trendC.current?.destroy();
  }, [leads, haStoricoMensile]);

  // ── Ricettività per categoria (globale) ─────────────────────
  const catStatsAdmin = {};
  leads.forEach(l => {
    if (!l.categoria || (l.tentativi || 0) === 0) return;
    if (!catStatsAdmin[l.categoria]) catStatsAdmin[l.categoria] = { tot: 0, appt: 0 };
    catStatsAdmin[l.categoria].tot++;
    if ((l.note_storia || []).some(h => h.esito === 'Appuntamento fissato')) catStatsAdmin[l.categoria].appt++;
  });
  const catRicettivitaAdmin = Object.entries(catStatsAdmin).map(([cat, s]) => ({ cat, tot: s.tot, appt: s.appt, pct: Math.round(s.appt / s.tot * 100) })).sort((a, b) => b.pct - a.pct);

  useEffect(() => {
    if (!catRef.current || !catRicettivitaAdmin.length) { catC.current?.destroy(); catC.current = null; return; }
    catC.current?.destroy();
    catC.current = new Chart(catRef.current, { type: 'bar', data: {
      labels: catRicettivitaAdmin.map(c => c.cat),
      datasets: [{ label: 'Conversione in appuntamento', data: catRicettivitaAdmin.map(c => c.pct), backgroundColor: '#0078D4', borderRadius: 5 }],
    }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}% (${catRicettivitaAdmin[ctx.dataIndex].appt}/${catRicettivitaAdmin[ctx.dataIndex].tot})` } } }, scales: { x: { max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,120,212,0.06)' } }, y: { grid: { display: false } } } } });
    return () => catC.current?.destroy();
  }, [leads]);

  // ── Trend temporale per categoria (appuntamenti fissati/mese) ──
  const CAT_COLORS = ['#0050A0', '#0078D4', '#4DA6E8', '#7B68EE', '#E07B1A', '#2E8B57', '#A32D2D', '#5A6B7E', '#C2185B', '#00838F'];
  const categorieConDati = [...new Set(leads.filter(l => l.categoria).map(l => l.categoria))];
  const catTrendData = categorieConDati.map((cat, i) => ({
    cat, color: CAT_COLORS[i % CAT_COLORS.length],
    valori: mesiEtichette.map(m => leads.filter(l => l.categoria === cat).reduce((n, l) => n + (l.note_storia || []).filter(h => h.esito === 'Appuntamento fissato' && (h.date || '').slice(0, 7) === m).length, 0)),
  })).filter(c => c.valori.some(v => v > 0));

  useEffect(() => {
    if (!catTrendRef.current || !catTrendData.length) { catTrendC.current?.destroy(); catTrendC.current = null; return; }
    catTrendC.current?.destroy();
    const labels = mesiEtichette.map(m => new Date(m + '-01T12:00').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }));
    catTrendC.current = new Chart(catTrendRef.current, { type: 'line', data: {
      labels,
      datasets: catTrendData.map(c => ({ label: c.cat, data: c.valori, borderColor: c.color, backgroundColor: c.color, borderWidth: 2, tension: .3, pointRadius: 3 })),
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { ticks: { stepSize: 1 }, grid: { color: 'rgba(0,120,212,0.06)' } } } } });
    return () => catTrendC.current?.destroy();
  }, [leads]);

  // ── Qualità appuntamenti globale (funzione SQL, giorno zero = da oggi) ──
  const qualitaApptAdmin = (() => {
    if (!apptStats || !apptStats.length) return null;
    const agg = {};
    apptStats.forEach(r => { agg[r.stato] = (agg[r.stato] || 0) + Number(r.cnt); });
    const nonVerificati = agg['Programmato'] || 0;
    const aggVerificati = { ...agg }; delete aggVerificati['Programmato'];
    const totVerificati = Object.values(aggVerificati).reduce((s, v) => s + v, 0);
    const svolti = agg['Svolto'] || 0;
    return { agg: aggVerificati, totVerificati, nonVerificati, pctSvolti: totVerificati > 0 ? Math.round(svolti / totVerificati * 100) : null };
  })();

  useEffect(() => {
    if (!qualRef.current || !qualitaApptAdmin || !qualitaApptAdmin.totVerificati) { qualC.current?.destroy(); qualC.current = null; return; }
    const ordine = ['Svolto', 'Non si è presentato', 'Da rifissare', 'Non effettuato'];
    const colori = { 'Svolto': '#1B7A3E', 'Non si è presentato': '#A32D2D', 'Da rifissare': '#E07B1A', 'Non effettuato': '#888888' };
    const labels = ordine.filter(s => qualitaApptAdmin.agg[s]);
    qualC.current?.destroy();
    qualC.current = new Chart(qualRef.current, { type: 'bar', data: {
      labels, datasets: [{ data: labels.map(s => qualitaApptAdmin.agg[s]), backgroundColor: labels.map(s => colori[s]), borderRadius: 5 }],
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { ticks: { stepSize: 1 }, grid: { color: 'rgba(0,120,212,0.06)' } } } } });
    return () => qualC.current?.destroy();
  }, [apptStats]);

  // ── Vista lead filtrata ────────────────────────────────────
  const filtered = leads.filter(l =>
    (!fStato || l.stato === fStato) &&
    (!fLista || l.lista === fLista) &&
    (!fCategoria || l.categoria === fCategoria)
  );

  const eliminaLead = async (id) => {
    if (!window.confirm('Eliminare definitivamente questo lead e il suo storico?')) return;
    await dbDeleteLeads([id]);
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelected(null);
    showToast('Lead eliminato', '', 'info');
  };

  // ── Eliminazione a lotti (id in comune tra selezione manuale e "elimina lista") ──
  const eliminaIdInBlocco = async (ids, etichetta) => {
    if (!ids.length) return;
    const BATCH = 200;
    const totalBatches = Math.ceil(ids.length / BATCH);
    for (let b = 0; b < totalBatches; b++) {
      const chunk = ids.slice(b * BATCH, (b + 1) * BATCH);
      setBulkProgress({ done: b * BATCH, total: ids.length });
      const ok = await dbDeleteLeads(chunk);
      if (!ok) {
        showToast('Errore durante l\'eliminazione', `Interrotta dopo ${b * BATCH} lead su ${ids.length}. I lead non ancora eliminati sono al sicuro.`, 'info');
        setBulkProgress(null);
        await load();
        return;
      }
    }
    setBulkProgress(null);
    const idSet = new Set(ids);
    setLeads(prev => prev.filter(l => !idSet.has(l.id)));
    setChecked(new Set());
    showToast(`${ids.length} lead eliminati`, etichetta || '', 'info');
  };

  const eliminaSelezionati = async () => {
    const ids = [...checked];
    if (!ids.length) return;
    if (!window.confirm(`Eliminare definitivamente ${ids.length} lead selezionati e il loro storico? L'operazione non è reversibile.`)) return;
    await eliminaIdInBlocco(ids);
  };

  const eliminaListaIntera = async () => {
    if (!listaDaEliminare) return;
    const ids = leads.filter(l => l.lista === listaDaEliminare).map(l => l.id);
    if (!ids.length) { showToast('Nessun lead in quella lista', '', 'info'); return; }
    const conferma = window.prompt(`Stai per eliminare TUTTI i ${ids.length} lead della lista "${listaDaEliminare}", storico incluso.\n\nScrivi ELIMINA per confermare:`);
    if (conferma !== 'ELIMINA') { showToast('Eliminazione annullata', '', 'info'); return; }
    await eliminaIdInBlocco(ids, `lista "${listaDaEliminare}"`);
    setListaDaEliminare('');
  };

  // ── Esportazione con storico leggibile ────────────────────────
  const esportaLead = async (rows, nomeFile) => {
    if (!rows.length) { showToast('Niente da esportare', '', 'info'); return; }
    const XLSX = await import('xlsx');
    const data = rows.map(l => ({
      Azienda: l.azienda || '', Referente: l.nome || '',
      Telefono: l.telefono || '', 'Telefono 2': l.telefono2 || '', 'Telefono 3': l.telefono3 || '',
      Email: l.email || '', Categoria: l.categoria || '', Città: l.citta || '', Provincia: l.provincia || '',
      Stato: l.stato || '', Lista: l.lista || '', Fonte: l.fonte || '',
      Tentativi: l.tentativi || 0,
      'Ultimo contatto': l.ultimo_contatto ? fmtDT(l.ultimo_contatto) : '',
      'Data richiamo': l.data_richiamo || '',
      'Ricontattabile dal': l.non_interessato_fino_a || '',
      'Storico chiamate': (l.note_storia || []).map(h => `${h.date ? fmtDT(h.date) : ''} — ${h.esito || 'Nota'}${h.testo ? ': ' + h.testo : ''}`).join('\n'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0] || {}).map(k => ({ wch: k === 'Storico chiamate' ? 60 : 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lead');
    XLSX.writeFile(wb, `${nomeFile}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Esportazione completata', `${rows.length} lead in "${nomeFile}...xlsx"`);
  };

  const toggleChecked = (id) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCheckedAll = () => setChecked(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)));

  const StatoBadge = ({ stato }) => (
    <span style={{ background: (STATO_COLORS[stato] || '#888') + '18', color: STATO_COLORS[stato] || '#888', border: `1px solid ${(STATO_COLORS[stato] || '#888')}55`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{stato}</span>
  );

  if (loading) return <div className="content"><div className="empty">Caricamento...</div></div>;

  return (
    <>
      <div className="topbar"><span className="page-title">Telemarketing</span></div>
      <div className="content">

        {/* ── IMPORT LISTE ── */}
        <div className="card">
          <div className="card-title">Importa una lista</div>
          {!fileRows ? (
            <>
              <p className="text-muted fs-12" style={{ marginBottom: 14, lineHeight: 1.6 }}>
                Carica un file CSV o Excel: potrai abbinare le colonne del file ai campi del lead. I duplicati (contro lead già presenti e contro i contatti del CRM) vengono riconosciuti dal <strong>telefono</strong> o dall'<strong>email</strong> e scartati con resoconto.
              </p>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>📁 Carica lista CSV / Excel</button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
            </>
          ) : (
            <>
              <div className="fs-12 text-muted" style={{ marginBottom: 10 }}>File: <strong>{fileName}</strong> — {fileRows.length} righe</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Nome lista *</label><input className="form-control" value={nomeLista} onChange={e => setNomeLista(e.target.value)} placeholder="Es. Commercialisti Roma Set26" /></div>
                <div className="form-group"><label className="form-label">Fonte assegnata ai lead</label>
                  <select className="form-control" value={fonteDefault} onChange={e => setFonteDefault(e.target.value)}>
                    {FONTI.map(f => <option key={f.name} value={f.name}>{f.icon} {f.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="card-title" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                Abbina le colonne
                {Object.keys(templates).length > 0 && (
                  <select className="form-control" style={{ width: 200, fontSize: 12 }} defaultValue="" onChange={e => { if (templates[e.target.value]) { setMapping(templates[e.target.value]); showToast('Template applicato', e.target.value); } }}>
                    <option value="">Applica template...</option>
                    {Object.keys(templates).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                <button className="btn btn-sm" onClick={salvaTemplate}>💾 Salva come template</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10, marginBottom: 6 }}>
                {CAMPI_LEAD.filter(f => !f.avanzato).map(f => (
                  <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{f.label}{(f.key === 'telefono') ? ' ★' : ''}</label>
                    <select className="form-control" value={mapping[f.key] || ''} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}>
                      <option value="">— ignora —</option>
                      {Object.keys(fileRows[0]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="fs-11 text-muted" style={{ margin: '10px 0 6px' }}>Campi avanzati — mappali solo se il file contiene già uno storico di chiamate (lascia vuoti per una lista mai lavorata prima)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10, marginBottom: 14, opacity: .85 }}>
                {CAMPI_LEAD.filter(f => f.avanzato).map(f => (
                  <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{f.label}</label>
                    <select className="form-control" value={mapping[f.key] || ''} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}>
                      <option value="">— ignora —</option>
                      {Object.keys(fileRows[0]).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="card-title" style={{ fontSize: 13 }}>Anteprima (prime 5 righe)</div>
              <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                <table className="crm-table" style={{ minWidth: 600 }}>
                  <thead><tr>{CAMPI_LEAD.filter(f => mapping[f.key]).map(f => <th key={f.key}>{f.label}</th>)}</tr></thead>
                  <tbody>
                    {fileRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>{CAMPI_LEAD.filter(f => mapping[f.key]).map(f => <td key={f.key} style={{ fontSize: 12 }}>{String(row[mapping[f.key]] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => { setFileRows(null); setFileName(''); }} disabled={importing}>Annulla</button>
                <button className="btn btn-primary" onClick={doImport} disabled={importing}>{importing ? '⏳ Importazione...' : `Importa "${nomeLista || '...'}"`}</button>
              </div>
              {importProgress && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ background: 'var(--bg3)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(importProgress.done / importProgress.total * 100)}%`, background: 'var(--accent)', height: '100%', transition: 'width .2s' }} />
                  </div>
                  <div className="fs-11 text-muted" style={{ marginTop: 4 }}>
                    {importProgress.fase === 'elaborazione' ? '🔎 Analisi e deduplica: ' : '💾 Scrittura su database: '}
                    {importProgress.done.toLocaleString('it-IT')} / {importProgress.total.toLocaleString('it-IT')} — non chiudere questa pagina
                  </div>
                </div>
              )}
            </>
          )}

          {report && (
            <div style={{ marginTop: 14, background: '#0078D40d', border: '1px solid #0078D455', borderRadius: 'var(--r)', padding: 14, fontSize: 13, lineHeight: 1.8 }}>
              <strong>Resoconto — {report.totale} righe nel file:</strong><br />
              ✅ <strong>{report.importati}</strong> nuovi lead importati{report.riattivati > 0 && <> · 🔄 <strong>{report.riattivati}</strong> riattivati (erano "non interessato" con data di ricontatto maturata)</>}<br />
              {report.giaLavorati > 0 && <>⛔ {report.giaLavorati} già lavorati in passato (non interessati / da non richiamare / numeri errati)<br /></>}
              {report.inLavorazione > 0 && <>📞 {report.inLavorazione} già in coda di lavorazione<br /></>}
              {report.appFissati > 0 && <>📆 {report.appFissati} con appuntamento già fissato<br /></>}
              {report.giaClienti > 0 && <>💼 {report.giaClienti} già clienti (di colleghi)<br /></>}
              {report.giaContatti > 0 && <>👤 {report.giaContatti} già presenti tra i tuoi contatti CRM<br /></>}
              {report.dupFile > 0 && <>♻ {report.dupFile} duplicati interni al file<br /></>}
              {report.senzaRecapiti > 0 && <>⚠ {report.senzaRecapiti} righe senza telefono né email (scartate)<br /></>}
            </div>
          )}
        </div>

        {/* ── IMPORTAZIONI RECENTI (annullabili) ── */}
        {batches.length > 0 && (
          <div className="card">
            <div className="card-title">Importazioni recenti</div>
            <p className="text-muted fs-12" style={{ marginBottom: 10 }}>Se un'importazione contiene errori, puoi annullarla: verranno eliminati solo i lead nuovi creati in quel lotto (le riattivazioni di lead già esistenti non vengono toccate).</p>
            {batches.slice(0, 5).map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{b.lista}</strong> — {b.count} lead
                  <span className="text-muted" style={{ marginLeft: 8 }}>{fmtDT(b.created_at)}</span>
                </div>
                <button className="btn btn-sm" style={{ color: '#A32D2D', borderColor: '#A32D2D55' }} onClick={() => annullaImport(b)}>Annulla</button>
              </div>
            ))}
          </div>
        )}

        {/* ── ANDAMENTO MENSILE ── */}
        {haStoricoMensile && (
          <div className="card">
            <div className="card-title">Andamento — ultimi 6 mesi</div>
            <div style={{ height: 230, position: 'relative' }}><canvas ref={trendRef} /></div>
          </div>
        )}

        {/* ── RICETTIVITÀ E TREND PER CATEGORIA ── */}
        {(catRicettivitaAdmin.length > 0 || catTrendData.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginTop: 16 }}>
            {catRicettivitaAdmin.length > 0 && (
              <div className="card" style={{ marginTop: 0 }}>
                <div className="card-title">Categorie più ricettive</div>
                <div style={{ height: 220, position: 'relative' }}><canvas ref={catRef} /></div>
              </div>
            )}
            {catTrendData.length > 0 && (
              <div className="card" style={{ marginTop: 0 }}>
                <div className="card-title">Appuntamenti per categoria nel tempo</div>
                <div style={{ height: 220, position: 'relative' }}><canvas ref={catTrendRef} /></div>
              </div>
            )}
          </div>
        )}

        {/* ── QUALITÀ APPUNTAMENTI (globale, da oggi) ── */}
        {qualitaApptAdmin && (qualitaApptAdmin.totVerificati > 0 || qualitaApptAdmin.nonVerificati > 0) && (
          <div className="card">
            <div className="card-title">Qualità appuntamenti (da oggi in poi)</div>
            {qualitaApptAdmin.totVerificati > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#1B7A3E' }}>{qualitaApptAdmin.pctSvolti}%</span>
                  <span className="text-muted fs-12">si sono effettivamente svolti (su {qualitaApptAdmin.totVerificati} verificati)</span>
                </div>
                <div style={{ height: 160, position: 'relative', marginTop: 10 }}><canvas ref={qualRef} /></div>
              </>
            ) : (
              <div className="empty" style={{ padding: '10px 0' }}>Nessun appuntamento ancora verificato da oggi in poi.</div>
            )}
            {qualitaApptAdmin.nonVerificati > 0 && (
              <div className="fs-11 text-muted" style={{ marginTop: 10 }}>
                ⏳ {qualitaApptAdmin.nonVerificati} appuntament{qualitaApptAdmin.nonVerificati === 1 ? 'o' : 'i'} ancora da verificare (marca l'esito nella scheda contatto dopo l'incontro).
              </div>
            )}
          </div>
        )}

        {/* ── REPORT DI RESA ── */}
        {resa.length > 0 && (
          <div className="card">
            <div className="card-title">Resa per lista</div>
            <div style={{ height: 200, position: 'relative', marginBottom: 14 }}><canvas ref={chartRef} /></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="crm-table" style={{ minWidth: 700 }}>
                <thead><tr><th>Lista</th><th style={{ textAlign: 'right' }}>Lead</th><th style={{ textAlign: 'right' }}>Chiamati</th><th style={{ textAlign: 'right' }}>Appuntamenti</th><th style={{ textAlign: 'right' }}>Conversione</th><th style={{ textAlign: 'right' }}>Tasso risposta</th><th style={{ textAlign: 'right' }}>Tasso scarto</th></tr></thead>
                <tbody>
                  {resa.map(x => (
                    <tr key={x.nome}>
                      <td style={{ fontWeight: 600 }}>{x.nome}</td>
                      <td style={{ textAlign: 'right' }}>{x.totale}</td>
                      <td style={{ textAlign: 'right' }}>{x.lavorati}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0050A0' }}>{x.appt}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: x.conv >= 10 ? '#1B7A3E' : 'inherit' }}>{x.conv}%</td>
                      <td style={{ textAlign: 'right' }}>{x.tassoRisposta}%</td>
                      <td style={{ textAlign: 'right', color: x.tassoScarto >= 15 ? '#A32D2D' : 'inherit' }}>{x.tassoScarto}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STRUMENTI DI GESTIONE LISTA ── */}
        <div className="card">
          <div className="card-title">Gestione lista</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-control" style={{ width: 260, fontSize: 13 }} value={listaDaEliminare} onChange={e => setListaDaEliminare(e.target.value)}>
              <option value="">— scegli una lista da eliminare —</option>
              {liste.map(l => <option key={l} value={l}>{l} ({leads.filter(x => x.lista === l).length})</option>)}
            </select>
            <button className="btn" style={{ color: '#A32D2D', borderColor: '#A32D2D55' }} disabled={!listaDaEliminare} onClick={eliminaListaIntera}>🗑 Elimina l'intera lista</button>
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => esportaLead(filtered, (fLista || 'lead_filtrati').replace(/[^a-z0-9]+/gi, '_'))}>⬇ Esporta i {filtered.length} lead filtrati</button>
          </div>
          {bulkProgress && (
            <div style={{ marginTop: 12 }}>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(bulkProgress.done / bulkProgress.total * 100)}%`, background: '#A32D2D', height: '100%', transition: 'width .2s' }} />
              </div>
              <div className="fs-11 text-muted" style={{ marginTop: 4 }}>Eliminazione: {bulkProgress.done.toLocaleString('it-IT')} / {bulkProgress.total.toLocaleString('it-IT')} — non chiudere questa pagina</div>
            </div>
          )}
        </div>

        {/* ── ELENCO LEAD ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            Lead ({filtered.length})
            <select className="form-control" style={{ width: 170, fontSize: 12 }} value={fStato} onChange={e => setFStato(e.target.value)}>
              <option value="">Tutti gli stati</option>
              <option value="Da chiamare">Da chiamare</option>
              {ESITI_CHIAMATA.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
            <select className="form-control" style={{ width: 170, fontSize: 12 }} value={fLista} onChange={e => setFLista(e.target.value)}>
              <option value="">Tutte le liste</option>
              {liste.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="form-control" style={{ width: 190, fontSize: 12 }} value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
              <option value="">Tutte le categorie</option>
              {CATEGORIE.filter(c => leads.some(l => l.categoria === c)).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {checked.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#A32D2D0d', border: '1px solid #A32D2D33', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>{checked.size} selezionati</strong>
              <button className="btn btn-sm" style={{ color: '#A32D2D', borderColor: '#A32D2D55' }} onClick={eliminaSelezionati}>🗑 Elimina selezionati</button>
              <button className="btn btn-sm" onClick={() => esportaLead(filtered.filter(l => checked.has(l.id)), 'lead_selezionati')}>⬇ Esporta selezionati</button>
              <button className="btn btn-sm" onClick={() => setChecked(new Set())}>✕ Deseleziona</button>
            </div>
          )}

          {filtered.length === 0 ? <div className="empty" style={{ padding: '14px 0' }}>Nessun lead. Importa la prima lista qui sopra. 👆</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="crm-table" style={{ minWidth: 700 }}>
                <thead><tr>
                  <th style={{ width: 30 }}><input type="checkbox" checked={checked.size === filtered.length && filtered.length > 0} onChange={toggleCheckedAll} /></th>
                  <th>Azienda / Referente</th><th>Categoria</th><th>Telefono</th><th>Lista</th><th>Stato</th><th style={{ textAlign: 'right' }}>Tent.</th><th>Ultimo contatto</th>
                </tr></thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id} onClick={() => setSelected(l)} style={{ cursor: 'pointer' }}>
                      <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={checked.has(l.id)} onChange={() => toggleChecked(l.id)} /></td>
                      <td><strong>{l.azienda || l.nome || '—'}</strong>{l.azienda && l.nome ? <div className="fs-11 text-muted">{l.nome}</div> : null}</td>
                      <td style={{ fontSize: 12 }}>{l.categoria || '—'}</td>
                      <td style={{ fontSize: 12 }}>{l.telefono || '—'}</td>
                      <td style={{ fontSize: 12 }}>{l.lista || '—'}</td>
                      <td><StatoBadge stato={l.stato} /></td>
                      <td style={{ textAlign: 'right' }}>{l.tentativi || 0}</td>
                      <td style={{ fontSize: 12 }}>{l.ultimo_contatto ? fmtDT(l.ultimo_contatto) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── DETTAGLIO LEAD ── */}
        {selected && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setSelected(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.azienda || selected.nome || '—'}</div>
                  <div className="text-muted fs-12">{selected.nome && selected.azienda ? selected.nome + ' · ' : ''}{selected.categoria || ''}{selected.citta ? ' · ' + selected.citta : ''}{selected.provincia ? ' (' + selected.provincia + ')' : ''}</div>
                </div>
                <button className="btn btn-sm" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div style={{ margin: '12px 0', fontSize: 13, lineHeight: 1.9 }}>
                📞 <strong>{selected.telefono || '—'}</strong>{selected.email ? <> · ✉ {selected.email}</> : null}<br />
                Lista: <strong>{selected.lista || '—'}</strong> · Fonte: <strong>{selected.fonte || '—'}</strong> · <StatoBadge stato={selected.stato} /><br />
                Tentativi: <strong>{selected.tentativi || 0}</strong>{selected.ultimo_contatto ? <> · Ultimo contatto: <strong>{fmtDT(selected.ultimo_contatto)}</strong></> : null}
                {selected.data_richiamo ? <><br />🔄 Richiamo previsto: <strong>{selected.data_richiamo}</strong></> : null}
                {selected.non_interessato_fino_a ? <><br />📅 Ricontattabile dal: <strong>{selected.non_interessato_fino_a}</strong></> : null}
              </div>
              {(selected.note_storia || []).length > 0 && (
                <>
                  <div className="card-title" style={{ marginBottom: 8 }}>Storico</div>
                  {[...selected.note_storia].reverse().map(h => {
                    const e = ESITI_CHIAMATA.find(x => x.name === h.esito);
                    return (
                      <div key={h.id} style={{ borderLeft: `3px solid ${e?.color || '#0078D4'}`, padding: '4px 10px', marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: e?.color || 'inherit' }}>{e?.icon || '📝'} {h.esito || 'Nota'} <span className="text-muted" style={{ fontWeight: 400 }}>— {fmtDT(h.date)}</span></div>
                        {h.testo && <div style={{ fontSize: 13 }}>{h.testo}</div>}
                      </div>
                    );
                  })}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <button className="btn" onClick={() => esportaLead([selected], (selected.azienda || selected.nome || 'lead').replace(/[^a-z0-9]+/gi, '_'))}>⬇ Esporta storico</button>
                <button className="btn" style={{ color: '#A32D2D', borderColor: '#A32D2D55' }} onClick={() => eliminaLead(selected.id)}>🗑 Elimina lead</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
