import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { lsGet, lsSet, uid, DEFAULT_BRAND } from '../constants';

const LS_KEY = 'crm_email_templates';

// Carattere usato quando il testo formattato viene incollato nell'email (i modelli con grassetto).
// Aptos è il predefinito di Outlook; Calibri e Arial servono solo come riserva.
const FONT_EMAIL = 'Aptos, Calibri, Arial, sans-serif';

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

// Grassetto: nel testo si scrive **così**. Il collegamento mailto accetta solo testo semplice,
// quindi per i modelli con grassetto il testo viene copiato formattato negli appunti.
export const haGrassetto = (testo) => /\*\*[\s\S]+?\*\*/.test(String(testo || ''));
export const togliMarkup = (testo) => String(testo || '').replace(/\*\*([\s\S]+?)\*\*/g, '$1');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function versioneHtml(testo) {
  let h = escapeHtml(String(testo || ''));
  h = h.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
  h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  h = h.replace(/\r?\n/g, '<br>');
  return '<div style="font-family:' + FONT_EMAIL + ';font-size:11pt;">' + h + '</div>';
}

// Avvolge (o toglie) il grassetto attorno alla selezione. Restituisce il nuovo testo e la nuova selezione.
export function avvolgiGrassetto(testo, s, e) {
  if (s === e) return { testo: testo.slice(0, s) + '****' + testo.slice(e), s: s + 2, e: s + 2 };
  if (testo.slice(s - 2, s) === '**' && testo.slice(e, e + 2) === '**') {
    return { testo: testo.slice(0, s - 2) + testo.slice(s, e) + testo.slice(e + 2), s: s - 2, e: e - 2 };
  }
  return { testo: testo.slice(0, s) + '**' + testo.slice(s, e) + '**' + testo.slice(e), s: s + 2, e: e + 2 };
}

async function copiaFormattato(html, plain) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })]);
      return true;
    }
  } catch (err) { /* provo il metodo alternativo */ }
  try {
    const box = document.createElement('div');
    box.contentEditable = 'true';
    box.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    box.innerHTML = html;
    document.body.appendChild(box);
    const range = document.createRange(); range.selectNodeContents(box);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const ok = document.execCommand('copy');
    sel.removeAllRanges(); document.body.removeChild(box);
    return ok;
  } catch (err) { return false; }
}

// Pulsante "Email": al click propone i modelli, poi apre il programma di posta con il testo già compilato.
export default function EmailButton({ contatto }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(false);
  const [bozza, setBozza] = useState([]);
  const [copiato, setCopiato] = useState(null); // { html, plain, oggetto, ok }

  if (!contatto?.email) return null;

  const link = ((lsGet('crm_brand', DEFAULT_BRAND) || DEFAULT_BRAND).callink) || DEFAULT_BRAND.callink;

  const apri = (e) => {
    e.stopPropagation();
    setTemplates(lsGet(LS_KEY, DEFAULT_EMAIL_TEMPLATES));
    setEditing(false);
    setCopiato(null);
    setOpen(true);
  };
  const chiudi = () => { setOpen(false); setEditing(false); setCopiato(null); };

  const apriMail = (params) => { window.location.href = 'mailto:' + contatto.email + (params || ''); };

  const invia = async (t) => {
    if (!t) { chiudi(); apriMail(''); return; }
    const oggetto = compila(t.oggetto, contatto, link);
    const testo = compila(t.corpo, contatto, link);
    const plain = togliMarkup(testo);
    if (!haGrassetto(t.corpo)) {
      chiudi();
      apriMail(`?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(plain)}`);
      return;
    }
    // Modello con grassetto: copio il testo formattato e apro l'email con solo l'oggetto
    const html = versioneHtml(testo);
    const ok = await copiaFormattato(html, plain);
    setCopiato({ html, plain, oggetto, ok });
    if (ok) apriMail(`?subject=${encodeURIComponent(oggetto)}`);
    else apriMail(`?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(plain)}`);
  };
  const copiaDiNuovo = async () => {
    const ok = await copiaFormattato(copiato.html, copiato.plain);
    setCopiato(c => ({ ...c, ok }));
  };

  const grassetto = (i) => {
    const ta = document.getElementById('tpl-corpo-' + i);
    if (!ta) return;
    const r = avvolgiGrassetto(bozza[i].corpo || '', ta.selectionStart, ta.selectionEnd);
    setCampo(i, 'corpo', r.testo);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(r.s, r.e); }, 0);
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
              <span className="modal-title">{editing ? 'Modifica modelli email' : copiato ? 'Testo copiato' : `Scrivi a ${contatto.nome}`}</span>
              <button type="button" className="modal-close" onClick={chiudi}>×</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
              {copiato && !editing ? (
                <div style={{ lineHeight: 1.6, fontSize: 13.5 }}>
                  {copiato.ok ? (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Testo copiato con la formattazione</div>
                      <div>Nell'email che si è aperta, clicca nel corpo del messaggio e incolla con <strong>Ctrl+V</strong> (Cmd+V su Mac): il grassetto viene mantenuto. L'oggetto è già compilato.</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 6, color: '#A32D2D' }}>Non sono riuscito a copiare il testo formattato</div>
                      <div>Ho aperto comunque l'email con il testo semplice, senza grassetto. Se preferisci, riprova con "Copia di nuovo".</div>
                    </>
                  )}
                  <div className="fs-12 text-muted" style={{ marginTop: 10 }}>Se l'email non si è aperta, usa "Apri email".</div>
                </div>
              ) : !editing ? (
                <>
                  <div className="fs-12 text-muted" style={{ marginBottom: 10 }}>Scegli un modello: il testo viene compilato con i dati del cliente e si apre il tuo programma di posta, dove puoi ancora modificarlo prima di inviare.</div>
                  {[{ id: '__vuota', nome: 'Email vuota', oggetto: 'Nessun testo preimpostato' }, ...templates].map(t => (
                    <div key={t.id} onClick={() => invia(t.id === '__vuota' ? null : t)}
                      style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 8, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-lt)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.nome}</div>
                      <div className="fs-12 text-muted">{t.oggetto}{t.corpo && haGrassetto(t.corpo) && <span style={{ marginLeft: 8, color: 'var(--accent-dk)', fontWeight: 600 }}>· con grassetto: il testo viene copiato, poi lo incolli</span>}</div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <button type="button" className="btn btn-sm" style={{ fontWeight: 800, minWidth: 30 }} title="Grassetto: seleziona il testo e premi B" onMouseDown={e => e.preventDefault()} onClick={() => grassetto(i)}>B</button>
                        <span className="fs-11 text-muted">Seleziona una parte del testo e premi B (oppure scrivi **così**)</span>
                      </div>
                      <textarea id={'tpl-corpo-' + i} className="form-control" style={{ minHeight: 170, lineHeight: 1.5 }} value={t.corpo} onChange={e => setCampo(i, 'corpo', e.target.value)} placeholder="Testo dell'email" />
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={aggiungi}>+ Nuovo modello</button>
                </>
              )}
            </div>

            <div className="modal-footer">
              {copiato && !editing ? (
                <>
                  <button type="button" className="btn" style={{ marginRight: 'auto' }} onClick={copiaDiNuovo}>Copia di nuovo</button>
                  <button type="button" className="btn" onClick={() => apriMail(`?subject=${encodeURIComponent(copiato.oggetto)}`)}>Apri email</button>
                  <button type="button" className="btn btn-primary" onClick={chiudi}>Chiudi</button>
                </>
              ) : !editing ? (
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
