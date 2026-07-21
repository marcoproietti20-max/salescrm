import React, { useState, useMemo } from 'react';
import { fmtDate, fmtDateTime, STATI_APPT } from '../constants';
import { StageBadge, StatoBadge } from './Badges';

export default function Appointments({ contacts, stages, setModal }) {
  const [filter, setFilter] = useState('tutti');
  const today = new Date().toISOString().split('T')[0];

  const events = useMemo(() => {
    const list = [];
    const koStageNames = stages.filter(s => s.isKo).map(s => s.name);
    contacts.forEach(c => {
      // Skip contacts in KO stages
      if (koStageNames.includes(c.fase)) return;
      (c.history || []).filter(h => h.type === 'appt' && h.date).forEach(h => {
        list.push({ contact: c, appt: h, date: h.date.split('T')[0], time: h.date.includes('T') ? h.date.split('T')[1]?.slice(0,5) : '', stato: h.stato || 'Svolto' });
      });
      // contacts in appt stage with no history
      const apptStage = stages.find(s => s.name.toLowerCase().includes('appuntamento'));
      if (apptStage && c.fase === apptStage.name && !(c.history || []).some(h => h.type === 'appt')) {
        list.push({ contact: c, appt: null, date: '', time: '', stato: 'Da pianificare' });
      }
    });
    return list.sort((a, b) => { if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1; return b.date.localeCompare(a.date); });
  }, [contacts, stages]);

  const filtered = filter === 'tutti' ? events : events.filter(e => e.stato === filter);

  // Group by date
  const groups = {};
  const order = [];
  filtered.forEach(e => {
    const key = e.date || '__nessuna__';
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(e);
  });

  const FILTERS = [
    { id: 'tutti', label: 'Tutti' },
    { id: 'Programmato', label: '⏳ Programmati' },
    { id: 'Da rifissare', label: '🔄 Da rifissare' },
    { id: 'Non effettuato', label: '❌ Non effettuati' },
  ];

  return (
    <>
      <div className="topbar">
        <span className="page-title">Appuntamenti</span>
        <div className="topbar-right">
          {FILTERS.map(f => (
            <button key={f.id} className={`btn btn-sm${filter === f.id ? ' btn-primary' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="content">
        {order.length === 0 && <div className="empty">Nessun appuntamento trovato</div>}
        {order.map(key => {
          const evs = groups[key];
          const isNoDate = key === '__nessuna__';
          const isToday = !isNoDate && key === today;
          const isPast  = !isNoDate && key < today;
          const dayBg = isNoDate ? '#FAEEDA' : isToday ? '#E6F1FB' : 'var(--bg3)';
          const dayColor = isNoDate ? '#633806' : isToday ? '#0C447C' : 'var(--text2)';
          const dayBorder = isNoDate ? '#FAC775' : isToday ? '#B5D4F4' : 'var(--border)';
          const dayLabel = isNoDate ? 'Da pianificare' : new Date(key + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

          return (
            <div key={key} className="agenda-day" style={{ borderColor: dayBorder }}>
              <div className="agenda-day-header" style={{ background: dayBg, borderBottomColor: dayBorder }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: dayColor, textTransform: 'capitalize' }}>{dayLabel}</span>
                {isToday && <span className="badge" style={{ background: '#0C447C', color: '#fff', fontSize: 10 }}>OGGI</span>}
                <span style={{ fontSize: 11, color: dayColor, opacity: 0.7, marginLeft: 'auto' }}>{evs.length} appuntament{evs.length === 1 ? 'o' : 'i'}</span>
              </div>
              {evs.map((ev, i) => {
                const stato = STATI_APPT.find(s => s.name === ev.stato);
                const dotColor = isNoDate ? '#EF9F27' : stato ? stato.color : '#378ADD';
                return (
                  <div key={i} className="agenda-event" onClick={() => ev.appt && setModal({ type: 'appt', data: { contactId: ev.contact.id, appt: ev.appt } })}>
                    <div className="agenda-time">
                      <span style={{ fontSize: 13, fontWeight: 700, color: isPast ? 'var(--text3)' : 'var(--text)' }}>{ev.time || '—'}</span>
                    </div>
                    <div className="agenda-dot-col">
                      <div className="agenda-dot" style={{ background: dotColor }} />
                      <div className="agenda-dot-line" />
                    </div>
                    <div className="agenda-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{ev.contact.nome}</div>
                          <div className="text-muted fs-12">{ev.contact.azienda}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <StageBadge name={ev.contact.fase} stages={stages} />
                          {ev.stato && <StatoBadge name={ev.stato} />}
                        </div>
                      </div>
                      {ev.appt?.esito && <div className="text-muted fs-12" style={{ marginTop: 6 }}>{ev.appt.esito.slice(0, 120)}{ev.appt.esito.length > 120 ? '...' : ''}</div>}
                      {!ev.appt && <button className="btn btn-sm btn-primary" style={{ marginTop: 7, fontSize: 11 }} onClick={e => { e.stopPropagation(); setModal({ type: 'appt', data: { contactId: ev.contact.id, appt: null } }); }}>Pianifica appuntamento</button>}
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
