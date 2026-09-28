import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { lsGet, lsSet, uid, DEFAULT_BRAND } from '../constants';

const LS_KEY = 'crm_email_templates';

// Modelli iniziali. Nel testo si possono usare:
//   {nome}    nome del contatto (con il titolo, es. "Avv. Mario Rossi")
//   {azienda} azienda del contatto
//   {link}    link per prenotare un incontro (preso dalle impostazioni del brand)
export const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: 'followup-preventivo',
    nome: 'Follow-up preventivo',
    oggetto: 'Feedback Preventivo - Il Sole 24 Ore Professionale',
    corpo: `Gentile {nome},

spero che la proposta che le ho inviato nei giorni scorsi sia di suo gradimento.

Le scrivo per sapere se ha avuto modo di valutarla e se posso esserle utile per qualsiasi chiarimento.

Le ricordo che le condizioni che le ho riservato sono legate a una disponibilità limitata, pertanto sarei lieto di ricevere un suo riscontro nei prossimi giorni.

Domani proverò a contattarla telefonicamente per un breve confronto.

A presto,
Marco Proietti
Il Sole 24 Ore Professionale`,
  },
  {
    id: 'nuovo-incontro',
    nome: 'Nuovo incontro dopo qualche mese',
    oggetto: 'Le novità Il Sole 24 Ore Professionale',
    corpo: `Gentile {nome},

è passato qualche mese dal nostro ultimo incontro e mi farebbe piacere aggiornarla sulle principali novità della nostra offerta, che potrebbero essere utili alla sua attività.

Se lo ritiene opportuno, possiamo fissare un breve incontro a distanza di circa venti minuti. Può scegliere il momento che preferisce da questo link: {link}

Resto a disposizione per qualsiasi chiarimento.

Cordiali saluti,
Marco Proietti
Il Sole 24 Ore Professionale`,
  },
  {
    id: 'dopo-incontro',
    nome: 'Dopo l\'incontro: ringraziamento e prossimi passi',
    oggetto: 'Grazie per il tempo dedicatomi',
    corpo: `Gentile {nome},

la ringrazio per il tempo che mi ha dedicato. Resto a sua disposizione per qualsiasi approfondimento e la ricontatterò a breve per definire insieme i prossimi passi.

Cordiali saluti,
Marco Proietti
Il Sole 24 Ore Professionale`,
  },
  {
    id: 'rinnovo',
    nome: 'Rinnovo in scadenza',
    oggetto: 'Rinnovo dei suoi servizi Il Sole 24 Ore Professionale',
    corpo: `Gentile {nome},

le scrivo perché uno dei servizi che ha attivi con noi è prossimo alla scadenza e vorrei proporle le condizioni di rinnovo, insieme alle novità disponibili nel frattempo.

Le andrebbe di sentirci per un breve confronto? Può indicarmi il momento che preferisce oppure scegliere direttamente da questo link: {link}

Cordiali saluti,
Marco Proietti
Il Sole 24 Ore Professionale`,
  },
];

function compila(testo, c, link) {
  return String(testo || '')
    .replace(/\{nome\}/g, c?.nome || '')
    .replace(/\{azienda\}/g, c?.azienda || '')
    .replace(/\{link\}/g, link || '');
}

