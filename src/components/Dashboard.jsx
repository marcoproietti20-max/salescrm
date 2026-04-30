// Dashboard.jsx
import React, { useEffect, useRef } from 'react';
import { Chart, ArcElement, BarElement, BarController, DoughnutController, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { fmtEur, fmt, FONTI, getFatturato, getPreventivato, getDataChiusura, getContratti } from '../constants';
import { FonteBadge, StageBadge } from './Badges';
Chart.register(ArcElement, BarElement, BarController, DoughnutController, CategoryScale, LinearScale, Tooltip, Legend);
const MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export default function Dashboard({ contacts, stages, today, navigateTo }) {
  const barRef = useRef(), doughRef = useRef(), pieRef = useRef();
  const barC = useRef(), doughC = useRef(), pieC = useRef();

  const activeStages = stages.filter(s => !s.isKo);
  const wonStage = activeStages[activeStages.length - 1];
  const koStages = stages.filter(s => s.isKo);
  const chiusiOK = contacts.filter(c => wonStage && c.fase === wonStage.name);
  const chiusiKO = contacts.filter(c => koStages.some(s => s.name === c.fase));
  const open = contacts.filter(c => !koStages.some(s => s.name === c.fase) && c.fase !== wonStage?.name);

  const curMonth = today.slice(0, 7);
  const curYear = today.slice(0, 4);
  const fatMese = chiusiOK.filter(c => getDataChiusura(c).startsWith(curMonth)).reduce((s, c) => s + getFatturato(c), 0);
  const fatAnno = chiusiOK.filter(c => getDataChiusura(c).startsWith(curYear)).reduce((s, c) => s + getFatturato(c), 0);
  const totPrev = open.reduce((s, c) => s + getPreventivato(c), 0);
  const urgentFU = contacts.reduce((n, c) => n + (c.history || []).filter(h => h.type === 'note' && h.followup && h.followup <= today).length, 0);
  const daRifissare = contacts.reduce((n, c) => n + (c.history || []).filter(h => h.type === 'appt' && (h.stato === 'Da rifissare' || h.stato === 'Non si è presentato' || h.stato === 'Non effettuato')).length, 0);

  // Monthly fatturato
  const monthly = Array(12).fill(0);
  chiusiOK.forEach(c => {
    const d = getDataChiusura(c);
    if (d && d.startsWith(curYear)) monthly[parseInt(d.slice(5, 7)) - 1] += getFatturato(c);
  });

  // Stage counts
  const stageCnt = {};
  activeStages.forEach(s => stageCnt[s.name] = 0);
  contacts.forEach(c => { if (stageCnt[c.fase] !== undefined) stageCnt[c.fase]++; });

  // Fonte counts
  const fonteCnt = {};
  FONTI.forEach(f => fonteCnt[f.name] = 0);
  contacts.forEach(c => { if (c.fonte) fonteCnt[c.fonte] = (fonteCnt[c.fonte] || 0) + 1; });

  // Product category breakdown
  const prodCat = {};
  contacts.forEach(c => getContratti(c).forEach(ct => (ct.prodotti || []).forEach(p => {
    if (p.categoria) prodCat[p.categoria] = (prodCat[p.categoria] || 0) + (Number(p.importo) || 0);
  })));
  const prodLabels = Object.keys(prodCat).filter(k => prodCat[k] > 0);
  const PIE_COLORS = ['#378ADD','#EF9F27','#7F77DD','#E07B1A','#639922','#c8102e','#0A66C2','#A32D2D','#3B6D11','#888'];

  useEffect(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c8102e';
    if (barRef.current) { barC.current?.destroy(); barC.current = new Chart(barRef.current, { type: 'bar', data: { labels: MESI, datasets: [{ label: '€', data: monthly, backgroundColor: accent + '99', borderColor: accent, borderWidth: 1.5, borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmtEur(ctx.parsed.y) } } }, scales: { y: { ticks: { callback: v => fmtEur(v) }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } } }); }
    if (doughRef.current) { doughC.current?.destroy(); doughC.current = new Chart(doughRef.current, { type: 'doughnut', data: { labels: activeStages.map(s => s.name), datasets: [{ data: activeStages.map(s => stageCnt[s.name] || 0), backgroundColor: activeStages.map(s => s.color), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } } }); }
    if (pieRef.current && prodLabels.length) { pieC.current?.destroy(); pieC.current = new Chart(pieRef.current, { type: 'doughnut', data: { labels: prodLabels, datasets: [{ data: prodLabels.map(k => prodCat[k]), backgroundColor: PIE_COLORS.slice(0, prodLabels.length), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ' ' + fmtEur(ctx.parsed) } } } } }); }
    return () => { barC.current?.destroy(); doughC.current?.destroy(); pieC.current?.destroy(); };
  }, [contacts, stages]);

  const urgentList = [];
  contacts.forEach(c => (c.history || []).forEach(h => { if (h.type === 'note' && h.followup && h.followup <= today) urgentList.push({ c, h, s: h.followup < today ? 'scaduto' : 'oggi' }); }));
  urgentList.sort((a, b) => a.h.followup.localeCompare(b.h.followup));

  const Metric = ({ label, value, sub, color, alert, onClick }) => (
    <div className="metric-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${alert ? ' metric-alert' : ''}`} style={color ? { color } : {}}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      {onClick && <div className="metric-hint">Clicca per dettaglio →</div>}
    </div>
  );

  return (
    <>
      <div className="topbar">
        <span className="page-title">Dashboard</span>
        <span className="text-muted fs-12">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
      <div className="content">
        {(urgentFU > 0 || daRifissare > 0) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {urgentFU > 0 && <div className="info-box red" style={{ flex: 1, cursor: 'pointer', margin: 0 }} onClick={() => navigateTo('followups')}>🔔 {urgentFU} follow-up urgenti — <strong>Vedi →</strong></div>}
            {daRifissare > 0 && <div className="info-box amber" style={{ flex: 1, cursor: 'pointer', margin: 0 }} onClick={() => navigateTo('appointments')}>🔄 {daRifissare} appuntamenti da gestire — <strong>Vedi →</strong></div>}
          </div>
        )}
        <div className="metric-grid">
          <Metric label="Trattative aperte" value={open.length} sub="in pipeline" onClick={() => navigateTo('pipeline')} />
          <Metric label="Totale preventivato" value={fmtEur(totPrev)} sub="trattative attive" onClick={() => navigateTo('contacts', { preventivato: true })} />
          <Metric label="Fatturato mese" value={fmtEur(fatMese)} sub={new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })} color="#3B6D11" onClick={() => navigateTo('chiuso')} />
          <Metric label="Fatturato anno" value={fmtEur(fatAnno)} sub={curYear} color="#3B6D11" onClick={() => navigateTo('chiuso')} />
        </div>
        <div className="metric-grid">
          <Metric label="Chiuso OK" value={chiusiOK.length} sub={fmtEur(chiusiOK.reduce((s, c) => s + getFatturato(c), 0)) + ' fatturati'} color="#3B6D11" onClick={() => navigateTo('chiuso')} />
          <Metric label="Chiuso KO" value={chiusiKO.length} sub="trattative perse" onClick={() => navigateTo('archivio')} />
          <Metric label="Follow-up urgenti" value={urgentFU} alert={urgentFU > 0} sub="oggi o scaduti" onClick={() => navigateTo('followups')} />
          <Metric label="Contatti totali" value={contacts.length} sub="in rubrica" onClick={() => navigateTo('contacts')} />
        </div>
        <div className="charts-grid">
          <div className="card" style={{ marginBottom: 0 }}><div className="card-title">Fatturato mensile {curYear}</div><div style={{ height: 210, position: 'relative' }}><canvas ref={barRef} /></div></div>
          <div className="card" style={{ marginBottom: 0 }}><div className="card-title">Pipeline per fase</div><div style={{ height: 210, position: 'relative' }}><canvas ref={doughRef} /></div></div>
        </div>
        <div style={{ height: 16 }} />
        <div className="card">
          <div className="card-title">Trattative per fase</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8 }}>
            {activeStages.map(s => (
              <div key={s.id} onClick={() => navigateTo('contacts', { fase: s.name })} style={{ background: s.color + '11', border: `1px solid ${s.color}44`, borderRadius: 'var(--r)', padding: '10px 12px', cursor: 'pointer' }}>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{stageCnt[s.name] || 0}</div>
              </div>
            ))}
          </div>
        </div>
        {prodLabels.length > 0 && (
          <div className="card">
            <div className="card-title">Fatturato per categoria prodotto</div>
            <div style={{ height: 220, position: 'relative' }}><canvas ref={pieRef} /></div>
          </div>
        )}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Follow-up urgenti
            {urgentList.length > 0 && <button className="btn btn-sm" onClick={() => navigateTo('followups')}>Vedi tutti →</button>}
          </div>
          {urgentList.length === 0 ? <div className="empty" style={{ padding: '14px 0' }}>Nessun follow-up urgente 🎉</div> :
            urgentList.slice(0, 5).map((f, i) => (
              <div key={i} className={`fu-item ${f.s}`}>
                <div style={{ flex: 1 }}>
                  <div className="fw-600">{f.c.nome} <span className="badge" style={{ fontSize: 10, background: f.s === 'scaduto' ? '#FCEBEB' : '#FAEEDA', color: f.s === 'scaduto' ? '#791F1F' : '#633806' }}>{f.s === 'scaduto' ? 'Scaduto' : 'Oggi'}</span></div>
                  <div className="text-muted fs-12">{f.c.azienda} — {(f.h.text || '').slice(0, 60)}</div>
                </div>
                <span className="fs-11 text-muted">{fmt(f.h.followup, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            ))}
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Contatti per fonte</div>
          {FONTI.filter(f => fonteCnt[f.name] > 0).map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, cursor: 'pointer' }} onClick={() => navigateTo('contacts', { fonte: f.name })}>
              <FonteBadge name={f.name} />
              <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(4, fonteCnt[f.name] / Math.max(1, contacts.length) * 100)}%`, background: f.color, height: '100%', borderRadius: 4 }} />
              </div>
              <span className="fs-12 text-muted" style={{ minWidth: 24, textAlign: 'right' }}>{fonteCnt[f.name]}</span>
            </div>
          ))}
          {FONTI.every(f => !fonteCnt[f.name]) && <div className="empty" style={{ padding: '12px 0' }}>Nessun dato</div>}
        </div>
      </div>
    </>
  );
}
