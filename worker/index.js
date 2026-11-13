import {SCHEMA_VERSION, validateBackup} from '../core.js';
import demoSales from '../data/demo-sales.json' with {type:'json'};
import {assets} from '../.generated/assets.js';
import {authenticate,handleAuth} from './auth.js';

export const MAX_WORKSPACE_BYTES=1800000;
const json=(value,status=200,extra={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
function error(message,status){return json({error:message},status);}

async function readBounded(request,max){
  if(Number(request.headers.get('content-length'))>max)throw new RangeError('For stor fil.');
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new RangeError('For stor fil.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}

export async function handleApi(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/auth/'))return handleAuth(request,env);
  if(!env.DB)return error('Lagringen er ikke tilgjengelig. Prøv igjen om litt.',503);
  const user=await authenticate(request,env);
  if(!user)return error('Logg inn for å åpne arbeidsområdet.',401);
  const userId=`account:${user.username}`;
  if(url.pathname==='/api/addresses'){
    if(request.method!=='GET')return error('Metoden er ikke tillatt.',405);
    const q=(url.searchParams.get('q')||'').trim();if(q.length<3||q.length>200)return error('Søk med mellom 3 og 200 tegn.',400);
    const upstream=new URL('https://ws.geonorge.no/adresser/v1/sok');upstream.search=new URLSearchParams({sok:q,kommunenummer:'5001',treffPerSide:'6',utkoordsys:'4258',fuzzy:'true'});
    try{const response=await fetch(upstream,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error();const result=await response.json();return json({adresser:(result.adresser||[]).filter(a=>a.kommunenummer==='5001')});}
    catch{return error('Kartverkets adressesøk er midlertidig utilgjengelig. Prøv igjen.',502);}
  }
  if(url.pathname!=='/api/workspace')return error('Fant ikke endepunktet.',404);
  if(!env.DB)return error('Lagringen er ikke tilgjengelig. Prøv igjen om litt.',503);
  if(!['GET','PUT'].includes(request.method))return error('Metoden er ikke tillatt.',405);
  if(request.method==='GET'){
    if(user.username==='admin'&&env.LEGACY_OWNER_ID){
      await env.DB.prepare('INSERT OR IGNORE INTO workspaces (owner_id, data, revision, updated_at) SELECT ?, data, revision, updated_at FROM workspaces WHERE owner_id = ?').bind(userId,env.LEGACY_OWNER_ID).run();
    }
    // Initialiser bare en ny brukers rad. Tabellen opprettes av versjonert migrering.
    const initial=JSON.stringify({schemaVersion:SCHEMA_VERSION,sales:demoSales,projects:[]});
    await env.DB.prepare('INSERT OR IGNORE INTO workspaces (owner_id, data, revision, updated_at) VALUES (?, ?, 0, ?)').bind(userId,initial,new Date().toISOString()).run();
    const row=await env.DB.prepare('SELECT data, revision, updated_at FROM workspaces WHERE owner_id = ?').bind(userId).first();
    return json({workspace:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at,user:{displayName:user.username}});
  }
  // Les identitet fra plattformen; eier-ID aksepteres aldri fra brukerens JSON.
  if(request.headers.get('origin')!==url.origin)return error('Forespørselen må komme fra Kvadrat-siden.',403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return error('Forventet JSON.',415);
  const revisionHeader=request.headers.get('if-match');
  if(!revisionHeader||!/^\d+$/.test(revisionHeader))return error('Last inn arbeidsområdet på nytt før du lagrer.',428);
  const revision=Number(revisionHeader);if(!Number.isSafeInteger(revision))return error('Ugyldig versjon.',400);
  let workspace;
  try{workspace=validateBackup(JSON.parse(await readBounded(request,MAX_WORKSPACE_BYTES)));}
  catch(e){return error(e instanceof RangeError?'Arbeidsområdet er for stort. Reduser antall salg eller lange notater.':`Ugyldige data: ${e.message}`,e instanceof RangeError?413:400);}
  const encoded=JSON.stringify(workspace);if(new TextEncoder().encode(encoded).byteLength>MAX_WORKSPACE_BYTES)return error('Arbeidsområdet er for stort.',413);
  const now=new Date().toISOString();
  const result=await env.DB.prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(encoded,now,userId,revision).run();
  if(result.meta.changes!==1)return error('Arbeidsområdet ble endret i en annen fane eller på en annen enhet. Last inn siste versjon før du prøver igjen.',409);
  return json({revision:revision+1,updatedAt:now});
}

export default {
  async fetch(request,env){
    try{
      const url=new URL(request.url);
      if(url.pathname.startsWith('/api/'))return await handleApi(request,env);
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
      const key=url.pathname==='/'?'/index.html':url.pathname;
      const asset=Object.hasOwn(assets,key)?assets[key]:null;
      if(!asset)return new Response('Fant ikke siden.',{status:404});
      const body=asset.base64?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
      return new Response(request.method==='HEAD'?null:body,{headers:{
        'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
      }});
    }catch(e){console.error('Kvadrat request failed',e?.name||'Error');return error('En serverfeil oppstod. Ingen lagring er bekreftet. Prøv igjen.',500);}
  }
};
