import React, { useState, useMemo, useEffect } from 'react';
import { fmtEur, fmt, getContratti } from '../constants';
import { nomeCorrisponde } from './Canvass';
import { dbLoadStoricoProvvigioni, dbEliminaStoricoFile, dbSalvaStoricoBatch, dbEliminaStoricoRiga, dbLoadExtraProvvigioni, dbSalvaExtraProvvigioni, dbEliminaExtraProvvigioni } from '../supabase';

// ── Tabella aliquote ──────────────────────────────────────────────────────
// Ogni riga: categoria (deve corrispondere a PRODOTTI), parola chiave facoltativa nel nome
// (stesso riconoscimento usato per i canvass — tutte le parole devono comparire, in qualsiasi
// ordine), aliquote Nuovo/Rinnovo per durata [1 anno, 2 anni, 3+ anni], ed "maggiorata45" se
// la riga rientra nella promozione dedicata (Editoria elettronica e Partner24 Professional).
// L'ordine conta: per ogni prodotto si usa la PRIMA riga della stessa categoria che corrisponde
// (per parola chiave, o l'ultima senza parola chiave come riserva finale).
export const SCADENZA_MAGGIORATA_45 = '2026-12-18';

export const TABELLA_PROVVIGIONI = [
  // Partner24 Ore — l'ordine qui è essenziale: "owner" va controllato prima di "business",
  // altrimenti "Partner 24 Business Owner" verrebbe scambiato per "Business Partner" (ogni
  // nome in questa categoria contiene già "Partner", quindi va isolata la parola distintiva).
  { categoria: 'Partner24 Ore', parola: 'master', etichetta: 'Master Partner', nuovo: [20,20,20], rinnovo: [10,13,13], maggiorata45: false },
  { categoria: 'Partner24 Ore', parola: 'owner', etichetta: 'Business Owner', nuovo: [20,20,20], rinnovo: [10,13,13], maggiorata45: false },
  { categoria: 'Partner24 Ore', parola: 'qualit', etichetta: 'Qualità', nuovo: [20,20,20], rinnovo: [20,20,20], maggiorata45: false },
  { categoria: 'Partner24 Ore', parola: 'professional', etichetta: 'Professional Partner', nuovo: [25,25,25], rinnovo: [10,13,13], maggiorata45: true },
  { categoria: 'Partner24 Ore', parola: 'business', etichetta: 'Business Partner', nuovo: [20,20,20], rinnovo: [20,20,20], maggiorata45: false },
  { categoria: 'Partner24 Ore', parola: null, etichetta: 'Partner24 — livello non riconosciuto', nuovo: [0,0,0], rinnovo: [0,0,0], maggiorata45: false },

  // Quotidiani
  { categoria: 'Quotidiani', parola: 'studi', etichetta: 'Studi di Settore', nuovo: [25,25,25], rinnovo: [25,25,25], maggiorata45: false },
  { categoria: 'Quotidiani', parola: 'carta', etichetta: 'Quotidiani Stand Alone (carta)', nuovo: [10,10,10], rinnovo: [10,10,10], maggiorata45: false },
  { categoria: 'Quotidiani', parola: null, etichetta: 'Quotidiani Bundle', nuovo: [20,25,35], rinnovo: [10,10,10], maggiorata45: false },

  // Altri Prodotti
  { categoria: 'Altri Prodotti', parola: 'newsletter', etichetta: 'Newsletter', nuovo: [20,20,20], rinnovo: [20,20,20], maggiorata45: false },
  { categoria: 'Altri Prodotti', parola: 'compass', etichetta: 'Business Compass', nuovo: [20,20,20], rinnovo: [20,20,20], maggiorata45: false },
  { categoria: 'Altri Prodotti', parola: null, etichetta: 'Altri Prodotti', nuovo: [10,10,10], rinnovo: [10,10,10], maggiorata45: false },

  // Categorie con un'unica aliquota, nessuna distinzione interna
  { categoria: 'Editoria elettronica', parola: null, etichetta: 'Editoria elettronica', nuovo: [25,30,35], rinnovo: [5,10,13], maggiorata45: true },
  { categoria: 'Software', parola: null, etichetta: 'Software', nuovo: [20,20,20], rinnovo: [10,13,13], maggiorata45: false },
  { categoria: 'Formazione', parola: null, etichetta: 'Formazione', nuovo: [20,25,25], rinnovo: [10,13,13], maggiorata45: false },
  { categoria: 'ItalyX', parola: null, etichetta: 'ItalyX', nuovo: [20,20,20], rinnovo: [20,20,20], maggiorata45: false },
];

