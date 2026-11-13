// Development adapter only. This module is never bundled into the hosted Worker.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../dist/server/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'.wrangler'),{recursive:true});
const db=new DatabaseSync(path.join(root,'.wrangler/dev.sqlite'));
const {readdir}=await import('node:fs/promises');
db.exec('CREATE TABLE IF NOT EXISTS _dev_migrations (name TEXT PRIMARY KEY)');
for(const file of (await readdir(path.join(root,'drizzle'))).filter(f=>f.endsWith('.sql')).sort()){
 if(!db.prepare('SELECT name FROM _dev_migrations WHERE name = ?').get(file)){db.exec(await readFile(path.join(root,'drizzle',file),'utf8'));db.prepare('INSERT INTO _dev_migrations (name) VALUES (?)').run(file);}
}
const DB={prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null;},async run(){const r=db.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}};}};}};}};
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const port=Number(arg('--port')||process.env.PORT||4173),host=arg('--host')||'127.0.0.1';
http.createServer(async(req,res)=>{
 try{
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value&&typeof value==='string')headers.set(key,value);}
  // A fixed development identity exists only inside this non-production adapter.
  headers.set('oai-authenticated-user-id','development-preview');headers.set('oai-authenticated-user-email','preview@kvadrat.test');
  const proto=headers.get('x-forwarded-proto')||'http';
  const origin=`${proto}://${headers.get('x-forwarded-host')||headers.get('host')}`;
  if(headers.get('origin'))headers.set('origin',origin);
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1800000){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk);}
  const request=new Request(new URL(req.url,origin),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  const response=await worker.fetch(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error.message);res.writeHead(500);res.end('Development server error');}
}).listen(port,host,()=>console.log(`Kvadrat development preview: http://${host}:${port}`));
