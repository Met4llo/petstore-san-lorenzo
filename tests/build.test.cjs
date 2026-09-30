const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
let count=0;async function build(){await import(pathToFileURL(path.join(root,'scripts/build.mjs')).href+'?test='+count++);}
(async()=>{await build();const out=path.join(root,'dist/san-lorenzo');const first=fs.readFileSync(path.join(out,'release.json'),'utf8');await build();assert.equal(fs.readFileSync(path.join(out,'release.json'),'utf8'),first);
assert(!fs.existsSync(path.join(root,'dist/la-malfa')));
const scripts=fs.readFileSync(path.join(out,'index.html'),'utf8').matchAll(/(?:src|href)="([^"#]+)"/g);for(const [,file]of scripts){if(!file.startsWith('https://'))assert(fs.existsSync(path.join(out,file)),file);}
const config=fs.readFileSync(path.join(out,'config.js'),'utf8');assert(config.includes('yjwhgwzrrkxjjhoipidj'));assert(!config.includes('olfltcygpakierjzrhcr'));assert(!fs.existsSync(path.join(out,'database')));assert(!fs.existsSync(path.join(out,'scripts')));
assert(fs.readFileSync(path.join(out,'sw.js'),'utf8').includes(JSON.parse(first).version));
const html=fs.readFileSync(path.join(out,'index.html'),'utf8');const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));for(const [,id]of fs.readFileSync(path.join(out,'app.js'),'utf8').matchAll(/\$\('([^']+)'\)/g))assert(ids.has(id),id);
console.log('Build: riproducibile, riferimenti validi, backend separato, nessuna pubblicazione La Malfa.');

})().catch(error=>{console.error(error);process.exitCode=1;});
