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
