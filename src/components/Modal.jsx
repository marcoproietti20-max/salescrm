import React, { useState } from 'react';
import { FONTI, CATEGORIE, ESITI, PROPOSTE, STATI_APPT, PRODOTTI, uid, fmt } from '../constants';

export default function Modal({ modal, setModal, contacts, stages, customFields,
  saveContact, deleteContact, updateContact, showToast }) {
  const close = () => setModal(null);

  if (modal.type === 'contact') return (
    <ContactForm c={modal.data} stages={stages} customFields={customFields}
      onSave={d => { saveContact(d); close(); }}
      onDelete={id => { if (window.confirm('Eliminare questo contatto?')) { deleteContact(id); close(); } }}
      onClose={close} />
  );
  if (modal.type === 'appt') return (
    <ApptForm contactId={modal.data.contactId} appt={modal.data.appt} stages={stages}
      onSave={(cid, appt, fase) => {
        updateContact(cid, c => {
          const h = [...(c.history || [])];
          const i = h.findIndex(x => x.id === appt.id);
          if (i >= 0) h[i] = appt; else h.push(appt);
          return { ...c, history: h, ...(fase ? { fase } : {}) };
        });
        showToast('Appuntamento salvato'); close();
      }}
      onDelete={(cid, hid) => { updateContact(cid, c => ({ ...c, history: (c.history || []).filter(h => h.id !== hid) })); close(); }}
      onClose={close} />
  );
  if (modal.type === 'followup') return (
    <FuForm contactId={modal.data.contactId} note={modal.data.note}
      onSave={(cid, note) => {
        updateContact(cid, c => {
          const h = [...(c.history || [])];
          const i = h.findIndex(x => x.id === note.id);
          if (i >= 0) h[i] = note; else h.push(note);
          return { ...c, history: h };
        });
        showToast('Follow-up aggiornato'); close();
      }}
      onDelete={(cid, nid) => { updateContact(cid, c => ({ ...c, history: (c.history || []).map(h => h.id === nid ? { ...h, followup: '' } : h) })); showToast('Follow-up eliminato'); close(); }}
      onClose={close} />
  );
  if (modal.type === 'contratto') return (
    <ContrattoForm contact={modal.data.contact} contratto={modal.data.contratto} isEdit={modal.data.isEdit}
      onSave={(cid, ct) => {
        updateContact(cid, c => ({
          ...c,
          contratti: modal.data.isEdit
            ? (c.contratti || []).map(x => x.id === ct.id ? ct : x)
            : [...(c.contratti || []), ct]
        }));
        showToast('Contratto salvato'); close();
      }}
      onDelete={(cid, cid2) => { updateContact(cid, c => ({ ...c, contratti: (c.contratti || []).filter(x => x.id !== cid2) })); showToast('Contratto eliminato'); close(); }}
      onClose={close} />
  );
  if (modal.type === 'merge') return (
    <MergeForm contacts={contacts} contact={modal.data}
      onMerge={(keepId, mergeId) => {
        const keep = contacts.find(c => c.id === keepId);
        const merge = contacts.find(c => c.id === mergeId);
        if (!keep || !merge) return;
        const merged = {
          ...keep,
          history: [...(keep.history || []), ...(merge.history || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
          contratti: [...(keep.contratti || []), ...(merge.contratti || [])],
          importoProposta: Math.max(keep.importoProposta || 0, merge.importoProposta || 0),
          proposta: keep.proposta || merge.proposta,
          esito: keep.esito || merge.esito,
          fase: keep.fase || merge.fase,
        };
        updateContact(keepId, () => merged);
        deleteContact(mergeId);
        showToast('Anagrafiche unite', keep.nome); close();
      }}
      onClose={close} />
  );
  return null;
}

// ── Overlay wrapper ─────────────────────────────────────────
function Overlay({ onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">{children}</div>
    </div>
  );
}

// ── Contact form ────────────────────────────────────────────
function ContactForm({ c, stages, customFields, onSave, onDelete, onClose }) {
  const isNew = !c?.id;
  const [f, setF] = useState({
    id: c?.id || '', nome: c?.nome || '', azienda: c?.azienda || '',
    email: c?.email || '', telefono: c?.telefono || '',
    fase: c?.fase || stages[0]?.name || '',
    fonte: c?.fonte || '', categoria: c?.categoria || '',
    esito: c?.esito || '', proposta: c?.proposta || '',
    importoProposta: c?.importoProposta || 0,
    dataChiusura: c?.dataChiusura || '',
    testoProposta: c?.testoProposta || '',
    customData: c?.customData || {}, history: c?.history || [],
    contratti: c?.contratti || [],
  });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Overlay onClose={onClose}>
      <div className="modal-header">
        <span className="modal-title">{isNew ? 'Nuovo contatto' : 'Modifica contatto'}</span>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        <div className="form-row">
          <div className="form-group"><label className="form-label">Nome *</label><input className="form-control" value={f.nome} onChange={e => s('nome', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Azienda</label><input className="form-control" value={f.azienda} onChange={e => s('azienda', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Telefono</label><input className="form-control" value={f.telefono} onChange={e => s('telefono', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={f.email} onChange={e => s('email', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fase</label>
            <select className="form-control" value={f.fase} onChange={e => s('fase', e.target.value)}>
              {stages.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Categoria</label>
            <select className="form-control" value={f.categoria} onChange={e => s('categoria', e.target.value)}>
              <option value="">— seleziona —</option>
              {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fonte</label>
            <select className="form-control" value={f.fonte} onChange={e => s('fonte', e.target.value)}>
              <option value="">— seleziona —</option>
              {FONTI.map(fn => <option key={fn.name} value={fn.name}>{fn.icon} {fn.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Esito</label>
            <select className="form-control" value={f.esito} onChange={e => s('esito', e.target.value)}>
              <option value="">— seleziona —</option>
              {ESITI.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Proposta</label>
            <select className="form-control" value={f.proposta} onChange={e => s('proposta', e.target.value)}>
              <option value="">— seleziona —</option>
              {PROPOSTE.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Importo proposta (€)</label>
            <input className="form-control" type="number" value={f.importoProposta} onChange={e => s('importoProposta', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Data chiusura</label>
            <input className="form-control" type="date" value={f.dataChiusura} onChange={e => s('dataChiusura', e.target.value)} />
            <div className="fs-11 text-muted" style={{ marginTop: 3 }}>Per "Chiuso per mese" e fatturato dashboard</div>
          </div>
          <div className="form-group" />
        </div>
        <div className="form-group">
          <label className="form-label">Testo proposta commerciale</label>
          <textarea className="form-control" style={{ minHeight: 90 }} value={f.testoProposta} onChange={e => s('testoProposta', e.target.value)} placeholder="Incolla qui la proposta inviata. Verrà riassunta dall'AI per i follow-up." />
        </div>

        {/* Contratti */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="form-label" style={{ margin: 0 }}>Contratti ({(f.contratti||[]).length})</div>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => s('contratti', [...(f.contratti||[]), { id: uid(), tipo: 'Nuovo', nuovoFatturato: 0, prodotti: [], dataInizio: '', totale: 0 }])}>+ Aggiungi contratto</button>
          </div>
          {(f.contratti||[]).length === 0 && <div className="fs-12 text-muted" style={{ marginBottom: 8 }}>Nessun contratto — clicca "+ Aggiungi contratto"</div>}
          {(f.contratti||[]).map((ct, ci) => (
            <div key={ct.id||ci} style={{ background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#3B6D11' }}>Contratto #{ci+1} — €{((ct.prodotti||[]).reduce((s,p)=>s+(Number(p.importo)||0),0)||ct.totale||0).toLocaleString('it-IT')}</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => s('contratti', (f.contratti||[]).filter((_,i)=>i!==ci))}>× Elimina</button>
              </div>
              <div className="form-row" style={{ marginBottom: 8 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tipo</label>
                  <select className="form-control" value={ct.tipo||'Nuovo'} onChange={e => s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,tipo:e.target.value}:x))}>
                    <option value="Nuovo">Nuovo</option><option value="Rinnovo">Rinnovo</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data inizio</label>
                  <input className="form-control" type="date" value={ct.dataInizio||''} onChange={e => s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,dataInizio:e.target.value}:x))} />
                </div>
              </div>
              {(ct.prodotti||[]).length === 0 && <div className="fs-12 text-muted" style={{ marginBottom: 6 }}>Nessun prodotto</div>}
              {(ct.prodotti||[]).map((p, pi) => (
                <div key={p.id||pi} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="form-control" style={{ flex: 2, minWidth: 120 }} value={p.categoria||''} onChange={e => s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,prodotti:x.prodotti.map((pp,j)=>j===pi?{...pp,categoria:e.target.value}:pp)}:x))}>
                    <option value="">— categoria —</option>
                    {['Editoria elettronica','Software','Formazione','Partner24 Ore','ItalyX','Quotidiani','Newsletter','Business Compass','Studi di Settore','Altri Prodotti'].map(pr=><option key={pr} value={pr}>{pr}</option>)}
                  </select>
                  <input className="form-control" style={{ flex: 2, minWidth: 80 }} type="text" placeholder="Nome prodotto" value={p.nome||''} onChange={e => s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,prodotti:x.prodotti.map((pp,j)=>j===pi?{...pp,nome:e.target.value}:pp)}:x))} />
                  <input className="form-control" style={{ flex: 1, minWidth: 70 }} type="number" placeholder="€" value={p.importo||''} onChange={e => { const v=Number(e.target.value)||0; s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,totale:(x.prodotti||[]).reduce((s,pp,j)=>s+(j===pi?v:Number(pp.importo)||0),0),prodotti:x.prodotti.map((pp,j)=>j===pi?{...pp,importo:v}:pp)}:x)); }} />
                  <input className="form-control" style={{ flex: 1, minWidth: 60 }} type="number" placeholder="mesi" value={p.durataM||''} onChange={e => s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,prodotti:x.prodotti.map((pp,j)=>j===pi?{...pp,durataM:Number(e.target.value)}:pp)}:x))} />
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,prodotti:x.prodotti.filter((_,j)=>j!==pi)}:x))}>×</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" style={{ marginTop: 4 }} onClick={() => s('contratti', (f.contratti||[]).map((x,i)=>i===ci?{...x,prodotti:[...(x.prodotti||[]),{id:uid(),categoria:'',nome:'',importo:0,durataM:12}]}:x))}>+ Prodotto</button>
            </div>
          ))}
        </div>

        {customFields.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
            <div className="form-label" style={{ marginBottom: 10 }}>Campi aggiuntivi</div>
            {customFields.map(cf => (
              <div className="form-group" key={cf.id}>
                <label className="form-label">{cf.name}</label>
                {cf.type === 'textarea'
                  ? <textarea className="form-control" value={f.customData[cf.id] || ''} onChange={e => s('customData', { ...f.customData, [cf.id]: e.target.value })} />
                  : cf.type === 'select' && cf.options
                    ? <select className="form-control" value={f.customData[cf.id] || ''} onChange={e => s('customData', { ...f.customData, [cf.id]: e.target.value })}><option value="">—</option>{cf.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
                    : <input className="form-control" type={cf.type || 'text'} value={f.customData[cf.id] || ''} onChange={e => s('customData', { ...f.customData, [cf.id]: e.target.value })} />}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-footer">
        {!isNew && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(f.id)}>Elimina</button>}
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={() => { if (!f.nome.trim()) return alert('Nome obbligatorio'); onSave(f); }}>Salva</button>
      </div>
    </Overlay>
  );
}

// ── Appt form ───────────────────────────────────────────────
function ApptForm({ contactId, appt, stages, onSave, onDelete, onClose }) {
  const a = appt || {};
  const [f, setF] = useState({ id: a.id || uid(), date: a.date || '', stato: a.stato || 'Programmato', esito: a.esito || '' });
  const [fase, setFase] = useState('');
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Overlay onClose={onClose}>
      <div className="modal-header"><span className="modal-title">{a.id ? 'Aggiorna appuntamento' : 'Registra appuntamento'}</span><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <div className="form-row">
          <div className="form-group"><label className="form-label">Data e ora</label><input className="form-control" type="datetime-local" value={f.date} onChange={e => s('date', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stato</label>
            <select className="form-control" value={f.stato} onChange={e => s('stato', e.target.value)}>
              {STATI_APPT.map(st => <option key={st.name} value={st.name}>{st.icon} {st.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Note / Esito</label><textarea className="form-control" value={f.esito} onChange={e => s('esito', e.target.value)} placeholder="Come è andato?" /></div>
        <div className="form-group"><label className="form-label">Aggiorna fase pipeline</label>
          <select className="form-control" value={fase} onChange={e => setFase(e.target.value)}>
            <option value="">— nessun cambiamento —</option>
            {stages.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-footer">
        {a.id && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(contactId, a.id)}>Elimina</button>}
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={() => onSave(contactId, { ...f, type: 'appt' }, fase)}>Salva</button>
      </div>
    </Overlay>
  );
}

// ── Follow-up form ──────────────────────────────────────────
function FuForm({ contactId, note, onSave, onDelete, onClose }) {
  const n = note || {};
  const [f, setF] = useState({ id: n.id || uid(), type: 'note', date: n.date || new Date().toISOString().slice(0, 10), text: n.text || '', followup: n.followup || '' });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Overlay onClose={onClose}>
      <div className="modal-header"><span className="modal-title">Modifica follow-up</span><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <div className="form-group"><label className="form-label">Data follow-up</label><input className="form-control" type="date" value={f.followup} onChange={e => s('followup', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Nota</label><textarea className="form-control" value={f.text} onChange={e => s('text', e.target.value)} /></div>
      </div>
      <div className="modal-footer">
        {n.id && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(contactId, n.id)}>Elimina follow-up</button>}
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={() => onSave(contactId, f)}>Salva</button>
      </div>
    </Overlay>
  );
}

// ── Contratto form ──────────────────────────────────────────
function ContrattoForm({ contact, contratto, isEdit, onSave, onDelete, onClose }) {
  const ct = contratto || {};
  const [tipo, setTipo] = useState(ct.tipo || 'Nuovo');
  const [nuovoFatturato, setNuovoFatturato] = useState(ct.nuovoFatturato || '');
  const [prodotti, setProdotti] = useState(ct.prodotti || []);
  const [dataInizio, setDataInizio] = useState(ct.dataInizio || '');

  const addP = () => setProdotti(p => [...p, { id: uid(), categoria: '', nome: '', importo: 0, durataM: 12 }]);
  const updP = (id, k, v) => setProdotti(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const delP = id => setProdotti(p => p.filter(x => x.id !== id));
  const totale = prodotti.reduce((s, p) => s + (Number(p.importo) || 0), 0);

  return (
    <Overlay onClose={onClose}>
      <div className="modal-header">
        <span className="modal-title">{isEdit ? 'Modifica contratto' : 'Nuovo contratto'} — {contact.nome}</span>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Tipo</label>
            <select className="form-control" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="Nuovo">Nuovo</option>
              <option value="Rinnovo">Rinnovo</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Data inizio</label>
            <input className="form-control" type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} />
          </div>
        </div>
        {tipo === 'Rinnovo' && (
          <div className="form-group">
            <label className="form-label">Nuovo fatturato (€)</label>
            <input className="form-control" type="number" value={nuovoFatturato} onChange={e => setNuovoFatturato(e.target.value)} placeholder="es. 200" />
            <div className="fs-11 text-muted" style={{ marginTop: 3 }}>Quota incrementale del rinnovo</div>
          </div>
        )}

        <div className="form-label" style={{ marginBottom: 8 }}>Prodotti</div>
        {prodotti.length === 0 && <div className="fs-12 text-muted" style={{ marginBottom: 8 }}>Nessun prodotto — clicca "+ Aggiungi"</div>}
        {prodotti.map((p, i) => (
          <div key={p.id} style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="fs-11 fw-600 text-muted" style={{ minWidth: 20 }}>#{i + 1}</span>
              <select className="form-control" style={{ flex: 2, minWidth: 130 }} value={p.categoria || ''} onChange={e => updP(p.id, 'categoria', e.target.value)}>
                <option value="">— categoria —</option>
                {PRODOTTI.map(pr => <option key={pr} value={pr}>{pr}</option>)}
              </select>
              <input className="form-control" style={{ flex: 2, minWidth: 100 }} type="text" placeholder="Nome prodotto" value={p.nome || ''} onChange={e => updP(p.id, 'nome', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ minWidth: 20 }} />
              <input className="form-control" style={{ flex: 1, minWidth: 80 }} type="number" placeholder="€ importo" value={p.importo} onChange={e => updP(p.id, 'importo', e.target.value)} />
              <input className="form-control" style={{ flex: 1, minWidth: 80 }} type="number" placeholder="mesi" value={p.durataM || ''} onChange={e => updP(p.id, 'durataM', e.target.value)} />
              <button className="btn btn-sm btn-danger" onClick={() => delP(p.id)}>×</button>
            </div>
            {p.durataM && dataInizio && (
              <div className="fs-11 text-muted" style={{ marginTop: 4 }}>
                Fine: {(() => { const d = new Date(dataInizio); d.setMonth(d.getMonth() + Number(p.durataM)); return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }); })()}
              </div>
            )}
          </div>
        ))}
        <button className="btn btn-sm" onClick={addP} style={{ marginBottom: 14 }}>+ Aggiungi prodotto</button>
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 14, fontWeight: 700 }}>
          Totale: <span style={{ color: '#3B6D11' }}>€{totale.toLocaleString('it-IT')}</span>
        </div>
      </div>
      <div className="modal-footer">
        {isEdit && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => onDelete(contact.id, ct.id)}>Elimina contratto</button>}
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={() => onSave(contact.id, { id: ct.id || uid(), tipo, nuovoFatturato: Number(nuovoFatturato) || 0, prodotti, dataInizio, totale })}>Salva</button>
      </div>
    </Overlay>
  );
}

// ── Merge form ──────────────────────────────────────────────
function MergeForm({ contacts, contact, onMerge, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const results = contacts.filter(c => c.id !== contact.id && (c.nome + (c.email || '') + (c.azienda || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <Overlay onClose={onClose}>
      <div className="modal-header"><span className="modal-title">Riconcilia — {contact.nome}</span><button className="modal-close" onClick={onClose}>×</button></div>
      <div className="modal-body">
        <div className="info-box blue" style={{ marginBottom: 14 }}>Cerca il contatto duplicato. Lo storico verrà unito e il duplicato eliminato.</div>
        <div className="form-group"><label className="form-label">Cerca duplicato</label><input className="form-control" value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, email, azienda..." autoFocus /></div>
        {q && results.map(c => (
          <div key={c.id} onClick={() => setSel(c)} style={{ padding: '10px 12px', borderRadius: 'var(--r)', border: `2px solid ${sel?.id === c.id ? 'var(--accent)' : 'var(--border)'}`, marginBottom: 6, cursor: 'pointer', background: sel?.id === c.id ? 'rgba(200,16,46,0.04)' : 'var(--bg2)' }}>
            <div className="fw-600">{c.nome}</div>
            <div className="fs-12 text-muted">{c.email} · {c.azienda}</div>
          </div>
        ))}
        {q && results.length === 0 && <div className="empty" style={{ padding: '12px 0' }}>Nessun risultato</div>}
        {sel && <div className="info-box amber" style={{ marginTop: 12 }}>⚠️ <strong>{sel.nome}</strong> verrà eliminato e il suo storico unito a <strong>{contact.nome}</strong>. Azione irreversibile.</div>}
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" disabled={!sel} onClick={() => { if (sel && window.confirm('Confermi?')) onMerge(contact.id, sel.id); }}>Unisci anagrafiche</button>
      </div>
    </Overlay>
  );
}
