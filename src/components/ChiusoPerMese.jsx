import React, { useState, useEffect, useRef } from 'react';
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { fmt, fmtEur, getDataChiusura, getContratti } from '../constants';
Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip);
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// ── Helpers ─────────────────────────────────────────────────
function getFatturatoNuovo(c) {
  return getContratti(c).filter(ct => ct.tipo !== 'Rinnovo')
    .reduce((s, ct) => s + (ct.prodotti||[]).reduce((ps,p) => ps+(Number(p.importo)||0), 0) || Number(ct.totale)||0, 0);
}
function getFatturatoRinnovo(c) {
  return getContratti(c).filter(ct => ct.tipo === 'Rinnovo')
    .reduce((s, ct) => s + (ct.prodotti||[]).reduce((ps,p) => ps+(Number(p.importo)||0), 0) || Number(ct.totale)||0, 0);
}
function getFatturatoTotale(c) { return getFatturatoNuovo(c) + getFatturatoRinnovo(c); }

// Valore contrattuale = somma per ogni prodotto: importo * (durataM/12)
// Rappresenta il valore annualizzato della durata effettiva
function getValoreContrattuale(c) {
  return getContratti(c).reduce((s, ct) => {
    if (ct.prodotti?.length) {
      return s + ct.prodotti.reduce((ps,p) => {
        const mesi = Number(p.durataM) || 12;
        return ps + (Number(p.importo)||0) * mesi / 12;
      }, 0);
    }
    const mesi = Number(ct.durataM) || 12;
    return s + (Number(ct.totale)||0) * mesi / 12;
  }, 0);
}

// Durata media in mesi del contratto
function getDurataMedia(c) {
  const contratti = getContratti(c);
  if (!contratti.length) return null;
  const durate = contratti.flatMap(ct =>
    ct.prodotti?.length ? ct.prodotti.map(p => Number(p.durataM)||12) : [Number(ct.durataM)||12]
  );
  return Math.round(durate.reduce((s,d) => s+d, 0) / durate.length);
}

