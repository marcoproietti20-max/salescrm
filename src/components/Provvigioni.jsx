import React, { useState, useMemo } from 'react';
import { fmtEur, fmt, getContratti } from '../constants';
import { nomeCorrisponde } from './Canvass';

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
export function eventiProdotto(p, ct, contatto) {
  const regola = trovaRegola(p.categoria, p.nome);
  if (!regola) return [];
  const anni = Math.max(1, Math.round((Number(p.durataM) || 12) / 12));
  const bucket = bucketDurata(p.durataM);
  const tipoKey = ct.tipo === 'Rinnovo' ? 'rinnovo' : 'nuovo';
  const importo = Number(p.importo) || 0;
  const eventi = [];
  for (let anno = 1; anno <= anni; anno++) {
    let pct = regola[tipoKey][bucket];
    let maggiorata = false;
    if (anno === 1 && tipoKey === 'nuovo' && regola.maggiorata45 && ct.dataInizio && ct.dataInizio <= SCADENZA_MAGGIORATA_45) {
      pct = 45; maggiorata = true;
    }
    eventi.push({
      contattoId: contatto.id, nome: contatto.nome, azienda: contatto.azienda,
      prodottoNome: p.nome || '(senza nome)', categoria: p.categoria, etichettaRegola: regola.etichetta,
      anno, primoAnno: anno === 1, tipo: tipoKey, maggiorata,
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
      if (!ct.dataInizio) return;
      (ct.prodotti || []).forEach(p => {
        eventi.push(...eventiProdotto(p, ct, c));
      });
    });
  });
  return eventi;
}

export function meseStr(d) { return d.toISOString().slice(0, 7); }
export function addMesiData(dataIso, n) { return addMesi(dataIso, n); }

export default function Provvigioni({ contacts, navigateTo }) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [offset, setOffset] = useState(1); // 0 = mese corrente, 1 = mese prossimo (default)

  const tuttiEventi = useMemo(() => calcolaTuttiEventi(contacts), [contacts]);

  const meseSelezionato = useMemo(() => meseStr(new Date(addMesi(oggi.slice(0,7)+'-01', offset) + 'T12:00:00')), [oggi, offset]);
  const etichettaMese = useMemo(() => {
    const d = new Date(meseSelezionato + '-01T12:00:00');
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }, [meseSelezionato]);

  const eventiMese = useMemo(() => tuttiEventi.filter(e => e.data.startsWith(meseSelezionato)).sort((a,b)=>a.data.localeCompare(b.data)), [tuttiEventi, meseSelezionato]);

  const totMese = eventiMese.reduce((s,e)=>s+e.provvigione, 0);
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
          <button className="btn btn-sm" onClick={()=>setOffset(1)}>Mese prossimo</button>
          <button className="btn btn-sm" onClick={()=>setOffset(o=>o+1)}>Succ. →</button>
        </div>
      </div>
      <div className="content">

        <div className="info-box blue" style={{ marginBottom: 16 }}>
          📅 Stai guardando <strong style={{ textTransform: 'capitalize' }}>{etichettaMese}</strong> — calcolato da ogni contratto già inserito, proiettando un incasso per ciascun anno della sua durata. Le aliquote sono quelle del piano provvigionale in vigore; verifica sempre i casi segnalati come "non riconosciuto".
        </div>

        <div className="metric-grid" style={{ marginBottom: 16 }}>
          <div className="metric-card"><div className="metric-label">Totale del mese</div><div className="metric-value" style={{ color: '#1B7A3E' }}>{fmtEur(totMese)}</div></div>
          <div className="metric-card"><div className="metric-label">Di cui Nuovo (1° anno)</div><div className="metric-value" style={{ color: '#0050A0' }}>{fmtEur(totNuovo)}</div></div>
          <div className="metric-card"><div className="metric-label">Di cui Rinnovo (1° anno)</div><div className="metric-value">{fmtEur(totRinnovo)}</div></div>
          <div className="metric-card"><div className="metric-label">Proiezione anni successivi</div><div className="metric-value" style={{ color: '#7B68EE' }}>{fmtEur(totProiezione)}</div></div>
        </div>

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
            <thead><tr><th>Cliente</th><th>Prodotto</th><th>Linea/livello</th><th>Anno</th><th>Aliquota</th><th>Imponibile</th><th>Provvigione</th></tr></thead>
            <tbody>
              {eventiMese.length === 0 ? <tr><td colSpan={7} className="empty">Nessun incasso previsto in questo mese</td></tr> : eventiMese.map((e,i) => (
                <tr key={i}>
                  <td className="fw-600">{e.nome}{e.azienda ? <div className="fs-11 text-muted">{e.azienda}</div> : null}</td>
                  <td className="fs-12">{e.prodottoNome}</td>
                  <td className="fs-12">{e.etichettaRegola}</td>
                  <td className="fs-12">
                    {e.primoAnno
                      ? <span className="badge" style={{ background: e.tipo==='nuovo'?'#EBF4FC':'#EEF1F5', color: e.tipo==='nuovo'?'#0050A0':'#5A6B7E' }}>{e.tipo==='nuovo'?'Nuovo':'Rinnovo'}{e.maggiorata && ' 🔥'}</span>
                      : <span className="badge" style={{ background: '#F1EDFC', color: '#7B68EE' }}>Proiezione anno {e.anno}</span>}
                  </td>
                  <td className="fs-12 fw-600">{e.pct}%</td>
                  <td className="fs-12">{fmtEur(e.importo)}</td>
                  <td className="fw-600" style={{ color: '#1B7A3E' }}>{fmtEur(e.provvigione)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