// Trova la regola giusta per un prodotto: prima le righe con parola chiave della sua categoria
// (nell'ordine della tabella), poi l'eventuale riga di riserva senza parola chiave.
export function trovaRegola(categoria, nome) {
  const righe = TABELLA_PROVVIGIONI.filter(r => r.categoria === categoria);
  const conParola = righe.find(r => r.parola && nomeCorrisponde(nome, r.parola));
  if (conParola) return conParola;
  return righe.find(r => !r.parola) || null;
}

function addMesi(dataIso, n) {
  const d = new Date(dataIso + 'T12:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
const bucketDurata = (durataM) => {
  const anni = Math.max(1, Math.round((Number(durataM) || 12) / 12));
  return anni >= 3 ? 2 : anni === 2 ? 1 : 0;
};

// Tutti gli "eventi di incasso" generati da UN prodotto: uno per ogni anno della sua durata,
// stesso mese del contratto, stessa aliquota ogni anno — tranne il primo, che prende la
// maggiorata 45% se la regola lo prevede, è un contratto "Nuovo" (mai Rinnovo), e parte entro
// la scadenza. Solo l'anno 1 è "il nuovo/rinnovo dell'anno"; gli anni successivi sono incassi
// proiettati dello stesso contratto, da tenere sempre separati in tutte le statistiche.
// Percentuale fissa sulla componente di avviamento (es. Valore24 Office AI) — una tantum,
// pagata solo alla firma, indipendente dalla linea/categoria e dalla durata del contratto.
export const PCT_AVVIAMENTO = 10;

// Trova, tra le rettifiche di un prodotto, quella per un anno specifico — interventi puntuali
// che Marco può impostare sul singolo prodotto: "escludi" (es. nota di credito, cliente che
// smette di pagare: l'anno teoricamente dura ma non verrà più fatturato) oppure "aliquota"
// (un'aliquota manuale diversa da quella di tabella, es. cliente fuori zona con aliquota
// ridotta dal secondo anno). Non toccano il contratto, restano sempre reversibili.
function trovaRettifica(p, anno) {
  return (p.rettifiche || []).find(r => Number(r.anno) === anno) || null;
}

export function eventiProdotto(p, ct, contatto) {
  const regola = trovaRegola(p.categoria, p.nome);
  if (!regola) return [];
  const anni = Math.max(1, Math.round((Number(p.durataM) || 12) / 12));
  const bucket = bucketDurata(p.durataM);
  const tipoKey = ct.tipo === 'Rinnovo' ? 'rinnovo' : 'nuovo';
  const importo = Number(p.importo) || 0;
  const eventi = [];
  const importoAvv = Number(p.importoAvviamento) || 0;
  if (importoAvv > 0 && ct.dataInizio) {
    eventi.push({
      contattoId: contatto.id, nome: contatto.nome, azienda: contatto.azienda,
      prodottoNome: (p.nome || '(senza nome)') + ' — avviamento', categoria: p.categoria, etichettaRegola: 'Avviamento (una tantum)',
      anno: 1, primoAnno: true, tipo: tipoKey, maggiorata: false, avviamento: true,
      data: ct.dataInizio, importo: importoAvv, pct: PCT_AVVIAMENTO, provvigione: importoAvv * PCT_AVVIAMENTO / 100,
    });
  }
  for (let anno = 1; anno <= anni; anno++) {
    const rettifica = trovaRettifica(p, anno);
    if (rettifica && rettifica.tipo === 'escluso') continue; // anno spento manualmente, non proiettato
    let pct = regola[tipoKey][bucket];
    let maggiorata = false;
    if (anno === 1 && tipoKey === 'nuovo' && regola.maggiorata45 && ct.dataInizio && ct.dataInizio <= SCADENZA_MAGGIORATA_45) {
      pct = 45; maggiorata = true;
    }
    let rettificata = false;
    if (rettifica && rettifica.tipo === 'aliquota' && rettifica.valore !== '' && rettifica.valore != null) {
      pct = Number(rettifica.valore) || 0; maggiorata = false; rettificata = true;
    }
    eventi.push({
      contattoId: contatto.id, nome: contatto.nome, azienda: contatto.azienda,
      prodottoNome: p.nome || '(senza nome)', categoria: p.categoria, etichettaRegola: regola.etichetta,
      anno, primoAnno: anno === 1, tipo: tipoKey, maggiorata, rettificata,
      data: anno === 1 ? ct.dataInizio : addMesi(ct.dataInizio, (anno - 1) * 12),
      importo, pct, provvigione: importo * pct / 100,
    });
  }
  return eventi;
}

// Tutti gli eventi di tutti i contatti, in un'unica lista piatta — usata sia dalla pagina
// dedicata sia dalla card compatta in Dashboard.
export function calcolaTuttiEventi(contacts) {
  const eventi = [];
  (contacts || []).forEach(c => {
    getContratti(c).forEach(ct => {
      if (!ct.dataInizio || ct.annullato) return; // contratto annullato: niente proiezione futura
      (ct.prodotti || []).forEach(p => {
        eventi.push(...eventiProdotto(p, ct, c));
      });
    });
  });
  return eventi;
}

export function meseStr(d) { return d.toISOString().slice(0, 7); }
export function addMesiData(dataIso, n) { return addMesi(dataIso, n); }

// ── Importazione estratti conto ────────────────────────────────────────────
// Gli estratti sono file .XLS che in realtà sono testo delimitato da tabulazioni, esportati
// dall'azienda in due codifiche diverse nel tempo (UTF-16 oppure normale) — si riconosce
// guardando quanti byte nulli ci sono: tipico dell'UTF-16, assente nell'altra.
function rilevaEDecodifica(buffer) {
  const bytes = new Uint8Array(buffer);
  const campione = bytes.slice(0, 2000);
  let nulli = 0;
  for (let i = 0; i < campione.length; i++) if (campione[i] === 0) nulli++;
  const isUtf16 = nulli / campione.length > 0.3;
  const decoder = new TextDecoder(isUtf16 ? 'utf-16le' : 'windows-1252');
  return decoder.decode(buffer);
}
function parseTSV(testo) {
  const righe = testo.split(/\r\n|\r|\n/).filter(r => r.trim().length > 0);
  if (!righe.length) return [];
  const headers = righe[0].split('\t').map(h => h.trim());
  const dati = [];
  for (let i = 1; i < righe.length; i++) {
    const celle = righe[i].split('\t');
    if (celle.length < 5) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (celle[idx] || '').trim(); });
    if (!obj['RAGIONE SOCIALE FATTURAZIONE'] && !obj['RAGIONE SOCIALE CLIENTE'] && !obj['NUMERO ORDINE']) continue;
    dati.push(obj);
  }
  return dati;
}
function numIta(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).trim().replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function dataIta(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = (parseInt(y) < 50 ? '20' : '19') + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
const MESI_IT = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12 };
// Il nome del file NON è affidabile per capire la competenza — un singolo estratto può
// contenere fatture di mesi molto diversi tra loro (rettifiche, ripresi, pagamenti in ritardo).
// Lo uso solo come etichetta di provenienza facoltativa (mese "ricevuto"), mai per decidere
// la competenza: quella si calcola riga per riga dalla sua vera DATA FATTURA.
function meseRicevutoDaFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const m = base.match(/([a-zàèìòù]+)[_\s]+(\d{4})/i);
  if (!m || !MESI_IT[m[1]]) return null;
  return `${m[2]}-${String(MESI_IT[m[1]]).padStart(2, '0')}`;
}
// La competenza si calcola da decorrenza+annualità (stessa logica del motore di proiezione:
// l'anno N di un contratto cade N-1 anni dopo la sua decorrenza), non dalla data fattura —
// un rinnovo inserito in anticipo può avere decorrenza mesi dopo la fattura che lo genera.
function mesiCompetenzaDaDecorrenza(decorrenzaIso, annualita) {
  if (!decorrenzaIso) return null;
  const n = (Number(annualita)||1) - 1;
  return addMesi(decorrenzaIso, n*12).slice(0,7);
}
function mappaRigaStorico(obj, meseRicevuto, nomeFile) {
  const dataFattura = dataIta(obj['DATA FATTURA']);
  const decorrenza = dataIta(obj['DECORRENZA']);
  return {
    mese_competenza: mesiCompetenzaDaDecorrenza(decorrenza, obj['ANNUALITA']),
    mese_ricevuto: meseRicevuto,
    numero_ordine: obj['NUMERO ORDINE'] || null, posizione: obj['POSIZIONE'] || null, codice_cliente: obj['CODICE CLIENTE'] || null,
    // "RAGIONE SOCIALE CLIENTE" è quasi sempre vuota nei file reali (1232 righe su 1258 nel
    // campione verificato) — il nome compilato davvero è "RAGIONE SOCIALE FATTURAZIONE".
    ragione_sociale: obj['RAGIONE SOCIALE FATTURAZIONE'] || obj['RAGIONE SOCIALE CLIENTE'] || null, tipo_contratto: obj['TIPO CONTRATTO'] || null,
    sostituzione: obj['SOSTITUZIONE'] || null, codice_prodotto: obj['CODICE PRODOTTO'] || null,
    descrizione_prodotto: obj['DESCRIZIONE PRODOTTO'] || null,
    numero_fattura: obj['NUMERO FATTURA'] || null,
    decorrenza, data_fattura: dataFattura,
    durata: numIta(obj['DURATA']), annualita: numIta(obj['ANNUALITA']),
    imponibile: numIta(obj['IMPONIBILE PROVV.']), aliquota: numIta(obj['ALIQUOTA PROVVIGIONE']),
    importo_provvigioni: numIta(obj['IMPORTO PROVVIGIONI']), note: obj['NOTE'] || null,
    file_origine: nomeFile,
  };
}
// Chiave che identifica una riga in modo univoco per il controllo duplicati: ordine, posizione,
// prodotto, sostituzione, numero fattura, importo esatto (compreso il segno) E nota. La nota è
// essenziale — un originale (nota vuota), il suo insoluto (nota "INSOLUTI", importo negativo) e
// il ripreso che lo recupera (nota "RIPRESO", importo di nuovo positivo) condividono tutto il
// resto ma sono tre eventi legittimi, non una riga ripetuta. È un vero duplicato solo quando la
// riga è IDENTICA in ogni campo, compresa la nota, e proviene da un file diverso già importato:
// capita quando una situazione ancora aperta (es. lo stesso insoluto) viene rilistata tale e
// quale nell'estratto successivo senza che sia cambiato nulla.
function chiaveRiga(r) {
  return [r.numero_ordine, r.posizione, r.codice_prodotto, r.sostituzione, r.numero_fattura, Math.round((r.importo_provvigioni||0)*100), (r.note||'').trim()].join('|');
}
// Traduce una riga di storico reale nella stessa identica forma di un "evento" calcolato,
// così la tabella e le metriche della pagina funzionano senza distinguere la provenienza.
function storicoComeEvento(r) {
  const annoNum = r.annualita || 1;
  return {
    id: r.id, storico: true,
    contattoId: r.codice_cliente, nome: r.ragione_sociale, azienda: null,
    codiceCliente: r.codice_cliente, numeroOrdine: r.numero_ordine, numeroFattura: r.numero_fattura,
    prodottoNome: r.descrizione_prodotto || '(senza nome)', categoria: null,
    etichettaRegola: r.sostituzione === 'U' ? 'Upgrade' : r.sostituzione === 'S' ? 'Standard' : '—',
    anno: annoNum, primoAnno: annoNum === 1, tipo: r.tipo_contratto === 'R' ? 'rinnovo' : 'nuovo',
    maggiorata: false, data: r.data_fattura || (r.mese_competenza + '-15'),
    importo: r.imponibile, pct: r.aliquota, provvigione: r.importo_provvigioni,
  };
}