export default function ChiusoPerMese({ contacts, stages }) {
  const curYear = new Date().getFullYear().toString();
  const wonStage = stages.filter(s => !s.isKo).slice(-1)[0];
  const closed = contacts.filter(c => wonStage && c.fase === wonStage.name && getDataChiusura(c));
  const allYears = [...new Set(closed.map(c => getDataChiusura(c).slice(0,4)))].sort().reverse();
  if (!allYears.includes(curYear)) allYears.unshift(curYear);

  const [year, setYear] = useState(curYear);
  const [openM, setOpenM] = useState({});
  const [sortK, setSortK] = useState('data');
  const [sortD, setSortD] = useState('desc');
  const chartRef = useRef(); const chartInst = useRef();

  const yearClosed = closed.filter(c => getDataChiusura(c).startsWith(year));

  const monthly = Array.from({length:12}, (_,i) => ({
    month: i, label: MESI[i],
    contacts: [], totale: 0, nuovo: 0, rinnovo: 0, valoreContrattuale: 0, count: 0
  }));

  yearClosed.forEach(c => {
    const m = parseInt(getDataChiusura(c).slice(5,7)) - 1;
    monthly[m].contacts.push(c);
    monthly[m].totale += getFatturatoTotale(c);
    monthly[m].nuovo += getFatturatoNuovo(c);
    monthly[m].rinnovo += getFatturatoRinnovo(c);
    monthly[m].valoreContrattuale += getValoreContrattuale(c);
    monthly[m].count++;
  });

  const totalTotale = yearClosed.reduce((s,c) => s + getFatturatoTotale(c), 0);
  const totalNuovo = yearClosed.reduce((s,c) => s + getFatturatoNuovo(c), 0);
  const totalRinnovo = yearClosed.reduce((s,c) => s + getFatturatoRinnovo(c), 0);
  const totalVC = yearClosed.reduce((s,c) => s + getValoreContrattuale(c), 0);
  const activeMths = monthly.filter(m => m.count > 0);
  const bestMonth = monthly.reduce((b,m) => m.totale > b.totale ? m : b, monthly[0]);

  const sortContacts = list => [...list].sort((a,b) => {
    let va='', vb='';
    if (sortK==='nome'){va=a.nome||'';vb=b.nome||'';}
    else if (sortK==='totale') return sortD==='asc'?getFatturatoTotale(a)-getFatturatoTotale(b):getFatturatoTotale(b)-getFatturatoTotale(a);
    else if (sortK==='nuovo') return sortD==='asc'?getFatturatoNuovo(a)-getFatturatoNuovo(b):getFatturatoNuovo(b)-getFatturatoNuovo(a);
    else if (sortK==='rinnovo') return sortD==='asc'?getFatturatoRinnovo(a)-getFatturatoRinnovo(b):getFatturatoRinnovo(b)-getFatturatoRinnovo(a);
    else if (sortK==='data'){va=getDataChiusura(a);vb=getDataChiusura(b);}
    const cmp=va.localeCompare(vb,'it',{numeric:true});
    return sortD==='asc'?cmp:-cmp;
  });

  const hs = k => { if(sortK===k) setSortD(d=>d==='asc'?'desc':'asc'); else{setSortK(k);setSortD('asc');} };
  const Th = ({k,l}) => <th style={{cursor:'pointer',userSelect:'none'}} onClick={()=>hs(k)}>{l}{sortK===k?(sortD==='asc'?' ↑':' ↓'):''}</th>;

  useEffect(() => {
    if (!chartRef.current) return;
    chartInst.current?.destroy();
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#c8102e';
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: MESI.map(m=>m.slice(0,3)),
        datasets: [
          { label: 'Nuovo', data: monthly.map(m=>m.nuovo), backgroundColor: '#378ADD99', borderColor: '#378ADD', borderWidth: 1.5, borderRadius: 4 },
          { label: 'Rinnovo', data: monthly.map(m=>m.rinnovo), backgroundColor: accent+'99', borderColor: accent, borderWidth: 1.5, borderRadius: 4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ' ' + fmtEur(ctx.parsed.y) } } },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: v => fmtEur(v) }, grid: { color: 'rgba(0,0,0,0.05)' } } }
      }
    });
    return () => chartInst.current?.destroy();
  }, [year, contacts, stages]);

  return (
    <>
      <div className="topbar">
        <span className="page-title">Chiuso per mese</span>
        <div className="topbar-right">
          <label className="fs-12 text-muted">Anno:</label>
          <select className="form-control" style={{width:90}} value={year} onChange={e=>setYear(e.target.value)}>
            {allYears.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div className="content">

        {/* Metriche */}
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Fatturato {year}</div>
            <div className="metric-value metric-green">{fmtEur(totalTotale)}</div>
            <div className="metric-sub">{yearClosed.length} contratt{yearClosed.length===1?'o':'i'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Di cui nuovo</div>
            <div className="metric-value" style={{color:'#378ADD'}}>{fmtEur(totalNuovo)}</div>
            <div className="metric-sub">fatturato da nuovi clienti</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Di cui rinnovo</div>
            <div className="metric-value" style={{color:'var(--accent)'}}>{fmtEur(totalRinnovo)}</div>
            <div className="metric-sub">fatturato da rinnovi</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Valore contrattuale</div>
            <div className="metric-value">{fmtEur(totalVC)}</div>
            <div className="metric-sub">importo × durata effettiva</div>
          </div>
        </div>

        {/* Grafico */}
        <div className="card">
          <div className="card-title">Fatturato per mese — Nuovo vs Rinnovo (€)</div>
          <div style={{height:240,position:'relative'}}><canvas ref={chartRef}/></div>
        </div>

        {/* Dettaglio mensile */}
        {activeMths.slice().reverse().map(m => (
          <div key={m.month} className="card" style={{padding:0,overflow:'hidden',marginBottom:12}}>
            <div
              style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',background:'var(--bg3)',cursor:'pointer'}}
              onClick={()=>setOpenM(p=>({...p,[m.month]:!p[m.month]}))}
            >
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:14,fontWeight:700}}>{m.label} {year}</span>
                <span className="text-muted fs-12">{m.count} contratt{m.count===1?'o':'i'}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:20}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#3B6D11'}}>{fmtEur(m.totale)}</div>
                  <div className="fs-11 text-muted" style={{display:'flex',gap:10}}>
                    {m.nuovo>0&&<span style={{color:'#378ADD'}}>Nuovo: {fmtEur(m.nuovo)}</span>}
                    {m.rinnovo>0&&<span style={{color:'var(--accent)'}}>Rinnovo: {fmtEur(m.rinnovo)}</span>}
                  </div>
                </div>
                <span style={{fontSize:16,color:'var(--text2)',transform:openM[m.month]?'rotate(180deg)':'',transition:'transform .2s'}}>▼</span>
              </div>
            </div>
            {openM[m.month] && (
              <table className="crm-table">
                <thead>
                  <tr>
                    <Th k="nome" l="Cliente"/>
                    <th>Azienda</th>
                    <Th k="data" l="Data chiusura"/>
                    <th>Prodotti</th>
                    <th>Durata</th>
                    <Th k="nuovo" l="Nuovo"/>
                    <Th k="rinnovo" l="Rinnovo"/>
                    <Th k="totale" l="Totale"/>
                    <th>Val. contrattuale</th>
                  </tr>
                </thead>
                <tbody>
                  {sortContacts(m.contacts).flatMap(c =>
                    getContratti(c).map((ct, ci) => {
                      const isNuovo = ct.tipo !== 'Rinnovo';
                      const importoCt = (ct.prodotti||[]).reduce((s,p)=>s+(Number(p.importo)||0),0) || Number(ct.totale)||0;
                      const prodotti = (ct.prodotti||[]).map(p=>p.categoria||p.nome||'').filter(Boolean);
                      const uniqueProd = [...new Set(prodotti)];
                      const durate = (ct.prodotti||[]).map(p=>Number(p.durataM)||12);
                      const durataLabel = durate.length > 0
                        ? durate.every(d=>d===durate[0]) ? `${durate[0]} mesi` : durate.map(d=>`${d}m`).join(', ')
                        : ct.durataM ? `${ct.durataM} mesi` : '—';
                      const vc = ct.prodotti?.length
                        ? ct.prodotti.reduce((s,p)=>s+(Number(p.importo)||0)*(Number(p.durataM)||12)/12,0)
                        : (Number(ct.totale)||0)*(Number(ct.durataM)||12)/12;
                      return (
                        <tr key={`${c.id}-${ct.id||ci}`}>
                          <td className="fw-600">{ci===0?c.nome:<span className="text-muted fs-12">↳</span>}</td>
                          <td className="text-muted fs-12">{ci===0?c.azienda||'—':''}</td>
                          <td className="text-muted fs-12">{ci===0?fmt(getDataChiusura(c),{day:'2-digit',month:'long',year:'numeric'}):''}</td>
                          <td className="text-muted fs-12">{uniqueProd.join(', ')||'—'}</td>
                          <td className="text-muted fs-12">{durataLabel}</td>
                          <td style={{fontWeight:600,color:'#378ADD'}}>{isNuovo?fmtEur(importoCt):'—'}</td>
                          <td style={{fontWeight:600,color:'var(--accent)'}}>{!isNuovo?fmtEur(importoCt):'—'}</td>
                          <td style={{fontWeight:700,color:'#3B6D11'}}>{fmtEur(importoCt)}</td>
                          <td className="text-muted fs-12">{fmtEur(vc)}</td>
                        </tr>
                      );
                    })
                  )}
                  <tr style={{background:'var(--bg3)'}}>
                    <td colSpan={5} style={{fontWeight:700,fontSize:11,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.04em'}}>Totale {m.label}</td>
                    <td style={{fontWeight:700,color:'#378ADD'}}>{m.nuovo>0?fmtEur(m.nuovo):'—'}</td>
                    <td style={{fontWeight:700,color:'var(--accent)'}}>{m.rinnovo>0?fmtEur(m.rinnovo):'—'}</td>
                    <td style={{fontWeight:700,color:'#3B6D11'}}>{fmtEur(m.totale)}</td>
                    <td className="text-muted">{fmtEur(m.valoreContrattuale)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        ))}
        {activeMths.length===0&&<div className="empty">Nessun contratto chiuso in {year}</div>}
      </div>
    </>
  );
}
