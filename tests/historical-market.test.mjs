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
