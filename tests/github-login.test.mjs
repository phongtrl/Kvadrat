import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApiClient,BACKEND_ORIGIN} from '../api-client.js';
import worker from '../worker/index.js';
import {passwordHash} from '../worker/auth.js';
import {database} from './helpers/database.mjs';
const origin='https://phongtrl.github.io';
const api=(path,options={})=>new Request(BACKEND_ORIGIN+path,options);

test('login cannot serialize username or password into a native GET URL, even without JavaScript',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const form=html.match(/<form\b[^>]*id="login-form"[\s\S]*?<\/form>/)[0];
 assert.match(form,/method="post"/);assert.doesNotMatch(form,/name="(?:username|password)"/);assert.match(form,/id="login-submit"[^>]*disabled/);
 assert.match(html,/<meta name="referrer" content="strict-origin">/);
 const boot=readFileSync(new URL('../boot.js',import.meta.url),'utf8');assert.doesNotMatch(boot,/location\.(?:replace|assign)\(/);
});
test('GitHub client sends requests to cloud API and keeps session secrets out of URLs',async()=>{
 let captured;const client=createApiClient(origin,async(url,options)=>{captured={url,options};return Response.json({});});
 client.setToken('a'.repeat(64));await client.request('/api/workspace');
 assert.equal(captured.url,BACKEND_ORIGIN+'/api/workspace');assert.equal(captured.options.credentials,'omit');assert.equal(captured.options.headers.get('Authorization'),'Bearer '+'a'.repeat(64));assert.ok(!captured.url.includes('a'.repeat(64)));
 client.setToken('');await client.request('/api/workspace');assert.equal(captured.options.headers.get('Authorization'),null);
 await assert.rejects(()=>client.request('https://evil.test/api/workspace'),/Ugyldig/);
});
test('CORS preflights accept only the specific GitHub origin and API headers',async()=>{
 const env=database();const request=(o,headers='authorization,if-match')=>api('/api/workspace',{method:'OPTIONS',headers:{Origin:o,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':headers}});
 const accepted=await worker.fetch(request(origin),env);assert.equal(accepted.status,204);assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(accepted.headers.get('Access-Control-Allow-Credentials'),null);
 assert.equal((await worker.fetch(request('https://evil.test'),env)).status,403);
 assert.equal((await worker.fetch(request(origin,'x-unexpected'),env)).status,403);
});
test('GitHub frontend can log in, read and save cloud data, and revoke its bearer session without cookies',async()=>{
 const salt='0123456789abcdef'.repeat(3),password='test-github-password';
 const env={...database(),ADMIN_BOOTSTRAP_HASH:JSON.stringify({salt,hash:await passwordHash(password,salt)})};
 const login=await worker.fetch(api('/kvadrat-auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password}).toString()}),env);
 assert.equal(login.status,200);assert.equal(login.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(login.headers.get('Set-Cookie'),null);
 const {sessionToken}=await login.json();assert.match(sessionToken,/^[a-f0-9]{64}$/);
 const headers={Origin:origin,Authorization:'Bearer '+sessionToken};
 const loaded=await worker.fetch(api('/api/workspace',{headers}),env);assert.equal(loaded.status,200);const data=await loaded.json();
 const updated=await worker.fetch(api('/api/workspace',{method:'PUT',headers:{...headers,'Content-Type':'application/json','If-Match':String(data.revision)},body:JSON.stringify({...data.workspace,sales:[]})}),env);assert.equal(updated.status,200);
 assert.equal((await(await worker.fetch(api('/api/workspace',{headers}),env)).json()).workspace.sales.length,0);
 const logout=await worker.fetch(api('/kvadrat-auth/logout',{method:'POST',headers}),env);assert.equal(logout.status,200);
 assert.equal((await worker.fetch(api('/api/workspace',{headers}),env)).status,401);
});
test('unknown origins cannot read a session token or use data endpoints',async()=>{
 const env=database();const response=await worker.fetch(api('/kvadrat-auth/login',{method:'POST',headers:{Origin:'https://elsewhere.test'}}),env);assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('persistent GitHub session survives reload and reopening, then logout revokes and removes it',async()=>{
 const {SESSION_STORAGE_KEY}=await import('../api-client.js');
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const salt='0123456789abcdef'.repeat(3),password='test-persistent-password';
 const env={...database(),ADMIN_BOOTSTRAP_HASH:JSON.stringify({salt,hash:await passwordHash(password,salt)})};
 const fetcher=(url,options)=>{const headers=new Headers(options.headers);headers.set('Origin',origin);return worker.fetch(new Request(url,{...options,headers}),env);};
 const first=createApiClient(origin,fetcher,storage);
 const login=await first.request('/kvadrat-auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password}).toString()});
 const {sessionToken}=await login.json();first.setToken(sessionToken);
 assert.equal(memory.get(SESSION_STORAGE_KEY),sessionToken);assert.ok(!JSON.stringify([...memory]).includes(password));
 const reopened=createApiClient(origin,fetcher,storage);
 assert.equal((await reopened.request('/api/workspace')).status,200);
 // The former eight-hour expiry must no longer apply.
 assert.ok(env.sqlite.prepare('SELECT expires_at FROM auth_sessions').get().expires_at>Date.now()+365*24*60*60*1000);
 assert.equal((await reopened.request('/kvadrat-auth/logout',{method:'POST'})).status,200);reopened.setToken('');
 assert.equal(memory.has(SESSION_STORAGE_KEY),false);
 assert.equal((await first.request('/api/workspace')).status,401);
 const third=createApiClient(origin,fetcher,storage);assert.equal((await third.request('/api/workspace')).status,401);
});
test('revoked sessions clear persisted token and blocked storage does not prevent login',async()=>{
 const {SESSION_STORAGE_KEY}=await import('../api-client.js');
 const values=new Map([[SESSION_STORAGE_KEY,'a'.repeat(64)]]);
 const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const client=createApiClient(origin,async()=>Response.json({}, {status:401}),storage);
 await client.request('/api/workspace');assert.equal(values.size,0);
 const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
 let header;const fallback=createApiClient(origin,async(_,options)=>{header=options.headers.get('Authorization');return Response.json({});},blocked);
 fallback.setToken('b'.repeat(64));await fallback.request('/api/workspace');assert.equal(header,'Bearer '+'b'.repeat(64));
});
