import React, { useState, useEffect, useCallback } from 'react';
import { lsGet, lsSet, uid, parseDate, DEFAULT_STAGES, DEFAULT_BRAND, DEFAULT_GS, parseCSVRow } from './constants';
import { dbLoadContacts, dbSave, dbSaveMany, dbDelete, dbDeleteMany, dbUpdateHistory, supabase } from './supabase';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Contacts from './components/Contacts';
import Pipeline from './components/Pipeline';
import Appointments from './components/Appointments';
import FollowUps from './components/FollowUps';
import ChiusoPerMese from './components/ChiusoPerMese';
import ArchivioKO from './components/ArchivioKO';
import Calendly from './components/Calendly';
import Settings from './components/Settings';
import Modal from './components/Modal';
import Toast from './components/Toast';
import Login from './components/Login';
import GlobalSearch from './components/GlobalSearch';
import './App.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [pageFilter, setPageFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [stages, setStages] = useState(() => lsGet('crm_stages', DEFAULT_STAGES));
  const [customFields, setCustomFields] = useState(() => lsGet('crm_fields', []));
  const [brand, setBrand] = useState(() => lsGet('crm_brand', DEFAULT_BRAND));
  const [gsCfg, setGsCfg] = useState(() => lsGet('crm_gs', DEFAULT_GS));
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setAuthLoading(false);
      if (session) dbLoadContacts().then(data => { setContacts(data); setLoading(false); });
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) dbLoadContacts().then(data => setContacts(data));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { lsSet('crm_stages', stages); }, [stages]);
  useEffect(() => { lsSet('crm_fields', customFields); }, [customFields]);
  useEffect(() => { lsSet('crm_brand', brand); }, [brand]);
  useEffect(() => { lsSet('crm_gs', gsCfg); }, [gsCfg]);
  useEffect(() => { document.documentElement.style.setProperty('--accent', brand.color||'#c8102e'); document.title = brand.name+' — CRM'; }, [brand]);

  const showToast = useCallback((title, msg='') => {
    setToast({title,msg}); setTimeout(()=>setToast(null),4000);
  }, []);

  const today = new Date().toISOString().slice(0,10);
  const urgentFU = contacts.reduce((n,c)=>n+(c.history||[]).filter(h=>h.type==='note'&&h.followup&&h.followup<=today).length,0);
  const navigateTo = useCallback((p, filter=null) => { setPageFilter(filter); setPage(p); }, []);
  const logout = async () => { await supabase.auth.signOut(); setSession(null); setContacts([]); };

  // CRUD
  const saveContact = useCallback(async (data) => {
    const isNew = !contacts.find(c=>c.id===data.id);
    const contact = isNew ? {...data, id:uid(), history:[], customData:{}, contratti:[], testoProposta:'', noteInterne:''} : data;
    setContacts(prev => { const idx=prev.findIndex(c=>c.id===contact.id); if(idx>=0){const n=[...prev];n[idx]=contact;return n;} return [...prev,contact]; });
    await dbSave(contact); showToast('Contatto salvato', contact.nome);
  }, [contacts, showToast]);

  const deleteContact = useCallback(async (id) => {
    setContacts(prev=>prev.filter(c=>c.id!==id)); await dbDelete(id); showToast('Contatto eliminato');
  }, [showToast]);

  const deleteContacts = useCallback(async (ids) => {
    setContacts(prev=>prev.filter(c=>!ids.has(c.id))); await dbDeleteMany(ids); showToast(`${ids.size} contatti eliminati`);
  }, [showToast]);

  const updateContact = useCallback(async (id, updater) => {
    let updated;
    setContacts(prev=>prev.map(c=>{if(c.id!==id)return c;updated=updater(c);return updated;}));
    if(updated) await dbSave(updated);
  }, []);

  const batchUpdate = useCallback(async (updater) => {
    let result;
    setContacts(prev=>{result=updater(prev);return result;});
    if(result) await dbSaveMany(result);
  }, []);

  // Google Sheet sync — preserves existing followups, never restores deleted ones
  const syncFromGoogleSheet = useCallback(async () => {
    const {sheetId,apiKey,tabName}=gsCfg;
    if(!sheetId||!apiKey) return {error:'Credenziali mancanti'};
    const url=`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName||'Sheet1')}?key=${apiKey}`;
    try {
      const r=await fetch(url); const data=await r.json();
      if(data.error) return {error:data.error.message};
      const rows=data.values||[];
      if(rows.length<2) return {imported:0,skipped:0,updated:0};
      const header=rows[0].map(h=>h.toLowerCase().trim());
      const cp=names=>{for(const n of names){const i=header.findIndex(h=>h.includes(n));if(i>=0)return i;}return -1;};
      const g=(row,i)=>i>=0?(row[i]||'').trim():'';
      const iNome=cp(['nome']); const iCat=cp(['categoria']); const iEmail=cp(['email']);
      const iTel=cp(['telefono','tel']); const iAz=cp(['azienda','studio']);
      const iFonte=cp(['fonte']); const iData=cp(['data app']);
      const iStato=cp(['stato app']); const iProp=cp(['proposta inviata','proposta']);
      const iEsito=cp(['esito']); const iFu=cp(['follow up','follow-up']); const iNote=cp(['note app','note']);
      const statoMap={'svolto':'Svolto','non si è presentato':'Non si è presentato','non effettuato':'Non effettuato','da rifissare':'Da rifissare','programmato':'Programmato'};
      let imported=0,skipped=0,updated=0;
      const todayStr=new Date().toISOString().slice(0,10);
      const toInsert=[],toUpdateHist=[];
      const current=[...contacts];
      for(let i=1;i<rows.length;i++){
        const row=rows[i]; const nome=g(row,iNome); if(!nome){skipped++;continue;}
        const email=g(row,iEmail);
        const existingIdx=current.findIndex(c=>(email&&c.email&&c.email.toLowerCase()===email.toLowerCase())||c.nome.toLowerCase()===nome.toLowerCase());
        const dataRaw=g(row,iData); const noteRaw=g(row,iNote);
        const fu=parseDate(g(row,iFu));
        const statoRaw=g(row,iStato).toLowerCase();
        const stato=statoMap[statoRaw]||'Programmato';
        // New appt always Programmato, empty esito
        const newHist=[];
        if(dataRaw) newHist.push({id:uid(),type:'appt',date:parseDate(dataRaw)||dataRaw,stato:'Programmato',esito:''});
        // Only add follow-up if not already present (prevents restoring deleted ones)
        if(existingIdx>=0){
          const ex=current[existingIdx];
          const existingDates=(ex.history||[]).filter(h=>h.type==='appt').map(h=>h.date.slice(0,10));
          const newDate=dataRaw?(parseDate(dataRaw)||dataRaw).slice(0,10):'';
          const existingFuDates=(ex.history||[]).filter(h=>h.type==='note'&&h.followup).map(h=>h.followup);
          const histToAdd=[...newHist];
          // Only add follow-up if it doesn't already exist in history
          if(fu&&!existingFuDates.includes(fu)){
            histToAdd.push({id:uid(),type:'note',date:todayStr,text:noteRaw||'Follow-up da importazione',followup:fu});
          }
          if(newDate&&!existingDates.includes(newDate)){
            const updatedHist=[...(ex.history||[]),...histToAdd];
            current[existingIdx]={...ex,history:updatedHist};
            toUpdateHist.push({id:ex.id,history:updatedHist});
            updated++;
          } else {skipped++;}
        } else {
          const fase=stages[1]?.name||'Appuntamento';
          const fuHist=fu?[{id:uid(),type:'note',date:todayStr,text:noteRaw||'Follow-up da importazione',followup:fu}]:[];
          const nc={id:uid(),nome,azienda:g(row,iAz),email,telefono:g(row,iTel),categoria:g(row,iCat),fase,fonte:g(row,iFonte)||'Calendly',esito:'',proposta:'',importoProposta:0,dataChiusura:'',contratti:[],testoProposta:'',noteInterne:'',history:[...newHist,...fuHist],customData:{}};
          current.push(nc); toInsert.push(nc); imported++;
        }
      }
      await Promise.all(toUpdateHist.map(u=>dbUpdateHistory(u.id,u.history)));
      if(toInsert.length) await dbSaveMany(toInsert);
      const fresh=await dbLoadContacts();
      setContacts(fresh);
      if(imported>0||updated>0) showToast('Sincronizzazione completata',`${imported} nuovi, ${updated} aggiornati`);
      return {imported,skipped,updated};
    } catch(e){return {error:e.message};}
  },[gsCfg,stages,contacts,showToast]);

  const importFromCSV = useCallback(async (rows) => {
    let imported=0,skipped=0; const toInsert=[];
    for(const row of rows){
      const contact=parseCSVRow(row,stages); if(!contact){skipped++;continue;}
      const exists=contacts.find(c=>(contact.email&&c.email&&c.email.toLowerCase()===contact.email.toLowerCase())||c.nome.toLowerCase()===contact.nome.toLowerCase());
      if(exists){skipped++;continue;}
      toInsert.push(contact); imported++;
    }
    if(toInsert.length){setContacts(prev=>[...prev,...toInsert]);await dbSaveMany(toInsert);}
    showToast(`${imported} contatti importati`,skipped>0?`${skipped} duplicati ignorati`:'');
    return {imported,skipped};
  },[contacts,stages,showToast]);

  const sharedProps = {
    contacts,stages,customFields,brand,gsCfg,
    setContacts:batchUpdate,setContactsDirect:setContacts,
    setStages,setCustomFields,setBrand,setGsCfg,
    saveContact,deleteContact,deleteContacts,updateContact,
    syncFromGoogleSheet,importFromCSV,
    setModal,showToast,today,navigateTo,pageFilter,setPageFilter,
  };

  const pages={dashboard:Dashboard,contacts:Contacts,pipeline:Pipeline,appointments:Appointments,followups:FollowUps,chiuso:ChiusoPerMese,archivio:ArchivioKO,calendly:Calendly,settings:Settings};
  const Page=pages[page]||Dashboard;

  if(authLoading) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
      <div style={{width:36,height:36,border:'3px solid #f0efe9',borderTop:'3px solid #c8102e',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(!session) return <Login onLogin={s=>setSession(s)}/>;

  if(loading) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16,fontFamily:'DM Sans, sans-serif'}}>
      <div style={{width:36,height:36,border:'3px solid #f0efe9',borderTop:'3px solid #c8102e',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{color:'#6B6B6B',fontSize:14}}>Caricamento CRM...</span>
    </div>
  );

  return(
    <div className="app">
      <Sidebar page={page} setPage={setPage} brand={brand} urgentFU={urgentFU}/>
      <main className="main">
        <Page {...sharedProps}/>
      </main>
      <div style={{position:'fixed',top:10,right:60,zIndex:30}}>
        <GlobalSearch contacts={contacts} stages={stages} setModal={setModal} navigateTo={navigateTo}/>
      </div>
      {modal&&<Modal modal={modal} setModal={setModal} {...sharedProps}/>}
      {toast&&<Toast toast={toast}/>}
      <button onClick={logout} style={{position:'fixed',bottom:16,right:16,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'6px 12px',fontSize:12,cursor:'pointer',color:'var(--text2)',zIndex:20}}>Esci</button>
    </div>
  );
}
