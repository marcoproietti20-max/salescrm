import React, { useEffect, useRef } from 'react';
import { Chart, ArcElement, BarElement, BarController, DoughnutController, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { fmtEur, fmt, FONTI, STATI_APPT, getFatturato, getPreventivato, getDataChiusura, getContratti } from '../constants';
import { FonteBadge } from './Badges';
Chart.register(ArcElement, BarElement, BarController, DoughnutController, CategoryScale, LinearScale, Tooltip, Legend);
const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

// Palette coerente: gradazioni di blu + verde per Chiuso OK
const PIPELINE_COLORS = ['#C2DEFA','#6AB4F0','#7B68EE','#0078D4','#1B7A3E'];
const PRODOTTI_COLORS = ['#0050A0','#0078D4','#4DA6E8','#89C4F4','#C2DEFA','#003F7F','#50A8E8','#1B7A3E','#2E8B57','#5A6B7E'];

// Colori fonti — distinti ma coordinati con la palette
const FONTE_COLORS = {
  'Telemarketing Rosanna': '#003F7F',
  'TMK Serena':            '#7B68EE',
  'TMK NTC':               '#6B5EA8',
  'LinkedIn':              '#0A66C2',
  'Coupon Aziendale':      '#E07B1A',
  'Autonomia':             '#2E8B57',
  'Email Marketing':       '#E74C3C',
  'Calendly':              '#4DA6E8',
  'Bookings':              '#0078D4',
  'Portafoglio':           '#2E7D32',
};

function getFattNuovo(c) {
  return getContratti(c).filter(ct=>ct.tipo!=='Rinnovo').reduce((s,ct)=>s+(ct.prodotti||[]).reduce((ps,p)=>ps+(Number(p.importo)||0),0)||(Number(ct.totale)||0),0);
}
function getFattRinnovo(c) {
  return getContratti(c).filter(ct=>ct.tipo==='Rinnovo').reduce((s,ct)=>s+(ct.prodotti||[]).reduce((ps,p)=>ps+(Number(p.importo)||0),0)||(Number(ct.totale)||0),0);
}

export default function Dashboard({ contacts, stages, today, navigateTo }) {
  const [filterApptMonth, setFilterApptMonth] = React.useState('');
  const barRef=useRef(), doughRef=useRef(), pieRef=useRef(), apptBarRef=useRef();
  const barC=useRef(), doughC=useRef(), pieC=useRef(), apptBarC=useRef();

  const wonStage = stages.filter(s=>!s.isKo).slice(-1)[0];
  const koStages = stages.filter(s=>s.isKo);
  const chiusiOK = contacts.filter(c=>wonStage&&c.fase===wonStage.name);
  const chiusiKO = contacts.filter(c=>koStages.some(s=>s.name===c.fase));
  const openHot = contacts.filter(c=>c.fase==='In valutazione');
  const curMonth = today.slice(0,7); const curYear = today.slice(0,4);
  const fatMese = chiusiOK.filter(c=>getDataChiusura(c).startsWith(curMonth)).reduce((s,c)=>s+getFatturato(c),0);
  const fatAnno = chiusiOK.filter(c=>getDataChiusura(c).startsWith(curYear)).reduce((s,c)=>s+getFatturato(c),0);
  const fatNuovoMese = chiusiOK.filter(c=>getDataChiusura(c).startsWith(curMonth)).reduce((s,c)=>s+getFattNuovo(c),0);
  const fatRinnovoMese = chiusiOK.filter(c=>getDataChiusura(c).startsWith(curMonth)).reduce((s,c)=>s+getFattRinnovo(c),0);
  const fatNuovoAnno = chiusiOK.filter(c=>getDataChiusura(c).startsWith(curYear)).reduce((s,c)=>s+getFattNuovo(c),0);
  const fatRinnovoAnno = chiusiOK.filter(c=>getDataChiusura(c).startsWith(curYear)).reduce((s,c)=>s+getFattRinnovo(c),0);
  const totPrev = openHot.reduce((s,c)=>s+getPreventivato(c),0);
  const urgentFU = contacts.reduce((n,c)=>n+(c.history||[]).filter(h=>h.type==='note'&&h.followup&&h.followup<=today).length,0);
  const koAndOkNames = [...stages.filter(s=>s.isKo).map(s=>s.name), wonStage?.name].filter(Boolean);
  const daRifissare = contacts.filter(c=>!koAndOkNames.includes(c.fase)).reduce((n,c)=>n+(c.history||[]).filter(h=>h.type==='appt'&&h.stato==='Programmato'&&h.date&&h.date.slice(0,10)<today).length,0);

  const monthlyNuovo = Array(12).fill(0); const monthlyRinnovo = Array(12).fill(0);
  chiusiOK.forEach(c=>{
    getContratti(c).forEach(ct=>{
      const d=ct.dataInizio||getDataChiusura(c);
      if(!d||!d.startsWith(curYear)) return;
      const m=parseInt(d.slice(5,7))-1; if(m<0||m>11) return;
      const v=(ct.prodotti||[]).reduce((s,p)=>s+(Number(p.importo)||0),0)||(Number(ct.totale)||0);
      if(ct.tipo==='Rinnovo') monthlyRinnovo[m]+=v; else monthlyNuovo[m]+=v;
    });
  });

  const activeStages = stages.filter(s=>!s.isKo);
  const stageCnt = {}; activeStages.forEach(s=>stageCnt[s.name]=0);
  contacts.forEach(c=>{if(stageCnt[c.fase]!==undefined)stageCnt[c.fase]++;});

  const prodCat = {};
  chiusiOK.forEach(c=>getContratti(c).filter(ct=>ct.tipo!=='Rinnovo').forEach(ct=>(ct.prodotti||[]).forEach(p=>{
    if(p.categoria)prodCat[p.categoria]=(prodCat[p.categoria]||0)+(Number(p.importo)||0);
  })));
  const prodLabels = Object.keys(prodCat).filter(k=>prodCat[k]>0);

  const fonteCnt = {}; FONTI.forEach(f=>fonteCnt[f.name]=0);
  contacts.forEach(c=>{if(c.fonte)fonteCnt[c.fonte]=(fonteCnt[c.fonte]||0)+1;});

  const fonteApptStats = {};
  FONTI.forEach(f=>{fonteApptStats[f.name]={total:0,stati:{}};STATI_APPT.forEach(s=>{fonteApptStats[f.name].stati[s.name]=0;});});
  contacts.forEach(c=>{
    if(!c.fonte||!fonteApptStats[c.fonte]) return;
    (c.history||[]).filter(h=>{
      if(h.type!=='appt'||!h.date) return false;
      if(filterApptMonth) return h.date.startsWith(filterApptMonth);
      return h.date.startsWith(curYear);
    }).forEach(h=>{
      fonteApptStats[c.fonte].total++;
      const stato=h.stato||'Svolto';
      if(fonteApptStats[c.fonte].stati[stato]!==undefined) fonteApptStats[c.fonte].stati[stato]++;
    });
  });
  const fonteConAppt = FONTI.filter(f=>fonteApptStats[f.name]?.total>0);

  const last6 = Array.from({length:6},(_,i)=>{const d=new Date(today);d.setMonth(d.getMonth()-5+i);return d.toISOString().slice(0,7);});
  const fonteMonthly = {};
  FONTI.forEach(f=>{fonteMonthly[f.name]=Array(6).fill(0);});
  contacts.forEach(c=>{
    if(!c.fonte||!fonteMonthly[c.fonte]) return;
    (c.history||[]).filter(h=>h.type==='appt'&&h.date).forEach(h=>{
      const ym=h.date.slice(0,7); const idx=last6.indexOf(ym);
      if(idx>=0) fonteMonthly[c.fonte][idx]++;
    });
  });
  const fontesWithData = FONTI.filter(f=>fonteMonthly[f.name]?.some(v=>v>0));

  useEffect(()=>{
    if(barRef.current){barC.current?.destroy();barC.current=new Chart(barRef.current,{type:'bar',data:{labels:MESI,datasets:[
      {label:'Nuovo',data:monthlyNuovo,backgroundColor:'#0050A0',borderColor:'#0050A0',borderWidth:0,borderRadius:4},
      {label:'Rinnovo',data:monthlyRinnovo,backgroundColor:'#89C4F4',borderColor:'#89C4F4',borderWidth:0,borderRadius:4}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:11}}},tooltip:{callbacks:{label:ctx=>' '+fmtEur(ctx.parsed.y)}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{callback:v=>fmtEur(v)},grid:{color:'rgba(0,120,212,0.06)'}}}}});}

    if(doughRef.current){doughC.current?.destroy();doughC.current=new Chart(doughRef.current,{type:'doughnut',data:{labels:activeStages.map(s=>s.name),datasets:[{data:activeStages.map(s=>stageCnt[s.name]||0),backgroundColor:PIPELINE_COLORS.slice(0,activeStages.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}}});}

    if(pieRef.current&&prodLabels.length){pieC.current?.destroy();pieC.current=new Chart(pieRef.current,{type:'doughnut',data:{labels:prodLabels,datasets:[{data:prodLabels.map(k=>prodCat[k]),backgroundColor:PRODOTTI_COLORS.slice(0,prodLabels.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{boxWidth:10,font:{size:11}}},tooltip:{callbacks:{label:ctx=>' '+fmtEur(ctx.parsed)}}}}});}

    if(apptBarRef.current&&fontesWithData.length){apptBarC.current?.destroy();apptBarC.current=new Chart(apptBarRef.current,{type:'bar',data:{labels:last6.map(m=>MESI[parseInt(m.slice(5,7))-1]+' '+m.slice(0,4)),datasets:fontesWithData.map(f=>({label:f.name,data:fonteMonthly[f.name],backgroundColor:FONTE_COLORS[f.name]||'#0078D4',borderColor:FONTE_COLORS[f.name]||'#0078D4',borderWidth:0,borderRadius:3}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:11}}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,ticks:{stepSize:1},grid:{color:'rgba(0,120,212,0.06)'}}}}});}

    return()=>{barC.current?.destroy();doughC.current?.destroy();pieC.current?.destroy();apptBarC.current?.destroy();};
  },[contacts,stages,filterApptMonth]);

  const urgentList=[];
  contacts.forEach(c=>(c.history||[]).forEach(h=>{if(h.type==='note'&&h.followup&&h.followup<=today)urgentList.push({c,h,s:h.followup<today?'scaduto':'oggi'});}));
  urgentList.sort((a,b)=>a.h.followup.localeCompare(b.h.followup));

  const Metric=({label,value,sub,color,alert,onClick})=>(
    <div className="metric-card" onClick={onClick} style={{cursor:onClick?'pointer':'default'}}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${alert?' metric-alert':''}`} style={color?{color}:{}}>{value}</div>
      {sub&&<div className="metric-sub">{sub}</div>}
      {onClick&&<div className="metric-hint">Clicca per dettaglio →</div>}
    </div>
  );

  return (
    <>
      <div className="topbar">
        <span className="page-title">Dashboard</span>
        <span className="text-muted fs-12">{new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
      </div>
      <div className="content">
        {(urgentFU>0||daRifissare>0)&&(
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
            {urgentFU>0&&<div style={{flex:1,background:'#C0392B',color:'white',border:'none',borderRadius:'var(--r)',padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:600}} onClick={()=>navigateTo('followups')}>🔔 {urgentFU} follow-up urgenti — Vedi →</div>}
            {daRifissare>0&&<div style={{flex:1,background:'#E07B1A',color:'white',border:'none',borderRadius:'var(--r)',padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:600}} onClick={()=>navigateTo('appointments')}>🔄 {daRifissare} appuntamenti da gestire — Vedi →</div>}
          </div>
        )}

        <div className="metric-grid">
          <Metric label="In valutazione" value={openHot.length} sub="trattative calde" onClick={()=>navigateTo('contacts',{fase:'In valutazione'})}/>
          <Metric label="Totale preventivato" value={fmtEur(totPrev)} sub="trattative in valutazione" color="#0050A0" onClick={()=>navigateTo('contacts',{fase:'In valutazione'})}/>
          <Metric label="Fatturato mese" value={fmtEur(fatMese)} sub={new Date().toLocaleDateString('it-IT',{month:'long',year:'numeric'})} color="#1B7A3E" onClick={()=>navigateTo('chiuso')}/>
          <Metric label="Fatturato anno" value={fmtEur(fatAnno)} sub={curYear} color="#1B7A3E" onClick={()=>navigateTo('chiuso')}/>
        </div>
        <div className="metric-grid">
          <Metric label="Nuovo — mese" value={fmtEur(fatNuovoMese)} sub="nuovi clienti" color="#0050A0" onClick={()=>navigateTo('chiuso')}/>
          <Metric label="Rinnovo — mese" value={fmtEur(fatRinnovoMese)} sub="rinnovi" color="#4DA6E8" onClick={()=>navigateTo('chiuso')}/>
          <Metric label="Nuovo — anno" value={fmtEur(fatNuovoAnno)} sub={`nuovi ${curYear}`} color="#0050A0" onClick={()=>navigateTo('chiuso')}/>
          <Metric label="Rinnovo — anno" value={fmtEur(fatRinnovoAnno)} sub={`rinnovi ${curYear}`} color="#4DA6E8" onClick={()=>navigateTo('chiuso')}/>
        </div>
        <div className="metric-grid">
          <Metric label="Chiuso OK" value={chiusiOK.length} sub={fmtEur(chiusiOK.reduce((s,c)=>s+getFatturato(c),0))+' fatturati'} color="#1B7A3E" onClick={()=>navigateTo('chiuso')}/>
          <Metric label="Chiuso KO" value={chiusiKO.length} sub="trattative perse" onClick={()=>navigateTo('archivio')}/>
          <Metric label="Follow-up urgenti" value={urgentFU} alert={urgentFU>0} sub="oggi o scaduti" onClick={()=>navigateTo('followups')}/>
          <Metric label="Contatti totali" value={contacts.length} sub="in rubrica" onClick={()=>navigateTo('contacts')}/>
        </div>

        <div className="charts-grid">
          <div className="card" style={{marginBottom:0}}><div className="card-title">Fatturato mensile {curYear} — Nuovo vs Rinnovo</div><div style={{height:210,position:'relative'}}><canvas ref={barRef}/></div></div>
          <div className="card" style={{marginBottom:0}}><div className="card-title">Pipeline per fase</div><div style={{height:210,position:'relative'}}><canvas ref={doughRef}/></div></div>
        </div>
        <div style={{height:16}}/>

        {prodLabels.length>0&&(
          <div className="card">
            <div className="card-title">Fatturato nuovo per categoria prodotto</div>
            <div style={{height:220,position:'relative'}}><canvas ref={pieRef}/></div>
          </div>
        )}

        <div className="card">
          <div className="card-title">Trattative per fase</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8}}>
            {activeStages.map((s,i)=>(
              <div key={s.id} onClick={()=>navigateTo('contacts',{fase:s.name})} style={{background:PIPELINE_COLORS[i]+'22',border:`1px solid ${PIPELINE_COLORS[i]}55`,borderRadius:'var(--r)',padding:'10px 12px',cursor:'pointer'}}>
                <div style={{fontSize:11,color:PIPELINE_COLORS[i],fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4,filter:'brightness(0.7)'}}>{s.name}</div>
                <div style={{fontSize:22,fontWeight:700,color:PIPELINE_COLORS[i],filter:'brightness(0.7)'}}>{stageCnt[s.name]||0}</div>
              </div>
            ))}
          </div>
        </div>

        {fontesWithData.length>0&&(
          <div className="card">
            <div className="card-title">Appuntamenti per fonte — ultimi 6 mesi</div>
            <div style={{height:220,position:'relative',marginBottom:20}}><canvas ref={apptBarRef}/></div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:16,marginBottom:8}}>
              <div className="card-title" style={{margin:0}}>Performance appuntamenti per fonte</div>
              <select className="form-control" style={{width:140,fontSize:12}} value={filterApptMonth} onChange={e=>setFilterApptMonth(e.target.value)}>
                <option value="">Anno {curYear}</option>
                {Array.from({length:12},(_,i)=>{const m=(i+1).toString().padStart(2,'0');const ym=`${curYear}-${m}`;return<option key={ym} value={ym}>{['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][i]} {curYear}</option>;})}
              </select>
            </div>
            <div style={{overflowX:'auto'}}>
              <table className="crm-table" style={{minWidth:600}}>
                <thead><tr>
                  <th>Fonte</th>
                  <th style={{textAlign:'right'}}>Totale</th>
                  {STATI_APPT.map(s=><th key={s.name} style={{textAlign:'right'}}>{s.icon} {s.name}</th>)}
                </tr></thead>
                <tbody>
                  {fonteConAppt.map(f=>{
                    const st=fonteApptStats[f.name];
                    return(<tr key={f.name}>
                      <td><FonteBadge name={f.name}/></td>
                      <td style={{textAlign:'right',fontWeight:700}}>{st.total}</td>
                      {STATI_APPT.map(s=>{const n=st.stati[s.name]||0;const pct=st.total>0?Math.round(n/st.total*100):0;
                        return<td key={s.name} style={{textAlign:'right',fontSize:12}}>{n>0?<span>{n} <span className="text-muted">({pct}%)</span></span>:<span className="text-muted">—</span>}</td>;
                      })}
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title" style={{display:'flex',justifyContent:'space-between'}}>
            Follow-up urgenti
            {urgentList.length>0&&<button className="btn btn-sm" onClick={()=>navigateTo('followups')}>Vedi tutti →</button>}
          </div>
          {urgentList.length===0?<div className="empty" style={{padding:'14px 0'}}>Nessun follow-up urgente 🎉</div>:
            urgentList.slice(0,5).map((f,i)=>(
              <div key={i} style={{background:f.s==='scaduto'?'#C0392B':'#E07B1A',color:'white',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontWeight:700}}>{f.c.nome}</div>
                  <div style={{fontSize:12,opacity:.85}}>{f.c.azienda} — {(f.h.text||'').slice(0,60)}</div>
                </div>
                <span style={{fontSize:11,opacity:.8}}>{fmt(f.h.followup,{day:'2-digit',month:'short',year:'numeric'})}</span>
              </div>
            ))}
        </div>

        <div className="card" style={{marginBottom:0}}>
          <div className="card-title">Contatti per fonte</div>
          {FONTI.filter(f=>fonteCnt[f.name]>0).map(f=>(
            <div key={f.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:9,cursor:'pointer'}} onClick={()=>navigateTo('contacts',{fonte:f.name})}>
              <FonteBadge name={f.name}/>
              <div style={{flex:1,background:'var(--bg3)',borderRadius:4,height:6,overflow:'hidden'}}>
                <div style={{width:`${Math.max(4,fonteCnt[f.name]/Math.max(1,contacts.length)*100)}%`,background:FONTE_COLORS[f.name]||'#0078D4',height:'100%',borderRadius:4}}/>
              </div>
              <span className="fs-12 text-muted" style={{minWidth:24,textAlign:'right'}}>{fonteCnt[f.name]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
