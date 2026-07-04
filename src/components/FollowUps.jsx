import React, { useState } from 'react';
import { fmt, uid } from '../constants';
import { dbSave } from '../supabase';

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

export default function FollowUps({ contacts, setModal, showToast, updateContact, setContacts }) {
  const today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState('calendar');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selIds, setSelIds] = useState(new Set());
  const [postponeDays, setPostponeDays] = useState(7);
  const [generatingEmail, setGeneratingEmail] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const all = [];
  contacts.forEach(c => (c.history || []).forEach(h => {
    if (h.type === 'note' && h.followup) {
      const s = h.followup < today ? 'scaduto' : h.followup === today ? 'oggi' : 'futuro';
      all.push({ c, h, s, key: `${c.id}__${h.id}` });
    }
  }));
  all.sort((a, b) => a.h.followup.localeCompare(b.h.followup));

  const groups = { scaduto: [], oggi: [], futuro: [] };
  all.forEach(f => groups[f.s].push(f));

  const toggleOne = key => setSelIds(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAll = checked => setSelIds(checked ? new Set(all.map(f => f.key)) : new Set());
  const allChecked = all.length > 0 && all.every(f => selIds.has(f.key));

  const bulkDelete = async () => {
    if (!selIds.size || !window.confirm(`Eliminare ${selIds.size} follow-up?`)) return;
    setDeleting(true);

    // Group by contact to batch updates
    const byContact = {};
    selIds.forEach(key => {
      const [cid, hid] = key.split('__');
      if (!byContact[cid]) byContact[cid] = [];
      byContact[cid].push(hid);
    });

    // Update each contact and save to Supabase — wait for ALL to complete
    const updatedContacts = contacts.map(c => {
      if (!byContact[c.id]) return c;
      return {
        ...c,
        history: (c.history || []).map(h =>
          byContact[c.id].includes(h.id) ? { ...h, followup: '' } : h
        )
      };
    });

    // Save all modified contacts to Supabase and wait for completion
    const modified = updatedContacts.filter(c => byContact[c.id]);
    await Promise.all(modified.map(c => dbSave(c)));

    // Update React state only after all saves are done
    setContacts(() => updatedContacts);
    setSelIds(new Set());
    setDeleting(false);
    showToast(`${selIds.size} follow-up eliminati`);
  };

  const bulkPostpone = () => {
    if (!selIds.size) return;
    selIds.forEach(key => {
      const [cid, hid] = key.split('__');
      updateContact(cid, c => ({
        ...c,
        history: (c.history || []).map(h => {
          if (h.id !== hid) return h;
          const d = new Date(h.followup);
          d.setDate(d.getDate() + Number(postponeDays));
          return { ...h, followup: d.toISOString().slice(0, 10) };
        })
      }));
    });
    setSelIds(new Set());
    showToast(`${selIds.size} follow-up posticipati`, `di ${postponeDays} giorni`);
  };

  const openEmail = async (f) => {
    setGeneratingEmail(f.key);
    const nome = f.c.nome || ''; const email = f.c.email || '';
    const nota = f.h.text || ''; const testoProposta = f.c.testoProposta || '';
    const sub = encodeURIComponent('Seguito alla nostra conversazione — Il Sole 24 Ore Professionale');
    let riassunto = '';
    if (testoProposta) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 200, messages: [{ role: 'user', content: `Riassumi in 2-3 frasi brevi questa proposta per un follow-up email: "${testoProposta}"` }] })
        });
        const data = await res.json(); riassunto = data.content?.[0]?.text || '';
      } catch { riassunto = ''; }
    }
    const body = encodeURIComponent(
      `Gentile ${nome},\n\nLa contatto in seguito alla nostra conversazione${riassunto ? ` e alla proposta che le ho inviato.\n\nCome le avevo illustrato: ${riassunto}` : ''}.\n\n${nota && nota !== 'Follow-up da importazione' ? `Note: ${nota}\n\n` : ''}Resto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\nMarco Proietti\nIl Sole 24 Ore Professionale`
    );
    setGeneratingEmail(null);
    window.open(`mailto:${email}?subject=${sub}&body=${body}`, '_blank');
  };

  const FuCard = ({ f }) => (
    <div className={`fu-item ${f.s}`}>
      <input type="checkbox" checked={selIds.has(f.key)} onChange={() => toggleOne(f.key)} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fw-600">{f.c.nome}
          <span className="badge" style={{ marginLeft: 6, fontSize: 10, background: f.s === 'scaduto' ? '#FCEBEB' : f.s === 'oggi' ? '#FAEEDA' : '#EAF3DE', color: f.s === 'scaduto' ? '#791F1F' : f.s === 'oggi' ? '#633806' : '#27500A' }}>
            {f.s === 'scaduto' ? 'Scaduto' : f.s === 'oggi' ? 'Oggi' : 'Futuro'}
          </span>
        </div>
        <div className="text-muted fs-12">{f.c.azienda} — {(f.h.text || '').slice(0, 80)}</div>
        <div className="fs-11 text-muted" style={{ marginTop: 3 }}>{fmt(f.h.followup, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button className="btn btn-sm" onClick={() => setModal({ type: 'scheda', data: f.c })} title="Apri scheda">👤</button>
        <button className="btn btn-sm" disabled={generatingEmail === f.key} onClick={() => openEmail(f)}>{generatingEmail === f.key ? '⏳' : '📧'}</button>
        <button className="btn btn-sm" onClick={() => setModal({ type: 'followup', data: { contactId: f.c.id, note: f.h } })}>✏️</button>
      </div>
    </div>
  );

  const weekDays = getWeekDays(weekOffset);
  const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
  const weekLabel = `${fmt(weekDays[0], { day: '2-digit', month: 'short' })} — ${fmt(weekDays[4], { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <>
      <div className="topbar">
        <span className="page-title">Follow-up</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn btn-sm${view === 'list' ? ' btn-primary' : ''}`} onClick={() => setView('list')}>Lista</button>
          <button className={`btn btn-sm${view === 'calendar' ? ' btn-primary' : ''}`} onClick={() => setView('calendar')}>Calendario</button>
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
                const dayFUs = all.filter(f => f.h.followup === d);
                const isPast = d < today;
                return (
                  <div key={d} style={{ background: isToday ? '#E6F1FB' : 'var(--bg2)', border: `1px solid ${isToday ? '#B5D4F4' : 'var(--border)'}`, borderRadius: 'var(--r)', overflow: 'hidden', minHeight: 120 }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: isToday ? '#B5D4F4' : 'var(--bg3)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? '#0C447C' : 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{DAY_NAMES[i]}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? '#0C447C' : isPast ? 'var(--text3)' : 'var(--text)' }}>{fmt(d, { day: '2-digit', month: 'short' })}</div>
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      {dayFUs.length === 0 && <div className="fs-11 text-muted" style={{ padding: '8px 0' }}>—</div>}
                      {dayFUs.map(f => (
                        <div key={f.key} style={{ background: 'var(--bg3)', borderRadius: 4, padding: '5px 7px', marginBottom: 5, cursor: 'pointer', fontSize: 11 }}
                          onClick={() => setModal({ type: 'scheda', data: f.c })}>
                          <div style={{ fontWeight: 700, marginBottom: 1 }}>{f.c.nome}</div>
                          <div className="text-muted" style={{ fontSize: 10 }}>{(f.h.text || '').slice(0, 40)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {all.length === 0 && <div className="empty">Nessun follow-up programmato 🎉</div>}
            {all.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', flexWrap: 'wrap' }}>
                <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} />
                <span className="fs-12 text-muted">{selIds.size > 0 ? `${selIds.size} selezionati` : 'Seleziona tutti'}</span>
                {selIds.size > 0 && (
                  <>
                    <div className="bulk-sep" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="fs-12 text-muted">Posticipa di</span>
                      <input className="form-control" type="number" value={postponeDays} onChange={e => setPostponeDays(e.target.value)} style={{ width: 60, padding: '4px 8px', fontSize: 12 }} />
                      <span className="fs-12 text-muted">giorni</span>
                      <button className="btn btn-sm" onClick={bulkPostpone}>Applica</button>
                    </div>
                    <div className="bulk-sep" />
                    <button className="btn btn-sm btn-danger" onClick={bulkDelete} disabled={deleting}>
                      {deleting ? '⏳ Eliminazione...' : '🗑 Elimina selezionati'}
                    </button>
                  </>
                )}
              </div>
            )}
            {groups.scaduto.length > 0 && <><div className="group-head" style={{ color: '#791F1F' }}>Scaduti ({groups.scaduto.length})</div>{groups.scaduto.map(f => <FuCard key={f.key} f={f} />)}</>}
            {groups.oggi.length > 0 && <><div className="group-head" style={{ color: '#633806' }}>Oggi ({groups.oggi.length})</div>{groups.oggi.map(f => <FuCard key={f.key} f={f} />)}</>}
            {groups.futuro.length > 0 && <><div className="group-head">Prossimi ({groups.futuro.length})</div>{groups.futuro.map(f => <FuCard key={f.key} f={f} />)}</>}
          </>
        )}
      </div>
    </>
  );
}
