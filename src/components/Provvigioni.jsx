import React, { useState, useMemo, useEffect } from 'react';
import { fmtEur, fmt, getContratti } from '../constants';
import { nomeCorrisponde } from './Canvass';
import { dbLoadStoricoProvvigioni, dbEliminaStoricoFile, dbSalvaStoricoBatch, dbEliminaStoricoRiga, dbLoadExtraProvvigioni, dbSalvaExtraProvvigioni, dbEliminaExtraProvvigioni, dbLoadEsclusioniStorico, dbAggiungiEsclusioneStorico, dbRimuoviEsclusioneStorico } from '../supabase';

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

// Riconoscimento automatico della categoria di un prodotto REALE dello storico (estratti conto),
// confermato riga per riga da Marco su un elenco di tutte le famiglie di prodotto osservate con
// aliquota ≥40% nei 20 estratti reali analizzati. Usato SOLO per sapere, quando l'ultimo anno
// noto ha un'aliquota da bonus (≥40%), quale riga di TABELLA_PROVVIGIONI applicare agli anni
// successivi — mai per calcolare l'aliquota stessa, che resta sempre quella reale della riga.
function indovinaCategoriaStorico(descrizioneProdotto) {
  const d = (descrizioneProdotto || '').toUpperCase();
  if (d.startsWith('TOP24') || d.startsWith('SMART24') || d.startsWith('MODULO24') || d.startsWith('BOOK24')
    || d.includes('ARCH. ESPERTO') || d.includes('ARCH.ESPERTO')) return 'Editoria elettronica';
  if (d.includes('PARTNER 24 ORE') || d.includes('PARTNER24 ORE') || d.includes('KIT INGRESSO')) return 'Partner24 Ore';
  return null;
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
      anno: 1, anniTotali: anni, primoAnno: true, tipo: tipoKey, maggiorata: false, avviamento: true,
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
    let importoAnno = importo;
    if (rettifica && rettifica.tipo === 'aliquota' && rettifica.valore !== '' && rettifica.valore != null) {
      pct = Number(rettifica.valore) || 0; maggiorata = false; rettificata = true;
    }
    // "importo" manuale: per contratti il cui prezzo cambia negli anni successivi (es. un
    // costo di avviamento/formazione conteggiato solo il primo anno, tramite importoAvviamento
    // separato) — senza questo, ogni anno ripeterebbe lo stesso importo del contratto.
    if (rettifica && rettifica.tipo === 'importo' && rettifica.valore !== '' && rettifica.valore != null) {
      importoAnno = Number(rettifica.valore) || 0; rettificata = true;
    }
    eventi.push({
      contattoId: contatto.id, nome: contatto.nome, azienda: contatto.azienda,
      prodottoNome: p.nome || '(senza nome)', categoria: p.categoria, etichettaRegola: regola.etichetta,
      anno, anniTotali: anni, primoAnno: anno === 1, tipo: tipoKey, maggiorata, rettificata,
      data: anno === 1 ? ct.dataInizio : addMesi(ct.dataInizio, (anno - 1) * 12),
      importo: importoAnno, pct, provvigione: importoAnno * pct / 100,
    });
  }
  return eventi;
}

