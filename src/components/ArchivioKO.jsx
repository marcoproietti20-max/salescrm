// ArchivioKO.jsx
import React, { useState } from 'react';
import { fmt, fmtEur, getLastAppt } from '../constants';
import { FonteBadge } from './Badges';

export function ArchivioKO({ contacts, stages, setContacts, showToast, setModal }) {
  const [q, setQ] = useState('');
  const [sortK, setSortK] = useState('nome'); const [sortD, setSortD] = useState('asc');
  const koNames = stages.filter(s => s.isKo).map(s => s.name);
  const ko = contacts.filter(c => koNames.includes(c.fase));
  const filtered = ko.filter(c => !q || (c.nome+(c.azienda||'')).toLowerCase().includes(q.toLowerCase()));
  const sorted = [...filtered].sort((a,b) => {
    let va='',vb='';
    if(sortK==='nome'){va=a.nome||'';vb=b.nome||'';}
    else if(sortK==='azienda'){va=a.azienda||'';vb=b.azienda||'';}
    else if(sortK==='categoria'){va=a.categoria||'';vb=b.categoria||'';}
    else if(sortK==='fonte'){va=a.fonte||'';vb=b.fonte||'';}
    else if(sortK==='app'){va=getLastAppt(a);vb=getLastAppt(b);}
    const cmp=va.localeCompare(vb,'it',{numeric:true}); return sortD==='asc'?cmp:-cmp;
  });
  const hs=k=>{if(sortK===k)setSortD(d=>d==='asc'?'desc':'asc');else{setSortK(k);setSortD('asc');}};
  const Th=({k,l,w})=><th style={{cursor:'pointer',userSelect:'none',width:w}} onClick={()=>hs(k)}>{l}{sortK===k?(sortD==='asc'?' ↑':' ↓'):''}</th>;
  const prevStage=stages.filter(s=>!s.isKo).slice(-2)[0]?.name||stages.filter(s=>!s.isKo)[0]?.name;
  const reopen=id=>{setContacts(p=>p.map(c=>c.id===id?{...c,fase:prevStage}:c));showToast('Trattativa riaperta',`→ "${prevStage}"`)};
  return (
    <>
      <div className="topbar"><span className="page-title">Archivio KO</span><span className="text-muted fs-12">{ko.length} trattative perse</span></div>
      <div className="content">
        <div className="info-box red">Trattative perse — non compaiono nella pipeline né in "Chiuso per mese".</div>
        <div className="search-bar"><input className="form-control" style={{maxWidth:300}} placeholder="Cerca..." value={q} onChange={e=>setQ(e.target.value)}/></div>
        <div className="table-wrap">
          <table className="crm-table">
            <thead><tr><Th k="nome" l="Cliente" w={140}/><Th k="azienda" l="Azienda" w={140}/><Th k="categoria" l="Categoria" w={130}/><Th k="fonte" l="Fonte" w={140}/><Th k="app" l="Ultimo App." w={110}/><th style={{width:200}}>Ultima nota</th><th style={{width:80}}></th></tr></thead>
            <tbody>
              {sorted.length===0?<tr><td colSpan={7} className="empty">Nessuna trattativa persa</td></tr>:
                sorted.map(c=>{
                  const la=getLastAppt(c);
                  const ln=(c.history||[]).filter(h=>h.type==='note'&&h.text).slice(-1)[0];
                  return(
                    <tr key={c.id} style={{cursor:'pointer'}} onClick={()=>setModal({type:'contact',data:c})}>
                      <td className="fw-600">{c.nome}</td><td className="text-muted">{c.azienda||'—'}</td><td className="fs-12 text-muted">{c.categoria||'—'}</td>
                      <td><FonteBadge name={c.fonte}/></td>
                      <td className="text-muted fs-12">{la?fmt(la,{day:'2-digit',month:'short',year:'numeric'}):'—'}</td>
                      <td className="text-muted fs-12" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ln?.text||'—'}</td>
                      <td onClick={e=>e.stopPropagation()}><button className="btn btn-sm" onClick={()=>reopen(c.id)}>Riapri</button></td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default ArchivioKO;
