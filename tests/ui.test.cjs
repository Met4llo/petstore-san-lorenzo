const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');const html=fs.readFileSync(path.join(root,'shared/index.html'),'utf8');
class Element{
 constructor(){this.hidden=false;this.children=[];this.value='';this.textContent='';this.dataset={};this.selectedOptions=[{textContent:'Senza data'}];this.classList={toggle(){},add(){},remove(){}};}
 append(...items){this.children.push(...items)}replaceChildren(...items){this.children=items}setAttribute(){}addEventListener(){}focus(){}close(){this.open=false}showModal(){this.open=true}querySelectorAll(){return []}
}
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
elements.get('filter').value='no-date';const storage=new Map();const context={window:{PetStoreCore:require('../shared/core.js'),PETSTORE_CONFIG:JSON.parse(fs.readFileSync(path.join(root,'stores/san-lorenzo.json'),'utf8')),addEventListener(){}},document:{getElementById:id=>{assert(elements.has(id),id);return elements.get(id)},createElement:()=>new Element(),querySelectorAll:()=>[],addEventListener(){},documentElement:new Element()},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setInterval(){},setTimeout(){},clearTimeout(){},console,URL,Date,Map,structuredClone,crypto:require('node:crypto').webcrypto};
vm.createContext(context);let source=fs.readFileSync(path.join(root,'shared/app.js'),'utf8');source=source.replace(/init\(\);\s*$/,'');vm.runInContext(source,context);
vm.runInContext("wire();user={id:'test'};profile={role:'admin'};products=[{ean:'1234567890123',name:'Test',supplier:'Fornitore',note:'',expiry:null}];state={rows:[],pending:[]};render();",context);
assert.equal(elements.get('stats').children.length,5);assert.equal(elements.get('products').children.length,1);
for(const view of ['home','scanner','products','settings']){vm.runInContext(`navigate('${view}')`,context);for(const name of ['home','scanner','products','settings'])assert.equal(elements.get('view-'+name).hidden,name!==view);}
vm.runInContext("showLogin('Sepi')",context);assert.equal(elements.get('operator-grid').hidden,true);assert.equal(elements.get('login-name').textContent,'Sepi');assert.equal(elements.get('admin-email-label').hidden,true);
vm.runInContext('showLogin(null)',context);assert.equal(elements.get('admin-email-label').hidden,false);
console.log('Interfaccia: navigazione, Home, schede prodotto e accesso operatore/amministratore verificati con DOM simulato.');
