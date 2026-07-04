import React, { useState } from 'react';
import { fmt, getPreventivato, getLastAppt, getNextFu } from '../constants';
import { FonteBadge, PropostaBadge } from './Badges';

export default function Pipeline({ contacts, stages, setModal, setContacts, showToast, deleteContact, deleteContacts }) {
  const activeStages = stages.filter(s => !s.isKo && s.name !== 'Chiuso OK');
  const [sortK, setSortK] = useState('nome');
  const [sortD, setSortD] = useState('asc');
  const [selIds, setSelIds] = useState(new Set());
  const today = new Date().toISOString().slice(0, 10);

  const sortC = (list) => [...list].sort((a, b) => {
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

  const handleBulkDelete = () => {
    if (!selIds.size) return;
    if (!window.confirm(`Eliminare ${selIds.size} contatti? Questa azione è irreversibile.`)) return;
    deleteContacts(selIds);
    setSelIds(new Set());
  };

  return (
    <>
      <div className="topbar">
        <span className="page-title">Pipeline</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="fs-12 text-muted">Ordina:</span>
          {[['nome','Nome'],['app','App.'],['fu','Follow-up'],['importo','€']].map(([k,l]) => (
            <button key={k} className={`btn btn-sm${sortK===k?' btn-primary':''}`}
              onClick={() => { if (sortK===k) setSortD(d=>d==='asc'?'desc':'asc'); else { setSortK(k); setSortD('asc'); } }}>
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
            <div className="bulk-sep" />
            <button className="btn btn-sm btn-danger" onClick={handleBulkDelete}>🗑 Elimina selezionati</button>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelIds(new Set())}>× Deseleziona</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, marginBottom: 6 }}>
          {activeStages.map(s => {
            const cnt = contacts.filter(c => c.fase === s.name).length;
            const val = contacts.filter(c => c.fase === s.name).reduce((sum, c) => sum + getPreventivato(c), 0);
            return (
              <div key={s.id} style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', paddingBottom: 6, borderBottom: `3px solid ${s.color}`, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {s.name} ({cnt}){val > 0 && <div style={{ fontWeight: 400, fontSize: 10 }}>€{val.toLocaleString('it-IT')}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 12, alignItems: 'start' }}>
          {activeStages.map(s => {
            const sc = sortC(contacts.filter(c => c.fase === s.name));
            return (
              <div key={s.id} className="kanban-col">
                <div className="kanban-header"><span>{s.name}</span><span className="kanban-count">{sc.length}</span></div>
                {sc.length === 0 && <div className="fs-12 text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>Nessun contatto</div>}
                {sc.map(c => {
                  const la = getLastAppt(c); const fu = getNextFu(c); const imp = getPreventivato(c); const isSel = selIds.has(c.id);
                  return (
                    <div key={c.id} className="deal-card" style={{ border: isSel ? '2px solid var(--accent)' : '1px solid var(--border)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleSel(c.id)} />
                      </div>
                      <div onClick={() => setModal({ type: 'scheda', data: c })} style={{ cursor: 'pointer' }}>
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
                      {/* Single delete button */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        <button className="btn btn-sm" style={{ flex: 1, fontSize: 11 }}
                          onClick={() => setModal({ type: 'contact', data: c })}>Modifica</button>
                        <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }}
                          onClick={() => { if (window.confirm(`Eliminare ${c.nome}?`)) deleteContact(c.id); }}>🗑</button>
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
