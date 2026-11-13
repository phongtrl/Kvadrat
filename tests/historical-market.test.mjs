import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketRows} from '../historical-market.js';
const data=JSON.parse(readFileSync(new URL('../data/ssb-trondheim.json',import.meta.url)));
test('SSB snapshot selects correct apartment metrics and latest complete year',()=>{
 const rows=marketRows(data);
 assert.deepEqual(rows.map(r=>r.period),['2025K4','2026K1','2026K2','2026K3']);
 assert.deepEqual(rows.at(-1),{period:'2026K3',price:61301,count:1106});
 assert.equal(rows.reduce((s,r)=>s+r.count,0),4571);
 assert.deepEqual(marketRows(data,'00').at(-1),{period:'2026K3',price:56864,count:1424});
});
test('Trøndelag includes county and every municipality without imputing suppressed values',()=>{
 const regions=data.dimension.Region.category.index;
 assert.equal(Object.keys(regions).length,39);
 assert.ok('50' in regions && '5001' in regions && '5061' in regions);
 for(const region of Object.keys(regions))for(const type of ['00','01','02','03']){
  const rows=marketRows(data,type,region);
  assert.equal(rows.length,4);
  for(const r of rows){assert.ok(r.price===null||Number.isFinite(r.price));assert.ok(r.count===null||Number.isInteger(r.count));}
 }
});
test('search priorities exclude sparse or missing observations and never rank county as municipality',async()=>{
 const {marketOpportunities}=await import('../historical-market.js');
 for(const type of ['00','01','02','03']){
 const rows=marketOpportunities(data,type);assert.equal(rows.length,38);assert.ok(rows.every(r=>r.code!=='50'));
 const valid=rows.filter(r=>r.eligible);assert.ok(valid.length>0);
 for(const row of valid){assert.ok(row.count>=50);assert.ok(row.price>0);assert.ok(row.score>0&&row.score<=100);}
 assert.ok(valid.every((r,i)=>i===0||r.score<=valid[i-1].score));
 for(const row of rows.filter(r=>!r.eligible))assert.equal(row.score,null);
 }
 const empty=structuredClone(data);empty.value=empty.value.map(()=>null);
 assert.equal(marketOpportunities(empty).filter(r=>r.eligible).length,0);
});
test('illustrative bid cap accounts for stamp duty, buffer, target profit and downside',async()=>{
 const {purchaseScenario}=await import('../market-advice.js');
 const input={resale:4000000,renovation:500000,other:200000,profit:300000,stampRate:.025};
 const result=purchaseScenario(input);assert.ok(Math.abs(result.bid-2925000/1.025)<.001);
 assert.ok(Math.abs(result.baseProfit-300000)<.001);assert.ok(Math.abs(result.stressProfit-(-215000))<.001);
 assert.equal(purchaseScenario({...input,resale:100000}).feasible,false);
 assert.throws(()=>purchaseScenario({...input,resale:NaN}));
});
