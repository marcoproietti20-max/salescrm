import React, { useState, useEffect, useRef } from 'react';
import { Chart, BarElement, BarController, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { fmt, fmtEur, getFatturato, getDataChiusura, getContratti } from '../constants';
Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip);
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

export default function ChiusoPerMese({ contacts, stages }) {
  const curYear = new Date().getFullYear().toString();
  const wonStage = stages.filter(s => !s.isKo).slice(-1)[0];
  const closed = contacts.filter(c => wonStage && c.fase === wonStage.name && getDataChiusura(c));
  const allYears = [...new Set(closed.map(c => getDataChiusura(c).slice(0, 4)))].sort().reverse();
  if (!allYears.includes(curYear)) allYears.unshift(curYear);

  const [year, setYear] = useState(curYear);
  const [openM, setOpenM] = useState({});
  const [sortK, setSortK] = useState('data'); const [sortD, setSortD] = useState('desc');
  const chartRef = useRef(); const chartInst = useRef();

  const yearClosed = closed.filter(c => getDataChiusura(c).startsWith(year));
  const getValore = c => {
    const f = getFatturato(c);
    return f > 0 ? f : Number(c.importoProposta) || 0;
  };
  const getNuovoFatturato = c => getContratti(c).reduce((s, ct) => s + (Number(ct.nuovoFatturato) || 0), 0);
  const getFattTriennale = c => getContratti(c).reduce((s, ct) => {
    if (ct.prodotti?.length) return s + ct.prodotti.reduce((ps, p) => ps + (Number(p.importo) || 0) * (Number(p.durataM) || 12) / 12, 0);
    return s + (ct.totale || 0);
  }, 0) || getValore(c);

  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i, label: MESI[i], contacts: [], value: 0, nuovoFat: 0, triennale: 0, count: 0 }));
  yearClosed.forEach(c => {
    const m = parseInt(getDataChiusura(c).slice(5, 7)) - 1;
    monthly[m].contacts.push(c);
    monthly[m].value += getValore(c);
    monthly[m].nuovoFat += getNuovoFatturato(c);
    monthly[m].triennale += getFattTriennale(c);
    monthly[m].count++;
  });

  const totalVal = yearClosed.reduce((s, c) => s + getValore(c), 0);
  const totalNuovo = yearClosed.reduce((s, c) => s + getNuovoFatturato(c), 0);
  const totalTriennale = yearClosed.reduce((s, c) => s + getFattTriennale(c), 0);
  const activeMths = monthly.filter(m => m.count > 0);
  const bestMonth = monthly.reduce((b, m) => m.value > b.value ? m : b, monthly[0]);

  const sortContacts = list => [...list].sort((a, b) => {
    let va = '', vb = '';
    if (sortK === 'nome') { va = a.nome||''; vb = b.nome||''; }
    else if (sortK === 'valore') return sortD === 'asc' ? getValore(a)-getValore(b) : getValore(b)-getValore(a);
    else if (sortK === 'data') { va = getDataChiusura(a); vb = getDataChiusura(b); }
    const cmp = va.localeCompare(vb,'it',{numeric:true}); return sortD==='asc'?cmp:-cmp;
  });
  const hs = k => { if(sortK===k)setSortD(d=>d==='asc'?'desc':'asc');else{setSortK(k);setSortD('asc');} };
  const Th = ({k,l}) => <th style={{cursor:'pointer',userSelect:'none'}} onClick={()=>hs(k)}>{l}{sortK===k?(sortD==='asc'?' ↑':' ↓'):''}</th>;

  useEffect(() => {
    if (!chartRef.current) return;
    chartInst.current?.destroy();
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#c8102e';
    chartInst.current = new Chart(chartRef.current, { type:'bar', data:{labels:MESI.map(m=>m.slice(0,3)),datasets:[{label:'€',data:monthly.map(m=>m.value),backgroundColor:monthly.map(m=>m.count?accent+'99':'#e0e0e055'),borderColor:monthly.map(m=>m.count?accent:'#ccc'),borderWidth:1.5,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtEur(ctx.parsed.y)}}},scales:{y:{ticks:{callback:v=>fmtEur(v)},grid:{color:'rgba(0,0,0,0.05)'}},x:{grid:{display:false}}}} });
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
        <div className="metric-grid">
          <div className="metric-card"><div className="metric-label">Fatturato {year}</div><div className="metric-value metric-green">{fmtEur(totalVal)}</div><div className="metric-sub">{yearClosed.length} contratti</div></div>
          <div className="metric-card"><div className="metric-label">Nuovo fatturato</div><div className="metric-value">{fmtEur(totalNuovo)}</div><div className="metric-sub">quota incrementale</div></div>
          <div className="metric-card"><div className="metric-label">Valore triennale</div><div className="metric-value">{fmtEur(totalTriennale)}</div><div className="metric-sub">valore contrattuale</div></div>
          <div className="metric-card"><div className="metric-label">Mese migliore</div><div className="metric-value" style={{fontSize:18}}>{bestMonth.count?bestMonth.label:'—'}</div><div className="metric-sub">{bestMonth.count?fmtEur(bestMonth.value):''}</div></div>
        </div>
        <div className="card"><div className="card-title">Fatturato per mese (€)</div><div style={{height:240,position:'relative'}}><canvas ref={chartRef}/></div></div>
        {activeMths.slice().reverse().map(m=>(
          <div key={m.month} className="card" style={{padding:0,overflow:'hidden',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',background:'var(--bg3)',cursor:'pointer'}} onClick={()=>setOpenM(p=>({...p,[m.month]:!p[m.month]}))}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:14,fontWeight:700}}>{m.label} {year}</span>
                <span className="text-muted fs-12">{m.count} contratt{m.count===1?'o':'i'}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#3B6D11'}}>{fmtEur(m.value)}</div>
                  {m.nuovoFat>0&&<div className="fs-11 text-muted">Nuovo: {fmtEur(m.nuovoFat)}</div>}
                </div>
                <span style={{fontSize:16,color:'var(--text2)',transform:openM[m.month]?'rotate(180deg)':'',transition:'transform .2s'}}>▼</span>
              </div>
            </div>
            {openM[m.month]&&(
              <table className="crm-table">
                <thead><tr><Th k="nome" l="Cliente"/><th>Azienda</th><Th k="data" l="Data chiusura"/><th>Prodotti</th><Th k="valore" l="Fatturato"/><th>Triennale</th></tr></thead>
                <tbody>
                  {sortContacts(m.contacts).map(c=>(
                    <tr key={c.id}>
                      <td className="fw-600">{c.nome}</td>
                      <td className="text-muted">{c.azienda||'—'}</td>
                      <td className="text-muted">{fmt(getDataChiusura(c),{day:'2-digit',month:'long',year:'numeric'})}</td>
                      <td className="text-muted fs-12">{getContratti(c).flatMap(ct=>(ct.prodotti||[]).map(p=>p.categoria||p.nome)).filter(Boolean).join(', ')||'—'}</td>
                      <td style={{fontWeight:700,color:'#3B6D11'}}>{fmtEur(getValore(c))}</td>
                      <td className="text-muted">{fmtEur(getFattTriennale(c))}</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)'}}>
                    <td colSpan={4} style={{fontWeight:700,fontSize:11,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.04em'}}>Totale {m.label}</td>
                    <td style={{fontWeight:700,color:'#3B6D11'}}>{fmtEur(m.value)}</td>
                    <td className="text-muted">{fmtEur(m.triennale)}</td>
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
