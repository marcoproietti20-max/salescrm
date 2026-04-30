import React, { useState } from 'react';
import { FONTI, CATEGORIE, ESITI, PROPOSTE, STATI_APPT, PRODOTTI, uid, fmt, fmtDT, getContratti, getPreventivato } from '../constants';
import { StageBadge, FonteBadge, EsitoBadge, PropostaBadge, StatoBadge } from './Badges';

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
  if (modal.type === 'scheda') return (
    <SchedaModal contact={modal.data} contacts={contacts} stages={stages}
      setModal={setModal} updateContact={updateContact} showToast={showToast}
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

// ── Scheda contatto ─────────────────────────────────────────
function SchedaModal({ contact: initialContact, contacts, stages, setModal, updateContact, showToast, onClose }) {
  const [noteText, setNoteText] = React.useState('');
  const [noteFu, setNoteFu] = React.useState('');
  const [noteFase, setNoteFase] = React.useState('');
  const today = new Date().toISOString().slice(0, 10);

  // Always read fresh contact from contacts array
  const c = contacts.find(x => x.id === initialContact.id) || initialContact;
  const hist = (c.history || []).slice().reverse();



  const addNote = () => {
    if (!noteText.trim()) return;
    updateContact(c.id, ct => ({
      ...ct,
      history: [...(ct.history || []), { id: uid(), type: 'note', date: today, text: noteText, followup: noteFu }],
      ...(noteFase ? { fase: noteFase } : {}),
    }));
    setNoteText(''); setNoteFu(''); setNoteFase('');
    showToast('Nota aggiunta');
  };

  const openEmail = () => {
    const sub = encodeURIComponent('Seguito alla nostra conversazione — Il Sole 24 Ore Professionale');
    const body = encodeURIComponent(`Gentile ${c.nome},\n\nLa contatto in seguito al nostro precedente appuntamento.\n\nResto a disposizione per qualsiasi informazione.\n\nCordiali saluti,\nMarco Proietti\nIl Sole 24 Ore Professionale`);
    window.open(`mailto:${c.email}?subject=${sub}&body=${body}`, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 700 }}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{c.nome}</div>
            <div className="text-muted fs-12">{c.azienda}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <StageBadge name={c.fase} stages={stages} />
            {c.email && <button className="btn btn-sm" onClick={openEmail}>📧 Email</button>}
            <button className="btn btn-sm" onClick={() => { onClose(); setTimeout(() => setModal({ type: 'merge', data: c }), 100); }}>🔗 Riconcilia</button>
            <button className="btn btn-sm btn-primary" onClick={() => { onClose(); setTimeout(() => setModal({ type: 'contact', data: c }), 100); }}>Modifica</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>

          {/* Info */}
          <div className="info-grid" style={{ marginBottom: 16 }}>
            <div className="info-item"><label>Telefono</label><span>{c.telefono || '—'}</span></div>
            <div className="info-item"><label>Email</label><span>{c.email || '—'}</span></div>
            <div className="info-item"><label>Categoria</label><span>{c.categoria || '—'}</span></div>
            <div className="info-item"><label>Fonte</label><FonteBadge name={c.fonte} /></div>
            <div className="info-item"><label>Proposta</label><PropostaBadge name={c.proposta} /></div>
            <div className="info-item"><label>Importo proposta</label><span style={{ fontWeight: 600, color: '#185FA5' }}>{getPreventivato(c) > 0 ? '€' + getPreventivato(c).toLocaleString('it-IT') : '—'}</span></div>
            <div className="info-item"><label>Esito</label><EsitoBadge name={c.esito} /></div>
            <div className="info-item"><label>Data chiusura</label><span>{c.dataChiusura ? fmt(c.dataChiusura) : '—'}</span></div>
          </div>

          {/* Contratti */}
          {getContratti(c).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>Contratti ({getContratti(c).length})</div>
              {getContratti(c).map((ct, i) => (
                <div key={ct.id || i} style={{ background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, marginBottom: 4 }}>
                    <span><strong>Totale:</strong> <span style={{ color: '#3B6D11', fontWeight: 700 }}>€{(ct.totale || 0).toLocaleString('it-IT')}</span></span>
                    <span className="badge" style={{ background: ct.tipo === 'Rinnovo' ? '#E6F1FB' : '#EAF3DE', color: ct.tipo === 'Rinnovo' ? '#0C447C' : '#27500A', border: 'none', fontSize: 10 }}>{ct.tipo || 'Nuovo'}</span>
                    {ct.dataInizio && <span><strong>Inizio:</strong> {fmt(ct.dataInizio)}</span>}
                    {ct.nuovoFatturato > 0 && <span><strong>Nuovo fatt.:</strong> €{ct.nuovoFatturato.toLocaleString('it-IT')}</span>}
                  </div>
                  {(ct.prodotti || []).length > 0 && (
                    <div className="fs-12">{ct.prodotti.map(p => (
                      <span key={p.id} style={{ display: 'inline-block', background: 'white', border: '1px solid #C0DD97', borderRadius: 4, padding: '2px 8px', marginRight: 6, marginTop: 4 }}>
                        {p.categoria && <strong>{p.categoria}</strong>}{p.categoria && p.nome ? ' — ' : ''}{p.nome}: €{Number(p.importo).toLocaleString('it-IT')}{p.durataM ? ` (${p.durataM}m)` : ''}
                      </span>
                    ))}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Testo proposta */}
          {c.testoProposta && (
            <div style={{ marginBottom: 16, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
              <div className="form-label" style={{ marginBottom: 6 }}>Testo proposta commerciale</div>
              <div className="fs-12 text-muted" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.testoProposta}</div>
            </div>
          )}

          {/* Storico */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className="section-head">
              Storico attività ({(c.history || []).length})
              <button className="btn btn-sm btn-primary" onClick={() => { onClose(); setTimeout(() => setModal({ type: 'appt', data: { contactId: c.id, appt: null } }), 100); }}>+ Appuntamento</button>
            </div>
            {hist.map(h => {
              if (h.type === 'appt') {
                const bc = { 'Svolto': '#639922', 'Da rifissare': '#E07B1A', 'Non effettuato': '#A32D2D', 'Non si è presentato': '#A32D2D', 'Programmato': '#378ADD' }[h.stato] || '#378ADD';
                return (
                  <div key={h.id} className="history-item appt" style={{ borderLeftColor: bc }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span className="history-tag tag-appt">Appuntamento</span>
                      <StatoBadge name={h.stato} />
                    </div>
                    <div className="history-date">{fmtDT(h.date)}</div>
                    <div className="history-text">{h.esito || <em className="text-muted">Nessun esito</em>}</div>
                    <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => { onClose(); setTimeout(() => setModal({ type: 'appt', data: { contactId: c.id, appt: h } }), 100); }}>Aggiorna</button>
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
                    <div style={{ fontSize: 11, color: fc, fontWeight: 500, marginTop: 4 }}>
                      Follow-up: {fmt(h.followup, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                      {fs === 'scaduto' ? ' — SCADUTO' : fs === 'oggi' ? ' — OGGI' : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn btn-sm" onClick={() => { onClose(); setTimeout(() => setModal({ type: 'followup', data: { contactId: c.id, note: h } }), 100); }}>✏️ Modifica</button>
                    <button className="btn btn-sm btn-danger" onClick={() => updateContact(c.id, ct => ({ ...ct, history: (ct.history || []).map(x => x.id === h.id ? { ...x, followup: '' } : x) }))}>× Elimina follow-up</button>
                  </div>
                </div>
              );
            })}
            {hist.length === 0 && <div className="empty" style={{ padding: '14px 0' }}>Nessuna attività</div>}

            {/* Aggiungi nota */}
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
      </div>
    </div>
  );
}
