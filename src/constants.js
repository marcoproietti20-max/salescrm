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
  'Commercialista','Consulente del Lavoro','Geometra','Ingegnere','Notaio','Tributarista','Altro',
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
  'ItalyX','Quotidiani','Newsletter','Business Compass','Studi di Settore','Altri Prodotti',
];
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
export const DEFAULT_GS = {
  sheetId: '1nC3fC_REUsd-XmoAKYXrsAqvxTlN8jcq4dvUrl32E3A',
  apiKey: 'AIzaSyBK57pFTI_sIIvy4haf0OZcDHws27kFPfM',
  tabName: 'Appuntamenti e trattative',
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
