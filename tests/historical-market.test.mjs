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
