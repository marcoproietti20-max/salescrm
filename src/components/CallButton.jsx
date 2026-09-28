import React from 'react';

// Numero pulito per il link tel: (tiene solo le cifre e un eventuale + iniziale)
export function telHref(numero) {
  const pulito = String(numero || '').replace(/[^\d+]/g, '');
  return pulito ? 'tel:' + pulito : null;
}

// Pulsante con l'icona della cornetta: avvia la chiamata al numero indicato.
// Se il contatto non ha un numero, non mostra nulla.
export default function CallButton({ numero, title, style }) {
  const href = telHref(numero);
  if (!href) return null;
  return (
    <a
      href={href}
      className="btn btn-sm"
      title={title || `Chiama ${numero}`}
      onClick={e => e.stopPropagation()}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 9px', color: '#1B7A3E', borderColor: 'rgba(27,122,62,.35)', textDecoration: 'none', ...style }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 2l3-1 1.8 3.6-2 1.6a10.5 10.5 0 004.5 4.5l1.6-2L15 10.5l-1 3C8 14.5 1.5 8 2.5 2z" />
      </svg>
    </a>
  );
}

// Numero di telefono cliccabile: si comporta come testo normale ma avvia la chiamata al click
export function PhoneLink({ numero, style }) {
  const href = telHref(numero);
  if (!href) return <span>{numero || '—'}</span>;
  return (
    <a href={href} title={`Chiama ${numero}`} onClick={e => e.stopPropagation()}
      style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted currentColor', ...style }}>
      {numero}
    </a>
  );
}
