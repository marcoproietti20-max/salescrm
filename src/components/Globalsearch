import React, { useState, useEffect, useRef } from 'react';
import { fmt, getContratti } from '../constants';
import { StageBadge } from './Badges';

export default function GlobalSearch({ contacts, stages, setModal, navigateTo }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setOpen(false); setQ(''); }
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const results = q.trim().length < 2 ? [] : (() => {
    const ql = q.toLowerCase();
    const matches = [];

    contacts.forEach(c => {
      const score = [
        c.nome?.toLowerCase().includes(ql) ? 3 : 0,
        c.azienda?.toLowerCase().includes(ql) ? 2 : 0,
        c.email?.toLowerCase().includes(ql) ? 2 : 0,
        c.telefono?.toLowerCase().includes(ql) ? 2 : 0,
        c.categoria?.toLowerCase().includes(ql) ? 1 : 0,
        (c.history||[]).some(h => h.text?.toLowerCase().includes(ql) || h.esito?.toLowerCase().includes(ql)) ? 1 : 0,
        getContratti(c).some(ct => (ct.prodotti||[]).some(p => p.nome?.toLowerCase().includes(ql) || p.categoria?.toLowerCase().includes(ql))) ? 1 : 0,
        c.testoProposta?.toLowerCase().includes(ql) ? 1 : 0,
        c.noteInterne?.toLowerCase().includes(ql) ? 1 : 0,
      ].reduce((s,v) => s+v, 0);
      if (score > 0) matches.push({ c, score });
    });

    return matches.sort((a,b) => b.score - a.score).slice(0, 8).map(m => m.c);
  })();

  const highlight = (text) => {
    if (!text || !q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return <>{text.slice(0,idx)}<mark style={{background:'#FFF176',borderRadius:2,padding:'0 1px'}}>{text.slice(idx,idx+q.length)}</mark>{text.slice(idx+q.length)}</>;
  };

  const getMatchContext = (c) => {
    const ql = q.toLowerCase();
    const note = (c.history||[]).find(h => h.text?.toLowerCase().includes(ql));
    if (note) return `Nota: ${note.text.slice(0,60)}...`;
    const ct = getContratti(c).find(ct => (ct.prodotti||[]).some(p => p.nome?.toLowerCase().includes(ql) || p.categoria?.toLowerCase().includes(ql)));
    if (ct) { const p = (ct.prodotti||[]).find(p => p.nome?.toLowerCase().includes(ql) || p.categoria?.toLowerCase().includes(ql)); return `Contratto: ${p?.categoria||''} ${p?.nome||''}`; }
    if (c.testoProposta?.toLowerCase().includes(ql)) return `Proposta: ${c.testoProposta.slice(0,60)}...`;
    if (c.noteInterne?.toLowerCase().includes(ql)) return `Note: ${c.noteInterne.slice(0,60)}...`;
    return null;
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r)', cursor:'pointer', fontSize:12, color:'var(--text2)', fontFamily:'var(--font)' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l3 3"/>
        </svg>
        Cerca...
        <span style={{marginLeft:4,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:3,padding:'1px 5px',fontSize:10}}>⌘K</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }}>
          <div ref={ref} style={{ background:'var(--bg2)', borderRadius:'var(--r-lg)', border:'1px solid var(--border2)', width:580, maxWidth:'90vw', boxShadow:'0 8px 40px rgba(0,0,0,0.2)', overflow:'hidden' }}>
            {/* Search input */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text2)" strokeWidth="1.5">
                <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l3 3"/>
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cerca contatti, note, contratti, proposte..."
                style={{ flex:1, border:'none', outline:'none', fontSize:15, fontFamily:'var(--font)', background:'transparent', color:'var(--text)' }}
                autoFocus
              />
              <button onClick={() => { setOpen(false); setQ(''); }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text2)', padding:'0 4px' }}>×</button>
            </div>

            {/* Results */}
            <div style={{ maxHeight:420, overflowY:'auto' }}>
              {q.trim().length < 2 && (
                <div style={{ padding:'20px 16px', color:'var(--text2)', fontSize:13, textAlign:'center' }}>
                  Digita almeno 2 caratteri per cercare
                </div>
              )}
              {q.trim().length >= 2 && results.length === 0 && (
                <div style={{ padding:'20px 16px', color:'var(--text2)', fontSize:13, textAlign:'center' }}>
                  Nessun risultato per "<strong>{q}</strong>"
                </div>
              )}
              {results.map(c => {
                const ctx = getMatchContext(c);
                return (
                  <div key={c.id}
                    style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:12 }}
                    onClick={() => { setModal({ type:'scheda', data:c }); setOpen(false); setQ(''); }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontWeight:700, fontSize:14 }}>{highlight(c.nome)}</span>
                        <StageBadge name={c.fase} stages={stages} />
                      </div>
                      <div style={{ fontSize:12, color:'var(--text2)', marginBottom:ctx?3:0 }}>
                        {highlight(c.azienda||'')}
                        {c.email && <> · {highlight(c.email)}</>}
                        {c.telefono && <> · {c.telefono}</>}
                      </div>
                      {ctx && <div style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic' }}>{ctx}</div>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', flexShrink:0, marginTop:2 }}>Apri scheda →</div>
                  </div>
                );
              })}
            </div>
            {q.trim().length >= 2 && results.length > 0 && (
              <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--text3)' }}>{results.length} risultat{results.length===1?'o':'i'}</span>
                <button className="btn btn-sm" onClick={() => { navigateTo('contacts'); setOpen(false); setQ(''); }}>Vai ai contatti →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
