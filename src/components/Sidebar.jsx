import React, { useState, useEffect } from 'react';

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',      icon: 'M2 2h5v5H2zm7 0h5v5H9zm-7 7h5v5H2zm7 0h5v5H9z' },
  { id: 'contacts',     label: 'Contatti',        icon: 'M8 8a3 3 0 100-6 3 3 0 000 6zm-6 6c0-3.3 2.7-6 6-6s6 2.7 6 6' },
  { id: 'pipeline',     label: 'Pipeline',        icon: 'M2 4h4v8H2zm5 3h4v5H7zm5-5h2v10h-2z' },
  { id: 'appointments', label: 'Appuntamenti',    icon: 'M1 2h14a1 1 0 011 1v11a1 1 0 01-1 1H1a1 1 0 01-1-1V3a1 1 0 011-1zm0 4h14M5 1v2M11 1v2' },
  { id: 'followups',    label: 'Follow-up',       icon: 'M8 1v7l4 2M15 8A7 7 0 111 8a7 7 0 0114 0z', badge: true },
  { id: 'chiuso',       label: 'Chiuso per mese', icon: 'M2 12l4-4 3 3 5-6M1 15h14' },
  { id: 'archivio',     label: 'Archivio KO',     icon: 'M1 5h14l-2-3H3zm0 0v10a1 1 0 001 1h12a1 1 0 001-1V5M6 9h4' },
  { id: 'calendly',     label: 'Bookings',        icon: 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 3v4l3 2' },
  { id: 'settings',     label: 'Impostazioni',    icon: 'M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8 1v2M8 13v2M1 8h2M13 8h2' },
];

export default function Sidebar({ page, setPage, brand, urgentFU }) {
  const [open, setOpen] = useState(window.innerWidth > 900);

  useEffect(() => {
    const fn = () => { if (window.innerWidth > 900) setOpen(true); };
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const go = (id) => { setPage(id); if (window.innerWidth <= 900) setOpen(false); };

  return (
    <>
      {open && window.innerWidth <= 900 && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 49 }} />
      )}
      <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
          {open ? <path d="M14 4L4 14M4 4l10 10" /> : <path d="M2 4h14M2 9h14M2 14h14" />}
        </svg>
      </button>
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo" style={{ paddingTop: window.innerWidth <= 900 ? 52 : 22 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: '-0.5px', lineHeight: 1 }}>
            SalesPRO
          </div>
        </div>
        <nav className="nav">
          <div className="nav-label">Menu</div>
          {NAV.map(item => (
            <button key={item.id} className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => go(item.id)} title={item.label}>
              <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d={item.icon} />
              </svg>
              <span>{item.label}</span>
              {item.badge && urgentFU > 0 && <span className="nav-badge">{urgentFU}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <strong>{brand.user}</strong>
          <span>{brand.role}</span>
        </div>
      </aside>
    </>
  );
}
