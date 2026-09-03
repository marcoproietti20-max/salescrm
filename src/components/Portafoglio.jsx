import React, { useState, useEffect, useMemo } from 'react';
import { dbLoadLeads } from '../supabase';

export default function Portafoglio() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fProdotto, setFProdotto] = useState('');
  const [fScadenza, setFScadenza] = useState('');
  const [mostraUsciti, setMostraUsciti] = useState(false);

  useEffect(() => {
    dbLoadLeads().then(data => {
      setLeads((data || []).filter(l => l.codice_cliente_sap));
      setLoading(false);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const prodottiUnici = useMemo(() => {
    const set = new Set();
    leads.forEach(l => (l.prodotti_attivi || []).forEach(p => p?.nome && set.add(p.nome)));
    return [...set].sort((a, b) => a.localeCompare(b, 'it'));
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (!mostraUsciti && l.portafoglio_uscito) return false;
      if (q && !((l.azienda || '') + (l.telefono || '') + (l.email || '')).toLowerCase().includes(q.toLowerCase())) return false;
      if (fProdotto && !(l.prodotti_attivi || []).some(p => p.nome === fProdotto)) return false;
      if (fScadenza) {
        if (!l.prossima_scadenza) return false;
        const giorni = (new Date(l.prossima_scadenza) - new Date(today)) / (1000 * 60 * 60 * 24);
        if (giorni < 0 || giorni > Number(fScadenza)) return false;
      }
      return true;
    }).sort((a, b) => (a.prossima_scadenza || '9999-99-99').localeCompare(b.prossima_scadenza || '9999-99-99'));
  }, [leads, q, fProdotto, fScadenza, mostraUsciti, today]);

  const totValore = filtered.reduce((s, l) => s + (Number(l.valore_cliente) || 0), 0);
  const inScadenza60 = leads.filter(l => !l.portafoglio_uscito && l.prossima_scadenza && (new Date(l.prossima_scadenza) - new Date(today)) / 86400000 <= 60 && (new Date(l.prossima_scadenza) - new Date(today)) / 86400000 >= 0).length;
  const bloccati = leads.filter(l => !l.portafoglio_uscito && l.stato_amministrativo).length;

  if (loading) return (
    <>
      <div className="topbar"><span className="page-title">Portafoglio</span></div>
      <div className="content"><div className="empty">Caricamento...</div></div>
    </>
  );

  return (
    <>
      <div className="topbar">
        <span className="page-title">Portafoglio <span className="text-muted fs-12">({filtered.length})</span></span>
      </div>
      <div className="content">

        <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          <div className="metric-card"><div className="metric-label">Clienti</div><div className="metric-value">{filtered.length}</div></div>
          <div className="metric-card"><div className="metric-label">Valore complessivo</div><div className="metric-value" style={{ color: '#1B7A3E' }}>€{totValore.toLocaleString('it-IT')}</div></div>
          <div className="metric-card"><div className="metric-label">In scadenza (60gg)</div><div className="metric-value" style={{ color: '#E07B1A' }}>{inScadenza60}</div></div>
          <div className="metric-card"><div className="metric-label">Bloccati / precontenzioso</div><div className="metric-value" style={{ color: bloccati > 0 ? '#A32D2D' : 'inherit' }}>{bloccati}</div></div>
        </div>

        <div className="search-bar">
          <input className="form-control" style={{ flex: 1, maxWidth: 260 }} placeholder="Cerca azienda, telefono, email..." value={q} onChange={e => setQ(e.target.value)} />
          {prodottiUnici.length > 0 && (
            <select className="form-control" style={{ width: 220 }} value={fProdotto} onChange={e => setFProdotto(e.target.value)}>
              <option value="">Tutti i prodotti</option>
              {prodottiUnici.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <select className="form-control" style={{ width: 190 }} value={fScadenza} onChange={e => setFScadenza(e.target.value)}>
            <option value="">Qualsiasi scadenza</option>
            <option value="30">In scadenza entro 30gg</option>
            <option value="60">In scadenza entro 60gg</option>
            <option value="90">In scadenza entro 90gg</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={mostraUsciti} onChange={e => setMostraUsciti(e.target.checked)} /> Mostra usciti
          </label>
        </div>

        <div className="table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Azienda</th><th>Telefono</th><th>Email</th><th>Prodotti attivi</th>
                <th>Valore</th><th>Prossima scadenza</th><th>Stato amm.vo</th><th>Stato chiamata</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={8} className="empty">Nessun cliente con questi filtri</td></tr> : filtered.map(l => {
                const giorni = l.prossima_scadenza ? (new Date(l.prossima_scadenza) - new Date(today)) / 86400000 : null;
                const scadenzaVicina = giorni !== null && giorni <= 60 && giorni >= 0;
                return (
                  <tr key={l.id} style={l.portafoglio_uscito ? { opacity: .55 } : {}}>
                    <td>
                      <span className="fw-600">{l.azienda || '—'}</span>
                      {l.portafoglio_uscito && <div className="fs-11" style={{ color: '#A32D2D', fontWeight: 600 }}>📤 Uscito dal portafoglio</div>}
                    </td>
                    <td className="fs-12">{l.telefono || '—'}</td>
                    <td className="fs-12" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email || '—'}</td>
                    <td>
                      {(l.prodotti_attivi || []).length === 0 ? <span className="text-muted fs-12">Nessuno</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 220 }}>
                          {l.prodotti_attivi.slice(0, 3).map((p, i) => (
                            <span key={i} title={p.importo ? `€${Number(p.importo).toLocaleString('it-IT')}` : ''} style={{ background: 'var(--accent-lt)', color: 'var(--accent-dk)', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.nome}</span>
                          ))}
                          {l.prodotti_attivi.length > 3 && <span className="fs-11 text-muted">+{l.prodotti_attivi.length - 3}</span>}
                        </div>
                      )}
                    </td>
                    <td className="fs-12">{l.valore_cliente ? <span style={{ fontWeight: 600, color: '#185FA5' }}>€{Number(l.valore_cliente).toLocaleString('it-IT')}</span> : '—'}</td>
                    <td className="fs-12" style={scadenzaVicina ? { color: '#E07B1A', fontWeight: 700 } : {}}>
                      {l.prossima_scadenza ? new Date(l.prossima_scadenza + 'T12:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      {l.stato_amministrativo
                        ? <span style={{ background: '#A32D2D18', color: '#A32D2D', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>⚠ {l.stato_amministrativo}</span>
                        : <span className="text-muted fs-12">—</span>}
                    </td>
                    <td className="fs-12">{l.stato}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
