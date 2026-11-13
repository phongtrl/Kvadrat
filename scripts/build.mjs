import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['index.html','styles.css','app.js','boot.js','auth-client.js','api-client.js','core.js','property-map.js','historical-market.js','market-advice.js','profit-planner.js','data/ssb-price-index.json','data/ssb-index-query.json','data/ssb-trondheim.json','data/ssb-query.json','data/demo-sales.json','data/listings.json','listings.js','vendor/leaflet.js','vendor/leaflet.css','vendor/LEAFLET-LICENSE',...['layers.png','layers-2x.png','marker-icon.png','marker-icon-2x.png','marker-shadow.png'].map(n=>'vendor/images/'+n)];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
const assets={};for(const file of files){const binary=file.endsWith('.png');const data=await readFile(path.join(root,file));assets['/'+file]={type:types[path.extname(file)]||'text/plain; charset=utf-8',body:data.toString(binary?'base64':'utf8'),base64:binary};}
await mkdir(path.join(root,'.generated'),{recursive:true});await writeFile(path.join(root,'.generated/assets.js'),'export const assets = '+JSON.stringify(assets)+';\n');
let worker=await readFile(path.join(root,'worker/index.js'),'utf8');
const auth=(await readFile(path.join(root,'worker/auth.js'),'utf8')).replace(/^export /gm,'');
worker=worker.replace(/^import .*from '\.\/auth\.js';\n/m,auth+'\n');
const core=(await readFile(path.join(root,'core.js'),'utf8')).replace(/^export /gm,'');
worker=worker.replace(/^import .*from '\.\.\/core\.js';\n/m,core+'\n').replace(/^import demoSales .*;\n/m,'const demoSales='+await readFile(path.join(root,'data/demo-sales.json'),'utf8')+';\n').replace(/^import \{assets\} .*;\n/m,'const assets='+JSON.stringify(assets)+';\n');
await rm(path.join(root,'dist'),{recursive:true,force:true});await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'dist/server/index.js'),worker);
await cp(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
await cp(path.join(root,'drizzle'),path.join(root,'dist/drizzle'),{recursive:true});
console.log(`Built hosted Worker with ${files.length} bundled assets and D1 migrations.`);
