export const FONTI = [
  { name: 'Telemarketing Rosanna', color: '#7F77DD', icon: '📞' },
  { name: 'TMK Serena',            color: '#9B6DD4', icon: '📞' },
  { name: 'TMK NTC',               color: '#6B5EA8', icon: '📞' },
  { name: 'LinkedIn',              color: '#0A66C2', icon: '🔗' },
  { name: 'Coupon Aziendale',      color: '#E07B1A', icon: '🎟' },
  { name: 'Autonomia',             color: '#639922', icon: '⭐' },
  { name: 'Email Marketing',       color: '#c8102e', icon: '✉' },
  { name: 'Calendly',              color: '#006BFF', icon: '📅' },
  { name: 'Bookings',              color: '#0078D4', icon: '📆' },
  { name: 'Portafoglio',           color: '#2E7D32', icon: '💼' },
];
export const CATEGORIE = [
  'Avvocato / Studio Legale','Architetto','Azienda','Caf/Patronato',
  'Commercialista','Consulente del Lavoro','Geometra','Ingegnere','Notaio','Tributarista',
  'Professionisti Generici / CED','Multiprofessionale','Amministratore di Condominio','Altro',
];
export const ESITI = [
  { name: 'Positivo', color: '#639922' },
  { name: 'In valutazione', color: '#E07B1A' },
  { name: 'Negativo', color: '#A32D2D' },
];
export const PROPOSTE = [
  { name: 'Offerta Inviata', color: '#639922' },
  { name: 'Non inviata', color: '#888888' },
];
export const STATI_APPT = [
  { name: 'Programmato',         icon: '⏳', color: '#378ADD' },
  { name: 'Svolto',              icon: '✅', color: '#639922' },
  { name: 'Da rifissare',        icon: '🔄', color: '#E07B1A' },
  { name: 'Non effettuato',      icon: '❌', color: '#A32D2D' },
  { name: 'Non si è presentato', icon: '🚫', color: '#A32D2D' },
];
export const PRODOTTI = [
  'Editoria elettronica','Software','Formazione','Partner24 Ore',
  'ItalyX','Quotidiani','Altri Prodotti',
];
// Catalogo prodotti per categoria — organizzato da Marco, usato per i suggerimenti nel campo
// Nome prodotto (ricerca/selezione guidata, ma resta testo libero: non è un elenco chiuso).
export const CATALOGO_PRODOTTI = {
  'Editoria elettronica': [
    'Top24 Fisco AI',
    'Top24 Fisco AI Pro',
    'Top24 Fisco Gold',
    'Top24 Lavoro AI',
    'Top24 Diritto AI',
    'Top24 Lavoro',
    'Top24 Diritto',
    'Smart Fisco24 Pro',
    'Smart Fisco24 Pro AI',
    'Smart Fisco24 Premium',
    'Smart Fisco24 Premium AI',
    'Smart Fisco24 Fisco',
    'Smart Lex24 AI',
    'Smart Lex24',
    'Smart Lavoro24 Consulenze',
    'Smart Lavoro24 Pro AI',
    'Smart Lavoro24 AI',
    'Smart Lavoro24 Apprendistato',
    'Smart Lavoro24 Appalti',
    'Smart Tecnici24',
    'Smart Condominio24',
    'Smart 24 Hse',
    'Smart 24 Superbonus',
    'Smart Pa24',
    'Smart Pa Polizia Locale',
    'Smart 24 Edilizia',
    'Smart 24 Azienda',
    'Quotidiano Digitale Abbinato A Banca Dati',
    'Modulo24 Contratti',
    'Modulo24 Responsabilitá E Risarcimento',
    'Modulo24 Famiglia',
    'Modulo24 Compliance',
    'Modulo24 Societa\'',
    'Modulo24 Accertamento',
    'Modulo24 Revisione Legale E Crisi D\'Impresa',
    'Modulo24 Terzo Settore',
    'Modulo24 Contenzioso',
    'Modulo Iva 24',
    'Modulo24 Tuir',
    'Modulo24 Operazioni Straordinarie',
    'Modulo24 Bilancio',
    'Modulo24 Riforma Fiscale',
    'Modulo24 Whistle Blowing',
    'Modulo24 Wealth Plannig',
    'Utenze aggiuntive banche dati',
  ],
  'Quotidiani': [
    'Quotidiano Digitale',
    'Quotidiano Carta',
    'Nt+ Fisco',
    'Nt+ Diritto',
    'Nt+ Enti Locali&Edilizia',
    'Nt+ Condominio',
    'Nt+ Lavoro',
    'Riviste 24 Fisco',
    'Riviste 24 Lavoro',
    'Riviste 24 Diritto',
    'Guida Al Diritto',
    'Book 24 Fisco',
    'Book 24 Diritto',
    'Book 24 Lavoro',
    'Book 24 Tecnici',
    '24+',
    'Mercati+',
    'Agrisole',
    'Studi Settore',
    'Archivio Storico 24',
  ],
  'Software': [
    'Valore24 Office Ai',
    'Valore24 Commercialisti',
    'Valore24 Sindaci E Revisori',
    'Valore24 Accertamento e Contezioso',
    'Valore24 Modulistica',
    'Valore24 Gdpr Privacy',
    'Valore24 Bilancio In Cloud',
    'Valore24 Crisi D\'Impresa Cloud',
    'Valore24 Bilancio/Crisi D\'Impresa Cloud',
    'Valore24 Bilancio/Adb/Crisi D\'Impresa Cloud',
    'Valore24 23I Compliance',
    'Valore24 Condominio Cloud',
    'Valore24 Business Plan',
    'Valore24 Centrale Rischi',
    'Valore24 Terzo Settore',
    'Valore24 Avvocato',
    'Valore24 Vertenze Lavoro',
    'Valore 24 Antiriciclaggio',
    'Valore 24 Paghe',
    'Valore 24 Passaporto di Prodotto',
    'Valore 24 Bit Impresa',
    'Valore 24 Esg',
    'Valore 24 WhistleBlowing',
  ],
  'Partner24 Ore': [
    'Partner 24 Business Owner Start Up Innovative',
    'Partner 24 Business Owner PMI Innovative',
    'Partner 24 Business Owner',
    'Partner 24 Business Partner',
    'Partner 24 Professional',
    'Qualita\'24Ore',
  ],
  'Formazione': [
    'Master Telefisco - Formazione',
    'Master Lavoro - Formazione',
    'Laboratorio',
    'Master Approfondimento',
    'Seminari',
    'Abbonamento "All Inclusive" Formazione',
    'Formazione Pa',
  ],
  'ItalyX': [
    'Italy-X Pmi',
    'Italy-X Grandi Aziende',
  ],
  'Altri Prodotti': [
    'Business Compass',
    'Newsletter',
    '24Suite Aziende (Modulo Base + 4 Moduli)',
    '24Suite Aziende (Modulo Base + 3 Moduli)',
    '24Suite Aziende (Modulo Base + 2 Moduli)',
    '24Suite Aziende (Modulo Base+ 1 Modulo A Scelta)',
    '24Suite Energia (Modulo Base + 4 Moduli)',
    '24Suite Energia (Modulo Base + 3 Moduli)',
    '24Suite Energia (Modulo Base + 2 Moduli)',
    '24Suite Energia (Modulo Base+ 1 Modulo A Scelta)',
    'Archivio Esperto Risponde Ambiente E Sicurezza',
    'Archivio Esperto Risponde Diritto',
    'Archivio Esperto Risponde Diritto Dell\'Economia',
    'Archivio Esperto Risponde Finanza E Risparmio',
    'Archivio Esperto Risponde Fisco',
    'Archivio Esperto Risponde Immobili',
    'Archivio Esperto Risponde Lavoro E Previdenza',
    'Archivio Esperto Risponde Pubblica Amministrazione',
    'Archivio Esperto Risponde Settori Economici',
    'Archivio Esperto Risponde Illimitato (2 Quesiti Demo Inclusi)',
  ],
};
// Le 6 linee su cui Marco ha un budget assegnato — sottoinsieme di PRODOTTI (restano fuori
// Newsletter, Business Compass, Studi di Settore, Altri Prodotti: categorie senza un target).
export const LINEE_BUDGET = ['Editoria elettronica','Software','Partner24 Ore','Formazione','ItalyX','Quotidiani'];
// Sigle del mandato aziendale — usate come etichette brevi nel grafico a colonne
export const SIGLE_BUDGET = { 'Editoria elettronica':'EE', 'Software':'SW', 'Partner24 Ore':'P24', 'Formazione':'EDU', 'ItalyX':'ITX', 'Quotidiani':'QD' };
export const DEFAULT_STAGES = [
  { id: 'lead', name: 'Lead',           color: '#378ADD', isKo: false },
  { id: 'appt', name: 'Appuntamento',   color: '#EF9F27', isKo: false },
  { id: 'prop', name: 'In Attesa',      color: '#7F77DD', isKo: false },
  { id: 'eval', name: 'In valutazione', color: '#E07B1A', isKo: false },
  { id: 'ok',   name: 'Chiuso OK',      color: '#639922', isKo: false },
  { id: 'ko',   name: 'Chiuso KO',      color: '#A32D2D', isKo: true  },
];
export const DEFAULT_BRAND = {
  name: 'SalesPRO', sub: 'Il Sole 24 Ore Professionale',
  user: 'Marco Proietti', role: 'Il Sole 24 Ore Professionale',
  color: '#c8102e',
  callink: 'https://bookings.cloud.microsoft/book/MarcoProiettiIlSole24Ore@ilsole24ore.onmicrosoft.com/?ismsaljsauthenabled',
};
export function lsGet(key, fb) { try { const v=localStorage.getItem(key); return v?JSON.parse(v):fb; } catch { return fb; } }
export function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
export function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
export function fmt(d, opts={day:'2-digit',month:'short',year:'numeric'}) {
  if (!d) return '—'; try { return new Date(d).toLocaleDateString('it-IT',opts); } catch { return d; }
}
export function fmtDT(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('it-IT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return d; }
}
export function fmtEur(v) { return '€'+(Number(v)||0).toLocaleString('it-IT'); }
export function parseDate(str) {
  if (!str) return ''; str=str.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10);
  const m=str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) { const y=m[3].length===2?'20'+m[3]:m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
  return str;
}
// Sottotipi di un prodotto "Formazione" — scelti riga per riga quando la categoria è Formazione.
// Servono a distinguere cosa conta per il target di un canvass da cosa genera davvero il premio
// (es. i canvass Education: tutto concorre al target, ma il premio è solo su Abbonamento e Laboratorio).
export const EDUCATION_TIPI = ['Abbonamento','One Shot','Su commessa','Joint Venture','Laboratorio'];

