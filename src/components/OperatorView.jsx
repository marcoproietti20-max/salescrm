import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, ArcElement, DoughnutController, BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { CATEGORIE, DEFAULT_BRAND, fmtDT } from '../constants';
import { dbLoadLeads, dbUpdateLead, supabase } from '../supabase';
Chart.register(ArcElement, DoughnutController, BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend);

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
// Voci "di servizio" nello storico (import, riattivazione, storico ordini) NON sono chiamate vere: vanno sempre escluse dai conteggi
const ESITI_VALIDI = new Set(ESITI_CHIAMATA.map(e => e.name));

const NAV_OP = [
  { id: 'home',     label: 'Dashboard',     icon: 'M2 2h5v5H2zm7 0h5v5H9zm-7 7h5v5H2zm7 0h5v5H9z' },
  { id: 'coda',     label: 'Coda chiamate', icon: 'M2.5 2l3-1 1.8 3.6-2 1.6a10.5 10.5 0 004.5 4.5l1.6-2L15 10.5l-1 3C8 14.5 1.5 8 2.5 2z' },
  { id: 'richiami', label: 'Richiami',      icon: 'M8 1v7l4 2M15 8A7 7 0 111 8a7 7 0 0114 0z', badge: true },
  { id: 'archivio', label: 'Archivio lead', icon: 'M1 5h14l-2-3H3zm0 0v10a1 1 0 001 1h12a1 1 0 001-1V5M6 9h4' },
];

const CSS = `
  .opv * { box-sizing: border-box; }
  .opv { min-height: 100vh; background: #EEF3F9; font-family: 'DM Sans', sans-serif; color: #1F2A37; display: flex; }
  .opv-side { width: 230px; min-height: 100vh; background: linear-gradient(175deg, #005A9E, ${BLU}); color: white; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 45; }
  .opv-logo { padding: 24px 20px 18px; }
  .opv-logo .big { font-size: 24px; font-weight: 800; letter-spacing: -.5px; }
  .opv-logo .sub { font-size: 11px; opacity: .8; letter-spacing: .08em; text-transform: uppercase; margin-top: 3px; }
  .opv-navlabel { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .65; padding: 8px 20px 6px; }
  .opv-navitem { display: flex; align-items: center; gap: 11px; width: calc(100% - 16px); margin: 2px 8px; padding: 10px 12px; border: none; border-radius: 10px; background: transparent; color: rgba(255,255,255,.85); font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; text-align: left; }
  .opv-navitem:hover { background: rgba(255,255,255,.1); }
  .opv-navitem.active { background: rgba(255,255,255,.2); color: white; }
  .opv-navicon { width: 16px; height: 16px; flex-shrink: 0; }
  .opv-navbadge { margin-left: auto; background: #E74C3C; color: white; border-radius: 20px; font-size: 11px; font-weight: 800; padding: 1px 8px; }
  .opv-sidefoot { margin-top: auto; padding: 16px 20px; border-top: 1px solid rgba(255,255,255,.2); font-size: 12px; }
  .opv-sidefoot strong { display: block; font-size: 13px; }
  .opv-sidefoot span { opacity: .75; }
  .opv-esci { margin-top: 10px; width: 100%; background: rgba(255,255,255,.14); color: white; border: 1px solid rgba(255,255,255,.4); border-radius: 9px; padding: 7px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .opv-esci:hover { background: rgba(255,255,255,.25); }
  .opv-main { flex: 1; margin-left: 230px; padding: 0 26px 60px; }
  .opv-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 0 6px; }
  .opv-title { font-size: 20px; font-weight: 800; }
  .opv-date { font-size: 12.5px; color: #6B7A8C; text-transform: capitalize; }
  .opv-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 12px; }
  .opv-metric { background: white; border-radius: 14px; padding: 15px 17px; box-shadow: 0 2px 10px rgba(0,60,120,.07); }
  .opv-metric .lbl { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #6B7A8C; }
  .opv-metric .val { font-size: 31px; font-weight: 800; line-height: 1.15; }
  .opv-metric .sub { font-size: 11.5px; color: #6B7A8C; }
  .opv-card { background: white; border-radius: 14px; padding: 18px 20px; box-shadow: 0 2px 10px rgba(0,60,120,.06); margin-top: 16px; }
  .opv-card-title { font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #33475B; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .opv-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .opv-input, .opv-select { border: 1.5px solid #D4DEE9; border-radius: 10px; padding: 10px 12px; font-size: 14px; font-family: inherit; background: white; color: inherit; }
  .opv-input:focus, .opv-select:focus { outline: none; border-color: ${BLU}; }
  .opv-search { flex: 1; min-width: 200px; }
  .opv-row { display: flex; align-items: center; gap: 14px; padding: 13px 15px; border: 1px solid #E2E9F1; border-radius: 12px; margin-bottom: 9px; cursor: pointer; background: white; transition: box-shadow .12s, border-color .12s; }
  .opv-row:hover { border-color: ${BLU}; box-shadow: 0 3px 12px rgba(0,120,212,.14); }
  .opv-row.hot { background: #FFF7ED; border-color: #F0B26B; }
  .opv-row .who { flex: 1; min-width: 0; }
  .opv-row .who .az { font-size: 15.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .opv-row .who .det { font-size: 12.5px; color: #6B7A8C; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
  .opv-tag { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
  .opv-call { display: inline-flex; align-items: center; gap: 8px; background: ${BLU}; color: white; border: none; border-radius: 10px; padding: 9px 15px; font-size: 14.5px; font-weight: 700; cursor: pointer; text-decoration: none; white-space: nowrap; }
  .opv-call:hover { background: #005A9E; }
  .opv-open { background: white; color: ${BLU}; border: 1.5px solid ${BLU}; border-radius: 10px; padding: 8px 13px; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; font-family: inherit; }
  .opv-empty { text-align: center; color: #8A97A6; font-size: 14px; padding: 20px 0; }
  .opv-modal-bg { position: fixed; inset: 0; background: rgba(15,30,50,.5); z-index: 60; display: flex; align-items: center; justify-content: center; padding: 14px; }
  .opv-modal { background: white; border-radius: 16px; width: 100%; max-width: 620px; max-height: 92vh; overflow-y: auto; padding: 24px; }
  .opv-bigcall { display: flex; align-items: center; justify-content: center; gap: 10px; background: ${BLU}; color: white; border-radius: 12px; padding: 15px; font-size: 25px; font-weight: 800; text-decoration: none; margin: 15px 0 8px; }
  .opv-callrow { display: flex; gap: 8px; margin-bottom: 8px; }
  .opv-callrow:last-of-type { margin-bottom: 8px; }
  .opv-bigcall.small { flex: 1; font-size: 16px; padding: 10px; margin: 0; background: white; color: ${BLU}; border: 1.5px solid ${BLU}; }
  .opv-bigcall.small:hover { background: ${BLU}15; }
  .opv-tabs { display: flex; gap: 6px; background: #EEF3F9; border-radius: 12px; padding: 5px; margin-bottom: 16px; }
  .opv-tab { flex: 1; border: none; border-radius: 9px; padding: 10px 8px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; background: transparent; color: #6B7A8C; }
  .opv-tab.on { background: white; color: ${BLU}; box-shadow: 0 1px 5px rgba(0,60,120,.12); }
  .opv-dl { display: grid; grid-template-columns: 130px 1fr; gap: 7px 12px; font-size: 14px; margin-bottom: 16px; }
  .opv-dl dt { color: #6B7A8C; font-weight: 600; }
  .opv-dl dd { margin: 0; font-weight: 600; }
  .opv-esiti { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .opv-esito-btn { border-radius: 12px; padding: 14px 10px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .opv-form-label { display: block; font-size: 12px; font-weight: 700; color: #33475B; margin-bottom: 5px; }
  .opv-textarea { width: 100%; border: 1.5px solid #D4DEE9; border-radius: 10px; padding: 10px 12px; font-size: 14px; font-family: inherit; resize: vertical; }
  .opv-textarea:focus { outline: none; border-color: ${BLU}; }
  .opv-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
  .opv-btn { border-radius: 10px; padding: 10px 18px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; border: 1.5px solid #D4DEE9; background: white; }
  .opv-btn.primary { background: ${BLU}; border-color: ${BLU}; color: white; }
  .opv-btn.primary:disabled { opacity: .6; }
  .opv-hist { border-left: 3px solid ${BLU}; padding: 5px 12px; margin-bottom: 10px; }
  .opv-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .opv-grid2 .opv-card { margin-top: 0; }
  .opv-row .who .nota { font-size: 12px; color: #8A97A6; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .opv-weeknav { display: flex; align-items: center; gap: 10px; margin-left: auto; }
  .opv-weeknav .lbl { font-size: 12.5px; font-weight: 700; color: #33475B; text-transform: none; letter-spacing: 0; }
  .opv-weekbtn { border: 1.5px solid #D4DEE9; background: white; border-radius: 8px; width: 30px; height: 30px; font-size: 15px; font-weight: 700; cursor: pointer; color: #33475B; font-family: inherit; }
  .opv-weekbtn:hover { border-color: ${BLU}; color: ${BLU}; }
  .opv-week { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .opv-day { background: #F6F9FC; border: 1px solid #E2E9F1; border-radius: 12px; padding: 10px; min-height: 130px; }
  .opv-day.today { border-color: ${BLU}; background: rgba(0,120,212,.05); }
  .opv-day-h { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #33475B; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; }
  .opv-day-h .num { font-size: 15px; color: ${BLU}; }
  .opv-mini { background: white; border: 1px solid #DDE6EF; border-left: 3px solid #4DA6E8; border-radius: 8px; padding: 7px 9px; margin-bottom: 7px; cursor: pointer; }
  .opv-mini:hover { border-color: ${BLU}; box-shadow: 0 2px 8px rgba(0,120,212,.15); }
  .opv-mini .n { font-size: 12.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .opv-mini .t { font-size: 11.5px; color: #6B7A8C; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .opv-banner { background: #E07B1A; color: white; border-radius: 12px; padding: 12px 18px; font-weight: 700; font-size: 13.5px; cursor: pointer; margin-top: 16px; box-shadow: 0 2px 10px rgba(224,123,26,.3); }
  .opv-banner:hover { background: #C96A12; }
  .opv-chip { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 14px; margin-right: 5px; }
  .opv-toggle { display: flex; gap: 6px; justify-content: flex-end; margin-top: 14px; }
  .opv-togglebtn { padding: 7px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; border: 1.5px solid #D4DEE9; background: white; color: #33475B; font-family: inherit; }
  .opv-togglebtn.on { background: ${BLU}; color: white; border-color: ${BLU}; }
  .opv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .opv-table th { text-align: left; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #6B7A8C; padding: 9px 10px; border-bottom: 1px solid #E2E9F1; background: #F6F9FC; white-space: nowrap; }
  .opv-table td { padding: 10px; border-bottom: 1px solid #EEF2F6; vertical-align: middle; }
  .opv-table tbody tr { cursor: pointer; }
  .opv-table tbody tr:hover { background: #F3F8FD; }
  .opv-sessionbadge { background: #1B7A3E15; color: #1B7A3E; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; white-space: nowrap; }
  .opv-notachip { border: 1.5px solid #D4DEE9; background: white; border-radius: 20px; padding: 5px 12px; font-size: 12px; font-weight: 600; color: #33475B; cursor: pointer; font-family: inherit; }
  .opv-notachip:hover { border-color: ${BLU}; color: ${BLU}; }
  .opv-undobar { display: flex; align-items: center; gap: 10px; background: #33475B; color: white; border-radius: 10px; padding: 8px 14px; margin-bottom: 14px; font-size: 13px; }
  .opv-undobtn { background: rgba(255,255,255,.18); color: white; border: 1px solid rgba(255,255,255,.4); border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .opv-undobtn:hover { background: rgba(255,255,255,.3); }
  .opv-toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); color: white; border-radius: 12px; padding: 12px 24px; font-size: 15px; font-weight: 700; z-index: 100; box-shadow: 0 6px 18px rgba(0,0,0,.28); }
  .opv-burger { display: none; position: fixed; top: 12px; left: 12px; z-index: 55; background: ${BLU}; color: white; border: none; border-radius: 10px; width: 40px; height: 40px; font-size: 18px; cursor: pointer; }
  .opv-overlay { display: none; }
  .opv-statochip { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
  @media (max-width: 900px) {
    .opv-side { transform: translateX(-100%); transition: transform .18s; }
    .opv-side.open { transform: translateX(0); }
    .opv-overlay.show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 44; }
    .opv-burger { display: block; }
    .opv-main { margin-left: 0; padding: 0 12px 60px; }
    .opv-topbar { padding-top: 60px; }
    .opv-metrics { grid-template-columns: repeat(2, 1fr); gap: 9px; }
    .opv-metric .val { font-size: 26px; }
    .opv-row { flex-wrap: wrap; gap: 8px; }
    .opv-row .who { flex-basis: 100%; }
    .opv-call { flex: 1; justify-content: center; }
    .opv-open { flex: 1; }
    .opv-esiti { grid-template-columns: 1fr 1fr; }
    .opv-bigcall { font-size: 21px; }
    .opv-grid2 { grid-template-columns: 1fr; }
    .opv-week { grid-template-columns: 1fr; }
    .opv-day { min-height: auto; }
  }
`;

