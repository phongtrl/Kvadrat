import test from 'node:test';
import assert from 'node:assert/strict';
import {parseListingPage} from '../worker/listing-preview.js';
import worker from '../worker/index.js';
import {database,testToken} from './helpers/database.mjs';
const url='https://www.finn.no/realestate/homes/ad.html?finnkode=480265636';
// Synthetic semantic fixture, not a captured live FINN page.
const html=`<script type="application/ld+json">{"@type":"Apartment","name":"Testbolig","address":{"streetAddress":"Testgata 1","addressLocality":"Trondheim"},"geo":{"latitude":63.43,"longitude":10.4},"offers":{"price":9999999},"floorSize":{"value":90}}</script><dl><dt>Prisantydning</dt><dd>2 000 000 kr</dd><dt>Internt bruksareal</dt><dd>65,5 m²</dd><dt>Fellesgjeld</dt><dd>0 kr</dd><dt>Omkostninger</dt><dd>50 000 kr</dd><dt>Felleskost/mnd.</dt><dd>3 500 kr</dd><dt>Eierform</dt><dd>Selveier</dd></dl>`;
test('preview extracts explicitly labelled prices and BRA-i without interpreting generic total/floorSize as asking price/BRA-i',()=>{
 const result=parseListingPage(html,url);assert.equal(result.complete,true);assert.equal(result.fields.price,2000000);assert.equal(result.fields.area,65.5);assert.equal(result.fields.debt,0);assert.equal(result.fields.address,'Testgata 1');assert.equal(result.fields.ownership,'selveier');assert.equal(result.fields.status,'ukjent');
 const partial=parseListingPage('<script type="application/ld+json">{"@type":"Apartment","name":"Test","offers":{"price":9000000},"floorSize":{"value":90}}</script>',url);assert.ok(partial.missing.includes('price'));assert.ok(partial.missing.includes('area'));assert.ok(partial.missing.includes('debt'));assert.equal(partial.fields.price,undefined);
});
test('lookup is authenticated, validates the target and refuses to bypass a FINN block',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);const env=database(['alice']);let calls=0;
 globalThis.fetch=async(target,options)=>{calls++;assert.equal(target,url);assert.equal(options.redirect,'manual');return new Response('Blocked',{status:403});};
 const request=(value,user=true)=>new Request('https://kvadrat.test/api/listing-preview',{method:'POST',headers:{Origin:'https://kvadrat.test','Content-Type':'application/json',...(user?{Cookie:'__Host-kvadrat_session='+testToken('alice')}:{})},body:JSON.stringify({url:value})});
 assert.equal((await worker.fetch(request(url,false),env)).status,401);assert.equal(calls,0);
 for(const target of ['http://127.0.0.1/','https://www.finn.no.evil.test/','https://www.finn.no@evil.test/','https://www.finn.no/not-an-ad'])assert.equal((await worker.fetch(request(target),env)).status,400);
 assert.equal(calls,0);const blocked=await worker.fetch(request(url),env);assert.equal(blocked.status,422);assert.match((await blocked.json()).error,/blokkerer/);
 globalThis.fetch=async()=>new Response(html,{headers:{'Content-Type':'text/html'}});const ok=await worker.fetch(request(url),env);assert.equal(ok.status,200);assert.equal((await ok.json()).fields.price,2000000);
 globalThis.fetch=async()=>new Response('',{status:302,headers:{Location:'http://127.0.0.1'}});assert.equal((await worker.fetch(request(url),env)).status,422);
 assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM workspaces').get().n,0,'lookup must not save unreviewed data');
});
