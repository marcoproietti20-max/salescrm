import React, { useState, useRef } from 'react';
import { uid, parseCSVRow } from '../constants';

export default function Calendly({ contacts, stages, setContacts, gsCfg, brand, syncFromGoogleSheet, importFromCSV, showToast }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [lastSync] = useState(localStorage.getItem('crm_sync_last') || '');
  const [form, setForm] = useState({ nome: '', azienda: '', email: '', telefono: '', data: '', note: '' });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const doSync = async () => {
    setSyncing(true); setSyncResult(null);
    const r = await syncFromGoogleSheet();
    const now = new Date().toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    localStorage.setItem('crm_sync_last', now);
    setSyncResult(r); setSyncing(false);
  };

  const importManual = () => {
    if (!form.nome.trim()) return alert('Il nome è obbligatorio');
    const history = [];
    if (form.data) history.push({ id: uid(), type: 'appt', date: form.data, stato: 'Programmato', esito: form.note || '' });
    setContacts(p => [...p, { id: uid(), nome: form.nome, azienda: form.azienda, email: form.email, telefono: form.telefono, fase: stages[1]?.name || stages[0]?.name, fonte: 'Bookings', categoria: '', esito: '', proposta: '', importoProposta: 0, dataChiusura: '', contratti: [], testoProposta: '', noteInterne: '', history, customData: {} }]);
    setForm({ nome: '', azienda: '', email: '', telefono: '', data: '', note: '' });
    showToast('Contatto importato', form.nome);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      let rows = [];
      if (file.name.endsWith('.csv')) {
        const Papa = await import('papaparse');
        const text = await file.text();
        const result = Papa.default.parse(text, { header: true, skipEmptyLines: true, delimiter: ',' });
        rows = result.data;
        if (rows.length === 0 || Object.keys(rows[0]).length <= 1) {
          const r2 = Papa.default.parse(text, { header: true, skipEmptyLines: true, delimiter: ';' });
          rows = r2.data;
        }
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      }
      const r = await importFromCSV(rows);
      setImportResult(r);
    } catch (err) { setImportResult({ error: err.message }); }
    setImporting(false); e.target.value = '';
  };

  return (
    <>
      <div className="topbar"><span className="page-title">Bookings & Importazione</span></div>
      <div className="content">
        <div className="card">
          <div className="card-title">Sincronizzazione da Google Sheet</div>
          <p className="text-muted fs-12" style={{ marginBottom: 14, lineHeight: 1.6 }}>
            <strong>Power Automate</strong> popola automaticamente il Google Sheet ad ogni nuova prenotazione da <strong>Microsoft Bookings</strong>. Clicca <strong>Sincronizza ora</strong> per importare i nuovi contatti — i duplicati vengono ignorati e i contratti esistenti non vengono sovrascritti.
          </p>
          {lastSync && <div className="fs-11 text-muted" style={{ marginBottom: 10 }}>Ultima sincronizzazione: {lastSync}</div>}
          <button className="btn btn-primary" onClick={doSync} disabled={syncing}>{syncing ? '⏳ Sincronizzazione...' : '🔄 Sincronizza ora'}</button>
          {syncResult && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              {syncResult.error ? <span style={{ color: '#A32D2D' }}>Errore: {syncResult.error}</span>
                : <span><span style={{ color: '#3B6D11', fontWeight: 600 }}>Completato.</span> {syncResult.imported} nuovi, {syncResult.updated} aggiornati, {syncResult.skipped} ignorati.</span>}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Importa da CSV / Excel</div>
          <p className="text-muted fs-12" style={{ marginBottom: 14, lineHeight: 1.6 }}>Carica un file CSV o Excel con i contatti da importare.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? '⏳ Importazione...' : '📁 Carica file CSV / Excel'}</button>
            <a className="btn" href="/template_importazione.csv" download>⬇ Scarica template CSV</a>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
          </div>
          {importResult && (
            <div style={{ fontSize: 13 }}>
              {importResult.error ? <span style={{ color: '#A32D2D' }}>Errore: {importResult.error}</span>
                : <span><span style={{ color: '#3B6D11', fontWeight: 600 }}>Importazione completata.</span> {importResult.imported} nuovi contatti, {importResult.skipped} duplicati ignorati.</span>}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Inserisci prenotazione manualmente</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Nome *</label><input className="form-control" value={form.nome} onChange={e => s('nome', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Azienda</label><input className="form-control" value={form.azienda} onChange={e => s('azienda', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e => s('email', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Telefono</label><input className="form-control" value={form.telefono} onChange={e => s('telefono', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Data appuntamento</label><input className="form-control" type="datetime-local" value={form.data} onChange={e => s('data', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Note</label><textarea className="form-control" value={form.note} onChange={e => s('note', e.target.value)} /></div>
          <button className="btn btn-primary" onClick={importManual}>Importa contatto</button>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Il tuo link Microsoft Bookings</div>
          <a href={brand.callink} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{(brand.callink || '').replace('https://', '')} ↗</a>
        </div>
      </div>
    </>
  );
}
