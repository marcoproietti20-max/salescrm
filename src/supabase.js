import { createClient } from '@supabase/supabase-js';

const URL = 'https://cgqklzuxvjtwbcnzbcwl.supabase.co';
const KEY = 'sb_publishable_L-mueqd5RFFTzmooKsHITA_pC7ZoR6U';
export const supabase = createClient(URL, KEY);

function toDb(c) {
  return {
    id: c.id,
    nome: c.nome || '',
    azienda: c.azienda || null,
    email: c.email || null,
    telefono: c.telefono || null,
    fase: c.fase || null,
    fonte: c.fonte || null,
    categoria: c.categoria || null,
    esito: c.esito || null,
    proposta: c.proposta || null,
    importo_proposta: Number(c.importoProposta) || 0,
    data_chiusura: c.dataChiusura || null,
    contratti: c.contratti || [],
    testo_proposta: c.testoProposta || null,
    note_interne: c.noteInterne || null,
    history: c.history || [],
    custom_data: c.customData || {},
    updated_at: new Date().toISOString(),
  };
}

function fromDb(r) {
  return {
    id: r.id,
    nome: r.nome || '',
    azienda: r.azienda || '',
    email: r.email || '',
    telefono: r.telefono || '',
    fase: r.fase || '',
    fonte: r.fonte || '',
    categoria: r.categoria || '',
    esito: r.esito || '',
    proposta: r.proposta || '',
    importoProposta: r.importo_proposta || 0,
    dataChiusura: r.data_chiusura || '',
    contratti: r.contratti || [],
    testoProposta: r.testo_proposta || '',
    noteInterne: r.note_interne || '',
    history: r.history || [],
    customData: r.custom_data || {},
  };
}

export async function dbLoadContacts() {
  const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return (data || []).map(fromDb);
}

export async function dbSave(contact) {
  const { error } = await supabase.from('contacts').upsert(toDb(contact), { onConflict: 'id' });
  if (error) console.error('dbSave:', error);
}

export async function dbSaveMany(contacts) {
  if (!contacts.length) return;
  const { error } = await supabase.from('contacts').upsert(contacts.map(toDb), { onConflict: 'id' });
  if (error) console.error('dbSaveMany:', error);
}

export async function dbDelete(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) console.error('dbDelete:', error);
}

export async function dbDeleteMany(ids) {
  const { error } = await supabase.from('contacts').delete().in('id', [...ids]);
  if (error) console.error('dbDeleteMany:', error);
}

// Update only history for existing contacts (preserves contratti etc)
export async function dbUpdateHistory(id, history) {
  const { error } = await supabase.from('contacts')
    .update({ history, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('dbUpdateHistory:', error);
}
