import React, { useState } from 'react';
import { fmtDT } from '../constants';
import { FonteBadge } from './Badges';

// I contatti eliminati da Pipeline/Contatti finiscono qui invece che sparire per sempre —
// deleteContact/deleteContacts (in App.jsx) li segnano come "deleted_at" invece di cancellarli,
// e dbLoadContacts li esclude dalle viste normali. "Ripristina" li rimanda in pipeline esattamente
// come stavano; "Elimina definitivamente" è l'unica azione davvero irreversibile qui dentro.
export default function Cestino({ trash, loadTrash, restoreFromTrash, purgeFromTrash, setModal, showToast }) {
  const [q, setQ] = useState('');
  const [selIds, setSelIds] = useState(new Set());

  const filtered = trash.filter(c => !q || (c.nome + (c.azienda || '')).toLowerCase().includes(q.toLowerCase()));

  const toggle = (id) => setSelIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = () => setSelIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));

  const handleRestoreOne = (id) => restoreFromTrash(new Set([id]));
  const handleRestoreSel = () => { restoreFromTrash(selIds); setSelIds(new Set()); };
  const handlePurgeOne = (id, nome) => {
    if (window.confirm(`Eliminare DEFINITIVAMENTE "${nome}"? Questa volta non si torna più indietro.`)) purgeFromTrash(new Set([id]));
  };
  const handlePurgeSel = () => {
    if (window.confirm(`Eliminare DEFINITIVAMENTE ${selIds.size} contatti? Questa volta non si torna più indietro.`)) {
      purgeFromTrash(selIds); setSelIds(new Set());
    }
  };

  return (
    <>
      <div className="topbar">
        <span className="page-title">Cestino</span>
        <span className="text-muted fs-12">{trash.length} contatti eliminati</span>
      </div>
      <div className="content">
        <div className="info-box">
          I contatti eliminati da Pipeline o Contatti restano qui, recuperabili in qualsiasi momento. Solo "Elimina definitivamente" li toglie per sempre dal database.
        </div>
        <div className="search-bar" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="form-control" style={{ maxWidth: 300 }} placeholder="Cerca..." value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn btn-sm" onClick={loadTrash}>↻ Aggiorna</button>
          {selIds.size > 0 && (
            <>
              <button className="btn btn-sm btn-primary" onClick={handleRestoreSel}>↩ Ripristina selezionati ({selIds.size})</button>
              <button className="btn btn-sm btn-danger" onClick={handlePurgeSel}>🗑 Elimina definitivamente ({selIds.size})</button>
            </>
          )}
        </div>
        <div className="table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}><input type="checkbox" checked={filtered.length > 0 && selIds.size === filtered.length} onChange={toggleAll} /></th>
                <th>Cliente</th><th>Azienda</th><th>Fonte</th><th>Eliminato il</th><th style={{ width: 220 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={6} className="empty">Il cestino è vuoto</td></tr> :
                filtered.map(c => (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={selIds.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td className="fw-600" style={{ cursor: 'pointer' }} onClick={() => setModal({ type: 'scheda', data: c })}>{c.nome}</td>
                    <td className="text-muted">{c.azienda || '—'}</td>
                    <td><FonteBadge name={c.fonte} /></td>
                    <td className="fs-12 text-muted">{fmtDT(c.deletedAt)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => handleRestoreOne(c.id)}>↩ Ripristina</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handlePurgeOne(c.id, c.nome)}>🗑 Elimina def.</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