// Tutti gli eventi di tutti i contatti, in un'unica lista piatta — usata dalla dashboard
// "previsionale" (stima dai contratti inseriti a mano) e dalla card compatta in Dashboard.
// Non ha più alcun ruolo nella dashboard "ufficiale" delle Provvigioni: quella mostra solo i
// dati reali degli estratti conto e la loro proiezione sui ricorrenti (eventiProiettatiDaStorico),
// per evitare qualunque doppio conteggio — le due fonti restano sempre scisse, mai sommate.
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
  // Il gestionale allinea le colonne con spazi, anche TRA il segno meno e le cifre di un
  // importo negativo (es. storni/insoluti: "-              684,00") — .trim() toglie solo gli
  // spazi ai bordi, quindi va rimosso ogni spazio, ovunque sia, prima di interpretare il numero.
  // Senza questo, parseFloat si ferma sul segno isolato e il valore negativo sparisce (diventa 0).
  const n = parseFloat(String(s).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
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
// Stima solo per anni futuri NON ancora fatturati (usata da eventiProiettatiDaStorico): decorrenza
// + annualità, cioè "l'anno N di un contratto cade N-1 anni dopo la sua decorrenza". Per le righe
// già fatturate, invece, il mese di competenza si prende direttamente dalla vera DATA FATTURA
// (sotto, in mappaRigaStorico) — mai da questa stima: un contratto può decorrere settimane prima
// di essere effettivamente inserito e fatturato insieme al resto del lotto di quel mese, quindi
// calcolarlo dalla decorrenza sposterebbe l'importo su un mese in cui non è mai stato pagato.
function mesiCompetenzaDaDecorrenza(decorrenzaIso, annualita) {
  if (!decorrenzaIso) return null;
  const n = (Number(annualita)||1) - 1;
  return addMesi(decorrenzaIso, n*12).slice(0,7);
}
function mappaRigaStorico(obj, meseRicevuto, nomeFile) {
  const dataFattura = dataIta(obj['DATA FATTURA']);
  const decorrenza = dataIta(obj['DECORRENZA']);
  return {
    // Competenza reale = mese della DATA FATTURA, il dato che l'azienda ha davvero usato per
    // pagare questa riga — fa fede al 100%, come tutto il resto dell'estratto conto. La stima da
    // decorrenza resta solo un ripiego per le rarissime righe import senza data fattura.
    mese_competenza: dataFattura ? dataFattura.slice(0,7) : mesiCompetenzaDaDecorrenza(decorrenza, obj['ANNUALITA']),
    mese_ricevuto: meseRicevuto,
    numero_ordine: obj['NUMERO ORDINE'] || null, posizione: obj['POSIZIONE'] || null, codice_cliente: obj['CODICE CLIENTE'] || null,
    // "RAGIONE SOCIALE CLIENTE" è quasi sempre vuota nei file reali (1232 righe su 1258 nel
    // campione verificato) — il nome compilato davvero è "RAGIONE SOCIALE FATTURAZIONE". Da
    // settembre 2026 l'azienda ha però cambiato il tracciato di esportazione: niente più colonne
    // separate "FATTURAZIONE"/"CLIENTE", un'unica colonna "RAGIONE SOCIALE" — senza questo terzo
    // fallback, tutte le righe di quel nuovo formato risultavano senza anagrafica.
    ragione_sociale: obj['RAGIONE SOCIALE FATTURAZIONE'] || obj['RAGIONE SOCIALE CLIENTE'] || obj['RAGIONE SOCIALE'] || null, tipo_contratto: obj['TIPO CONTRATTO'] || null,
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
// Riconosce lo stato di una riga storno/ripreso dalla sua nota reale, solo per segnalarlo bene
// in tabella — non cambia mai il calcolo: l'importo (positivo o negativo) resta quello reale,
// sommato così com'è al totale del mese. Marco vuole vedere questi casi a colpo d'occhio, non
// una logica diversa: se poi arriva un ripreso, si somma e il totale si corregge da solo.
function statoDaNota(note) {
  const n = (note || '').toUpperCase();
  if (n.includes('ANNULLAT')) return { label: 'Annullato', bg: '#FBE3E3', color: '#A32D2D' };
  if (n.includes('INSOLUT')) return { label: 'Insoluto', bg: '#FFF3DB', color: '#A8710A' };
  if (n.includes('RIPRES')) return { label: 'Ripreso', bg: '#E6F4EA', color: '#1B7A3E' };
  return null;
}
function storicoComeEvento(r) {
  const annoNum = r.annualita || 1;
  // Durata del contratto in anni, così come l'ha fatturata l'azienda — serve per vedere a
  // colpo d'occhio a che punto siamo (es. "anno 2 di 3, restano 1") sulle righe reali.
  const anniTotali = r.durata ? Math.max(1, Math.round(r.durata / 12)) : null;
  return {
    id: r.id, storico: true,
    contattoId: r.codice_cliente, nome: r.ragione_sociale, azienda: null,
    codiceCliente: r.codice_cliente, numeroOrdine: r.numero_ordine, numeroFattura: r.numero_fattura,
    prodottoNome: r.descrizione_prodotto || '(senza nome)', categoria: null,
    etichettaRegola: r.sostituzione === 'U' ? 'Upgrade' : r.sostituzione === 'S' ? 'Standard' : '—',
    anno: annoNum, anniTotali, primoAnno: annoNum === 1, tipo: r.tipo_contratto === 'R' ? 'rinnovo' : 'nuovo',
    maggiorata: false, data: r.data_fattura || (r.mese_competenza + '-15'), note: r.note,
    importo: r.imponibile, pct: r.aliquota, provvigione: r.importo_provvigioni,
  };
}

// ── Proiezione futura dai dati reali importati ─────────────────────────────
// Un cliente conosciuto SOLO tramite l'estratto conto importato (mai inserito a mano come
// contratto nel CRM) non esisterebbe altrimenti per il motore di proiezione: calcolaTuttiEventi
// legge solo i contratti inseriti a mano, quindi quel cliente non mostrerebbe mai un "Ricorrente"
// nei mesi futuri finché non arriva il vero estratto conto di quell'anno. Questa funzione proietta
// invece gli anni ancora non fatturati (durata/12 > ultima annualità vista) direttamente dalle
// righe storiche già importate.
// L'estratto conto fa fede al 100%: l'aliquota da usare per l'anno futuro è quella REALE già
// applicata dall'azienda nell'ultimo anno fatturato dello stesso contratto (ricavata dalle sue
// stesse colonne ALIQUOTA PROVVIGIONE / IMPORTO PROVVIGIONI). Ogni voce (ordine + prodotto +
// sostituzione U/S) viene proiettata SEPARATAMENTE con la propria aliquota reale — mai unita ad
// altre voci dello stesso ordine in una media: un Upgrade e uno Standard sullo stesso prodotto
// sono due righe di fatturazione indipendenti, spesso con aliquote molto diverse tra loro (es.
// 45% e 13%), e unirle produceva un'aliquota "intermedia" (18,98%, 14,67%...) che non corrisponde
// a nessuna voce reale e che Marco non vuole più vedere.
// L'unico caso in cui l'aliquota reale dell'ultimo anno NON va ripetuta tale e quale è il bonus
// "maggiorata" del 45% riconosciuto solo al primo anno (mai da un anno 2+ in su): se la categoria
// del prodotto si riconosce dal nome (indovinaCategoriaStorico) ed è una categoria che prevede
// davvero quel bonus, l'aliquota degli anni successivi si corregge IN AUTOMATICO con la riga
// "rinnovo" di TABELLA_PROVVIGIONI sulla durata di questo contratto. Se la categoria non si
// riconosce, resta solo il segnale manuale (⚠️ + ✎) per Marco.
export function eventiProiettatiDaStorico(storico, esclusioni) {
  // Esclusione manuale: contratto pluriennale saldato in un'unica soluzione (tutte le
  // annualità già incassate subito, es. caso Saint Thomas) — Marco la imposta a mano dalla
  // tabella, perché dallo storico non c'è modo di distinguerla da un vero ricorrente futuro.
  // Chiave solo ordine+prodotto (non sostituzione): un'esclusione/correzione impostata da Marco
  // su un contratto vale per tutte le sue voci (anche se in futuro comparisse un U e un S).
  const mappaEsclusioni = new Map((esclusioni || []).map(e => [`${e.numero_ordine}|${e.codice_prodotto}`, e]));
  const gruppi = {};
  (storico || []).forEach(r => {
    if (!r.numero_ordine || !r.codice_prodotto || !r.decorrenza) return;
    const chiave = `${r.numero_ordine}|${r.codice_prodotto}|${r.sostituzione || ''}`;
    (gruppi[chiave] = gruppi[chiave] || []).push(r);
  });
  const eventi = [];
  Object.entries(gruppi).forEach(([chiave, righe]) => {
    const chiaveEsclusione = `${righe[0].numero_ordine}|${righe[0].codice_prodotto}`;
    const esclusione = mappaEsclusioni.get(chiaveEsclusione);
    if (esclusione && esclusione.aliquota_override == null) return; // escluso del tutto
    const durataM = Math.max(...righe.map(r => Number(r.durata) || 0));
    const anniTotali = durataM ? Math.max(1, Math.round(durataM / 12)) : 1;
    const maxAnnualita = Math.max(...righe.map(r => Number(r.annualita) || 1));
    if (anniTotali <= maxAnnualita) return; // nessun anno futuro ancora da proiettare
    const ultime = righe.filter(r => Number(r.annualita) === maxAnnualita);
    // Se l'azienda ha già segnalato "ANNULLATO" sull'ultimo anno conosciuto, il contratto è
    // chiuso per davvero — niente proiezione sugli anni successivi. È un segnale che arriva
    // dai dati reali stessi, quindi non richiede nessun intervento manuale di Marco su questo
    // lato "ufficiale": eliminare il contratto nel CRM ferma solo la stima "Previsionale",
    // che legge i contratti inseriti a mano, non questa proiezione basata sullo storico.
    if (ultime.some(r => (r.note || '').toUpperCase().includes('ANNULLAT'))) return;
    const base = ultime[0];
    // Questa voce (ordine+prodotto+sostituzione) ha ormai sempre una sola riga per annualità —
    // niente più somma tra U e S: imponibile/provvigione/aliquota sono già quelli reali di
    // questa singola voce, mai una media con un'altra voce diversa.
    const importoBase = ultime.reduce((s, r) => s + (Number(r.imponibile) || 0), 0);
    const provvigioneBase = ultime.reduce((s, r) => s + (Number(r.importo_provvigioni) || 0), 0);
    const pctReale = importoBase > 0 ? Math.round((provvigioneBase / importoBase) * 10000) / 100 : (Number(base.aliquota) || 0);
    // Oltre 35% non esiste aliquota "ordinaria" in tabella per nessuna categoria: è quasi sempre
    // il bonus/maggiorata riconosciuto solo il primo anno. Se riconosco la categoria del prodotto
    // e quella categoria prevede davvero la maggiorata45, correggo in automatico l'aliquota degli
    // anni successivi con la riga "rinnovo" di tabella, sulla durata di questo contratto.
    const categoria = indovinaCategoriaStorico(base.descrizione_prodotto);
    const tipoKey = base.tipo_contratto === 'R' ? 'rinnovo' : 'nuovo';
    let pctAutocorretta = null;
    if (pctReale >= 40 && categoria) {
      const regola = trovaRegola(categoria, base.descrizione_prodotto);
      if (regola && regola.maggiorata45) {
        pctAutocorretta = regola.rinnovo[bucketDurata(durataM)];
      }
    }
    // Resta un ⚠️ manuale solo per i casi che NON si riescono a correggere da soli (categoria
    // non riconosciuta, o aliquota alta per un motivo diverso dal bonus) — Marco può sempre
    // intervenire con ✎ anche su questi.
    const sospettaMaggiorata = pctReale >= 40 && pctAutocorretta == null && !(esclusione && esclusione.aliquota_override != null);
    const pct = (esclusione && esclusione.aliquota_override != null)
      ? Number(esclusione.aliquota_override)
      : (pctAutocorretta != null ? pctAutocorretta : pctReale);
    for (let anno = maxAnnualita + 1; anno <= anniTotali; anno++) {
      eventi.push({
        storicoProiettato: true,
        contattoId: base.codice_cliente, nome: base.ragione_sociale, azienda: null,
        codiceCliente: base.codice_cliente, numeroOrdine: base.numero_ordine, numeroFattura: null,
        codiceProdotto: base.codice_prodotto,
        prodottoNome: base.descrizione_prodotto || '(senza nome)', categoria,
        etichettaRegola: base.sostituzione === 'U' ? 'Upgrade' : base.sostituzione === 'S' ? 'Standard' : '—',
        anno, anniTotali, primoAnno: false, tipo: tipoKey, maggiorata: false, sospettaMaggiorata,
        correttaDaCategoria: pctAutocorretta != null,
        data: mesiCompetenzaDaDecorrenza(base.decorrenza, anno) + '-15',
        importo: importoBase, pct, provvigione: importoBase * pct / 100,
      });
    }
  });
  return eventi;
}

export default function Provvigioni({ contacts, navigateTo, showToast }) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [offset, setOffset] = useState(0); // 0 = mese di competenza corrente (default) — l'incasso vero arriva ~45 giorni dopo

  // ── Due dashboard scisse, mai sommate tra loro ──────────────────────────────────────────
  // "Ufficiale": solo i dati reali degli estratti conto, più la proiezione sui ricorrenti
  // calcolata da quegli stessi dati (eventiProiettatiDaStorico) — fa fede, copre tutti i mesi.
  // "Previsionale": una stima basata sui contratti inseriti a mano, utile solo per il mese in
  // corso e quello appena concluso, in attesa che arrivi l'estratto conto reale il 15. Non
  // genera mai proiezioni sugli anni successivi: quelle restano di competenza esclusiva
  // dell'ufficiale, altrimenti le due dashboard si sovrapporrebbero sullo stesso incasso.
  const [vista, setVista] = useState('ufficiale'); // 'ufficiale' | 'previsionale'

  // ── Storico reale dagli estratti conto — unica fonte della dashboard ufficiale ──
  const [storico, setStorico] = useState(null); // null = ancora in caricamento
  const ricaricaStorico = () => dbLoadStoricoProvvigioni().then(setStorico);
  useEffect(() => { ricaricaStorico(); }, []);

  // Contratti esclusi manualmente dalla proiezione sui ricorrenti (es. saldati in un'unica
  // soluzione, caso Saint Thomas — tutte le annualità già incassate, nessun rateo futuro).
  const [esclusioni, setEsclusioni] = useState([]);
  const ricaricaEsclusioni = () => dbLoadEsclusioniStorico().then(setEsclusioni);
  useEffect(() => { ricaricaEsclusioni(); }, []);
  const escludiDallaProiezione = async (numeroOrdine, codiceProdotto, nomeCliente) => {
    const motivo = window.prompt(`Escludere "${nomeCliente||''}" dalla proiezione dei ricorrenti futuri? Usalo quando il cliente ha già saldato tutte le annualità in un'unica soluzione.\n\nMotivo (facoltativo):`, 'Saldato in un\'unica soluzione');
    if (motivo === null) return; // annullato
    const ok = await dbAggiungiEsclusioneStorico(numeroOrdine, codiceProdotto, motivo, null);
    if (!ok) { showToast('Errore durante il salvataggio', '', 'info'); return; }
    showToast('Contratto escluso dalla proiezione', '');
    ricaricaEsclusioni();
  };
  // Corregge solo l'aliquota usata per gli anni futuri di questo contratto (non lo esclude) —
  // serve quando l'ultimo anno reale importato portava un bonus/maggiorata riconosciuto solo
  // quell'anno, che altrimenti continuerebbe a ripetersi identico su tutti gli anni successivi.
  const correggiAliquotaProiezione = async (numeroOrdine, codiceProdotto, nomeCliente, pctAttuale) => {
    const input = window.prompt(`Aliquota da usare per gli anni futuri di "${nomeCliente||''}" (attualmente proiettata al ${pctAttuale}%, probabilmente comprende un bonus riconosciuto solo il primo anno).\n\nNuova aliquota %:`, '');
    if (input === null) return;
    const valore = parseFloat(input.replace(',', '.'));
    if (isNaN(valore)) { showToast('Aliquota non valida', '', 'info'); return; }
    const ok = await dbAggiungiEsclusioneStorico(numeroOrdine, codiceProdotto, `Aliquota corretta manualmente da ${pctAttuale}% a ${valore}%`, valore);
    if (!ok) { showToast('Errore durante il salvataggio', '', 'info'); return; }
    showToast('Aliquota corretta', `${valore}% per gli anni futuri`);
    ricaricaEsclusioni();
  };
  const rimuoviEsclusione = async (id) => {
    const ok = await dbRimuoviEsclusioneStorico(id);
    if (!ok) { showToast('Errore durante la rimozione', '', 'info'); return; }
    ricaricaEsclusioni();
  };

  // Proiezione dei ricorrenti futuri, generata solo dai dati reali già importati — questa è
  // l'UNICA fonte di "tuttiEventi" qui sotto: i contratti inseriti a mano non entrano più nella
  // dashboard ufficiale, per evitare qualunque doppio conteggio con gli estratti conto.
  const eventiStoricoProiettati = useMemo(() => eventiProiettatiDaStorico(storico, esclusioni), [storico, esclusioni]);
  const tuttiEventi = eventiStoricoProiettati;

  const meseSelezionato = useMemo(() => meseStr(new Date(addMesi(oggi.slice(0,7)+'-01', offset) + 'T12:00:00')), [oggi, offset]);
  const etichettaMese = useMemo(() => {
    const d = new Date(meseSelezionato + '-01T12:00:00');
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }, [meseSelezionato]);
  // Selettore mese/anno diretto (es. "2025-06") — calcola l'offset in mesi interi rispetto a
  // oggi, senza passare per le frecce avanti/indietro una alla volta.
  const vaiAMese = (valoreYYYYMM) => {
    if (!valoreYYYYMM) return;
    const [ySel, mSel] = valoreYYYYMM.split('-').map(Number);
    const [yOggi, mOggi] = oggi.slice(0,7).split('-').map(Number);
    setOffset((ySel - yOggi) * 12 + (mSel - mOggi));
  };

  // ── Dashboard "previsionale": solo mese in corso e mese appena concluso, dai contratti a mano ──
  const eventiCalcolatiDaContratti = useMemo(() => calcolaTuttiEventi(contacts), [contacts]);
  const mesePrevisionaleCorrente = useMemo(() => meseStr(new Date(oggi.slice(0,7) + '-01T12:00:00')), [oggi]);
  const mesePrevisionalePrecedente = useMemo(() => addMesi(mesePrevisionaleCorrente + '-01', -1).slice(0,7), [mesePrevisionaleCorrente]);
  const calcolaRiepilogoPrevisionale = (mese) => {
    const ev = eventiCalcolatiDaContratti.filter(e => e.data.startsWith(mese)).sort((a,b)=>a.data.localeCompare(b.data));
    return {
      mese, eventi: ev,
      totale: ev.reduce((s,e)=>s+e.provvigione,0),
      nuovo: ev.filter(e=>e.primoAnno && e.tipo==='nuovo').reduce((s,e)=>s+e.provvigione,0),
      rinnovo: ev.filter(e=>e.primoAnno && e.tipo==='rinnovo').reduce((s,e)=>s+e.provvigione,0),
      ricorrenti: ev.filter(e=>!e.primoAnno).reduce((s,e)=>s+e.provvigione,0),
    };
  };
  const riepilogoPrevisionale = useMemo(() => ([
    calcolaRiepilogoPrevisionale(mesePrevisionaleCorrente),
    calcolaRiepilogoPrevisionale(mesePrevisionalePrecedente),
  ]), [eventiCalcolatiDaContratti, mesePrevisionaleCorrente, mesePrevisionalePrecedente]);

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
    // Il mese di competenza reale (data fattura) quasi sempre NON coincide col nome del file
    // (es. "Agosto 2025.XLS" è lo statement ricevuto ad agosto, ma copre quasi sempre le fatture
    // di luglio) — senza questo salto, Marco resta a guardare il mese che aveva aperto prima di
    // importare e lo vede vuoto, pensando che l'import non abbia funzionato. mesiTrovati è già
    // ordinato dal più recente al più vecchio: ci si sposta sul più recente dei mesi appena importati.
    if (anteprima.mesiTrovati.length) vaiAMese(anteprima.mesiTrovati[0][0]);
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

  // ── Gestione estratti conto importati: elenco file con righe/totale, eliminabili da qui ──
  const [gestioneFile, setGestioneFile] = useState(false);
  const fileImportati = useMemo(() => {
    const m = {};
    (storico||[]).forEach(r => {
      const key = r.file_origine || '(sconosciuto)';
      (m[key] = m[key] || { file: key, righe: 0, totale: 0, mesi: new Set() });
      m[key].righe += 1;
      m[key].totale += (r.importo_provvigioni || 0);
      m[key].mesi.add(r.mese_competenza);
    });
    return Object.values(m).sort((a,b) => a.file.localeCompare(b.file));
  }, [storico]);
  const eliminaFileStorico = async (nomeFile, righe) => {
    if (!window.confirm(`Eliminare definitivamente tutte le ${righe} righe importate dal file "${nomeFile}"? L'operazione non è reversibile (puoi solo ricaricare il file).`)) return;
    const ok = await dbEliminaStoricoFile(nomeFile);
    if (!ok) { showToast('Errore durante l\'eliminazione', '', 'info'); return; }
    showToast('File eliminato', `${righe} righe rimosse`);
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

  // Tre categorie distinte: Nuovo (primo anno, cliente nuovo), Rinnovo (primo anno, cliente già
  // in portafoglio) e Ricorrenti (le rate degli anni successivi dovute alla durata del contratto,
  // indipendentemente dal fatto che sia nato Nuovo o Rinnovo — 12 mesi zero, 24 mesi uno, ecc.).
  const totMese = eventiMese.reduce((s,e)=>s+e.provvigione, 0) + totExtra;
  const totPrimoAnno = eventiMese.filter(e=>e.primoAnno).reduce((s,e)=>s+e.provvigione, 0);
  const totProiezione = eventiMese.filter(e=>!e.primoAnno).reduce((s,e)=>s+e.provvigione, 0);
  const totNuovo = eventiMese.filter(e=>e.primoAnno && e.tipo==='nuovo').reduce((s,e)=>s+e.provvigione, 0);
  const totRinnovo = eventiMese.filter(e=>e.primoAnno && e.tipo==='rinnovo').reduce((s,e)=>s+e.provvigione, 0);

  // Proiezione dei prossimi 12 mesi (da oggi), per vedere a colpo d'occhio il ricorrente in arrivo
  const prossimi12 = useMemo(() => {
    return Array.from({length:12}, (_,i) => {
      const m = meseStr(new Date(addMesi(oggi.slice(0,7)+'-01', i) + 'T12:00:00'));
      // Per i mesi già coperti da un estratto conto reale uso quel dato, non la proiezione
      // calcolata — stessa regola di priorità usata per il dettaglio del mese selezionato.
      const tot = mesiConStorico.has(m)
        ? (storico||[]).filter(r=>r.mese_competenza===m).reduce((s,r)=>s+(r.importo_provvigioni||0), 0)
        : tuttiEventi.filter(e=>e.data.startsWith(m)).reduce((s,e)=>s+e.provvigione,0);
      return { mese: m, tot };
    });
  }, [tuttiEventi, oggi, storico, mesiConStorico]);
  const maxProiezione = Math.max(1, ...prossimi12.map(p=>p.tot));

  const perCategoria = useMemo(() => {
    const m = {};
    eventiMese.forEach(e => { m[e.etichettaRegola] = (m[e.etichettaRegola]||0) + e.provvigione; });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }, [eventiMese]);

  // ── Dettaglio del mese: sotto-tab Nuovo/Rinnovo/Ricorrenti, ordinamento colonne, selezione con somma ──
  const [filtroTipo, setFiltroTipo] = useState('tutti'); // 'tutti' | 'nuovo' | 'rinnovo' | 'ricorrenti'
  const [ordinamento, setOrdinamento] = useState({ campo: null, dir: 1 });
  const [selezionati, setSelezionati] = useState(() => new Set());
  useEffect(() => { setSelezionati(new Set()); setFiltroTipo('tutti'); }, [meseSelezionato, vista]);

  const eventiMeseConIdx = useMemo(() => eventiMese.map((e, i) => ({ ...e, _idx: i })), [eventiMese]);
  const conteggiTipo = useMemo(() => ({
    tutti: eventiMeseConIdx.length,
    nuovo: eventiMeseConIdx.filter(e => e.primoAnno && e.tipo === 'nuovo').length,
    rinnovo: eventiMeseConIdx.filter(e => e.primoAnno && e.tipo === 'rinnovo').length,
    ricorrenti: eventiMeseConIdx.filter(e => !e.primoAnno).length,
  }), [eventiMeseConIdx]);
  const eventiMeseFiltrati = useMemo(() => {
    let righe = eventiMeseConIdx;
    if (filtroTipo === 'nuovo') righe = righe.filter(e => e.primoAnno && e.tipo === 'nuovo');
    else if (filtroTipo === 'rinnovo') righe = righe.filter(e => e.primoAnno && e.tipo === 'rinnovo');
    else if (filtroTipo === 'ricorrenti') righe = righe.filter(e => !e.primoAnno);
    if (ordinamento.campo) {
      const campo = ordinamento.campo;
      righe = [...righe].sort((a, b) => {
        let va = a[campo], vb = b[campo];
        if (typeof va === 'string' || typeof vb === 'string') { va = (va||'').toString().toLowerCase(); vb = (vb||'').toString().toLowerCase(); }
        if (va < vb) return -1 * ordinamento.dir;
        if (va > vb) return 1 * ordinamento.dir;
        return 0;
      });
    }
    return righe;
  }, [eventiMeseConIdx, filtroTipo, ordinamento]);
  const ordinaPer = (campo) => setOrdinamento(o => o.campo === campo ? { campo, dir: -o.dir } : { campo, dir: 1 });
  const iconaOrdinamento = (campo) => ordinamento.campo !== campo ? '' : (ordinamento.dir === 1 ? ' ▲' : ' ▼');
  const toggleSelezione = (idx) => setSelezionati(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const toggleSelezionaTutti = () => setSelezionati(s => s.size === eventiMeseFiltrati.length ? new Set() : new Set(eventiMeseFiltrati.map(e => e._idx)));
  const totSelezionati = useMemo(() => eventiMeseConIdx.filter(e => selezionati.has(e._idx)).reduce((s,e)=>s+e.provvigione, 0), [eventiMeseConIdx, selezionati]);

  return (
    <>
      <div className="topbar">
        <span className="page-title">Provvigioni</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button className="btn btn-sm" style={{ border: 'none', borderRadius: 0, background: vista==='ufficiale' ? 'var(--bg3)' : 'transparent', fontWeight: vista==='ufficiale'?700:400 }} onClick={()=>setVista('ufficiale')}>📄 Ufficiale</button>
            <button className="btn btn-sm" style={{ border: 'none', borderRadius: 0, background: vista==='previsionale' ? 'var(--bg3)' : 'transparent', fontWeight: vista==='previsionale'?700:400 }} onClick={()=>setVista('previsionale')}>🧮 Previsionale</button>
          </div>
          {vista === 'ufficiale' && (<>
            <button className="btn btn-sm" onClick={()=>setOffset(o=>o-1)}>← Prec.</button>
            <button className="btn btn-sm" onClick={()=>setOffset(0)}>Oggi</button>
            <button className="btn btn-sm" onClick={()=>setOffset(o=>o+1)}>Succ. →</button>
            <input className="form-control" type="month" style={{ width: 150 }} value={meseSelezionato} onChange={e=>vaiAMese(e.target.value)} title="Vai direttamente a un mese/anno" />
            <button className="btn btn-sm" onClick={()=>setGestioneFile(true)} title="Vedi ed elimina gli estratti conto già importati">🗂 Gestisci estratti</button>
            <button className="btn btn-sm btn-primary" onClick={()=>fileRef.current?.click()}>📁 Carica estratto conto</button>
            <input ref={fileRef} type="file" accept=".xls,.XLS,.txt" style={{ display: 'none' }} onChange={selezionaFile} />
          </>)}
        </div>
      </div>
      <div className="content">

      {vista === 'previsionale' ? (
        <>
          <div className="info-box amber" style={{ marginBottom: 16 }}>
            🧮 Stima provvigionale calcolata dai contratti inseriti a mano — utile solo per capire quanto hai ipoteticamente maturato nel mese in corso e in quello appena concluso, in attesa dell'estratto conto reale del 15. Non è collegata ai dati ufficiali e non proietta anni futuri: quella parte resta solo nella dashboard "Ufficiale".
          </div>
          <div className="charts-grid" style={{ marginBottom: 16 }}>
            {riepilogoPrevisionale.map((r, idx) => (
              <div className="card" key={r.mese} style={{ marginBottom: 0 }}>
                <div className="card-title" style={{ marginBottom: 10, textTransform: 'capitalize' }}>
                  {idx === 0 ? 'Mese in corso — ' : 'Mese appena concluso — '}
                  {new Date(r.mese+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'})}
                </div>
                <div className="metric-grid" style={{ marginBottom: 10 }}>
                  <div className="metric-card"><div className="metric-label">Totale</div><div className="metric-value" style={{ color: '#1B7A3E' }}>{fmtEur(r.totale)}</div></div>
                  <div className="metric-card"><div className="metric-label">Nuovo</div><div className="metric-value" style={{ color: '#0050A0' }}>{fmtEur(r.nuovo)}</div></div>
                  <div className="metric-card"><div className="metric-label">Rinnovo</div><div className="metric-value">{fmtEur(r.rinnovo)}</div></div>
                  <div className="metric-card"><div className="metric-label">Ricorrenti</div><div className="metric-value" style={{ color: '#7B68EE' }}>{fmtEur(r.ricorrenti)}</div></div>
                </div>
                <div className="table-wrap">
                  <table className="crm-table">
                    <thead><tr><th>Cliente</th><th>Prodotto</th><th>Anno</th><th>Aliquota</th><th>Provvigione</th></tr></thead>
                    <tbody>
                      {r.eventi.length === 0 ? <tr><td colSpan={5} className="empty">Nessun contratto manuale per questo mese</td></tr> : r.eventi.map((e,i) => (
                        <tr key={i}>
                          <td className="fw-600 fs-12">{e.nome || <span className="text-muted">(nome non disponibile)</span>}</td>
                          <td className="fs-12">{e.prodottoNome}</td>
                          <td className="fs-12">{e.primoAnno ? (e.tipo==='nuovo'?'Nuovo':'Rinnovo') : `Anno ${e.anno}`}</td>
                          <td className="fs-12">{e.pct}%</td>
                          <td className="fw-600 fs-12" style={{ color: '#1B7A3E' }}>{fmtEur(e.provvigione)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
        <div className="info-box blue" style={{ marginBottom: 16 }}>
          📅 Competenza <strong style={{ textTransform: 'capitalize' }}>{etichettaMese}</strong> — pre-fattura il <strong>{prefatturaStr}</strong>, incasso previsto entro il <strong>{incassoStr}</strong>.{' '}
          {haStoricoMeseSelezionato
            ? <strong>📄 Dato reale, importato dall'estratto conto.</strong>
            : eventiMese.length > 0
              ? <>Proiezione sui ricorrenti calcolata dai dati reali già importati per questi contratti, stessa aliquota dell'ultimo anno fatturato.</>
              : <>Nessun dato reale importato per questo mese. La stima dai contratti inseriti a mano è nella dashboard "Previsionale".</>}
        </div>

        <div className="metric-grid" style={{ marginBottom: 8 }}>
          <div className="metric-card"><div className="metric-label">Totale del mese</div><div className="metric-value" style={{ color: '#1B7A3E' }}>{fmtEur(totMese)}</div></div>
          <div className="metric-card" title="Primo anno di un contratto con un cliente nuovo.">
            <div className="metric-label">Nuovo</div><div className="metric-value" style={{ color: '#0050A0' }}>{fmtEur(totNuovo)}</div>
          </div>
          <div className="metric-card" title="Rinnovo fatturato quest'anno su un cliente già nel tuo portafoglio.">
            <div className="metric-label">Rinnovo</div><div className="metric-value">{fmtEur(totRinnovo)}</div>
          </div>
          <div className="metric-card" title="Provvigioni pagate negli anni successivi in base alla durata del contratto: 12 mesi zero ricorrenti, 24 mesi uno, 36 mesi due, ecc. — indipendentemente dal fatto che il contratto sia nato Nuovo o Rinnovo.">
            <div className="metric-label">Ricorrenti</div><div className="metric-value" style={{ color: '#7B68EE' }}>{fmtEur(totProiezione)}</div>
          </div>
        </div>
        {totExtra !== 0 && (
          <div className="fs-12 text-muted" style={{ marginBottom: 16 }}>Di cui <strong>{fmtEur(totExtra)}</strong> inserito manualmente come premio/rimborso per questo mese.</div>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Dettaglio — {eventiMeseFiltrati.length} di {eventiMese.length} contratti/prodotti in questo mese</div>
          <div style={{ display: 'flex', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {[['tutti','Tutti'],['nuovo','Nuovo'],['rinnovo','Rinnovo'],['ricorrenti','Ricorrenti']].map(([k,label]) => (
              <button key={k} className="btn btn-sm" style={{ border: 'none', borderRadius: 0, background: filtroTipo===k ? 'var(--bg3)' : 'transparent', fontWeight: filtroTipo===k?700:400 }} onClick={()=>setFiltroTipo(k)}>
                {label} <span className="text-muted">({conteggiTipo[k]})</span>
              </button>
            ))}
          </div>
        </div>
        {selezionati.size > 0 && (
          <div className="info-box blue" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{selezionati.size} rig{selezionati.size===1?'a selezionata':'he selezionate'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <strong style={{ fontSize: 15 }}>{fmtEur(totSelezionati)}</strong>
              <button className="btn btn-sm" onClick={()=>setSelezionati(new Set())}>Deseleziona tutto</button>
            </span>
          </div>
        )}
        <div className="table-wrap">
          <table className="crm-table">
            <thead><tr>
              <th style={{ width: 28 }}><input type="checkbox" checked={eventiMeseFiltrati.length>0 && selezionati.size===eventiMeseFiltrati.length} onChange={toggleSelezionaTutti} /></th>
              <th style={{ cursor: 'pointer' }} onClick={()=>ordinaPer('nome')}>Cliente{iconaOrdinamento('nome')}</th>
              <th style={{ cursor: 'pointer' }} onClick={()=>ordinaPer('prodottoNome')}>Prodotto{iconaOrdinamento('prodottoNome')}</th>
              <th style={{ cursor: 'pointer' }} onClick={()=>ordinaPer('etichettaRegola')}>Linea/livello{iconaOrdinamento('etichettaRegola')}</th>
              <th style={{ cursor: 'pointer' }} onClick={()=>ordinaPer('anno')}>Anno{iconaOrdinamento('anno')}</th>
              <th>Durata contratto</th>
              <th style={{ cursor: 'pointer' }} onClick={()=>ordinaPer('pct')}>Aliquota{iconaOrdinamento('pct')}</th>
              <th style={{ cursor: 'pointer' }} onClick={()=>ordinaPer('importo')}>Imponibile{iconaOrdinamento('importo')}</th>
              <th style={{ cursor: 'pointer' }} onClick={()=>ordinaPer('provvigione')}>Provvigione{iconaOrdinamento('provvigione')}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {eventiMeseFiltrati.length === 0 ? <tr><td colSpan={10} className="empty">Nessun incasso previsto in questo mese</td></tr> : eventiMeseFiltrati.map((e) => (
                <tr key={e._idx} style={selezionati.has(e._idx) ? { background: 'var(--bg3)' } : undefined}>
                  <td><input type="checkbox" checked={selezionati.has(e._idx)} onChange={()=>toggleSelezione(e._idx)} /></td>
                  <td className="fw-600">
                    {e.nome || <span className="text-muted">(nome non disponibile)</span>}
                    {e.azienda ? <div className="fs-11 text-muted">{e.azienda}</div> : null}
                    {(e.storico || e.storicoProiettato) && <div className="fs-11 text-muted">{e.codiceCliente ? `cod. ${e.codiceCliente}` : ''}{e.codiceCliente && (e.numeroOrdine||e.numeroFattura) ? ' · ' : ''}{e.numeroOrdine ? `ordine ${e.numeroOrdine}` : ''}{e.numeroOrdine && e.numeroFattura ? ' · ' : ''}{e.numeroFattura ? `fatt. ${e.numeroFattura}` : ''}</div>}
                  </td>
                  <td className="fs-12">{e.prodottoNome}</td>
                  <td className="fs-12">{e.etichettaRegola}</td>
                  <td className="fs-12">
                    {e.primoAnno
                      ? <span className="badge" style={{ background: e.tipo==='nuovo'?'#EBF4FC':'#EEF1F5', color: e.tipo==='nuovo'?'#0050A0':'#5A6B7E' }}>{e.tipo==='nuovo'?'Nuovo':'Rinnovo'}{e.maggiorata && ' 🔥'}</span>
                      : <span className="badge" style={{ background: e.storicoProiettato ? '#FDEEDC' : '#F1EDFC', color: e.storicoProiettato ? '#B5651D' : '#7B68EE' }} title={e.storicoProiettato ? 'Proiettato dai dati reali già importati per questo contratto (non da un contratto inserito a mano nel CRM)' : undefined}>{e.storico ? `Anno ${e.anno}` : e.storicoProiettato ? `Proiezione anno ${e.anno} (da storico)` : `Proiezione anno ${e.anno}`}</span>}
                    {e.rettificata && <span className="badge" style={{ background: '#FFF3DB', color: '#A8710A', marginLeft: 4 }} title="Aliquota modificata manualmente per questo anno">✎</span>}
                    {e.storico && statoDaNota(e.note) && (
                      <span className="badge" style={{ background: statoDaNota(e.note).bg, color: statoDaNota(e.note).color, marginLeft: 4 }} title={e.note}>{statoDaNota(e.note).label}</span>
                    )}
                  </td>
                  <td className="fs-12">
                    {e.anniTotali
                      ? <>anno {e.anno} di {e.anniTotali}{e.anniTotali - e.anno > 0 && <div className="fs-11 text-muted">restano {e.anniTotali - e.anno}</div>}</>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="fs-12 fw-600">
                    {e.pct}%
                    {e.correttaDaCategoria && <span title={`Corretta automaticamente: l'ultimo anno reale aveva il bonus del 45% riconosciuto solo al primo anno — dal secondo anno si applica l'aliquota di rinnovo di tabella per la categoria "${e.categoria}".`} style={{ marginLeft: 4, cursor: 'help', color: '#1B7A3E' }}>✓</span>}
                    {e.sospettaMaggiorata && <span title="Sopra il 35% non esiste aliquota ordinaria in tabella: è probabile che l'ultimo anno reale includesse un bonus riconosciuto solo quell'anno, che qui si sta ripetendo per errore. Non riconosco la categoria di questo prodotto per correggerla da solo — usa ✎ per correggerla a mano." style={{ marginLeft: 4, cursor: 'help' }}>⚠️</span>}
                  </td>
                  <td className="fs-12">{fmtEur(e.importo)}</td>
                  <td className="fw-600" style={{ color: '#1B7A3E' }}>{fmtEur(e.provvigione)}</td>
                  <td>
                    {e.storico && (
                      <button className="btn btn-sm" title="Elimina questa riga dello storico" onClick={()=>eliminaRigaStorico(e)} style={{ color: '#C0392B' }}>🗑</button>
                    )}
                    {e.storicoProiettato && (<>
                      <button className="btn btn-sm" title="Correggi l'aliquota usata per gli anni futuri di questo contratto" onClick={()=>correggiAliquotaProiezione(e.numeroOrdine, e.codiceProdotto, e.nome, e.pct)} style={{ color: '#0050A0' }}>✎</button>
                      <button className="btn btn-sm" title="Escludi questo contratto dalla proiezione dei ricorrenti futuri (es. saldato in un'unica soluzione)" onClick={()=>escludiDallaProiezione(e.numeroOrdine, e.codiceProdotto, e.nome)} style={{ color: '#B5651D' }}>🚫</button>
                    </>)}
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
          <div className="fs-11 text-muted" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span>Mesi con dato reale già importato:</span>
            {[...mesiConStorico].sort().reverse().map(m => (
              <button key={m} className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 11, background: m===meseSelezionato?'var(--bg3)':'transparent', fontWeight: m===meseSelezionato?700:400 }} onClick={()=>vaiAMese(m)}>
                {new Date(m+'-01T12:00:00').toLocaleDateString('it-IT',{month:'short',year:'numeric'})}
              </button>
            ))}
          </div>
        )}
        </>
      )}
      </div>

      {/* ── Gestione estratti conto importati: elenco file, eliminabili uno per uno ── */}
      {gestioneFile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,40,.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={()=>setGestioneFile(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 22 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Estratti conto importati</div>
            <div className="fs-12 text-muted" style={{ marginBottom: 16 }}>{fileImportati.length} file, {storico?.length || 0} righe totali nello storico ufficiale.</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {fileImportati.length === 0 && <div className="fs-12 text-muted">Nessun estratto conto importato.</div>}
              {fileImportati.map(f => (
                <div key={f.file} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div className="fw-600 fs-13">{f.file}</div>
                    <div className="fs-11 text-muted">{f.righe} righe · {[...f.mesi].sort().join(', ')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="fw-600" style={{ color: f.totale >= 0 ? '#1B7A3E' : '#C0392B' }}>{fmtEur(f.totale)}</span>
                    <button className="btn btn-sm" title="Elimina questo file dallo storico" onClick={()=>eliminaFileStorico(f.file, f.righe)} style={{ color: '#C0392B' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
            {esclusioni.length > 0 && (<>
              <div className="fw-600 fs-13" style={{ marginTop: 18, marginBottom: 6 }}>Correzioni manuali sulla proiezione ricorrenti</div>
              {esclusioni.map(x => (
                <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="fs-12">
                    <span className="fw-600">ordine {x.numero_ordine}</span> · {x.codice_prodotto}
                    {' · '}{x.aliquota_override != null ? <span style={{ color: '#0050A0' }}>aliquota corretta a {x.aliquota_override}%</span> : <span style={{ color: '#B5651D' }}>escluso dalla proiezione</span>}
                    {x.motivo && <div className="fs-11 text-muted">{x.motivo}</div>}
                  </div>
                  <button className="btn btn-sm" title="Rimuovi questa correzione" onClick={()=>rimuoviEsclusione(x.id)} style={{ color: '#C0392B' }}>🗑</button>
                </div>
              ))}
            </>)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={()=>setGestioneFile(false)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

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
                  <div className="fs-11 text-muted" style={{ marginBottom: 4 }}>Ripartizione per mese di competenza (data fattura reale):</div>
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

            <div className="fs-12 text-muted" style={{ marginBottom: 16 }}>Il mese di competenza di ogni riga è la sua vera data fattura, non il nome del file: un file può contenere comunque righe di mesi diversi (rettifiche, ripresi), come sopra.</div>

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