export default function OperatorView({ profile, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageOp, setPageOp] = useState('home');
  const [weekOffset, setWeekOffset] = useState(0);
  const [richiamiView, setRichiamiView] = useState('cal');
  const [sideOpen, setSideOpen] = useState(false);
  const [fCategoria, setFCategoria] = useState('');
  const [fLista, setFLista] = useState('');
  const [fStato, setFStato] = useState('');
  const [cerca, setCerca] = useState('');
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('esito');
  const [esitoOpen, setEsitoOpen] = useState(null);
  const [nota, setNota] = useState('');
  const [dataRichiamo, setDataRichiamo] = useState('');
  const [ricontatto, setRicontatto] = useState('6m');
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apptStats, setApptStats] = useState(null); // null = non ancora caricato, [] = errore/vuoto
  const [ordinaCoda, setOrdinaCoda] = useState('tentativi_asc');
  const [ordinaRichiami, setOrdinaRichiami] = useState('data_richiamo_asc');
  const [codaCorrente, setCodaCorrente] = useState(null); // snapshot degli id per "Prossimo →"
  const [codaIndice, setCodaIndice] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [ultimaAzione, setUltimaAzione] = useState(null); // per "Annulla ultima registrazione"
  const [visCoda, setVisCoda] = useState(50);
  const [visRichiami, setVisRichiami] = useState(50);
  const [visRiconatti, setVisRiconatti] = useState(50);
  const [visArretrato, setVisArretrato] = useState(50);
  const [visArchivio, setVisArchivio] = useState(50);
  const chartRef = useRef(); const chartC = useRef();
  const esitiChartRef = useRef(); const esitiChartC = useRef();
  const catChartRef = useRef(); const catChartC = useRef();
  const qualChartRef = useRef(); const qualChartC = useRef();

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', BLU);
    document.title = 'SalesPRO — Telemarketing';
  }, []);

  useEffect(() => {
    supabase.rpc('get_appuntamenti_stats').then(({ data, error }) => {
      if (error) { console.error('get_appuntamenti_stats:', error); setApptStats([]); }
      else setApptStats(data || []);
    });
  }, []);

  const load = useCallback(async () => {
    const data = await dbLoadLeads();
    if (data === null) { setToast({ msg: 'Errore di caricamento. Ricarica la pagina o avvisa Marco.', type: 'err' }); setLeads([]); }
    else setLeads(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // ── Filtri e code ──────────────────────────────────────────
  const matchFiltri = l => {
    if (fCategoria && l.categoria !== fCategoria) return false;
    if (fLista && l.lista !== fLista) return false;
    if (cerca) {
      const q = cerca.toLowerCase();
      const hay = [l.azienda, l.nome, l.telefono, l.citta].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const byRichiamo = (a, b) => (a.data_richiamo || '').localeCompare(b.data_richiamo || '');

  // Ordinamento configurabile: chi ha meno tentativi, chi aspetta da più tempo, alfabetico, o l'ordine di caricamento
  const applicaOrdine = (arr, criterio) => {
    const out = [...arr];
    switch (criterio) {
      case 'tentativi_asc': return out.sort((a, b) => (a.tentativi || 0) - (b.tentativi || 0));
      case 'tentativi_desc': return out.sort((a, b) => (b.tentativi || 0) - (a.tentativi || 0));
      case 'contatto_vecchio': return out.sort((a, b) => (a.ultimo_contatto || '').localeCompare(b.ultimo_contatto || '') || (a.ultimo_contatto ? 0 : -1));
      case 'contatto_recente': return out.sort((a, b) => (b.ultimo_contatto || '').localeCompare(a.ultimo_contatto || ''));
      case 'azienda_az': return out.sort((a, b) => (a.azienda || a.nome || '').localeCompare(b.azienda || b.nome || ''));
      case 'data_richiamo_asc': return out.sort(byRichiamo);
      default: return out; // ordine di caricamento
    }
  };

  // "richiamo_fissato_da" distingue un richiamo vero (fissato al telefono da te, data precisa)
  // da un richiamo di massa recuperato dall'importazione (data non significativa, solo un arretrato da smaltire)
  const richiamiOggi = applicaOrdine(leads.filter(l => l.stato === 'Richiamare' && l.richiamo_fissato_da !== 'import' && l.data_richiamo && l.data_richiamo <= today && matchFiltri(l)), ordinaRichiami);
  const richiamiArretratoImport = applicaOrdine(leads.filter(l => l.stato === 'Richiamare' && l.richiamo_fissato_da === 'import' && matchFiltri(l)), ordinaCoda);
  const riconatti = leads.filter(l => l.stato === 'Non interessato' && l.non_interessato_fino_a && l.non_interessato_fino_a <= today && matchFiltri(l));
  const daChiamare = applicaOrdine(leads.filter(l => (l.stato === 'Da chiamare' || l.stato === 'Non risponde') && matchFiltri(l)), ordinaCoda);
  const richiamiFuturi = applicaOrdine(leads.filter(l => l.stato === 'Richiamare' && l.richiamo_fissato_da !== 'import' && (!l.data_richiamo || l.data_richiamo > today) && matchFiltri(l)), ordinaRichiami);
  const nRichiamiBadge = leads.filter(l => (l.stato === 'Richiamare' && l.richiamo_fissato_da !== 'import' && l.data_richiamo && l.data_richiamo <= today) || (l.stato === 'Non interessato' && l.non_interessato_fino_a && l.non_interessato_fino_a <= today)).length;

  const OPZIONI_ORDINE_CODA = [
    { v: 'tentativi_asc', l: '↑ Meno tentativi prima' },
    { v: 'tentativi_desc', l: '↓ Più tentativi prima' },
    { v: 'contatto_vecchio', l: 'Contattati da più tempo' },
    { v: 'contatto_recente', l: 'Contattati di recente' },
    { v: 'azienda_az', l: 'Azienda A-Z' },
    { v: 'default', l: 'Ordine di caricamento' },
  ];
  const OPZIONI_ORDINE_RICHIAMI = [
    { v: 'data_richiamo_asc', l: 'Data richiamo (prima le scadenze vicine)' },
    { v: 'tentativi_asc', l: '↑ Meno tentativi prima' },
    { v: 'azienda_az', l: 'Azienda A-Z' },
    { v: 'default', l: 'Ordine di caricamento' },
  ];

  const liste = [...new Set(leads.map(l => l.lista).filter(Boolean))].sort();
  const categoriePresenti = CATEGORIE.filter(c => leads.some(l => l.categoria === c));

  const esitiOggi = leads.reduce((n, l) => n + (l.note_storia || []).filter(h => ESITI_VALIDI.has(h.esito) && (h.date || '').slice(0, 10) === today).length, 0);
  const apptOggi = leads.reduce((n, l) => n + (l.note_storia || []).filter(h => (h.date || '').slice(0, 10) === today && h.esito === 'Appuntamento fissato').length, 0);

  // ── KPI del mese ────────────────────────────────────────────
  const curMonth = today.slice(0, 7);
  const tuttiEsiti = [];
  leads.forEach(l => (l.note_storia || []).forEach(h => tuttiEsiti.push(h)));
  const esitiMese = tuttiEsiti.filter(h => (h.date || '').slice(0, 7) === curMonth && ESITI_VALIDI.has(h.esito));
  const chiamateMese = esitiMese.length;
  const conversazioniMese = esitiMese.filter(h => h.esito !== 'Non risponde' && h.esito !== 'Numero errato').length;
  const apptMese = esitiMese.filter(h => h.esito === 'Appuntamento fissato').length;
  const conversionePct = conversazioniMese > 0 ? Math.round(apptMese / conversazioniMese * 100) : 0;

  // Media storica chiamate/giorno lavorato (esclude oggi per confronto onesto)
  const giorniConAttivita = new Set(tuttiEsiti.filter(h => (h.date || '').slice(0, 10) !== today).map(h => (h.date || '').slice(0, 10)));
  const mediaGiornaliera = giorniConAttivita.size > 0 ? Math.round(tuttiEsiti.filter(h => (h.date||'').slice(0,10) !== today).length / giorniConAttivita.size) : 0;

  // Distribuzione esiti del mese (torta)
  const distribEsiti = ESITI_CHIAMATA.map(e => ({ ...e, n: esitiMese.filter(h => h.esito === e.name).length })).filter(e => e.n > 0);

  // Ricettività per categoria (dai lead lavorati)
  const catStats = {};
  leads.forEach(l => {
    if (!l.categoria || (l.tentativi || 0) === 0) return;
    if (!catStats[l.categoria]) catStats[l.categoria] = { tot: 0, appt: 0 };
    catStats[l.categoria].tot++;
    if ((l.note_storia || []).some(h => h.esito === 'Appuntamento fissato')) catStats[l.categoria].appt++;
  });
  const catRicettivita = Object.entries(catStats).map(([cat, s]) => ({ cat, tot: s.tot, appt: s.appt, pct: Math.round(s.appt / s.tot * 100) })).sort((a, b) => b.pct - a.pct);

  // Qualità appuntamenti (dalla funzione SQL — già filtrata sul suo nome dal database)
  // Nota: "Programmato" = appuntamento non ancora chiuso da Marco dopo l'incontro.
  // Non lo trattiamo come esito valido: la percentuale conta solo sui casi verificati.
  const qualitaAppt = (() => {
    if (!apptStats || !apptStats.length) return null;
    const agg = {};
    apptStats.forEach(r => { agg[r.stato] = (agg[r.stato] || 0) + Number(r.cnt); });
    const nonVerificati = agg['Programmato'] || 0;
    const aggVerificati = { ...agg }; delete aggVerificati['Programmato'];
    const totVerificati = Object.values(aggVerificati).reduce((s, v) => s + v, 0);
    const svolti = agg['Svolto'] || 0;
    return { agg: aggVerificati, totVerificati, nonVerificati, totComplessivo: totVerificati + nonVerificati, pctSvolti: totVerificati > 0 ? Math.round(svolti / totVerificati * 100) : null };
  })();

  // ── Grafico settimana (pagina home) ────────────────────────
  const giorni = []; { const d = new Date(); while (giorni.length < 5) { if (d.getDay() !== 0 && d.getDay() !== 6) giorni.unshift(d.toISOString().slice(0, 10)); d.setDate(d.getDate() - 1); } }
  const chiamateGiorni = giorni.map(g => leads.reduce((n, l) => n + (l.note_storia || []).filter(h => (h.date || '').slice(0, 10) === g).length, 0));
  const haAttivita = chiamateGiorni.some(v => v > 0);

  useEffect(() => {
    if (pageOp !== 'home' || !haAttivita || !chartRef.current) { chartC.current?.destroy(); chartC.current = null; return; }
    const appt = giorni.map(g => leads.reduce((n, l) => n + (l.note_storia || []).filter(h => (h.date || '').slice(0, 10) === g && h.esito === 'Appuntamento fissato').length, 0));
    const labels = giorni.map(g => new Date(g + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }));
    chartC.current?.destroy();
    chartC.current = new Chart(chartRef.current, { type: 'bar', data: { labels, datasets: [
      { label: 'Chiamate', data: chiamateGiorni, backgroundColor: '#89C4F4', borderRadius: 5 },
      { label: 'Appuntamenti', data: appt, backgroundColor: '#0050A0', borderRadius: 5 },
    ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { ticks: { stepSize: 1 }, grid: { color: 'rgba(0,120,212,0.06)' } } } } });
    return () => chartC.current?.destroy();
  }, [leads, haAttivita, pageOp]);

  // ── Torta esiti del mese ────────────────────────────────────
  useEffect(() => {
    if (pageOp !== 'home' || !esitiChartRef.current || !distribEsiti.length) { esitiChartC.current?.destroy(); esitiChartC.current = null; return; }
    esitiChartC.current?.destroy();
    esitiChartC.current = new Chart(esitiChartRef.current, { type: 'doughnut', data: {
      labels: distribEsiti.map(e => e.name),
      datasets: [{ data: distribEsiti.map(e => e.n), backgroundColor: distribEsiti.map(e => e.color), borderWidth: 0 }],
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } } } });
    return () => esitiChartC.current?.destroy();
  }, [pageOp, leads]);

  // ── Ricettività per categoria ───────────────────────────────
  useEffect(() => {
    if (pageOp !== 'home' || !catChartRef.current || !catRicettivita.length) { catChartC.current?.destroy(); catChartC.current = null; return; }
    catChartC.current?.destroy();
    catChartC.current = new Chart(catChartRef.current, { type: 'bar', data: {
      labels: catRicettivita.map(c => c.cat),
      datasets: [{ label: 'Conversione in appuntamento', data: catRicettivita.map(c => c.pct), backgroundColor: '#0078D4', borderRadius: 5 }],
    }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}% (${catRicettivita[ctx.dataIndex].appt}/${catRicettivita[ctx.dataIndex].tot})` } } }, scales: { x: { max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,120,212,0.06)' } }, y: { grid: { display: false } } } } });
    return () => catChartC.current?.destroy();
  }, [pageOp, leads]);

  // ── Qualità appuntamenti (Svolto / Non presentato / Da rifissare...) ──
  useEffect(() => {
    if (pageOp !== 'home' || !qualChartRef.current || !qualitaAppt || !qualitaAppt.totVerificati) { qualChartC.current?.destroy(); qualChartC.current = null; return; }
    const ordine = ['Svolto', 'Non si è presentato', 'Da rifissare', 'Non effettuato'];
    const colori = { 'Svolto': '#1B7A3E', 'Non si è presentato': '#A32D2D', 'Da rifissare': '#E07B1A', 'Non effettuato': '#888888' };
    const labels = ordine.filter(s => qualitaAppt.agg[s]);
    qualChartC.current?.destroy();
    qualChartC.current = new Chart(qualChartRef.current, { type: 'bar', data: {
      labels,
      datasets: [{ data: labels.map(s => qualitaAppt.agg[s]), backgroundColor: labels.map(s => colori[s]), borderRadius: 5 }],
    }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { ticks: { stepSize: 1 }, grid: { color: 'rgba(0,120,212,0.06)' } } } } });
    return () => qualChartC.current?.destroy();
  }, [pageOp, apptStats]);

  // ── Registrazione esito ────────────────────────────────────
  // apriLead: se richiamato da una riga di una coda (coda=array), memorizza la coda per il pulsante "Prossimo →"
  const apriLead = (l, t = 'esito', coda = null) => {
    setSelected(l); setEsitoOpen(null); setTab(t);
    if (coda) { setCodaCorrente(coda.map(x => x.id)); setCodaIndice(coda.findIndex(x => x.id === l.id)); }
    else { setCodaCorrente(null); setCodaIndice(0); }
  };
  const apriEsito = (esito) => { setEsitoOpen(esito); setNota(''); setDataRichiamo(''); setRicontatto('6m'); };

  const NOTE_RAPIDE = ['Non disponibile al momento', 'Richiamare dopo pranzo', 'Numero non più attivo', 'Chiedere del titolare', 'Segreteria, non ha voluto passare la chiamata'];

  const registraEsito = async (vaiAlProssimoDopo) => {
    if (!selected || !esitoOpen || saving) return;
    const e = esitoOpen;
    if (e.tipo === 'richiamo' && !dataRichiamo) { showToast('Indica la data di richiamo', 'err'); return; }
    setSaving(true);
    const nowIso = new Date().toISOString();
    const entry = { id: Date.now().toString(36), date: nowIso, esito: e.name, testo: nota.trim() };
    // Salvo lo stato precedente per l'eventuale "Annulla ultima registrazione"
    const prima = { stato: selected.stato, tentativi: selected.tentativi, ultimo_contatto: selected.ultimo_contatto, note_storia: selected.note_storia, data_richiamo: selected.data_richiamo, non_interessato_fino_a: selected.non_interessato_fino_a, richiamo_fissato_da: selected.richiamo_fissato_da };
    const fields = {
      stato: e.name,
      tentativi: (selected.tentativi || 0) + 1,
      ultimo_contatto: nowIso,
      note_storia: [...(selected.note_storia || []), entry],
      data_richiamo: e.tipo === 'richiamo' ? dataRichiamo : null,
      non_interessato_fino_a: null,
      richiamo_fissato_da: e.tipo === 'richiamo' ? 'operatore' : null,
    };
    if (e.tipo === 'noninteressato' && ricontatto !== 'mai') {
      const d = new Date(); d.setMonth(d.getMonth() + (ricontatto === '6m' ? 6 : 12));
      fields.non_interessato_fino_a = d.toISOString().slice(0, 10);
    }
    const leadIdAppenaSalvato = selected.id;
    const ok = await dbUpdateLead(leadIdAppenaSalvato, fields);
    setSaving(false);
    if (!ok) { showToast('Salvataggio non riuscito. Riprova.', 'err'); return; }
    setLeads(prev => prev.map(l => l.id === leadIdAppenaSalvato ? { ...l, ...fields } : l));
    setSessionCount(n => n + 1);
    setUltimaAzione({ leadId: leadIdAppenaSalvato, nomeAzienda: selected.azienda || selected.nome || 'il lead', esitoNome: e.name, campiPrima: prima });
    setEsitoOpen(null);

    if (vaiAlProssimoDopo && codaCorrente && codaCorrente.length) {
      const prossimoIndice = codaIndice + 1;
      const prossimoId = codaCorrente[prossimoIndice];
      if (prossimoId) {
        // il lead aggiornato potrebbe non essere più nella lista "leads" fresca al momento giusto: lo cerco dopo l'aggiornamento locale
        setTimeout(() => {
          setLeads(curr => {
            const prossimo = curr.find(x => x.id === prossimoId);
            if (prossimo) { setSelected(prossimo); setCodaIndice(prossimoIndice); setTab('esito'); }
            else { setSelected(null); setCodaCorrente(null); showToast('Coda completata! 🎉'); }
            return curr;
          });
        }, 0);
        showToast(e.name === 'Appuntamento fissato' ? '🎉 Appuntamento registrato!' : `Esito registrato: ${e.name}`);
        return;
      }
      setSelected(null); setCodaCorrente(null);
      showToast('Coda completata! 🎉');
      return;
    }
    setSelected(null);
    showToast(e.name === 'Appuntamento fissato' ? '🎉 Appuntamento registrato!' : `Esito registrato: ${e.name}`);
  };

  const annullaUltimaAzione = async () => {
    if (!ultimaAzione) return;
    const ok = await dbUpdateLead(ultimaAzione.leadId, ultimaAzione.campiPrima);
    if (!ok) { showToast('Impossibile annullare, riprova.', 'err'); return; }
    setLeads(prev => prev.map(l => l.id === ultimaAzione.leadId ? { ...l, ...ultimaAzione.campiPrima } : l));
    setSessionCount(n => Math.max(0, n - 1));
    showToast(`Registrazione annullata per ${ultimaAzione.nomeAzienda}`, 'info');
    setUltimaAzione(null);
  };

  // ── Componenti ─────────────────────────────────────────────
  const statoInfo = s => ESITI_CHIAMATA.find(x => x.name === s) || { icon: '📞', color: BLU };

  const Riga = ({ l, hot, mostraStato, coda }) => {
    const ultimaNota = (l.note_storia || []).filter(h => h.testo).slice(-1)[0]?.testo;
    return (
    <div className={'opv-row' + (hot ? ' hot' : '')} onClick={() => apriLead(l, mostraStato ? 'scheda' : 'esito', coda)}>
      <div className="who">
        <div className="az">{l.azienda || l.nome || '—'}</div>
        <div className="det">
          {l.nome && l.azienda ? l.nome : ''}{l.citta ? (l.nome && l.azienda ? ' · ' : '') + l.citta : ''}
          {hot && l.data_richiamo ? ` · richiamo ${new Date(l.data_richiamo + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}
          {l.tentativi > 0 ? ` · ${l.tentativi} tentativ${l.tentativi === 1 ? 'o' : 'i'}` : ''}
        </div>
        <div style={{ marginTop: 3 }}>
          {l.categoria && <span className="opv-chip" style={{ background: 'rgba(0,120,212,.1)', color: '#005A9E' }}>{l.categoria}</span>}
          {l.lista && <span className="opv-chip" style={{ background: '#EEF1F5', color: '#5A6B7E' }}>{l.lista}</span>}
        </div>
        {ultimaNota && <div className="nota">📝 {ultimaNota}</div>}
      </div>
      {hot && <span className="opv-tag" style={{ background: '#E07B1A20', color: '#B35F0E' }}>{l.stato === 'Richiamare' ? '🔄 Richiamo' : '📅 Ricontatto'}</span>}
      {mostraStato && <span className="opv-statochip" style={{ background: statoInfo(l.stato).color + '18', color: statoInfo(l.stato).color }}>{statoInfo(l.stato).icon} {l.stato}</span>}
      {l.telefono && <a className="opv-call" href={'tel:' + l.telefono.replace(/\s/g, '')} onClick={e => e.stopPropagation()}>📞 {l.telefono}{(l.telefono2 || l.telefono3) && <span style={{ opacity: .75, fontWeight: 400 }}> +{[l.telefono2, l.telefono3].filter(Boolean).length}</span>}</a>}
      <button className="opv-open" onClick={e => { e.stopPropagation(); apriLead(l, 'esito', coda); }}>Registra esito</button>
    </div>
  );};

  const Sezione = ({ titolo, items, hot, vuoto, mostraStato, visCount, setVisCount, extra }) => {
    const mostrati = visCount ? items.slice(0, visCount) : items;
    return (
    <div className="opv-card">
      <div className="opv-card-title">
        {titolo} <span style={{ color: BLU }}>({items.length})</span>
        {extra}
      </div>
      {items.length === 0 ? <div className="opv-empty">{vuoto}</div> : mostrati.map(l => <Riga key={l.id} l={l} hot={hot} mostraStato={mostraStato} coda={items} />)}
      {visCount && items.length > visCount && (
        <button className="opv-btn" style={{ width: '100%', marginTop: 6 }} onClick={() => setVisCount(v => v + 50)}>Mostra altri 50 (di {items.length - visCount} rimanenti)</button>
      )}
    </div>
  );};

  const Filtri = ({ conStato }) => (
    <div className="opv-card">
      <div className="opv-filters">
        <input className="opv-input opv-search" placeholder="🔎 Cerca nome, azienda, telefono, città..." value={cerca} onChange={e => setCerca(e.target.value)} />
        <select className="opv-select" value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {categoriePresenti.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {liste.length > 1 && (
          <select className="opv-select" value={fLista} onChange={e => setFLista(e.target.value)}>
            <option value="">Tutte le liste</option>
            {liste.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {conStato && (
          <select className="opv-select" value={fStato} onChange={e => setFStato(e.target.value)}>
            <option value="">Tutti gli stati</option>
            <option value="Da chiamare">Da chiamare</option>
            {ESITI_CHIAMATA.map(e => <option key={e.name} value={e.name}>{e.icon} {e.name}</option>)}
          </select>
        )}
        {(fCategoria || fLista || cerca || fStato) && <button className="opv-btn" onClick={() => { setFCategoria(''); setFLista(''); setCerca(''); setFStato(''); }}>✕ Azzera</button>}
      </div>
    </div>
  );

  // ── Agenda settimanale richiami ────────────────────────────
  const lunedi = (() => { const d = new Date(); d.setDate(d.getDate() + weekOffset * 7); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return d; })();
  const giorniSett = Array.from({ length: 5 }, (_, i) => { const d = new Date(lunedi); d.setDate(lunedi.getDate() + i); return d.toISOString().slice(0, 10); });
  const richiamiGiorno = g => leads.filter(l => l.stato === 'Richiamare' && l.richiamo_fissato_da !== 'import' && l.data_richiamo === g && matchFiltri(l));
  const richiamiSenzaData = leads.filter(l => l.stato === 'Richiamare' && l.richiamo_fissato_da !== 'import' && !l.data_richiamo && matchFiltri(l));
  const labelSett = `${lunedi.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${new Date(giorniSett[4] + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const AgendaSettimana = () => (
    <div className="opv-card">
      <div className="opv-card-title">
        🗓 Agenda richiami
        <div className="opv-weeknav">
          <button className="opv-btn" style={{ padding: '6px 13px', fontSize: 12.5 }} onClick={() => setWeekOffset(w => w - 1)}>← Prec.</button>
          <button className="opv-btn" style={{ padding: '6px 13px', fontSize: 12.5, ...(weekOffset === 0 ? { borderColor: '#0078D4', color: '#0078D4' } : {}) }} onClick={() => setWeekOffset(0)}>Oggi</button>
          <button className="opv-btn" style={{ padding: '6px 13px', fontSize: 12.5 }} onClick={() => setWeekOffset(w => w + 1)}>Succ. →</button>
          <span className="lbl">{labelSett}</span>
        </div>
      </div>
      <div className="opv-week">
        {giorniSett.map(g => {
          const items = richiamiGiorno(g);
          const d = new Date(g + 'T12:00');
          const scaduto = g < today;
          return (
            <div key={g} className={'opv-day' + (g === today ? ' today' : '')}>
              <div className="opv-day-h">
                <span>{d.toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                <span className="num" style={scaduto ? { color: '#B35F0E' } : {}}>{d.getDate()}</span>
              </div>
              {items.length === 0
                ? <div style={{ fontSize: 11.5, color: '#B0BCC9', textAlign: 'center', paddingTop: 8 }}>—</div>
                : items.map(l => (
                  <div key={l.id} className="opv-mini" style={scaduto ? { borderLeftColor: '#E07B1A' } : {}} onClick={() => apriLead(l, 'esito')}>
                    <div className="n">{l.azienda || l.nome || '—'}</div>
                    <div className="t">{l.telefono || ''}</div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      {richiamiSenzaData.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#6B7A8C' }}>
          ⚠ {richiamiSenzaData.length} richiam{richiamiSenzaData.length === 1 ? 'o' : 'i'} senza data: {richiamiSenzaData.map(l => l.azienda || l.nome).join(', ')}
        </div>
      )}
    </div>
  );

  const titoli = { home: 'Dashboard', coda: 'Coda chiamate', richiami: 'Richiami', archivio: 'Archivio lead' };
  const daFare = [...richiamiOggi, ...riconatti, ...daChiamare].slice(0, 5);
  const archivioLeads = leads.filter(l => matchFiltri(l) && (!fStato || l.stato === fStato));

  if (loading) return (
    <div className="opv"><style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100%' }}>
        <div style={{ width: 38, height: 38, border: '3.5px solid #D4DEE9', borderTop: `3.5px solid ${BLU}`, borderRadius: '50%', animation: 'opvspin .8s linear infinite' }} />
        <style>{`@keyframes opvspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  return (
    <div className="opv">
      <style>{CSS}</style>

      <button className="opv-burger" onClick={() => setSideOpen(o => !o)}>{sideOpen ? '✕' : '☰'}</button>
      <div className={'opv-overlay' + (sideOpen ? ' show' : '')} onClick={() => setSideOpen(false)} />

      {/* ── Sidebar ── */}
      <aside className={'opv-side' + (sideOpen ? ' open' : '')}>
        <div className="opv-logo">
          <div className="big">SalesPRO</div>
          <div className="sub">Telemarketing</div>
        </div>
        <div className="opv-navlabel">Menu</div>
        {NAV_OP.map(item => (
          <button key={item.id} className={'opv-navitem' + (pageOp === item.id ? ' active' : '')}
            onClick={() => { setPageOp(item.id); setSideOpen(false); }}>
            <svg className="opv-navicon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={item.icon} /></svg>
            <span>{item.label}</span>
            {item.badge && nRichiamiBadge > 0 && <span className="opv-navbadge">{nRichiamiBadge}</span>}
          </button>
        ))}
        <div className="opv-sidefoot">
          <strong>{profile?.nome || 'Operatore'}</strong>
          <span>Il Sole 24 Ore Professionale</span>
          <button className="opv-esci" onClick={onLogout}>Esci</button>
        </div>
      </aside>

      {/* ── Contenuto ── */}
      <main className="opv-main">
        <div className="opv-topbar">
          <span className="opv-title">{pageOp === 'home' ? `Ciao ${profile?.nome || ''} 👋` : titoli[pageOp]}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {sessionCount > 0 && <span className="opv-sessionbadge">✓ {sessionCount} lavorati in questa sessione</span>}
            <span className="opv-date">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </span>
        </div>

        {ultimaAzione && !selected && (
          <div className="opv-undobar">
            <span>✓ Registrato <strong>{ultimaAzione.esitoNome}</strong> per {ultimaAzione.nomeAzienda}</span>
            <button className="opv-undobtn" onClick={annullaUltimaAzione}>↩ Annulla</button>
            <button className="opv-undobtn" style={{ marginLeft: 'auto', background: 'transparent', border: 'none' }} onClick={() => setUltimaAzione(null)}>✕</button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {pageOp === 'home' && (
          <>
            {nRichiamiBadge > 0 && (
              <div className="opv-banner" onClick={() => setPageOp('richiami')}>
                🔄 {nRichiamiBadge} {nRichiamiBadge === 1 ? 'richiamo' : 'richiami'} da fare oggi — Vedi →
              </div>
            )}
            {richiamiArretratoImport.length > 0 && (
              <div className="fs-12" style={{ color: '#6B7A8C', marginTop: 8, cursor: 'pointer' }} onClick={() => setPageOp('richiami')}>
                🗂 Hai anche {richiamiArretratoImport.length.toLocaleString('it-IT')} lead in arretrato dall'importazione, senza scadenza — lavorali con calma quando vuoi →
              </div>
            )}
            <div className="opv-metrics">
              <div className="opv-metric"><div className="lbl">Chiamate oggi</div><div className="val" style={{ color: BLU }}>{esitiOggi}</div><div className="sub">esiti registrati</div></div>
              <div className="opv-metric"><div className="lbl">Appuntamenti</div><div className="val" style={{ color: '#1B7A3E' }}>{apptOggi}</div><div className="sub">fissati oggi 🎯</div></div>
              <div className="opv-metric" style={{ cursor: 'pointer' }} onClick={() => setPageOp('richiami')}><div className="lbl">Richiami</div><div className="val" style={{ color: '#E07B1A' }}>{nRichiamiBadge}</div><div className="sub">da fare oggi →</div></div>
              <div className="opv-metric" style={{ cursor: 'pointer' }} onClick={() => setPageOp('coda')}><div className="lbl">In coda</div><div className="val" style={{ color: '#33475B' }}>{daChiamare.length}</div><div className="sub">da chiamare →</div></div>
            </div>

            <div className="opv-card">
              <div className="opv-card-title">▶ Da fare adesso</div>
              {daFare.length === 0
                ? <div className="opv-empty">{leads.length === 0 ? 'Nessuna lista caricata: appena Marco importa i lead, li troverai qui.' : 'Tutto lavorato per oggi 🎉'}</div>
                : daFare.map(l => <Riga key={l.id} l={l} hot={l.stato === 'Richiamare' || l.stato === 'Non interessato'} coda={daFare} />)}
              {(richiamiOggi.length + riconatti.length + daChiamare.length) > 5 && (
                <button className="opv-btn" style={{ width: '100%', marginTop: 4 }} onClick={() => setPageOp('coda')}>Vedi tutta la coda →</button>
              )}
            </div>

            {haAttivita && (
              <div className="opv-card">
                <div className="opv-card-title">La tua settimana</div>
                <div style={{ height: 170, position: 'relative' }}><canvas ref={chartRef} /></div>
              </div>
            )}

            {chiamateMese > 0 && (
              <div className="opv-card">
                <div className="opv-card-title">📈 Il tuo mese — {new Date(curMonth + '-01T12:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 4 }}>
                  <div>
                    <div className="lbl" style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7A8C', textTransform: 'uppercase' }}>Chiamate</div>
                    <div style={{ fontSize: 26, fontWeight: 800 }}>{chiamateMese}</div>
                    {mediaGiornaliera > 0 && <div style={{ fontSize: 11.5, color: '#6B7A8C' }}>media {mediaGiornaliera}/giorno</div>}
                  </div>
                  <div>
                    <div className="lbl" style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7A8C', textTransform: 'uppercase' }}>Appuntamenti</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#1B7A3E' }}>{apptMese}</div>
                  </div>
                  <div>
                    <div className="lbl" style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7A8C', textTransform: 'uppercase' }}>Tasso di conversione</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0078D4' }}>{conversionePct}%</div>
                    <div style={{ fontSize: 11.5, color: '#6B7A8C' }}>su conversazioni utili</div>
                  </div>
                </div>
              </div>
            )}

            {(distribEsiti.length > 0 || catRicettivita.length > 0) && (
              <div className="opv-grid2">
                {distribEsiti.length > 0 && (
                  <div className="opv-card">
                    <div className="opv-card-title">🎯 Come sono andate le chiamate (mese)</div>
                    <div style={{ height: 190, position: 'relative' }}><canvas ref={esitiChartRef} /></div>
                  </div>
                )}
                {catRicettivita.length > 0 && (
                  <div className="opv-card">
                    <div className="opv-card-title">🏆 Categorie più ricettive</div>
                    <div style={{ height: 190, position: 'relative' }}><canvas ref={catChartRef} /></div>
                  </div>
                )}
              </div>
            )}

            {qualitaAppt && qualitaAppt.totComplessivo > 0 && (
              <div className="opv-card">
                <div className="opv-card-title">✨ Qualità dei tuoi appuntamenti</div>
                {qualitaAppt.totVerificati > 0 ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: '#1B7A3E' }}>{qualitaAppt.pctSvolti}%</span>
                      <span style={{ fontSize: 13, color: '#6B7A8C' }}>si sono effettivamente svolti (su {qualitaAppt.totVerificati} verificati)</span>
                    </div>
                    <div style={{ height: 160, position: 'relative', marginTop: 10 }}><canvas ref={qualChartRef} /></div>
                  </>
                ) : (
                  <div className="opv-empty">Nessun appuntamento ancora verificato da Marco.</div>
                )}
                {qualitaAppt.nonVerificati > 0 && (
                  <div style={{ fontSize: 11.5, color: '#8A97A6', marginTop: 10 }}>
                    ⏳ {qualitaAppt.nonVerificati} appuntament{qualitaAppt.nonVerificati === 1 ? 'o' : 'i'} in attesa di verifica da parte di Marco — non {qualitaAppt.nonVerificati === 1 ? 'è incluso' : 'sono inclusi'} nella percentuale.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── CODA CHIAMATE ── */}
        {pageOp === 'coda' && (
          <>
            <Filtri />
            <Sezione
              titolo="📞 Da chiamare" items={daChiamare}
              vuoto={leads.length === 0 ? 'Nessuna lista caricata: appena Marco importa i lead, li troverai qui.' : 'Tutto lavorato con questi filtri 🎉'}
              visCount={visCoda} setVisCount={setVisCoda}
              extra={
                <select className="opv-select" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 8px' }} value={ordinaCoda} onChange={e => { setOrdinaCoda(e.target.value); setVisCoda(50); }}>
                  {OPZIONI_ORDINE_CODA.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              }
            />
          </>
        )}

        {/* ── RICHIAMI ── */}
        {pageOp === 'richiami' && (
          <>
            <div className="opv-toggle">
              <button className={'opv-togglebtn' + (richiamiView === 'list' ? ' on' : '')} onClick={() => setRichiamiView('list')}>Lista</button>
              <button className={'opv-togglebtn' + (richiamiView === 'cal' ? ' on' : '')} onClick={() => setRichiamiView('cal')}>Calendario</button>
            </div>
            <Filtri />
            {richiamiView === 'cal' ? (
              <>
                <AgendaSettimana />
                <div className="opv-grid2">
                  <Sezione titolo="🔄 Richiami di oggi" items={richiamiOggi} hot vuoto="Nessun richiamo fissato in scadenza 🎉" />
                  <Sezione
                    titolo="🗂 Arretrato da smaltire (dall'importazione)"
                    items={richiamiArretratoImport}
                    vuoto="Arretrato smaltito, ottimo lavoro 🎉"
                    visCount={visArretrato} setVisCount={setVisArretrato}
                    extra={
                      <select className="opv-select" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 8px' }} value={ordinaCoda} onChange={e => setOrdinaCoda(e.target.value)}>
                        {OPZIONI_ORDINE_CODA.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    }
                  />
                </div>
                <Sezione titolo="📅 Da ricontattare (erano non interessati)" items={riconatti} vuoto="Nessun ricontatto maturato" visCount={visRiconatti} setVisCount={setVisRiconatti} />
              </>
            ) : (
              <>
                <div className="opv-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="fs-12" style={{ fontWeight: 700, color: '#33475B' }}>Ordina richiami fissati:</span>
                  <select className="opv-select" style={{ fontSize: 12, padding: '5px 8px' }} value={ordinaRichiami} onChange={e => setOrdinaRichiami(e.target.value)}>
                    {OPZIONI_ORDINE_RICHIAMI.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <Sezione titolo="🔄 Richiami di oggi" items={richiamiOggi} hot vuoto="Nessun richiamo fissato in scadenza 🎉" visCount={visRichiami} setVisCount={setVisRichiami} />
                <Sezione titolo="⏳ Richiami programmati (prossimi giorni)" items={richiamiFuturi} vuoto="Nessun richiamo futuro in agenda" />

                <div className="opv-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="fs-12" style={{ fontWeight: 700, color: '#33475B' }}>Ordina arretrato:</span>
                  <select className="opv-select" style={{ fontSize: 12, padding: '5px 8px' }} value={ordinaCoda} onChange={e => setOrdinaCoda(e.target.value)}>
                    {OPZIONI_ORDINE_CODA.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <Sezione titolo="🗂 Arretrato da smaltire (dall'importazione)" items={richiamiArretratoImport} vuoto="Arretrato smaltito, ottimo lavoro 🎉" visCount={visArretrato} setVisCount={setVisArretrato} />
                <Sezione titolo="📅 Da ricontattare (erano non interessati)" items={riconatti} vuoto="Nessun ricontatto maturato" visCount={visRiconatti} setVisCount={setVisRiconatti} />
              </>
            )}
          </>
        )}

        {/* ── ARCHIVIO ── */}
        {pageOp === 'archivio' && (
          <>
            <Filtri conStato />
            <div className="opv-card">
              <div className="opv-card-title" style={{ flexWrap: 'wrap' }}>
                🗂 Tutti i lead <span style={{ color: '#0078D4' }}>({archivioLeads.length})</span>
                <select className="opv-select" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 8px' }} value={ordinaCoda} onChange={e => { setOrdinaCoda(e.target.value); setVisArchivio(50); }}>
                  {OPZIONI_ORDINE_CODA.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              {archivioLeads.length === 0 ? <div className="opv-empty">Nessun lead con questi filtri</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="opv-table">
                    <thead><tr><th>Azienda / Referente</th><th>Categoria</th><th>Telefono</th><th>Lista</th><th>Stato</th><th style={{ textAlign: 'right' }}>Tent.</th><th>Ultima nota</th><th>Ultimo contatto</th></tr></thead>
                    <tbody>
                      {applicaOrdine(archivioLeads, ordinaCoda).slice(0, visArchivio).map(l => {
                        const un = (l.note_storia || []).filter(h => h.testo).slice(-1)[0]?.testo;
                        const si = statoInfo(l.stato);
                        return (
                          <tr key={l.id} onClick={() => apriLead(l, 'scheda')}>
                            <td><strong>{l.azienda || l.nome || '—'}</strong>{l.azienda && l.nome ? <div style={{ fontSize: 11.5, color: '#6B7A8C' }}>{l.nome}</div> : null}</td>
                            <td>{l.categoria || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{l.telefono || '—'}</td>
                            <td>{l.lista || '—'}</td>
                            <td><span className="opv-statochip" style={{ background: si.color + '18', color: si.color }}>{si.icon} {l.stato}</span></td>
                            <td style={{ textAlign: 'right' }}>{l.tentativi || 0}</td>
                            <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: un ? 'italic' : 'normal', color: un ? '#5A6B7E' : '#B0BCC9' }}>{un || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{l.ultimo_contatto ? fmtDT(l.ultimo_contatto) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {archivioLeads.length > visArchivio && (
                    <button className="opv-btn" style={{ width: '100%', marginTop: 10 }} onClick={() => setVisArchivio(v => v + 50)}>Mostra altri 50 (di {archivioLeads.length - visArchivio} rimanenti)</button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Scheda lead ── */}
      {selected && (
        <div className="opv-modal-bg" onClick={() => { setSelected(null); setEsitoOpen(null); }}>
          <div className="opv-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 21, fontWeight: 800 }}>{selected.azienda || selected.nome || '—'}</div>
                <div style={{ fontSize: 13, color: '#6B7A8C', marginTop: 2 }}>
                  {selected.nome && selected.azienda ? selected.nome + ' · ' : ''}{selected.categoria || ''}{selected.citta ? ' · ' + selected.citta : ''}{selected.provincia ? ' (' + selected.provincia + ')' : ''}
                </div>
              </div>
              <button className="opv-btn" onClick={() => { setSelected(null); setEsitoOpen(null); }}>✕</button>
            </div>

            <a className="opv-bigcall" href={'tel:' + (selected.telefono || '').replace(/\s/g, '')}>📞 {selected.telefono || 'Nessun numero'}</a>
            {(selected.telefono2 || selected.telefono3) && (
              <div className="opv-callrow">
                {selected.telefono2 && <a className="opv-bigcall small" href={'tel:' + selected.telefono2.replace(/\s/g, '')}>☎ {selected.telefono2}</a>}
                {selected.telefono3 && <a className="opv-bigcall small" href={'tel:' + selected.telefono3.replace(/\s/g, '')}>☎ {selected.telefono3}</a>}
              </div>
            )}
            <div style={{ textAlign: 'center', fontSize: 12, color: '#6B7A8C', marginBottom: 14 }}>
              {selected.email ? <>✉ {selected.email} · </> : null}
              Lista: <strong>{selected.lista || '—'}</strong> · Tentativi: <strong>{selected.tentativi || 0}</strong>
              {selected.ultimo_contatto ? <> · Ultimo: <strong>{fmtDT(selected.ultimo_contatto)}</strong></> : null}
            </div>

            <div className="opv-tabs">
              <button className={'opv-tab' + (tab === 'esito' ? ' on' : '')} onClick={() => setTab('esito')}>📞 Registra esito</button>
              <button className={'opv-tab' + (tab === 'scheda' ? ' on' : '')} onClick={() => { setTab('scheda'); setEsitoOpen(null); }}>📋 Scheda e storico</button>
            </div>

            {tab === 'scheda' && (
              <>
                <dl className="opv-dl">
                  {selected.nome && <><dt>Referente</dt><dd>{selected.nome}</dd></>}
                  {selected.categoria && <><dt>Categoria</dt><dd>{selected.categoria}</dd></>}
                  {selected.telefono && <><dt>Telefono</dt><dd>{selected.telefono}</dd></>}
                  {selected.email && <><dt>Email</dt><dd>{selected.email}</dd></>}
                  {(selected.citta || selected.provincia) && <><dt>Città</dt><dd>{selected.citta || ''}{selected.provincia ? ' (' + selected.provincia + ')' : ''}</dd></>}
                  <dt>Lista</dt><dd>{selected.lista || '—'}</dd>
                  <dt>Stato</dt><dd>{statoInfo(selected.stato).icon} {selected.stato}</dd>
                  <dt>Tentativi</dt><dd>{selected.tentativi || 0}</dd>
                  {selected.ultimo_contatto && <><dt>Ultimo contatto</dt><dd>{fmtDT(selected.ultimo_contatto)}</dd></>}
                  {selected.data_richiamo && <><dt>Richiamo</dt><dd>🔄 {new Date(selected.data_richiamo + 'T12:00').toLocaleDateString('it-IT')}</dd></>}
                  {selected.non_interessato_fino_a && <><dt>Ricontattabile dal</dt><dd>📅 {new Date(selected.non_interessato_fino_a + 'T12:00').toLocaleDateString('it-IT')}</dd></>}
                </dl>
                <div className="opv-card-title">Storico chiamate e note</div>
                {(selected.note_storia || []).length === 0 ? (
                  <div className="opv-empty">Nessuna chiamata registrata finora.</div>
                ) : (
                  [...selected.note_storia].reverse().map(h => {
                    const e = ESITI_CHIAMATA.find(x => x.name === h.esito);
                    return (
                      <div key={h.id} className="opv-hist" style={{ borderColor: e?.color || BLU }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: e?.color || '#33475B' }}>{e?.icon || '📝'} {h.esito || 'Nota'} <span style={{ fontWeight: 400, color: '#8A97A6' }}>— {fmtDT(h.date)}</span></div>
                        {h.testo && <div style={{ fontSize: 14 }}>{h.testo}</div>}
                      </div>
                    );
                  })
                )}
              </>
            )}

            {tab === 'esito' && (!esitoOpen ? (
              <>
                <div className="opv-card-title">Com'è andata la chiamata?</div>
                <div className="opv-esiti">
                  {ESITI_CHIAMATA.map(e => (
                    <button key={e.name} className="opv-esito-btn" onClick={() => apriEsito(e)}
                      style={{ background: e.color + '14', border: `1.5px solid ${e.color}`, color: e.color }}>
                      {e.icon} {e.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ background: esitoOpen.color + '0d', border: `1px solid ${esitoOpen.color}55`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: esitoOpen.color, marginBottom: 12 }}>{esitoOpen.icon} {esitoOpen.name}</div>

                {esitoOpen.tipo === 'richiamo' && (
                  <div style={{ marginBottom: 12 }}>
                    <label className="opv-form-label">Quando richiamare? *</label>
                    <input type="date" className="opv-input" style={{ width: '100%' }} min={today} value={dataRichiamo} onChange={e => setDataRichiamo(e.target.value)} />
                  </div>
                )}

                {esitoOpen.tipo === 'noninteressato' && (
                  <div style={{ marginBottom: 12 }}>
                    <label className="opv-form-label">Ricontattabile tra:</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[['6m', '6 mesi'], ['12m', '12 mesi'], ['mai', 'Mai più']].map(([v, lab]) => (
                        <button key={v} className="opv-btn" onClick={() => setRicontatto(v)}
                          style={{ flex: 1, ...(ricontatto === v ? { background: BLU + '15', borderColor: BLU, color: BLU } : {}) }}>
                          {lab}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {esitoOpen.tipo === 'appuntamento' && (
                  <div style={{ background: '#1B7A3E12', border: '1px solid #1B7A3E55', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 }}>
                    🎯 Ricorda di inviare il link per la prenotazione:<br />
                    <a href={DEFAULT_BRAND.callink} target="_blank" rel="noreferrer" style={{ color: '#1B7A3E', fontWeight: 700, fontSize: 12, wordBreak: 'break-all' }}>{DEFAULT_BRAND.callink}</a>
                  </div>
                )}

                <div style={{ marginBottom: 4 }}>
                  <label className="opv-form-label">Nota {esitoOpen.tipo === 'noninteressato' ? '(motivo, prodotto concorrente, scadenze...)' : '(facoltativa)'}</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {NOTE_RAPIDE.map(nr => (
                      <button key={nr} type="button" className="opv-notachip" onClick={() => setNota(n => n ? n + ' · ' + nr : nr)}>{nr}</button>
                    ))}
                  </div>
                  <textarea className="opv-textarea" rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Es. richiamare dopo le 15, chiedere del titolare..." />
                </div>

                <div className="opv-actions">
                  <button className="opv-btn" onClick={() => setEsitoOpen(null)} disabled={saving}>← Indietro</button>
                  <button className="opv-btn" onClick={() => registraEsito(false)} disabled={saving}>{saving ? '⏳...' : 'Registra e chiudi'}</button>
                  <button className="opv-btn primary" onClick={() => registraEsito(true)} disabled={saving}>{saving ? '⏳ Salvataggio...' : (codaCorrente && codaCorrente.length ? 'Registra e prossimo →' : 'Registra esito')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="opv-toast" style={{ background: toast.type === 'err' ? '#A32D2D' : '#1B7A3E' }}>{toast.msg}</div>}
    </div>
  );
}