export default function Provvigioni({ contacts, navigateTo, showToast }) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [offset, setOffset] = useState(0); // 0 = mese di competenza corrente (default) — l'incasso vero arriva ~45 giorni dopo

  const tuttiEventi = useMemo(() => calcolaTuttiEventi(contacts), [contacts]);

  const meseSelezionato = useMemo(() => meseStr(new Date(addMesi(oggi.slice(0,7)+'-01', offset) + 'T12:00:00')), [oggi, offset]);
  const etichettaMese = useMemo(() => {
    const d = new Date(meseSelezionato + '-01T12:00:00');
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }, [meseSelezionato]);

  // ── Storico reale dagli estratti conto — ha sempre la precedenza sulla proiezione calcolata ──
  const [storico, setStorico] = useState(null); // null = ancora in caricamento
  const ricaricaStorico = () => dbLoadStoricoProvvigioni().then(setStorico);
  useEffect(() => { ricaricaStorico(); }, []);

  const mesiConStorico = useMemo(() => new Set((storico||[]).map(r=>r.mese_competenza)), [storico]);
  const haStoricoMeseSelezionato = mesiConStorico.has(meseSelezionato);

  const eventiMese = useMemo(() => {
    if (haStoricoMeseSelezionato) {
      return (storico||[]).filter(r=>r.mese_competenza===meseSelezionato).map(storicoComeEvento).sort((a,b)=>(a.data||'').localeCompare(b.data||''));
    }
    return tuttiEventi.filter(e => e.data.startsWith(meseSelezionato)).sort((a,b)=>a.data.localeCompare(b.data));
  }, [tuttiEventi, meseSelezionato, storico, haStoricoMeseSelezionato]);

  // ── Caricamento di un nuovo estratto conto: anteprima prima di confermare ──
  const [anteprima, setAnteprima] = useState(null); // { file, meseRicevuto, righe, righeSenzaData, totale, mesiTrovati }
  const [caricando, setCaricando] = useState(false);
  const fileRef = React.useRef();

  const selezionaFile = async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    const buffer = await file.arrayBuffer();
    const testo = rilevaEDecodifica(buffer);
    const righeGrezze = parseTSV(testo);
    const meseRicevuto = meseRicevutoDaFilename(file.name); // solo informativo, mai bloccante
    const righe = righeGrezze.map(r => mappaRigaStorico(r, meseRicevuto, file.name));
    const righeConData = righe.filter(r => r.mese_competenza);
    const righeSenzaData = righe.length - righeConData.length;
    // Confronto con tutto lo storico già importato da ALTRI file, per scartare i veri duplicati
    // (stessa riga identica, nota compresa, già presente altrove) senza toccare ripresi/insoluti
    // legittimi, che condividono ordine e fattura ma non la nota o il segno dell'importo.
    const chiaviEsistenti = new Set((storico||[]).filter(r => r.file_origine !== file.name).map(chiaveRiga));
    const righeValide = righeConData.filter(r => !chiaviEsistenti.has(chiaveRiga(r)));
    const righeDuplicate = righeConData.filter(r => chiaviEsistenti.has(chiaveRiga(r)));
    const totale = righeValide.reduce((s,r)=>s+r.importo_provvigioni, 0);
    const totaleDuplicati = righeDuplicate.reduce((s,r)=>s+r.importo_provvigioni, 0);
    // Ripartizione per mese di competenza reale — un file può contenere più mesi insieme
    const perMese = {};
    righeValide.forEach(r => { perMese[r.mese_competenza] = (perMese[r.mese_competenza]||0) + r.importo_provvigioni; });
    const mesiTrovati = Object.entries(perMese).sort((a,b)=>b[0].localeCompare(a[0]));
    setAnteprima({ file: file.name, meseRicevuto, righe: righeValide, righeSenzaData, righeDuplicate, totaleDuplicati, totale, mesiTrovati });
  };

  const confermaImport = async () => {
    if (!anteprima) return;
    setCaricando(true);
    await dbEliminaStoricoFile(anteprima.file); // sicuro ricaricare lo stesso file due volte
    const ok = await dbSalvaStoricoBatch(anteprima.righe);
    setCaricando(false);
    if (!ok) { showToast('Errore durante il salvataggio', '', 'info'); return; }
    const extra = anteprima.righeDuplicate.length ? `, ${anteprima.righeDuplicate.length} duplicate scartate` : '';
    showToast('Estratto importato', `${anteprima.righe.length} righe su ${anteprima.mesiTrovati.length} mes${anteprima.mesiTrovati.length===1?'e':'i'}${extra}`);
    setAnteprima(null);
    ricaricaStorico();
  };

  const eliminaRigaStorico = async (riga) => {
    if (!window.confirm(`Eliminare definitivamente questa riga dello storico (${riga.nome||''} — ${fmtEur(riga.provvigione)})?`)) return;
    const ok = await dbEliminaStoricoRiga(riga.id);
    if (!ok) { showToast('Errore durante l\'eliminazione', '', 'info'); return; }
    showToast('Riga eliminata', '');
    ricaricaStorico();
  };

  // ── Premi/rimborsi manuali, per mese — una riga distinta nel totale, non legata a nessun contratto ──
  const [extra, setExtra] = useState([]);
  const ricaricaExtra = () => dbLoadExtraProvvigioni().then(setExtra);
  useEffect(() => { ricaricaExtra(); }, []);
  const extraMese = useMemo(() => extra.filter(x => x.mese === meseSelezionato), [extra, meseSelezionato]);
  const totExtra = extraMese.reduce((s,x)=>s+(Number(x.importo)||0), 0);
  const [nuovoExtra, setNuovoExtra] = useState({ descrizione: '', importo: '' });
  const aggiungiExtra = async () => {
    if (!nuovoExtra.descrizione.trim() || !nuovoExtra.importo) return;
    const ok = await dbSalvaExtraProvvigioni({ mese: meseSelezionato, descrizione: nuovoExtra.descrizione.trim(), importo: Number(nuovoExtra.importo) });
    if (!ok) { showToast('Errore durante il salvataggio', '', 'info'); return; }
    setNuovoExtra({ descrizione: '', importo: '' });
    ricaricaExtra();
  };
  const eliminaExtra = async (id) => {
    const ok = await dbEliminaExtraProvvigioni(id);
    if (!ok) return;
    ricaricaExtra();
  };

  // Il mese mostrato è quello di competenza — l'incasso vero arriva dopo: pre-fattura il 15
  // del mese successivo, pagamento entro la fine di quel mese successivo.
  const { prefatturaStr, incassoStr } = useMemo(() => {
    const meseSucc = addMesi(meseSelezionato + '-01', 1);
    const d = new Date(meseSucc + 'T12:00:00');
    const ultimoGiorno = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    const pf = new Date(d.getFullYear(), d.getMonth(), 15);
    const inc = new Date(d.getFullYear(), d.getMonth(), ultimoGiorno);
    return {
      prefatturaStr: pf.toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' }),
      incassoStr: inc.toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' }),
    };
  }, [meseSelezionato]);

  const totMese = eventiMese.reduce((s,e)=>s+e.provvigione, 0) + totExtra;
  const totPrimoAnno = eventiMese.filter(e=>e.primoAnno).reduce((s,e)=>s+e.provvigione, 0);
  const totProiezione = eventiMese.filter(e=>!e.primoAnno).reduce((s,e)=>s+e.provvigione, 0);
  const totNuovo = eventiMese.filter(e=>e.primoAnno && e.tipo==='nuovo').reduce((s,e)=>s+e.provvigione, 0);
  const totRinnovo = eventiMese.filter(e=>e.primoAnno && e.tipo==='rinnovo').reduce((s,e)=>s+e.provvigione, 0);

  // Proiezione dei prossimi 12 mesi (da oggi), per vedere a colpo d'occhio il ricorrente in arrivo
  const prossimi12 = useMemo(() => {
    return Array.from({length:12}, (_,i) => {
      const m = meseStr(new Date(addMesi(oggi.slice(0,7)+'-01', i) + 'T12:00:00'));
      const tot = tuttiEventi.filter(e=>e.data.startsWith(m)).reduce((s,e)=>s+e.provvigione,0);
      return { mese: m, tot };
    });
  }, [tuttiEventi, oggi]);
  const maxProiezione = Math.max(1, ...prossimi12.map(p=>p.tot));

  const perCategoria = useMemo(() => {
    const m = {};
    eventiMese.forEach(e => { m[e.etichettaRegola] = (m[e.etichettaRegola]||0) + e.provvigione; });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }, [eventiMese]);

  return (
    <>
      <div className="topbar">
        <span className="page-title">Provvigioni</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-sm" onClick={()=>setOffset(o=>o-1)}>← Prec.</button>
          <button className="btn btn-sm" onClick={()=>setOffset(0)}>Oggi</button>
          <button className="btn btn-sm" onClick={()=>setOffset(o=>o+1)}>Succ. →</button>
          <button className="btn btn-sm btn-primary" onClick={()=>fileRef.current?.click()}>📁 Carica estratto conto</button>
          <input ref={fileRef} type="file" accept=".xls,.XLS,.txt" style={{ display: 'none' }} onChange={selezionaFile} />
        </div>
      </div>
      <div className="content">

        <div className="info-box blue" style={{ marginBottom: 16 }}>
          📅 Competenza <strong style={{ textTransform: 'capitalize' }}>{etichettaMese}</strong> — pre-fattura il <strong>{prefatturaStr}</strong>, incasso previsto entro il <strong>{incassoStr}</strong>.{' '}
          {haStoricoMeseSelezionato
            ? <strong>📄 Dato reale, importato dall'estratto conto.</strong>
            : <>Stima calcolata da ogni contratto inserito, proiettando un incasso per ciascun anno della sua durata — verifica sempre i casi segnalati come "non riconosciuto".</>}
        </div>

        <div className="metric-grid" style={{ marginBottom: 16 }}>
          <div className="metric-card"><div className="metric-label">Totale del mese</div><div className="metric-value" style={{ color: '#1B7A3E' }}>{fmtEur(totMese)}</div></div>
          <div className="metric-card"><div className="metric-label">Di cui Nuovo (1° anno)</div><div className="metric-value" style={{ color: '#0050A0' }}>{fmtEur(totNuovo)}</div></div>
          <div className="metric-card"><div className="metric-label">Di cui Rinnovo (1° anno)</div><div className="metric-value">{fmtEur(totRinnovo)}</div></div>
          <div className="metric-card"><div className="metric-label">Proiezione anni successivi</div><div className="metric-value" style={{ color: '#7B68EE' }}>{fmtEur(totProiezione)}</div></div>
        </div>
        {totExtra !== 0 && (
          <div className="fs-12" style={{ marginBottom: 16, color: 'var(--text2)' }}>Di cui <strong>{fmtEur(totExtra)}</strong> di premi/rimborsi inseriti manualmente per questo mese.</div>
        )}

        <div className="charts-grid" style={{ marginBottom: 16 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Prossimi 12 mesi</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
              {prossimi12.map(p => {
                const h = Math.max(3, (p.tot/maxProiezione)*100);
                const attivo = p.mese === meseSelezionato;
                return (
                  <div key={p.mese} title={`${p.mese}: ${fmtEur(p.tot)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', cursor: 'pointer' }}
                    onClick={() => setOffset(Math.round((new Date(p.mese+'-01') - new Date(oggi.slice(0,7)+'-01')) / (1000*60*60*24*30)))}>
                    <div style={{ width: '70%', height: `${h}%`, background: attivo ? '#1B7A3E' : '#C2DEFA', borderRadius: '4px 4px 1px 1px', transition: 'height .4s ease' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {prossimi12.map(p => (
                <div key={p.mese} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: p.mese===meseSelezionato?'#1B7A3E':'var(--text3)', fontWeight: p.mese===meseSelezionato?700:400 }}>
                  {new Date(p.mese+'-01T12:00:00').toLocaleDateString('it-IT',{month:'short'})}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Per linea/livello — questo mese</div>
            {perCategoria.length === 0 && <div className="fs-12 text-muted">Nessun incasso previsto questo mese</div>}
            {perCategoria.map(([et, tot]) => (
              <div key={et} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}>
                <span>{et}</span>
                <span style={{ fontWeight: 700 }}>{fmtEur(tot)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-title" style={{ marginBottom: 10 }}>Dettaglio — {eventiMese.length} contratti/prodotti in questo mese</div>
        <div className="table-wrap">
          <table className="crm-table">
            <thead><tr><th>Cliente</th><th>Prodotto</th><th>Linea/livello</th><th>Anno</th><th>Aliquota</th><th>Imponibile</th><th>Provvigione</th><th></th></tr></thead>
            <tbody>
              {eventiMese.length === 0 ? <tr><td colSpan={8} className="empty">Nessun incasso previsto in questo mese</td></tr> : eventiMese.map((e,i) => (
                <tr key={i}>
                  <td className="fw-600">
                    {e.nome || <span className="text-muted">(nome non disponibile)</span>}
                    {e.azienda ? <div className="fs-11 text-muted">{e.azienda}</div> : null}
                    {e.storico && <div className="fs-11 text-muted">{e.codiceCliente ? `cod. ${e.codiceCliente}` : ''}{e.codiceCliente && (e.numeroOrdine||e.numeroFattura) ? ' · ' : ''}{e.numeroOrdine ? `ordine ${e.numeroOrdine}` : ''}{e.numeroOrdine && e.numeroFattura ? ' · ' : ''}{e.numeroFattura ? `fatt. ${e.numeroFattura}` : ''}</div>}
                  </td>
                  <td className="fs-12">{e.prodottoNome}</td>
                  <td className="fs-12">{e.etichettaRegola}</td>
                  <td className="fs-12">
                    {e.primoAnno
                      ? <span className="badge" style={{ background: e.tipo==='nuovo'?'#EBF4FC':'#EEF1F5', color: e.tipo==='nuovo'?'#0050A0':'#5A6B7E' }}>{e.tipo==='nuovo'?'Nuovo':'Rinnovo'}{e.maggiorata && ' 🔥'}</span>
                      : <span className="badge" style={{ background: '#F1EDFC', color: '#7B68EE' }}>{e.storico ? `Anno ${e.anno}` : `Proiezione anno ${e.anno}`}</span>}
                    {e.rettificata && <span className="badge" style={{ background: '#FFF3DB', color: '#A8710A', marginLeft: 4 }} title="Aliquota modificata manualmente per questo anno">✎</span>}
                  </td>
                  <td className="fs-12 fw-600">{e.pct}%</td>
                  <td className="fs-12">{fmtEur(e.importo)}</td>
                  <td className="fw-600" style={{ color: '#1B7A3E' }}>{fmtEur(e.provvigione)}</td>
                  <td>
                    {e.storico && (
                      <button className="btn btn-sm" title="Elimina questa riga dello storico" onClick={()=>eliminaRigaStorico(e)} style={{ color: '#C0392B' }}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Premi/rimborsi manuali del mese ── */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Premi/rimborsi manuali — {etichettaMese}</div>
          {extraMese.length === 0 && <div className="fs-12 text-muted" style={{ marginBottom: 10 }}>Nessuno inserito per questo mese.</div>}
          {extraMese.map(x => (
            <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 6 }}>
              <span>{x.descrizione}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{fmtEur(Number(x.importo))}</strong>
                <button className="btn btn-sm" onClick={()=>eliminaExtra(x.id)} style={{ color: '#C0392B' }}>🗑</button>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input className="form-control" style={{ flex: 2 }} placeholder="Descrizione (es. Premio trimestrale Q3)" value={nuovoExtra.descrizione} onChange={e=>setNuovoExtra(v=>({...v, descrizione: e.target.value}))} />
            <input className="form-control" style={{ flex: 1 }} type="number" placeholder="€ importo" value={nuovoExtra.importo} onChange={e=>setNuovoExtra(v=>({...v, importo: e.target.value}))} />
            <button className="btn btn-sm btn-primary" onClick={aggiungiExtra}>+ Aggiungi</button>
          </div>
        </div>

        {mesiConStorico.size > 0 && (
          <div className="fs-11 text-muted" style={{ marginTop: 10 }}>
            Mesi con dato reale già importato: {[...mesiConStorico].sort().reverse().map(m => new Date(m+'-01T12:00:00').toLocaleDateString('it-IT',{month:'short',year:'numeric'})).join(', ')}
          </div>
        )}
      </div>

      {/* ── Anteprima prima di confermare l'import ── */}
      {anteprima && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={()=>setAnteprima(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 480, padding: 22 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Conferma importazione</div>
            <div className="fs-12 text-muted" style={{ marginBottom: 16 }}>{anteprima.file}</div>

            <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Righe lette: <strong>{anteprima.righe.length}</strong>{anteprima.righeSenzaData > 0 && <span className="text-muted"> ({anteprima.righeSenzaData} scartate, data mancante)</span>}</div>
              <div style={{ fontSize: 13, marginBottom: anteprima.mesiTrovati.length ? 10 : 0 }}>Totale provvigioni nel file: <strong style={{ color: '#1B7A3E' }}>{fmtEur(anteprima.totale)}</strong></div>
              {anteprima.mesiTrovati.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <div className="fs-11 text-muted" style={{ marginBottom: 4 }}>Ripartizione per mese di competenza (decorrenza + annualità):</div>
                  {anteprima.mesiTrovati.map(([mese, tot]) => (
                    <div key={mese} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                      <span>{new Date(mese+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'})}{mesiConStorico.has(mese) && ' ⚠️'}</span>
                      <span style={{ fontWeight: 600 }}>{fmtEur(tot)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {anteprima.mesiTrovati.some(([mese]) => mesiConStorico.has(mese)) && (
              <div className="info-box amber" style={{ marginBottom: 16 }}>⚠️ Per almeno uno dei mesi sopra (segnato con ⚠️) hai già importato dati in precedenza. Confermando, le righe di questo file si aggiungono a quelle già presenti per quel mese (non le sostituiscono) — a meno che il nome del file sia identico a uno già caricato, nel qual caso quel file viene sostituito.</div>
            )}

            {anteprima.righeDuplicate.length > 0 && (
              <div className="info-box amber" style={{ marginBottom: 16 }}>
                🔁 {anteprima.righeDuplicate.length} rig{anteprima.righeDuplicate.length===1?'a':'he'} (per {fmtEur(anteprima.totaleDuplicati)}) già present{anteprima.righeDuplicate.length===1?'e':'i'} identiche in un file diverso già importato — le sto escludendo da questo import per non contarle due volte. Non riguarda ripresi o insoluti, quelli restano e vengono contati normalmente.
              </div>
            )}

            <div className="fs-12 text-muted" style={{ marginBottom: 16 }}>Il mese di competenza di ogni riga è dedotto da decorrenza e annualità, non dal nome del file: un file può contenere righe di mesi diversi, come sopra.</div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={()=>setAnteprima(null)} disabled={caricando}>Annulla</button>
              <button className="btn btn-primary" onClick={confermaImport} disabled={caricando}>{caricando?'⏳ Importazione...':'Conferma import'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