// Calcola l'avanzamento di un canvass sui contatti attuali. Generico: non sa nulla delle regole
// di UN canvass specifico, le legge tutte dall'oggetto canvass stesso — così la stessa funzione
// vale per ogni canvass futuro, cambiano solo i dati salvati (date, percentuali, tipi coinvolti).
export function calcolaCanvass(canvass, contacts) {
  let fatturatoTarget = 0;
  const fatturatoPerTipoPremio = {};
  (canvass.tipi_premio || []).forEach(t => { fatturatoPerTipoPremio[t] = 0; });

  contacts.forEach(c => {
    getContratti(c).filter(ct => ct.tipo !== 'Rinnovo' && ct.dataInizio >= canvass.data_inizio && ct.dataInizio <= canvass.data_fine)
      .forEach(ct => {
        (ct.prodotti || []).forEach(p => {
          if (p.categoria !== canvass.linea_prodotto) return;
          const imp = Number(p.importo) || 0;
          if ((canvass.tipi_target || []).includes(p.tipoFormazione)) fatturatoTarget += imp;
          if ((canvass.tipi_premio || []).includes(p.tipoFormazione)) fatturatoPerTipoPremio[p.tipoFormazione] = (fatturatoPerTipoPremio[p.tipoFormazione]||0) + imp;
        });
      });
  });

  const target = canvass.target_individuale || 0;
  const pct = target > 0 ? (fatturatoTarget / target) * 100 : 0;
  const obiettivoRaggiunto = pct >= 100;

  let premio = 0;
  if (obiettivoRaggiunto) {
    (canvass.premio_regole || []).forEach(r => {
      premio += (fatturatoPerTipoPremio[r.tipo] || 0) * (r.pct / 100);
    });
    if (canvass.cap_premio) premio = Math.min(premio, canvass.cap_premio);
  }

  return { fatturatoTarget, pct, obiettivoRaggiunto, fatturatoPerTipoPremio, premio };
}

