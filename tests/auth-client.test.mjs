import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse,postAuth} from '../auth-client.js';
import worker from '../worker/index.js';
import {passwordHash} from '../worker/auth.js';
import {database} from './helpers/database.mjs';

test('HTML replies from a gateway never leak a JSON parser error or HTML into the page',async()=>{
 for(const status of [200,401,403,404,502]){
  await assert.rejects(()=>postAuth('login',{username:'admin',password:'test'},async()=>new Response('<html>not JSON</html>',{status,headers:{'Content-Type':'text/html'}})),error=>error.message.includes(`HTTP ${status}`)&&!error.message.includes('Unexpected token')&&!error.message.includes('<html>'));
 }
});
test('malformed JSON produces a useful error and structured API errors retain their message',async()=>{
 await assert.rejects(()=>readApiResponse(new Response('{',{headers:{'Content-Type':'application/json'}})),/ufullstendig/);
 await assert.rejects(()=>postAuth('login',{},async()=>Response.json({error:'Feil brukernavn eller passord.'},{status:401})),/Feil brukernavn eller passord/);
 await assert.rejects(()=>postAuth('login',{},async()=>Response.json({ok:true})),/kunne ikke bekreftes/);
});
test('browser form transport uses an app-owned route and round-trips special password characters',async()=>{
 let captured;
 const data=await postAuth('login',{username:'admin',password:'plus+and&equals=space æ'},async(url,options)=>{captured={url,options};return Response.json({user:{username:'admin'}});});
 assert.equal(captured.url,'/kvadrat-auth/login');assert.equal(captured.options.credentials,'same-origin');
 assert.ok(captured.options.headers['Content-Type'].startsWith('application/x-www-form-urlencoded'));
 assert.equal(new URLSearchParams(captured.options.body).get('password'),'plus+and&equals=space æ');assert.equal(data.user.username,'admin');
});
test('client login function integrates with Worker and SQLite using form encoding',async()=>{
 const salt='0123456789abcdef'.repeat(3),password='test+password&æ 123';
 const env={...database(),ADMIN_BOOTSTRAP_HASH:JSON.stringify({salt,hash:await passwordHash(password,salt)})};
 let cookie='';
 const transport=async(path,options)=>{
  const response=await worker.fetch(new Request('https://kvadrat.test'+path,{...options,headers:{...options.headers,Origin:'https://kvadrat.test',Cookie:cookie}}),env);
  if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response;
 };
 const rejected=await worker.fetch(new Request('https://kvadrat.test/kvadrat-auth/login',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/x-www-form-urlencoded'},body:'username=admin&password=wrong'}),env);assert.equal(rejected.status,403);
 await postAuth('login',{username:'admin',password},transport);
 const workspace=await worker.fetch(new Request('https://kvadrat.test/api/workspace',{headers:{Cookie:cookie}}),env);assert.equal(workspace.status,200);
 assert.equal((await workspace.json()).user.displayName,'admin');
 await postAuth('logout',{},transport);
 assert.equal((await worker.fetch(new Request('https://kvadrat.test/api/workspace',{headers:{Cookie:cookie}}),env)).status,401);
});
