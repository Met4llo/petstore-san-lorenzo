/* San Lorenzo: client dedicato. Non importa né modifica l'app di La Malfa. */
'use strict';
const C = window.PetStoreCore;
const config = window.PETSTORE_CONFIG;
const $ = id => document.getElementById(id);
let client, db, catalog = [], accessories = [], conditions = {}, suppliers = [];
let profile = null, user = null, state = {rows:[],pending:[]}, products = [], selected = null;
let loginName = null, syncRunning = false, scanner = null, limit = 100, generation = 0, timer;
const backendScope = () => new URL(config.supabaseUrl).hostname;
const cacheKey = () => `${backendScope()}:${config.storeId}:${user.id}`;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(timer); timer = setTimeout(()=>{$('toast').hidden=true;},5000); }
function requireUser() { if (!user || !profile) throw new Error('Accedi prima di continuare.'); }
function refresh() { products = C.merge(catalog,state.rows,state.pending,accessories); render(); $('queue-count').textContent = state.pending.length ? `${state.pending.length} modifiche in attesa` : 'Tutto inviato'; }
function openDB() { return new Promise((resolve,reject)=>{ const req=indexedDB.open('PetStoreSecure-'+config.storeId,1); req.onupgradeneeded=()=>req.result.createObjectStore('snapshots'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
function readSnapshot(key) { return new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readonly');const req=tx.objectStore('snapshots').get(key);req.onsuccess=()=>resolve(req.result || {rows:[],pending:[]});req.onerror=()=>reject(req.error);}); }
function persist(next = state, key = cacheKey()) { const snapshot=structuredClone(next); return new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(snapshot,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('Memoria locale non disponibile'));}); }
async function fetchAll(table) { const rows=[];for(let offset=0;;offset+=1000){const {data,error}=await client.from(table).select('*').eq('store_id',C.STORE).order('ean').range(offset,offset+999);if(error)throw error;rows.push(...data);if(data.length<1000)return rows;} }
function showLogin(name) { loginName=name; $('login-form').hidden=false;$('login-name').textContent=name || 'Amministratore';$('admin-email-label').hidden=!!name;$('admin-email').required=!name;$('password').value='';$('login-status').textContent='';$('password').focus(); }
function hideAccount() { $('workspace').hidden=true;$('login').hidden=false;$('products').replaceChildren();$('messages').replaceChildren();$('history').replaceChildren();$('detail').close();$('identity').textContent='';$('queue-count').textContent='';$('sync-status').textContent='';selected=null;state={rows:[],pending:[]};products=[];user=null;profile=null; }
async function signOut() {
  if(syncRunning) {toast('Attendi la fine della sincronizzazione prima di cambiare operatore.');return;}
  generation++; await stopScanner();hideAccount();$('login-form').hidden=true;
  const {error}=await client.auth.signOut({scope:'local'});if(error)toast('Sessione locale chiusa; uscita dal server non riuscita.');
}
async function acceptSession(authUser, expectedName = null) {
  const {data,error}=await client.from('sl_profiles').select('*').eq('user_id',authUser.id).eq('store_id',C.STORE).eq('active',true).single();
  if(error || !data || (expectedName ? data.display_name!==expectedName || data.role==='admin' : data.role!=='admin')) throw new Error('Account non autorizzato per questo accesso.');
  const epoch=++generation;user=authUser;profile=data;
  try {state=await readSnapshot(cacheKey());} catch {hideAccount();throw new Error('Memoria locale non disponibile. Accesso interrotto.');}
  if(epoch!==generation)return;
  $('login').hidden=true;$('workspace').hidden=false;$('login-form').hidden=true;$('password').value='';
  $('identity').textContent=profile.display_name+(profile.role==='manager'?' · Responsabile':profile.role==='admin'?' · Amministratore':'');
  $('admin-note').hidden=profile.role!=='admin';refresh();await sync();
}
async function login(event) {
  event.preventDefault();if(!client)return;$('login-submit').disabled=true;$('login-status').textContent='Accesso in corso…';
  try {
    const email=loginName ? config.operators[loginName] : $('admin-email').value.trim();
    const {data,error}=await client.auth.signInWithPassword({email,password:$('password').value});
    if(error)throw new Error('Accesso non riuscito. Controlla la password e la connessione.');
    try {await acceptSession(data.user,loginName);} catch(error){await client.auth.signOut({scope:'local'});hideAccount();throw error;}
    $('login-status').textContent='';
  } catch(error) {$('login-status').textContent=error.message;} finally {$('password').value='';$('login-submit').disabled=false;}
}
async function sync() {
  if(syncRunning || !user)return;
  syncRunning=true;const epoch=generation;$('sync').disabled=true;$('save').disabled=true;$('sync-status').textContent='Sincronizzazione in corso…';
  try {
    const {data:verified,error:authError}=await client.auth.getUser();
    if(authError || verified.user?.id!==user.id)throw new Error('Verifica dell’accesso non riuscita. Collegati alla rete e accedi nuovamente.');
    for(const op of [...state.pending]) {
      const {data,error}=await client.rpc('sl_save_product',{p_store:C.STORE,p_product:C.toPayload(op.product),p_expected_version:op.expectedVersion});
      if(epoch!==generation)return;
      if(error) {
        const pending=state.pending.map(item=>item.id===op.id?{...item,error:error.message}:item);
        const next={...state,pending};await persist(next);state=next;
        // Conserva il payload locale: nessuna lettura cloud lo sovrascrive.
        throw new Error(/CONFLICT/.test(error.message)?'Conflitto: un collega ha modificato un prodotto. Aprilo per confrontare i dati.':error.message);
      }
      const row=Array.isArray(data)?data[0]:data;
      const next={rows:[...state.rows.filter(r=>r.ean!==row.ean),row],pending:C.acknowledge(state.pending,op.id)};
      await persist(next);state=next;
    }
    const rows=await fetchAll('sl_products');if(epoch!==generation)return;
    const next={...state,rows};await persist(next);state=next;
    await loadMessages(epoch);
    $('sync-status').textContent='Sincronizzato alle '+new Date().toLocaleTimeString('it-IT');
  } catch(error) {if(epoch===generation)$('sync-status').textContent='Sincronizzazione incompleta: '+error.message;}
  finally {syncRunning=false;$('sync').disabled=false;$('save').disabled=false;if(user && epoch===generation)refresh();}
}
function filtered() {return products.filter(p=>C.matches(p,$('filter').value,$('search').value.trim(),$('supplier').value)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','it'));}
function badge(p) { if(p.absent)return ['Non in negozio',''];if(p.noExpiry)return ['Senza scadenza',''];if(p.managed)return ['Gestito','managed'];const n=C.days(p.expiry);if(n===null)return ['Senza data',''];if(p.signaled)return ['Segnalato','managed'];if(n<=0)return [n===0?'Scaduto oggi':`Scaduto da ${-n} giorni`,'expired'];return [`${n} giorni`,n<=7?'urgent':'']; }
function render() {
  if(!user)return;const visible=filtered();$('list-count').textContent=`${visible.length} prodotti · ${Math.min(limit,visible.length)} visualizzati`;
  const frag=document.createDocumentFragment();visible.slice(0,limit).forEach(p=>{const b=document.createElement('button');b.className='product';const title=document.createElement('h3');title.textContent=p.name;b.append(title);const meta=document.createElement('div');meta.className='meta';meta.textContent=p.ean+' · '+p.supplier;b.append(meta);const [text,style]=badge(p);const tag=document.createElement('span');tag.className='badge '+style;tag.textContent=text;b.append(tag);if(state.pending.some(op=>op.product.ean===p.ean)){const pending=document.createElement('p');pending.className='meta';pending.textContent='Modifica in attesa di invio';b.append(pending);}b.onclick=()=>openProduct(p);frag.append(b);});$('products').replaceChildren(frag);$('show-more').hidden=visible.length<=limit;
  const stats=[['Scaduti',products.filter(p=>C.matches(p,'expired','','')).length],['Entro 7 giorni',products.filter(p=>C.matches(p,'urgent','','')).length],['Senza data',products.filter(p=>C.matches(p,'no-date','','')).length]];
  $('stats').replaceChildren(...stats.map(([label,n])=>{const el=document.createElement('div');el.className='stat';const strong=document.createElement('strong');strong.textContent=n;el.append(strong,document.createTextNode(label));return el;}));
}
function conditionText() {const s=$('detail-supplier').value;const match=Object.entries(conditions).find(([key])=>key===s || s.includes(key));$('supplier-condition').textContent=match?'Condizioni fornitore: '+(typeof match[1]==='string'?match[1]:JSON.stringify(match[1])):'';}
async function openProduct(p) {
  requireUser();selected={...p};$('detail-title').textContent=p.name || 'Nuovo prodotto';$('ean').value=p.ean || '';$('ean').readOnly=!!p.ean;
  $('name').value=p.name || '';$('detail-supplier').value=p.supplier || '';$('expiry').value=p.expiry || '';$('no-expiry').checked=!!p.noExpiry;$('expiry').disabled=!!p.noExpiry;$('state').value=p.managed?'managed':p.signaled?'signaled':'';$('absent').checked=!!p.absent;$('note').value=p.note || '';$('detail-status').textContent='';$('history').replaceChildren();conditionText();
  const op=state.pending.find(x=>x.product.ean===p.ean);$('discard-pending').hidden=!op;
  if(op?.error)$('detail-status').textContent=op.error;
  if(!$('detail').open)$('detail').showModal();
  if(!p.ean)return;const epoch=generation;const {data,error}=await client.from('sl_product_log').select('actor_name,changed_at,old_value,new_value').eq('store_id',C.STORE).eq('ean',p.ean).order('id',{ascending:false}).limit(20);
  if(epoch!==generation || selected?.ean!==p.ean)return;
  if(error){$('history').textContent='Storico non disponibile: '+error.message;return;}
  $('history').replaceChildren(...data.map(row=>{const div=document.createElement('div');div.className='history-row';const old=row.old_value;const next=row.new_value;div.textContent=`${row.actor_name} · ${new Date(row.changed_at).toLocaleString('it-IT')} · Scadenza: ${old?.expiry || 'nessuna'} → ${next.expiry || 'nessuna'} · Stato: ${next.managed?'gestito':next.signaled?'segnalato':'da controllare'} · Note: ${next.note || 'nessuna'}`;return div;}));
}
async function saveProduct(event) {
  event.preventDefault();if(syncRunning){toast('Attendi la sincronizzazione.');return;}requireUser();const epoch=generation;
  try {
    const product=C.normalize({...selected,ean:$('ean').value,name:$('name').value,supplier:$('detail-supplier').value,expiry:$('expiry').value || null,noExpiry:$('no-expiry').checked,signaled:$('state').value!=='',managed:$('state').value==='managed',absent:$('absent').checked,note:$('note').value});
    if(!selected.ean && products.some(p=>p.ean===product.ean))throw new Error('Questo EAN esiste già. Apri il prodotto dalla ricerca.');
    if(state.pending.find(op=>op.product.ean===product.ean)?.error?.includes('CONFLICT'))throw new Error('Confronta i dati del collega prima di sostituire una modifica in conflitto.');
    const next={...state,pending:C.enqueue(state.pending,product,crypto.randomUUID())};await persist(next);if(epoch!==generation)return;state=next;refresh();$('detail').close();toast('Salvato su questo dispositivo. Invio al negozio in corso.');await sync();
  } catch(error){$('detail-status').textContent=error.message;}
}
async function discardPending() {
  if(syncRunning || !selected)return;const ean=selected.ean;const epoch=generation;
  try {
    const {data,error}=await client.from('sl_products').select('*').eq('store_id',C.STORE).eq('ean',ean).maybeSingle();if(error)throw error;if(epoch!==generation)return;
    const remote=data?C.fromRow(data):catalog.find(p=>p.ean===ean);
    const summary=remote?`Scadenza del negozio: ${remote.expiry || 'nessuna'}\nStato: ${remote.managed?'gestito':remote.signaled?'segnalato':'da controllare'}\nNote: ${remote.note || 'nessuna'}`:'Prodotto non ancora presente nel negozio.';
    if(!confirm(summary+'\n\nScartare la tua modifica locale? Puoi poi riaprire e modificare il prodotto.'))return;
    const next={rows:data?[...state.rows.filter(r=>r.ean!==ean),data]:state.rows.filter(r=>r.ean!==ean),pending:state.pending.filter(op=>op.product.ean!==ean)};await persist(next);state=next;refresh();$('detail').close();toast('Modifica locale scartata. Dati del negozio ricaricati.');
  } catch(error){$('detail-status').textContent='Confronto non riuscito: '+error.message;}
}
async function loadMessages(epoch=generation) {
  const {data,error}=await client.from('sl_messages').select('id,body,created_at,author_id').eq('store_id',C.STORE).order('id',{ascending:false}).limit(100);if(error)throw error;if(epoch!==generation || !user)return;
  $('messages').replaceChildren(...data.map(row=>{const el=document.createElement('article');el.className='message';const body=document.createElement('p');body.textContent=row.body;const date=document.createElement('small');date.textContent=new Date(row.created_at).toLocaleString('it-IT');el.append(body,date);return el;}));
}
async function stopScanner() {if(scanner){try{await scanner.stop();}catch{}try{scanner.clear();}catch{}scanner=null;}$('scanner').hidden=true;}
async function startScanner() {
  requireUser();if(scanner)return;const epoch=generation;
  try {if(!window.Html5Qrcode)throw new Error('Scanner non disponibile. Usa la ricerca manuale.');$('scanner').hidden=false;scanner=new Html5Qrcode('reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:140}},async text=>{if(epoch!==generation)return;const code=text.trim();const p=products.find(p=>p.ean===code);await stopScanner();if(p)openProduct(p);else{$('search').value=code;$('filter').value='all';render();toast('EAN non trovato. Puoi aggiungere il prodotto.');}},()=>{});}catch(error){await stopScanner();toast('Fotocamera: '+error.message);}
}
function download(name,body,type) {const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function changePassword(event) {
  event.preventDefault();requireUser();const button=event.submitter;button.disabled=true;const epoch=generation;
  try {const next=$('new-password').value;if(next.length<12 || next!==$('confirm-password').value)throw new Error('Usa almeno 12 caratteri e verifica la conferma.');const {data,error}=await client.auth.signInWithPassword({email:user.email,password:$('old-password').value});if(error || data.user?.id!==user.id)throw new Error('Password attuale non corretta o connessione non disponibile.');if(epoch!==generation)return;const result=await client.auth.updateUser({password:next});if(result.error)throw result.error;event.target.reset();toast('Password aggiornata.');}catch(error){toast(error.message);}finally{button.disabled=false;}
}
function wire() {
  document.querySelectorAll('[data-operator]').forEach(b=>b.onclick=()=>showLogin(b.dataset.operator));$('admin-login').onclick=()=>showLogin(null);$('login-back').onclick=()=>{$('login-form').hidden=true;$('password').value='';};$('login-form').onsubmit=login;$('logout').onclick=signOut;$('sync').onclick=sync;
  ['search','filter','supplier'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{limit=100;render();}));$('show-more').onclick=()=>{limit+=100;render();};
  $('add-product').onclick=()=>openProduct({version:0});$('product-form').onsubmit=saveProduct;$('close-detail').onclick=()=>{$('detail').close();selected=null;};$('discard-pending').onclick=discardPending;
  $('no-expiry').onchange=()=>{$('expiry').disabled=$('no-expiry').checked;if($('no-expiry').checked){$('expiry').value='';$('state').value='';}};$('detail-supplier').onchange=conditionText;
  $('scan').onclick=startScanner;$('stop-scan').onclick=stopScanner;
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=async()=>{await stopScanner();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));['products','board','settings'].forEach(view=>$('view-'+view).hidden=view!==button.dataset.view);if(button.dataset.view==='board')try{await loadMessages();}catch(error){toast(error.message);}});
  $('message-form').onsubmit=async event=>{event.preventDefault();requireUser();const epoch=generation;event.submitter.disabled=true;try{const {error}=await client.from('sl_messages').insert({store_id:C.STORE,author_id:user.id,body:$('message').value.trim()});if(error)throw error;if(epoch!==generation)return;$('message').value='';await loadMessages();toast('Messaggio pubblicato.');}catch(error){toast('Messaggio non pubblicato: '+error.message);}finally{event.submitter.disabled=false;}};
  $('password-form').onsubmit=changePassword;$('print').onclick=()=>window.print();
  $('export-csv').onclick=()=>{requireUser();const rows=[['EAN','Nome','Fornitore','Scadenza','Segnalato','Gestito','Senza scadenza','Non in negozio','Note'],...filtered().map(p=>[p.ean,p.name,p.supplier,p.expiry,p.signaled,p.managed,p.noExpiry,p.absent,p.note])];download('san-lorenzo-scadenze.csv','\ufeff'+rows.map(row=>row.map(C.csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');};
  $('backup').onclick=()=>{requireUser();download('san-lorenzo-backup.json',JSON.stringify({format:1,storeId:C.STORE,exportedAt:new Date().toISOString(),rows:state.rows,pending:state.pending},null,2),'application/json');};
  window.addEventListener('online',()=>sync());document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScanner();else sync();});setInterval(()=>{if(!document.hidden)sync();},300000);
}
async function init() {
  wire();try {
    C.validateConfig(config);if(!window.supabase)throw new Error('Libreria di accesso non disponibile. Verifica la connessione.');
    client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{storageKey:'petstore-'+config.storeId+'-auth-'+backendScope(),persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});db=await openDB();
    const resources=await Promise.all(['products.json','accessory-eans.json','supplier-conditions.json','suppliers.json'].map(async file=>{const r=await fetch(file);if(!r.ok)throw new Error('Impossibile caricare '+file);return r.json();}));
    [catalog,accessories,conditions]=resources;suppliers=[...new Set(catalog.map(p=>p.supplier).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it'));
    for(const id of ['supplier','detail-supplier']){for(const supplier of suppliers){const option=document.createElement('option');option.value=supplier;option.textContent=supplier;$(id).append(option);}}
    client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT' && user){generation++;stopScanner();hideAccount();}});
    // Nessuna identità viene ricavata da un nome salvato in localStorage.
    const {data}=await client.auth.getSession();if(data.session){const verified=await client.auth.getUser();if(verified.data.user){const p=await client.from('sl_profiles').select('display_name,role').eq('user_id',verified.data.user.id).single();if(p.data)await acceptSession(verified.data.user,p.data.role==='admin'?null:p.data.display_name);}}
    if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  }catch(error){hideAccount();$('login-status').textContent=error.message;$('login-submit').disabled=true;}
}
init();