export function getContratti(c) {
  if (c.contratti?.length) return c.contratti;
  if (c.contratto) return [c.contratto];
  return [];
}
export function getFatturato(c) {
  const list=getContratti(c);
  if (!list.length) return Number(c.importoProposta)||0;
  return list.reduce((s,ct)=>{ if(ct.prodotti?.length) return s+ct.prodotti.reduce((ps,p)=>ps+(Number(p.importo)||0),0); return s+(Number(ct.totale)||0); },0);
}
export function getPreventivato(c) { return Number(c.importoProposta)||0; }
// Fatturato diviso tra nuovo e rinnovo — condiviso tra Dashboard e Chiuso per mese
export function getFattNuovo(c) {
  return getContratti(c).filter(ct=>ct.tipo!=='Rinnovo').reduce((s,ct)=>s+(ct.prodotti||[]).reduce((ps,p)=>ps+(Number(p.importo)||0),0)||(Number(ct.totale)||0),0);
}
export function getFattRinnovo(c) {
  return getContratti(c).filter(ct=>ct.tipo==='Rinnovo').reduce((s,ct)=>s+(ct.prodotti||[]).reduce((ps,p)=>ps+(Number(p.importo)||0),0)||(Number(ct.totale)||0),0);
}
// Un vero contatto commerciale è avvenuto: o un appuntamento è segnato Svolto, o è stata
// inviata un'offerta. Il secondo segnale è importante perché lo stato dell'appuntamento
// richiede un aggiornamento manuale separato dalla chiusura della trattativa — facile da
// dimenticare — mentre l'offerta inviata è una prova diretta che una conversazione c'è stata.
// Usata per il tasso di chiusura "vero": chi non rientra in nessuno dei due casi non ha mai
// avuto una vera conversazione commerciale, quindi non deve contare né a favore né contro.
export function haContattoReale(c) {
  const apptSvolto = (c.history||[]).some(h=>h.type==='appt'&&h.stato==='Svolto');
  const offertaInviata = c.proposta === 'Offerta Inviata';
  return apptSvolto || offertaInviata;
}
// I 5 giorni (lun-ven) della settimana corrente + offset — condiviso tra le viste calendario
export function getWeekDays(offset) {
  const now=new Date(); const day=now.getDay();
  const mon=new Date(now); mon.setDate(now.getDate()-(day===0?6:day-1)+offset*7);
  return Array.from({length:5},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d.toISOString().slice(0,10); });
}
export function getDataChiusura(c) { return c.dataChiusura||getContratti(c)[0]?.dataInizio||''; }
export function getLastAppt(c) {
  const a=(c.history||[]).filter(h=>h.type==='appt'&&h.date).sort((a,b)=>b.date.localeCompare(a.date));
  return a[0]?a[0].date.slice(0,10):'';
}
export function getNextFu(c) {
  const f=(c.history||[]).filter(h=>h.type==='note'&&h.followup).sort((a,b)=>a.followup.localeCompare(b.followup));
  return f[0]?f[0].followup:'';
}
export function parseCSVRow(row, stages) {
  const nome=(row['Nome']||row['nome']||'').trim();
  if (!nome) return null;
  const faseRaw=(row['Fase']||row['fase']||'').toLowerCase();
  const faseMap={'chiuso ok':'Chiuso OK','ok':'Chiuso OK','chiuso ko':'Chiuso KO','ko':'Chiuso KO','in valutazione':'In valutazione','in attesa':'In Attesa','proposta':'In Attesa','appuntamento':'Appuntamento','lead':'Lead'};
  const fase=faseMap[faseRaw]||stages[1]?.name||'Appuntamento';
  const importoContratto=Number((row['Importo Contratto']||row['importo contratto']||'0').toString().replace(/[€,]/g,''))||0;
  const durataM=Number(row['Durata Mesi']||row['durata mesi']||12);
  const dataInizioContratto=parseDate(row['Data Inizio Contratto']||row['data inizio contratto']||'');
  const prodottiRaw=row['Prodotti']||row['prodotti']||'';
  let contratti=[];
  if (importoContratto>0) {
    const prodotti=prodottiRaw?prodottiRaw.split(',').map(p=>{const parts=p.trim().split(':');return{id:uid(),categoria:parts[0]?.trim()||'',nome:'',importo:Number(parts[1]?.trim())||0,durataM};}):[];
    contratti=[{id:uid(),tipo:'Nuovo',nuovoFatturato:0,prodotti,dataInizio:dataInizioContratto,totale:importoContratto}];
  }
  return {
    id:uid(),nome,azienda:(row['Azienda']||row['azienda']||'').trim(),email:(row['Email']||row['email']||'').trim(),
    telefono:(row['Telefono']||row['telefono']||'').trim(),categoria:(row['Categoria']||row['categoria']||'').trim(),
    fonte:(row['Fonte']||row['fonte']||'').trim(),fase,esito:(row['Esito']||row['esito']||'').trim(),
    proposta:(row['Proposta']||row['proposta']||'').trim(),
    importoProposta:Number((row['Importo Proposta']||row['importo proposta']||'0').toString().replace(/[€\s]/g,''))||0,
    dataChiusura:parseDate(row['Data Chiusura']||row['data chiusura']||''),
    contratti,testoProposta:'',noteInterne:'',
    history:(()=>{const hist=[];const fu=parseDate(row['Follow Up']||row['follow up']||'');const note=(row['Note']||row['note']||'').trim();if(fu||note)hist.push({id:uid(),type:'note',date:new Date().toISOString().slice(0,10),text:note||'Importato da CSV',followup:fu});return hist;})(),
    customData:{},
  };
}