// Pulsante "Email": al click propone i modelli, poi apre il programma di posta con il testo già compilato.
export default function EmailButton({ contatto }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(false);
  const [bozza, setBozza] = useState([]);

  if (!contatto?.email) return null;

  const link = ((lsGet('crm_brand', DEFAULT_BRAND) || DEFAULT_BRAND).callink) || DEFAULT_BRAND.callink;

  const apri = (e) => {
    e.stopPropagation();
    setTemplates(lsGet(LS_KEY, DEFAULT_EMAIL_TEMPLATES));
    setEditing(false);
    setOpen(true);
  };
  const chiudi = () => { setOpen(false); setEditing(false); };

  const invia = (t) => {
    const params = t
      ? `?subject=${encodeURIComponent(compila(t.oggetto, contatto, link))}&body=${encodeURIComponent(compila(t.corpo, contatto, link))}`
      : '';
    chiudi();
    window.location.href = 'mailto:' + contatto.email + params;
  };

  // ── Modifica modelli ──
  const avviaModifica = () => { setBozza(templates.map(t => ({ ...t }))); setEditing(true); };
  const setCampo = (i, k, v) => setBozza(b => b.map((t, idx) => idx === i ? { ...t, [k]: v } : t));
  const aggiungi = () => setBozza(b => [...b, { id: uid(), nome: 'Nuovo modello', oggetto: '', corpo: 'Gentile {nome},\n\n' }]);
  const rimuovi = (i) => { if (window.confirm('Eliminare questo modello?')) setBozza(b => b.filter((_, idx) => idx !== i)); };
  const ripristina = () => { if (window.confirm('Ripristinare i modelli iniziali? Le tue modifiche andranno perse.')) setBozza(DEFAULT_EMAIL_TEMPLATES.map(t => ({ ...t }))); };
  const salva = () => {
    const puliti = bozza.filter(t => (t.nome || '').trim());
    lsSet(LS_KEY, puliti);
    setTemplates(puliti);
    setEditing(false);
  };

  return (
    <>
      <button type="button" className="btn btn-sm" onClick={apri}>📧 Email</button>
      {open && createPortal(
        <div className="modal-overlay" style={{ zIndex: 400 }}
          onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) chiudi(); }}>
          <div className="modal-box" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Modifica modelli email' : `Scrivi a ${contatto.nome}`}</span>
              <button type="button" className="modal-close" onClick={chiudi}>×</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
              {!editing ? (
                <>
                  <div className="fs-12 text-muted" style={{ marginBottom: 10 }}>Scegli un modello: il testo viene compilato con i dati del cliente e si apre il tuo programma di posta, dove puoi ancora modificarlo prima di inviare.</div>
                  {[{ id: '__vuota', nome: 'Email vuota', oggetto: 'Nessun testo preimpostato' }, ...templates].map(t => (
                    <div key={t.id} onClick={() => invia(t.id === '__vuota' ? null : t)}
                      style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 8, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-lt)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.nome}</div>
                      <div className="fs-12 text-muted">{t.oggetto}</div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="fs-12 text-muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
                    Nel testo puoi usare <strong>{'{nome}'}</strong> (nome del cliente), <strong>{'{azienda}'}</strong> e <strong>{'{link}'}</strong> (il tuo link per prenotare un incontro). Vengono sostituiti in automatico ogni volta.
                  </div>
                  {bozza.map((t, i) => (
                    <div key={t.id || i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 12, marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input className="form-control" style={{ flex: 1, fontWeight: 700 }} value={t.nome} onChange={e => setCampo(i, 'nome', e.target.value)} placeholder="Nome del modello" />
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => rimuovi(i)}>Elimina</button>
                      </div>
                      <input className="form-control" style={{ marginBottom: 8 }} value={t.oggetto} onChange={e => setCampo(i, 'oggetto', e.target.value)} placeholder="Oggetto dell'email" />
                      <textarea className="form-control" style={{ minHeight: 170, lineHeight: 1.5 }} value={t.corpo} onChange={e => setCampo(i, 'corpo', e.target.value)} placeholder="Testo dell'email" />
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={aggiungi}>+ Nuovo modello</button>
                </>
              )}
            </div>

            <div className="modal-footer">
              {!editing ? (
                <>
                  <button type="button" className="btn" style={{ marginRight: 'auto' }} onClick={avviaModifica}>✏️ Modifica modelli</button>
                  <button type="button" className="btn" onClick={chiudi}>Chiudi</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn" style={{ marginRight: 'auto' }} onClick={ripristina}>Ripristina iniziali</button>
                  <button type="button" className="btn" onClick={() => setEditing(false)}>Annulla</button>
                  <button type="button" className="btn btn-primary" onClick={salva}>Salva modelli</button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
