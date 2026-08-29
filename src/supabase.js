import { createClient } from '@supabase/supabase-js';
const URL = 'https://cgqklzuxvjtwbcnzbcwl.supabase.co';
const KEY = 'sb_publishable_L-mueqd5RFFTzmooKsHITA_pC7ZoR6U';
export const supabase = createClient(URL, KEY);
function toDb(c) {
  return {
    id:c.id, nome:c.nome||'', azienda:c.azienda||null, email:c.email||null, telefono:c.telefono||null,
    fase:c.fase||null, fonte:c.fonte||null, categoria:c.categoria||null, esito:c.esito||null,
    proposta:c.proposta||null, importo_proposta:Number(c.importoProposta)||0,
    data_chiusura:c.dataChiusura||null, contratti:c.contratti||[], testo_proposta:c.testoProposta||null,
    note_interne:c.noteInterne||null, history:c.history||[], custom_data:c.customData||{},
    updated_at:new Date().toISOString(),
  };
}
function fromDb(r) {
  return {
    id:r.id, nome:r.nome||'', azienda:r.azienda||'', email:r.email||'', telefono:r.telefono||'',
    fase:r.fase||'', fonte:r.fonte||'', categoria:r.categoria||'', esito:r.esito||'',
    proposta:r.proposta||'', importoProposta:r.importo_proposta||0, dataChiusura:r.data_chiusura||'',
    contratti:r.contratti||[], testoProposta:r.testo_proposta||'', noteInterne:r.note_interne||'',
    history:r.history||[], customData:r.custom_data||{},
  };
}
export async function dbLoadContacts() {
  const {data,error}=await supabase.from('contacts').select('*').order('created_at',{ascending:true});
  if(error){console.error(error);return[];}
  return (data||[]).map(fromDb);
}
export async function dbSave(contact) {
  const {error}=await supabase.from('contacts').upsert(toDb(contact),{onConflict:'id'});
  if(error) console.error('dbSave:',error);
}
export async function dbSaveMany(contacts) {
  if(!contacts.length) return;
  const {error}=await supabase.from('contacts').upsert(contacts.map(toDb),{onConflict:'id'});
  if(error) console.error('dbSaveMany:',error);
}
export async function dbDelete(id) {
  const {error}=await supabase.from('contacts').delete().eq('id',id);
  if(error) console.error('dbDelete:',error);
}
export async function dbDeleteMany(ids) {
  const {error}=await supabase.from('contacts').delete().in('id',[...ids]);
  if(error) console.error('dbDeleteMany:',error);
}
export async function dbUpdateHistory(id, history) {
  const {error}=await supabase.from('contacts').update({history,updated_at:new Date().toISOString()}).eq('id',id);
  if(error) console.error('dbUpdateHistory:',error);
}
export async function dbLoadBookingsInbox() {
  const {data,error}=await supabase.from('bookings_inbox').select('*').eq('processato',false).order('created_at',{ascending:true});
  if(error){console.error('dbLoadBookingsInbox:',error);return null;}
  return data||[];
}
export async function dbMarkBookingsProcessed(ids) {
  if(!ids.length) return;
  const {error}=await supabase.from('bookings_inbox').update({processato:true}).in('id',ids);
  if(error) console.error('dbMarkBookingsProcessed:',error);
}
export async function dbLoadProfile() {
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return null;
  const {data,error}=await supabase.from('profiles').select('*').eq('id',user.id).single();
  if(error){console.error('dbLoadProfile:',error);return null;}
  return data;
}
export async function dbLoadLeads() {
  const {data,error}=await supabase.from('leads').select('*').order('created_at',{ascending:true});
  if(error){console.error('dbLoadLeads:',error);return null;}
  return data||[];
}
export async function dbInsertLeads(rows) {
  if(!rows.length) return [];
  const {data,error}=await supabase.from('leads').insert(rows).select('id');
  if(error){console.error('dbInsertLeads:',error);return null;}
  return data.map(r=>r.id);
}
export async function dbUpdateLead(id, fields) {
  const {error}=await supabase.from('leads').update(fields).eq('id',id);
  if(error){console.error('dbUpdateLead:',error);return false;}
  return true;
}
export async function dbDeleteLeads(ids) {
  if(!ids.length) return true;
  const {error}=await supabase.from('leads').delete().in('id',ids);
  if(error){console.error('dbDeleteLeads:',error);return false;}
  return true;
}
export function normPhone(t) {
  if(!t) return '';
  let n=String(t).replace(/[^0-9+]/g,'');
  if(n.startsWith('00')) n='+'+n.slice(2);
  if(n.startsWith('+39')) n=n.slice(3);
  else if(n.startsWith('+')) n=n.slice(1);
  return n;
}
export async function dbLoadImportBatches() {
  const {data,error}=await supabase.from('import_batches').select('*').order('created_at',{ascending:false});
  if(error){console.error('dbLoadImportBatches:',error);return null;}
  return data||[];
}
export async function dbCreateImportBatch(lista, leadIds) {
  const {error}=await supabase.from('import_batches').insert({lista, lead_ids: leadIds, count: leadIds.length});
  if(error) console.error('dbCreateImportBatch:',error);
}
export async function dbUndoImportBatch(batch) {
  const ok = await dbDeleteLeads(batch.lead_ids);
  if(!ok) return false;
  const {error}=await supabase.from('import_batches').delete().eq('id',batch.id);
  if(error){console.error('dbUndoImportBatch:',error);return false;}
  return true;
}
