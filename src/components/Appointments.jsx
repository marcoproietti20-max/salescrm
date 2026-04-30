// Appointments.jsx
import React, { useState, useMemo } from 'react';
import { fmt, fmtDT, STATI_APPT } from '../constants';
import { StageBadge, StatoBadge } from './Badges';

export default function Appointments({ contacts, stages, setModal }) {
  const [filter, setFilter] = useState('tutti');
  const today = new Date().toISOString().slice(0, 10);
  const koNames = stages.filter(s => s.isKo).map(s => s.name);

  const events = useMemo(() => {
    const list = [];
    contacts.forEach(c => {
      if (koNames.includes(c.fase)) return;
      (c.history || []).filter(h => h.type === 'appt' && h.date).forEach(h => {
        list.push({ c, appt: h, date: h.date.slice(0, 10), time: h.date.includes('T') ? h.date.slice(11, 16) : '', stato: h.stato || 'Svolto' });
      });
      const apptStageName = stages.find(s => s.name.toLowerCase().includes('appuntamento'))?.name;
      if (apptStageName && c.fase === apptStageName && !(c.history || []).some(h => h.type === 'appt')) {
        list.push({ c, appt: null, date: '', time: '', stato: 'Da pianificare' });
      }
    });
    return list.sort((a, b) => { if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1; return b.date.localeCompare(a.date); });
  }, [contacts, stages, koNames]);

  const filtered = filter === 'tutti' ? events : events.filter(e => e.stato === filter);
  const groups = {};
  filtered.forEach(e => { const k = e.date || '__nessuna__'; if (!groups[k]) groups[k] = []; groups[k].push(e); });

  const FILTERS = [{ id: 'tutti', label: 'Tutti' }, { id: 'Programmato', label: '⏳ Programmati' }, { id: 'Da rifissare', label: '🔄 Da rifissare' }, { id: 'Non effettuato', label: '❌ Non effettuati' }];

  return (
    <>
      <div className="topbar">
        <span className="page-title">Appuntamenti</span>
        <div className="topbar-right">{FILTERS.map(f => <button key={f.id} className={`btn btn-sm${filter===f.id?' btn-primary':''}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
      </div>
      <div className="content">
        {Object.keys(groups).length === 0 && <div className="empty">Nessun appuntamento</div>}
        {Object.keys(groups).map(key => {
          const evs = groups[key]; const isNone = key === '__nessuna__'; const isToday = key === today; const isPast = key < today && !isNone;
          const bg = isNone ? '#FAEEDA' : isToday ? '#E6F1FB' : 'var(--bg3)';
          const bc = isNone ? '#FAC775' : isToday ? '#B5D4F4' : 'var(--border)';
          const label = isNone ? 'Da pianificare' : new Date(key + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          return (
            <div key={key} className="agenda-day" style={{ borderColor: bc }}>
              <div className="agenda-day-header" style={{ background: bg, borderBottomColor: bc }}>
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', color: isToday ? '#0C447C' : isNone ? '#633806' : 'var(--text)' }}>{label}</span>
                {isToday && <span className="badge" style={{ background: '#0C447C', color: '#fff', fontSize: 10 }}>OGGI</span>}
                <span className="fs-11 text-muted" style={{ marginLeft: 'auto' }}>{evs.length} appuntament{evs.length===1?'o':'i'}</span>
              </div>
              {evs.map((ev, i) => {
                const dotColor = isNone ? '#EF9F27' : STATI_APPT.find(s => s.name === ev.stato)?.color || '#378ADD';
                return (
                  <div key={i} className="agenda-event" onClick={() => ev.appt && setModal({ type: 'appt', data: { contactId: ev.c.id, appt: ev.appt } })}>
                    <div style={{ width: 60, padding: '12px 0 12px 16px', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isPast ? 'var(--text3)' : 'var(--text)' }}>{ev.time || '—'}</span>
                    </div>
                    <div style={{ width: 24, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 15 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor }} />
                      <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 3 }} />
                    </div>
                    <div style={{ flex: 1, padding: '12px 16px 12px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>{ev.c.nome}</div>
                          <div className="text-muted fs-12">{ev.c.azienda}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <StageBadge name={ev.c.fase} stages={stages} />
                          {ev.stato && <StatoBadge name={ev.stato} />}
                        </div>
                      </div>
                      {ev.appt?.esito && <div className="text-muted fs-12" style={{ marginTop: 6 }}>{ev.appt.esito.slice(0, 120)}</div>}
                      {!ev.appt && <button className="btn btn-sm btn-primary" style={{ marginTop: 7, fontSize: 11 }} onClick={e => { e.stopPropagation(); setModal({ type: 'appt', data: { contactId: ev.c.id, appt: null } }); }}>Pianifica</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
