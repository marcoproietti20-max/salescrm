import React, { useState, useMemo } from 'react';
import { fmt, fmtDT, STATI_APPT } from '../constants';
import { StageBadge, StatoBadge } from './Badges';

function getWeekDays(offset) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function Appointments({ contacts, stages, setModal }) {
  const [filter, setFilter] = useState('tutti');
  const [view, setView] = useState('list');
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const koNames = stages.filter(s => s.isKo).map(s => s.name);

  const events = useMemo(() => {
    const list = [];
    contacts.forEach(c => {
      if (koNames.includes(c.fase)) return;
      (c.history || []).filter(h => h.type === 'appt' && h.date).forEach(h => {
        list.push({ c, appt: h, date: h.date.slice(0, 10), time: h.date.includes('T') ? h.date.slice(11, 16) : '', stato: h.stato || 'Svolto' });
      });
    });
    return list.sort((a, b) => { if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1; return b.date.localeCompare(a.date); });
  }, [contacts, stages, koNames]);

  const filtered = filter === 'tutti' ? events : events.filter(e => e.stato === filter);

  // Calendar view
  const weekDays = getWeekDays(weekOffset);
  const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
  const weekLabel = `${fmt(weekDays[0], { day: '2-digit', month: 'short' })} — ${fmt(weekDays[4], { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const FILTERS = [{ id:'tutti', label:'Tutti' }, { id:'Programmato', label:'⏳ Programmati' }, { id:'Da rifissare', label:'🔄 Da rifissare' }, { id:'Non effettuato', label:'❌ Non effettuati' }];

  // List view grouped by date
  const groups = {};
  filtered.forEach(e => { const k = e.date || '__nessuna__'; if (!groups[k]) groups[k] = []; groups[k].push(e); });

  const EventCard = ({ ev, compact = false }) => {
    const dotColor = STATI_APPT.find(s => s.name === ev.stato)?.color || '#378ADD';
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: compact ? '7px 10px' : '10px 14px', marginBottom: compact ? 5 : 8, cursor: 'pointer' }}
        onClick={() => ev.appt && setModal({ type: 'appt', data: { contactId: ev.c.id, appt: ev.appt } })}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: compact ? 11 : 13 }}>{ev.c.nome}</div>
            {!compact && <div className="text-muted fs-12">{ev.c.azienda}</div>}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            <StatoBadge name={ev.stato} />
            <button className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 11 }}
              onClick={e => { e.stopPropagation(); setModal({ type: 'scheda', data: ev.c }); }} title="Apri scheda">👤</button>
          </div>
        </div>
        {ev.time && !compact && <div className="fs-11 text-muted" style={{ marginTop: 3 }}>{ev.time}</div>}
        {ev.appt?.esito && !compact && <div className="text-muted fs-12" style={{ marginTop: 4 }}>{ev.appt.esito.slice(0, 80)}</div>}
      </div>
    );
  };

  return (
    <>
      <div className="topbar">
        <span className="page-title">Appuntamenti</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm${view==='list'?' btn-primary':''}`} onClick={() => setView('list')}>Lista</button>
          <button className={`btn btn-sm${view==='calendar'?' btn-primary':''}`} onClick={() => setView('calendar')}>Calendario</button>
          {view === 'list' && FILTERS.map(f => <button key={f.id} className={`btn btn-sm${filter===f.id?' btn-primary':''}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
      </div>
      <div className="content">
        {view === 'calendar' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <button className="btn btn-sm" onClick={() => setWeekOffset(w => w - 1)}>← Prec.</button>
              <button className="btn btn-sm" onClick={() => setWeekOffset(0)}>Oggi</button>
              <button className="btn btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Succ. →</button>
              <span className="fs-12 text-muted fw-600">{weekLabel}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {weekDays.map((d, i) => {
                const isToday = d === today;
                const dayEvs = events.filter(e => e.date === d);
                const isPast = d < today;
                return (
                  <div key={d} style={{ background: isToday ? '#E6F1FB' : 'var(--bg2)', border: `1px solid ${isToday ? '#B5D4F4' : 'var(--border)'}`, borderRadius: 'var(--r)', overflow: 'hidden', minHeight: 140 }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: isToday ? '#B5D4F4' : 'var(--bg3)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#0C447C' : 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{DAY_NAMES[i]}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? '#0C447C' : isPast ? 'var(--text3)' : 'var(--text)' }}>{fmt(d, { day: '2-digit', month: 'short' })}</div>
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      {dayEvs.length === 0 && <div className="fs-11 text-muted" style={{ padding: '8px 0' }}>—</div>}
                      {dayEvs.map((ev, idx) => <EventCard key={idx} ev={ev} compact />)}
                      <button className="btn btn-sm" style={{ width: '100%', fontSize: 10, marginTop: 4, justifyContent: 'center' }}
                        onClick={() => setModal({ type: 'appt', data: { contactId: null, appt: null, prefDate: d } })}>+ App.</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {Object.keys(groups).length === 0 && <div className="empty">Nessun appuntamento</div>}
            {Object.keys(groups).map(key => {
              const evs = groups[key]; const isNone = key === '__nessuna__'; const isToday = key === today; const isPast = key < today && !isNone;
              const bg = isNone ? '#FAEEDA' : isToday ? '#E6F1FB' : 'var(--bg3)';
              const bc = isNone ? '#FAC775' : isToday ? '#B5D4F4' : 'var(--border)';
              const label = isNone ? 'Da pianificare' : new Date(key + 'T00:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
              return (
                <div key={key} className="agenda-day" style={{ borderColor: bc }}>
                  <div className="agenda-day-header" style={{ background: bg, borderBottomColor: bc }}>
                    <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', color: isToday ? '#0C447C' : isNone ? '#633806' : 'var(--text)' }}>{label}</span>
                    {isToday && <span className="badge" style={{ background:'#0C447C', color:'#fff', fontSize:10 }}>OGGI</span>}
                    <span className="fs-11 text-muted" style={{ marginLeft:'auto' }}>{evs.length} appuntament{evs.length===1?'o':'i'}</span>
                  </div>
                  {evs.map((ev, i) => {
                    const dotColor = STATI_APPT.find(s => s.name === ev.stato)?.color || '#378ADD';
                    return (
                      <div key={i} className="agenda-event" onClick={() => ev.appt && setModal({ type:'appt', data:{ contactId:ev.c.id, appt:ev.appt } })}>
                        <div style={{ width:60, padding:'12px 0 12px 16px', flexShrink:0 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:isPast?'var(--text3)':'var(--text)' }}>{ev.time||'—'}</span>
                        </div>
                        <div style={{ width:24, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:15 }}>
                          <div style={{ width:10, height:10, borderRadius:'50%', background:dotColor }} />
                          <div style={{ width:2, flex:1, background:'var(--border)', marginTop:3 }} />
                        </div>
                        <div style={{ flex:1, padding:'12px 16px 12px 10px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                            <div>
                              <div style={{ fontWeight:700, marginBottom:2 }}>{ev.c.nome}</div>
                              <div className="text-muted fs-12">{ev.c.azienda}</div>
                            </div>
                            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                              <StageBadge name={ev.c.fase} stages={stages}/>
                              {ev.stato && <StatoBadge name={ev.stato}/>}
                              <button className="btn btn-sm" style={{ fontSize:11, padding:'2px 7px' }}
                                onClick={e => { e.stopPropagation(); setModal({ type:'scheda', data:ev.c }); }} title="Apri scheda">👤</button>
                            </div>
                          </div>
                          {ev.appt?.esito && <div className="text-muted fs-12" style={{ marginTop:6 }}>{ev.appt.esito.slice(0,120)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
