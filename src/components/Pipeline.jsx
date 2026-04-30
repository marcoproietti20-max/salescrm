import React, { useState } from 'react';
import { fmt, fmtEur, getPreventivato, getLastAppt, getNextFu } from '../constants';
import { FonteBadge, PropostaBadge } from './Badges';

export default function Pipeline({ contacts, stages, setModal, setContacts, showToast }) {
  const activeStages = stages.filter(s => !s.isKo);
  const [sortK, setSortK] = useState('nome');
  const [sortD, setSortD] = useState('asc');
  const [selIds, setSelIds] = useState(new Set());
  const today = new Date().toISOString().slice(0, 10);
  const curMonth = today.slice(0, 7);
  const wonStage = activeStages[activeStages.length - 1];

  const sortContacts = (list) => [...list].sort((a, b) => {
    let va = '', vb = '';
    if (sortK === 'nome') { va = a.nome || ''; vb = b.nome || ''; }
    else if (sortK === 'app') { va = getLastAppt(a); vb = getLastAppt(b); }
    else if (sortK === 'fu') { va = getNextFu(a); vb = getNextFu(b); }
    else if (sortK === 'importo') return sortD === 'asc' ? getPreventivato(a) - getPreventivato(b) : getPreventivato(b) - getPreventivato(a);
    const cmp = va.localeCompare(vb, 'it', { numeric: true });
    return sortD === 'asc' ? cmp : -cmp;
  });

  const toggleSel = id => setSelIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const cols = activeStages.length;

  return (
    <>
      <div className="topbar">
        <span className="page-title">Pipeline</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="fs-12 text-muted">Ordina:</span>
          {[['nome','Nome'],['app','App.'],['fu','Follow-up'],['importo','€']].map(([k,l]) => (
            <button key={k} className={`btn btn-sm${sortK===k?' btn-primary':''}`} onClick={() => { if (sortK===k) setSortD(d=>d==='asc'?'desc':'asc'); else { setSortK(k); setSortD('asc'); } }}>
              {l}{sortK===k?(sortD==='asc'?' ↑':' ↓'):''}
            </button>
          ))}
        </div>
      </div>
      <div className="content">
        {selIds.size > 0 && (
          <div className="bulk-bar" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0C447C' }}>{selIds.size} selezionati</span>
            <div className="bulk-sep" />
            <select className="form-control" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}
              onChange={e => { if (!e.target.value) return; setContacts(p => p.map(c => selIds.has(c.id) ? { ...c, fase: e.target.value } : c)); showToast('Fase aggiornata', e.target.value); setSelIds(new Set()); e.target.value = ''; }}>
              <option value="">Cambia fase...</option>
              {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelIds(new Set())}>× Deseleziona</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, marginBottom: 6 }}>
          {activeStages.map(s => {
            const isWon = wonStage?.name === s.name;
            const cnt = contacts.filter(c => c.fase === s.name && (!isWon || getDataChiusura(c).startsWith(curMonth) || !getDataChiusura(c))).length;
            const val = contacts.filter(c => c.fase === s.name).reduce((sum, c) => sum + getPreventivato(c), 0);
            return (
              <div key={s.id} style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', paddingBottom: 6, borderBottom: `3px solid ${s.color}`, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {s.name} ({cnt}){isWon && <div style={{ fontSize: 10, fontWeight: 400, opacity: .8 }}>{new Date().toLocaleDateString('it-IT', { month: 'long' })}</div>}{val > 0 && <div style={{ fontWeight: 400, fontSize: 10 }}>€{val.toLocaleString('it-IT')}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, alignItems: 'start' }}>
          {activeStages.map(s => {
            const isWon = wonStage?.name === s.name;
            const stageContacts = sortContacts(contacts.filter(c => {
              if (c.fase !== s.name) return false;
              if (isWon) { const dc = getDataChiusura(c); return !dc || dc.startsWith(curMonth); }
              return true;
            }));
            return (
              <div key={s.id} className="kanban-col">
                <div className="kanban-header"><span>{s.name}</span><span className="kanban-count">{stageContacts.length}</span></div>
                {stageContacts.length === 0 && <div className="fs-12 text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>Nessun contatto</div>}
                {stageContacts.map(c => {
                  const la = getLastAppt(c); const fu = getNextFu(c); const imp = getPreventivato(c); const isSel = selIds.has(c.id);
                  return (
                    <div key={c.id} className="deal-card" style={{ border: isSel ? '2px solid var(--accent)' : '1px solid var(--border)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 8, right: 8 }}><input type="checkbox" checked={isSel} onChange={() => toggleSel(c.id)} /></div>
                      <div onClick={() => setModal({ type: 'contact', data: c })}>
                        <div style={{ fontWeight: 700, marginBottom: 2, paddingRight: 20 }}>{c.nome}</div>
                        <div className="text-muted fs-12" style={{ marginBottom: 4 }}>{c.azienda || '—'}</div>
                        {c.categoria && <div className="fs-11 text-muted" style={{ marginBottom: 4 }}>{c.categoria}</div>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                          {c.fonte && <FonteBadge name={c.fonte} />}
                          {c.proposta && <PropostaBadge name={c.proposta} />}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                          {imp > 0 && <span className="fs-11 fw-600" style={{ color: '#185FA5' }}>€{imp.toLocaleString('it-IT')}</span>}
                          {la && <span className="fs-11 text-muted">📅 {fmt(la, { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                        </div>
                        {fu && <div className="fs-11 fw-600" style={{ color: fu <= today ? '#A32D2D' : '#185FA5', marginTop: 4 }}>🔔 {fmt(fu, { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function getDataChiusura(c) { return c.dataChiusura || (c.contratti?.length ? c.contratti[0]?.dataInizio : '') || ''; }
