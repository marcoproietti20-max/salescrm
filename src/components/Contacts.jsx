import React, { useState, useMemo } from 'react';
import { fmt, fmtDT, uid, FONTI, CATEGORIE, ESITI, PROPOSTE, getPreventivato, getContratti, getFatturato, getLastAppt, getNextFu } from '../constants';
import { StageBadge, FonteBadge, EsitoBadge, PropostaBadge, StatoBadge } from './Badges';

export default function Contacts({ contacts, stages, customFields, setModal, updateContact,
  deleteContact, deleteContacts, setContacts, showToast, today, pageFilter, setPageFilter, navigateTo }) {

  const [q, setQ] = useState('');
  const [fFase, setFFase] = useState('');
  const [fFonte, setFFonte] = useState('');
  const [fProp, setFProp] = useState('');
  const [fEsito, setFEsito] = useState('');
  const [fPrev, setFPrev] = useState(false);
  const [selIds, setSelIds] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [openContact, setOpenContact] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteFu, setNoteFu] = useState('');
  const [noteFase, setNoteFase] = useState('');
  const [sortK, setSortK] = useState('');
  const [sortD, setSortD] = useState('asc');

  // Apply filter from dashboard
  React.useEffect(() => {
    if (!pageFilter) return;
    if (pageFilter.fase) setFFase(pageFilter.fase === 'aperto' ? '' : pageFilter.fase);
    if (pageFilter.fonte) setFFonte(pageFilter.fonte);
    if (pageFilter.preventivato) setFPrev(true);
    setPageFilter(null);
  }, [pageFilter, setPageFilter]);

  const sort = (key) => { if (sortK === key) setSortD(d => d === 'asc' ? 'desc' : 'asc'); else { setSortK(key); setSortD('asc'); } };

  const filtered = useMemo(() => {
    let list = contacts.filter(c => {
      if (q && !(c.nome + (c.azienda || '') + (c.email || '')).toLowerCase().includes(q.toLowerCase())) return false;
      if (fFase && c.fase !== fFase) return false;
      if (fFonte && c.fonte !== fFonte) return false;
      if (fProp && c.proposta !== fProp) return false;
      if (fEsito && c.esito !== fEsito) return false;
      if (fPrev && !getPreventivato(c)) return false;
      return true;
    });
    if (sortK) list = [...list].sort((a, b) => {
      let va = '', vb = '';
      if (sortK === 'nome') { va = a.nome || ''; vb = b.nome || ''; }
      else if (sortK === 'azienda') { va = a.azienda || ''; vb = b.azienda || ''; }
      else if (sortK === 'fase') { va = a.fase || ''; vb = b.fase || ''; }
      else if (sortK === 'categoria') { va = a.categoria || ''; vb = b.categoria || ''; }
      else if (sortK === 'fonte') { va = a.fonte || ''; vb = b.fonte || ''; }
      else if (sortK === 'esito') { va = a.esito || ''; vb = b.esito || ''; }
      else if (sortK === 'proposta') { va = a.proposta || ''; vb = b.proposta || ''; }
      else if (sortK === 'importo') return sortD === 'asc' ? getPreventivato(a) - getPreventivato(b) : getPreventivato(b) - getPreventivato(a);
      else if (sortK === 'app') { va = getLastAppt(a); vb = getLastAppt(b); }
      else if (sortK === 'fu') { va = getNextFu(a); vb = getNextFu(b); }
      const cmp = va.localeCompare(vb, 'it', { numeric: true });
      return sortD === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [contacts, q, fFase, fFonte, fProp, fEsito, fPrev, sortK, sortD]);

  const allChecked = filtered.length > 0 && filtered.every(c => selIds.has(c.id));
  const toggleOne = (id) => setSelIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (checked) => setSelIds(prev => { const n = new Set(prev); filtered.forEach(c => checked ? n.add(c.id) : n.delete(c.id)); return n; });

  // Keep openContact in sync with contacts array
  React.useEffect(() => {
    if (!openId) { setOpenContact(null); return; }
    const found = contacts.find(c => c.id === openId);
    setOpenContact(found || null);
  }, [openId, contacts]);

  const addNote = () => {
    if (!noteText.trim() || !openId) return;
    updateContact(openId, c => ({
      ...c,
      history: [...(c.history || []), { id: uid(), type: 'note', date: today, text: noteText, followup: noteFu }],
      ...(noteFase ? { fase: noteFase } : {}),
    }));
    setNoteText(''); setNoteFu(''); setNoteFase('');
    showToast('Nota aggiunta', '');
  };

  const Th = ({ k, label }) => (
    <th className={k ? 'sortable' : ''} onClick={() => k && sort(k)}>
      {label}{sortK === k ? (sortD === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <>
      <div className="topbar">
        <span className="page-title">Contatti <span className="text-muted fs-12">({contacts.length})</span></span>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'contact', data: null })}>+ Nuovo</button>
      </div>
      <div className="content">

        {/* Filters */}
        <div className="search-bar">
          <input className="form-control" style={{ flex: 1, maxWidth: 260 }} placeholder="Cerca nome, azienda, email..." value={q} onChange={e => setQ(e.target.value)} />
          <select className="form-control" style={{ width: 140 }} value={fFase} onChange={e => setFFase(e.target.value)}>
            <option value="">Tutte le fasi</option>
            {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 140 }} value={fFonte} onChange={e => setFFonte(e.target.value)}>
            <option value="">Tutte le fonti</option>
            {FONTI.map(f => <option key={f.name} value={f.name}>{f.icon} {f.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 140 }} value={fProp} onChange={e => setFProp(e.target.value)}>
            <option value="">Tutte le proposte</option>
            {PROPOSTE.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <select className="form-control" style={{ width: 120 }} value={fEsito} onChange={e => setFEsito(e.target.value)}>
            <option value="">Tutti gli esiti</option>
            {ESITI.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
          {fPrev && <button className="btn btn-sm btn-primary" onClick={() => setFPrev(false)}>Con preventivo ×</button>}
        </div>

        {/* Bulk bar */}
        {selIds.size > 0 && (
          <div className="bulk-bar">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0C447C' }}>{selIds.size} selezionati</span>
            <div className="bulk-sep" />
            <select className="form-control" style={{ width: 140, fontSize: 12, padding: '4px 8px' }}
              onChange={e => { if (!e.target.value) return; setContacts(p => p.map(c => selIds.has(c.id) ? { ...c, fase: e.target.value } : c)); showToast('Fase aggiornata', e.target.value); e.target.value = ''; }}>
              <option value="">Cambia fase...</option>
              {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="form-control" style={{ width: 155, fontSize: 12, padding: '4px 8px' }}
              onChange={e => { if (!e.target.value) return; setContacts(p => p.map(c => selIds.has(c.id) ? { ...c, fonte: e.target.value } : c)); showToast('Fonte aggiornata', e.target.value); e.target.value = ''; }}>
              <option value="">Cambia fonte...</option>
              {FONTI.map(f => <option key={f.name} value={f.name}>{f.icon} {f.name}</option>)}
            </select>
            <div className="bulk-sep" />
            <button className="btn btn-sm btn-danger" onClick={() => {
              if (window.confirm(`Eliminare ${selIds.size} contatti?`)) { deleteContacts(selIds); setSelIds(new Set()); setOpenId(null); }
            }}>🗑 Elimina</button>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setSelIds(new Set())}>× Deseleziona</button>
          </div>
        )}

        {/* Table */}
        <div className="table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>
                  <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} />
                </th>
                <Th k="nome" label="Nome" />
                <Th k="azienda" label="Azienda" />
                <Th k={null} label="Telefono" />
                <Th k={null} label="Email" />
                <Th k="fase" label="Fase" />
                <Th k="categoria" label="Categoria" />
                <Th k="app" label="Ultimo App." />
                <Th k="proposta" label="Proposta" />
                <Th k="importo" label="Importo €" />
                <Th k="fu" label="Follow-up" />
                <Th k="fonte" label="Fonte" />
                <Th k="esito" label="Esito" />
                <th style={{ width: 120 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={14} className="empty">Nessun contatto trovato</td></tr>
                : filtered.map(c => {
                  const lastDs = getLastAppt(c);
                  const fu = getNextFu(c);
                  const isChecked = selIds.has(c.id);
                  const isOpen = openId === c.id;
                  const imp = getPreventivato(c);
                  return (
                    <tr key={c.id} style={{ background: isOpen ? 'rgba(200,16,46,0.06)' : isChecked ? 'rgba(200,16,46,0.03)' : '' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleOne(c.id)} />
                      </td>
                      <td><span className="fw-600">{c.nome}</span></td>
                      <td>{c.azienda || '—'}</td>
                      <td className="fs-12">{c.telefono || '—'}</td>
                      <td className="fs-12" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '—'}</td>
                      <td><StageBadge name={c.fase} stages={stages} /></td>
                      <td className="fs-12 text-muted">{c.categoria || '—'}</td>
                      <td className="fs-12">{lastDs ? <span style={{ color: lastDs < today ? '#A32D2D' : '#185FA5', fontWeight: 500 }}>{fmt(lastDs, { day: '2-digit', month: 'short', year: 'numeric' })}</span> : <span className="text-muted">—</span>}</td>
                      <td><PropostaBadge name={c.proposta} /></td>
                      <td className="fs-12">{imp > 0 ? <span style={{ fontWeight: 600, color: '#185FA5' }}>€{imp.toLocaleString('it-IT')}</span> : <span className="text-muted">—</span>}</td>
                      <td className="fs-11">{fu ? <span style={{ color: fu < today ? '#A32D2D' : fu === today ? '#E07B1A' : '#185FA5', fontWeight: 500 }}>{fmt(fu, { day: '2-digit', month: 'short', year: 'numeric' })}</span> : <span className="text-muted">—</span>}</td>
                      <td><FonteBadge name={c.fonte} /></td>
                      <td><EsitoBadge name={c.esito} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm" style={{ marginRight: 4 }}
                          onClick={() => { 
                            if (openId === c.id) { setOpenId(null); setOpenContact(null); }
                            else { setOpenId(c.id); setOpenContact(c); }
                          }}>
                          {isOpen ? 'Chiudi' : 'Scheda'}
                        </button>
                        <button className="btn btn-sm btn-primary"
                          onClick={() => setModal({ type: 'contact', data: c })}>
                          Modifica
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Detail panel — always rendered when openContact exists */}
        {openContact && (
          <div className="detail-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{openContact.nome}</div>
                <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{openContact.azienda}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <StageBadge name={openContact.fase} stages={stages} />
                <FonteBadge name={openContact.fonte} />
                <EsitoBadge name={openContact.esito} />
                {openContact.email && (
                  <button className="btn btn-sm" onClick={() => {
                    const sub = encodeURIComponent('Seguito alla nostra conversazione — Il Sole 24 Ore Professionale');
                    const body = encodeURIComponent(`Gentile ${openContact.nome},\n\nLa contatto in seguito al nostro precedente appuntamento.\n\nResto a disposizione per qualsiasi informazione.\n\nCordiali saluti,\nMarco Proietti\nIl Sole 24 Ore Professionale`);
                    window.open(`mailto:${openContact.email}?subject=${sub}&body=${body}`, '_blank');
                  }}>📧 Email</button>
                )}
                <button className="btn btn-sm" onClick={() => setModal({ type: 'merge', data: openContact })}>🔗 Riconcilia</button>
                <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'contact', data: openContact })}>Modifica</button>
              </div>
            </div>

            <div className="info-grid">
              <div className="info-item"><label>Telefono</label><span>{openContact.telefono || '—'}</span></div>
              <div className="info-item"><label>Email</label><span>{openContact.email || '—'}</span></div>
              <div className="info-item"><label>Categoria</label><span>{openContact.categoria || '—'}</span></div>
              <div className="info-item"><label>Proposta</label><PropostaBadge name={openContact.proposta} /></div>
              <div className="info-item"><label>Importo proposta</label><span style={{ fontWeight: 600, color: '#185FA5' }}>{getPreventivato(openContact) > 0 ? '€' + getPreventivato(openContact).toLocaleString('it-IT') : '—'}</span></div>
              <div className="info-item"><label>Data chiusura</label><span>{openContact.dataChiusura ? fmt(openContact.dataChiusura) : '—'}</span></div>
            </div>

            {/* Contratti */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="form-label" style={{ margin: 0 }}>Contratti ({getContratti(openContact).length})</div>
                <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'contratto', data: { contact: openContact, isEdit: false } })}>+ Nuovo contratto</button>
              </div>
              {getContratti(openContact).length === 0 && <div className="fs-12 text-muted">Nessun contratto registrato</div>}
              {getContratti(openContact).map((ct, i) => (
                <div key={ct.id || i} style={{ background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                      <span><strong>Totale:</strong> <span style={{ color: '#3B6D11', fontWeight: 700 }}>€{(ct.totale || 0).toLocaleString('it-IT')}</span></span>
                      <span className="badge" style={{ background: ct.tipo === 'Rinnovo' ? '#E6F1FB' : '#EAF3DE', color: ct.tipo === 'Rinnovo' ? '#0C447C' : '#27500A', border: 'none', fontSize: 10 }}>{ct.tipo || 'Nuovo'}</span>
                      {ct.dataInizio && <span><strong>Inizio:</strong> {fmt(ct.dataInizio)}</span>}
                      {ct.nuovoFatturato > 0 && <span><strong>Nuovo fatt.:</strong> €{ct.nuovoFatturato.toLocaleString('it-IT')}</span>}
                    </div>
                    <button className="btn btn-sm" onClick={() => setModal({ type: 'contratto', data: { contact: openContact, contratto: ct, isEdit: true } })}>✏️</button>
                  </div>
                  {ct.prodotti?.length > 0 && (
                    <div className="fs-12" style={{ marginTop: 4 }}>
                      {ct.prodotti.map(p => (
                        <span key={p.id} style={{ display: 'inline-block', background: 'white', border: '1px solid #C0DD97', borderRadius: 4, padding: '2px 8px', marginRight: 6, marginTop: 4 }}>
                          {p.categoria && <strong>{p.categoria}</strong>}{p.categoria && p.nome ? ' — ' : ''}{p.nome}: €{Number(p.importo).toLocaleString('it-IT')}{p.durataM ? ` (${p.durataM}m)` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Testo proposta */}
            {openContact.testoProposta && (
              <div style={{ marginBottom: 16, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                <div className="form-label" style={{ marginBottom: 6 }}>Testo proposta commerciale</div>
                <div className="fs-12 text-muted" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{openContact.testoProposta}</div>
              </div>
            )}

            {/* Storico */}
            <div className="divider">
              <div className="section-head">
                Storico attività ({(openContact.history || []).length})
                <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'appt', data: { contactId: openContact.id, appt: null } })}>+ Appuntamento</button>
              </div>
              {(openContact.history || []).slice().reverse().map(h => {
                if (h.type === 'appt') {
                  const bc = { 'Svolto': '#639922', 'Da rifissare': '#E07B1A', 'Non effettuato': '#A32D2D', 'Non si è presentato': '#A32D2D', 'Programmato': '#378ADD' }[h.stato] || '#378ADD';
                  return (
                    <div key={h.id} className="history-item appt" style={{ borderLeftColor: bc }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span className="history-tag tag-appt">Appuntamento</span>
                        <StatoBadge name={h.stato} />
                      </div>
                      <div className="history-date">{fmtDT(h.date)}</div>
                      <div className="history-text">{h.esito || <em className="text-muted">Nessun esito registrato</em>}</div>
                      <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setModal({ type: 'appt', data: { contactId: openContact.id, appt: h } })}>Aggiorna</button>
                    </div>
                  );
                }
                const fs = h.followup ? (h.followup < today ? 'scaduto' : h.followup === today ? 'oggi' : 'futuro') : '';
                const fc = { scaduto: '#A32D2D', oggi: '#E07B1A', futuro: '#185FA5' }[fs] || '';
                return (
                  <div key={h.id} className="history-item note">
                    <span className="history-tag tag-note">Nota</span>
                    <div className="history-date">{fmt(h.date, { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                    <div className="history-text">{h.text}</div>
                    {h.followup && (
                      <>
                        <div style={{ fontSize: 11, color: fc, fontWeight: 500, marginTop: 4 }}>
                          Follow-up: {fmt(h.followup, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                          {fs === 'scaduto' ? ' — SCADUTO' : fs === 'oggi' ? ' — OGGI' : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-sm" onClick={() => setModal({ type: 'followup', data: { contactId: openContact.id, note: h } })}>✏️ Modifica</button>
                          <button className="btn btn-sm btn-danger" onClick={() => updateContact(openContact.id, c => ({ ...c, history: (c.history || []).map(x => x.id === h.id ? { ...x, followup: '' } : x) }))}>× Elimina</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {(openContact.history || []).length === 0 && <div className="empty" style={{ padding: '14px 0' }}>Nessuna attività</div>}

              {/* Add note */}
              <div style={{ marginTop: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: 14 }}>
                <div className="form-label" style={{ marginBottom: 8 }}>Aggiungi nota</div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <textarea className="form-control" style={{ minHeight: 60 }} placeholder="Nota..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                </div>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Follow-up</label>
                    <input className="form-control" type="date" value={noteFu} onChange={e => setNoteFu(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Aggiorna fase</label>
                    <select className="form-control" value={noteFase} onChange={e => setNoteFase(e.target.value)}>
                      <option value="">— nessun cambiamento —</option>
                      {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={addNote}>Salva nota</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
