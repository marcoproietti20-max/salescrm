import React, { useState } from 'react';
import { uid, DEFAULT_STAGES } from '../constants';

export default function Settings({ brand, setBrand, stages, setStages, customFields, setCustomFields,
  gsCfg, setGsCfg, contacts, setContacts, showToast }) {

  const [newStage, setNewStage] = useState({ name: '', color: '#378ADD' });
  const [newField, setNewField] = useState({ name: '', type: 'text', options: '' });
  const [gsTest, setGsTest] = useState('');
  const sb = (k, v) => setBrand(b => ({ ...b, [k]: v }));

  const testGS = async () => {
    setGsTest('Connessione in corso...');
    try {
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${gsCfg.sheetId}?key=${gsCfg.apiKey}&fields=sheets.properties`);
      const data = await r.json();
      if (data.error) { setGsTest('Errore: ' + data.error.message); return; }
      const tabs = data.sheets?.map(s => s.properties.title).join(', ');
      setGsTest('✅ OK — Tab: ' + tabs);
    } catch (e) { setGsTest('Errore: ' + e.message); }
  };

  const exportCSV = () => {
    const rows = [['Nome','Azienda','Telefono','Email','Fase','Fonte','Categoria','Esito','Proposta','Importo Proposta','Data Chiusura']];
    contacts.forEach(c => rows.push([c.nome,c.azienda||'',c.telefono||'',c.email||'',c.fase||'',c.fonte||'',c.categoria||'',c.esito||'',c.proposta||'',c.importoProposta||'',c.dataChiusura||'']));
    const csv = rows.map(r => r.map(v => '"'+(v||'').toString().replace(/"/g,'""')+'"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv); a.download = 'crm_contatti_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  };

  const Section = ({ title, desc, children }) => (
    <div className="card">
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {desc && <div className="text-muted fs-12" style={{ marginBottom: 16, lineHeight: 1.6 }}>{desc}</div>}
      {children}
    </div>
  );

  return (
    <>
      <div className="topbar"><span className="page-title">Impostazioni</span></div>
      <div className="content">

        <Section title="Personalizzazione" desc="Modifica nome, colori e dettagli del CRM.">
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Nome CRM</label><input className="form-control" value={brand.name||''} onChange={e=>sb('name',e.target.value)}/></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Sottotitolo</label><input className="form-control" value={brand.sub||''} onChange={e=>sb('sub',e.target.value)}/></div>
          </div>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Il tuo nome</label><input className="form-control" value={brand.user||''} onChange={e=>sb('user',e.target.value)}/></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Ruolo</label><input className="form-control" value={brand.role||''} onChange={e=>sb('role',e.target.value)}/></div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Colore principale</label><input className="form-control" type="color" value={brand.color||'#c8102e'} onChange={e=>sb('color',e.target.value)}/></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Link Calendly</label><input className="form-control" value={brand.callink||''} onChange={e=>sb('callink',e.target.value)}/></div>
          </div>
        </Section>

        <Section title="Fasi pipeline" desc="Aggiungi, rinomina o rimuovi le fasi. Spunta KO per mandare una fase all'archivio.">
          {stages.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '9px 12px', marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <input className="form-control" style={{ flex: 1 }} value={s.name} onChange={e => setStages(p => p.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} />
              <input type="color" className="form-control" style={{ width: 40, height: 30, padding: '2px 3px' }} value={s.color} onChange={e => setStages(p => p.map(x => x.id === s.id ? { ...x, color: e.target.value } : x))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={s.isKo||false} onChange={e => setStages(p => p.map(x => x.id === s.id ? { ...x, isKo: e.target.checked } : x))} /> KO
              </label>
              {stages.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Eliminare questa fase?')) setStages(p => p.filter(x => x.id !== s.id)); }}>×</button>}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input className="form-control" style={{ flex: 1 }} placeholder="Nome nuova fase..." value={newStage.name} onChange={e => setNewStage(n => ({ ...n, name: e.target.value }))} />
            <input type="color" className="form-control" style={{ width: 50 }} value={newStage.color} onChange={e => setNewStage(n => ({ ...n, color: e.target.value }))} />
            <button className="btn btn-primary btn-sm" onClick={() => { if (!newStage.name.trim()) return; setStages(p => [...p, { id: uid(), ...newStage, isKo: false }]); setNewStage({ name: '', color: '#378ADD' }); }}>+ Aggiungi</button>
          </div>
        </Section>

        <Section title="Campi personalizzati" desc="Aggiungi campi extra alle anagrafiche.">
          {customFields.map((f, i) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '9px 12px', marginBottom: 8 }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{f.name}</span>
              <span className="badge" style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{f.type}</span>
              <button className="btn btn-sm btn-danger" onClick={() => setCustomFields(p => p.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {customFields.length === 0 && <div className="text-muted fs-12" style={{ marginBottom: 10 }}>Nessun campo personalizzato.</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input className="form-control" style={{ flex: 1, minWidth: 120 }} placeholder="Nome campo..." value={newField.name} onChange={e => setNewField(n => ({ ...n, name: e.target.value }))} />
            <select className="form-control" style={{ width: 120 }} value={newField.type} onChange={e => setNewField(n => ({ ...n, type: e.target.value }))}>
              <option value="text">Testo</option><option value="number">Numero</option><option value="date">Data</option><option value="select">Selezione</option><option value="textarea">Testo lungo</option>
            </select>
            {newField.type === 'select' && <input className="form-control" style={{ flex: 1, minWidth: 150 }} placeholder="Opzioni sep. da virgola" value={newField.options} onChange={e => setNewField(n => ({ ...n, options: e.target.value }))} />}
            <button className="btn btn-primary btn-sm" onClick={() => { if (!newField.name.trim()) return; const f = { id: uid(), name: newField.name, type: newField.type }; if (newField.type === 'select') f.options = newField.options.split(',').map(s => s.trim()).filter(Boolean); setCustomFields(p => [...p, f]); setNewField({ name: '', type: 'text', options: '' }); }}>+ Aggiungi</button>
          </div>
        </Section>

        <Section title="Google Sheet" desc="Credenziali per la sincronizzazione da Calendly/Zapier.">
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Sheet ID</label><input className="form-control" value={gsCfg.sheetId||''} onChange={e=>setGsCfg(c=>({...c,sheetId:e.target.value}))}/></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">API Key</label><input className="form-control" type="password" value={gsCfg.apiKey||''} onChange={e=>setGsCfg(c=>({...c,apiKey:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Nome foglio (tab)</label><input className="form-control" value={gsCfg.tabName||''} onChange={e=>setGsCfg(c=>({...c,tabName:e.target.value}))}/></div>
          <button className="btn btn-sm btn-primary" onClick={testGS}>Test connessione</button>
          {gsTest && <div style={{ marginTop: 8, fontSize: 12, color: gsTest.startsWith('✅') ? '#3B6D11' : '#A32D2D' }}>{gsTest}</div>}
        </Section>

        <Section title="Dati">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={exportCSV}>⬇ Esporta CSV</button>
            <button className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Cancellare TUTTI i dati? Irreversibile.')) { setContacts([]); showToast('Dati cancellati'); } }}>🗑 Cancella tutti i dati</button>
          </div>
        </Section>
      </div>
    </>
  );
}
