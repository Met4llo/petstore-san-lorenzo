// Eseguire solo sul proprio computer o in un ambiente amministrativo fidato.
// La service_role non deve entrare nel repository né nel frontend.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validateConfig}=require('../shared/core.js');
const url=process.env.SL_SUPABASE_URL;
const key=process.env.SL_SERVICE_ROLE_KEY;
const adminEmail=process.env.SL_ADMIN_EMAIL;
if(!url || !key || !adminEmail)throw new Error('Configura SL_SUPABASE_URL, SL_SERVICE_ROLE_KEY e SL_ADMIN_EMAIL.');
validateConfig({supabaseUrl:url,publishableKey:'sb_publishable_validation',storeId:'san-lorenzo'});
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))throw new Error('Email amministratore non valida.');
const accounts=[
  ['Sepi','manager','sepi@san-lorenzo.petstore.invalid','SL_PASSWORD_SEPI'],
  ['Liborio','operator','liborio@san-lorenzo.petstore.invalid','SL_PASSWORD_LIBORIO'],
  ['Daniela','operator','daniela@san-lorenzo.petstore.invalid','SL_PASSWORD_DANIELA'],
  ['Francesco','operator','francesco@san-lorenzo.petstore.invalid','SL_PASSWORD_FRANCESCO'],
  ['Amministratore','admin',adminEmail,'SL_PASSWORD_ADMIN']
];
// Valida tutto prima di creare il primo account.
for(const [, , ,variable] of accounts){if(!process.env[variable] || process.env[variable].length<12)throw new Error(`${variable}: usa una password unica di almeno 12 caratteri.`);}
if(new Set(accounts.map(a=>process.env[a[3]])).size!==accounts.length)throw new Error('Le cinque password devono essere diverse.');
async function api(path,method,body){
  const response=await fetch(new URL(path,url),{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok)throw new Error(`Operazione amministrativa fallita (${response.status}). Verifica account esistenti e configurazione del nuovo progetto.`);
  return value;
}
for(const [name,role,email,variable] of accounts){
  const created=await api('/auth/v1/admin/users','POST',{email,password:process.env[variable],email_confirm:true});
  try {
    await api('/rest/v1/sl_profiles','POST',{user_id:created.id,store_id:'san-lorenzo',display_name:name,role,active:true});
  }catch(error){
    // Senza profilo l'utente non può leggere o scrivere i dati del negozio.
    console.error(`Profilo di ${name} non creato. L'account resta senza accesso: completa il profilo nel pannello Supabase prima di riprovare.`);
    throw error;
  }
  console.log(`${name}: account e permessi creati.`);
}
