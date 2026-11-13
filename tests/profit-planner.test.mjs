import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {indexSeries,forecastIndex,projectScenario} from '../profit-planner.js';
import {calculate} from '../core.js';
const project={id:'p1',name:'Test',address:'Testadresse',status:'Vurderes',ownership:'selveier',area:65,lat:63.43,lng:10.4,purchase:3000000,debt:0,resale:4100000,renovation:350000,contingency:15,buyFees:15000,saleFees:100000,monthly:3500,months:6,equity:900000,interest:6.5,stampBase:3000000,expenses:[],tasks:[]};
test('official index uses correct region and period and reports explicit forecast horizon',()=>{
 const data=JSON.parse(readFileSync(new URL('../data/ssb-price-index.json',import.meta.url)));
 const series=indexSeries(data,'004');assert.equal(series.length,43);assert.equal(series.at(-1).value,144.6);
 const result=forecastIndex(series);assert.equal(result.period,'2026K3');assert.equal(result.target,'2027K3');assert.equal(result.tests,8);assert.ok(result.modelError<result.flatError);assert.ok(result.low<result.central&&result.high>result.central);
 assert.equal(indexSeries(data,'010').at(-1).value,140.1);
});
test('flat history selects no-growth baseline; missing and noncontiguous data cannot generate forecasts',()=>{
 const rows=Array.from({length:28},(_,i)=>({period:`${2020+Math.floor(i/4)}K${i%4+1}`,value:100}));
 const result=forecastIndex(rows);assert.equal(result.selected,'flat');assert.equal(result.central,100);assert.equal(result.flatError,0);
 assert.equal(forecastIndex(rows.slice(0,8)),null);
 const missing=structuredClone(rows);missing[4].value=null;assert.equal(forecastIndex(missing),null);
 assert.equal(forecastIndex(rows.filter((_,i)=>i!==4)),null);
});
test('stress includes market drop, renovation, delay and financing while bid solver meets profit target',()=>{
 const before=structuredClone(project),result=projectScenario(project,{target:300000});assert.deepEqual(result.base,calculate(project));assert.ok(result.downside.profit<result.base.profit);
 const stress=calculate({...project,resale:project.resale*.9,renovation:calculate(project).renovation*1.2,contingency:0,expenses:[],months:9,interest:8.5});assert.deepEqual(result.downside,stress);
 const atBid=calculate({...project,purchase:result.bid,stampBase:result.bid});assert.ok(Math.abs(atBid.profit-300000)<.01);assert.equal(result.breakEven,result.base.total);assert.deepEqual(project,before);
});
test('annual scenarios scale to holding period; impossible bids and fully funded co-op are handled',()=>{
 const growth=projectScenario(project,{annual:10});assert.ok(Math.abs(growth.adjustedResale-project.resale*Math.sqrt(1.1))<.001);
 assert.equal(projectScenario({...project,resale:50000}).bid,null);
 const coop={...project,ownership:'borettslag',equity:10000000},result=projectScenario(coop,{target:300000});assert.equal(result.base.financing,0);assert.ok(Math.abs(calculate({...coop,purchase:result.bid}).profit-300000)<.01);
 assert.throws(()=>projectScenario(project,{annual:-100}));assert.throws(()=>projectScenario(project,{delay:NaN}));
});
