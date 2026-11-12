import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate,median,parseCSV,validateSale,validateSales,validateProject,validateBackup,csvExport} from '../core.js';

const project={id:'p1',name:'Testprosjekt',address:'Testadresse',status:'Vurderes',ownership:'selveier',area:65,lat:63.43,lng:10.4,purchase:3000000,debt:0,resale:4100000,renovation:350000,contingency:15,buyFees:15000,saleFees:100000,monthly:3500,months:6,equity:900000,interest:6.5,stampBase:3000000,notes:'',expenses:[],tasks:[]};
const sale={id:'real-1',address:'Testadresse',district:'Midtbyen',date:'2026-10-02',area:65,price:4000000,lat:63.43,lng:10.4,source:'Egen salgsoversikt'};

test('kontantkalkyle inkluderer dokumentavgift, buffer, løpende utgifter og enkle renter',()=>{
 const c=calculate(project);
 assert.equal(c.stamp,75000);assert.ok(Math.abs(c.renovation-402500)<.01);
 assert.ok(Math.abs(c.total-3701688.75)<.01);assert.ok(Math.abs(c.profit-398311.25)<.01);
 assert.ok(Math.abs(c.equityRoi-44.25680555555556)<.00001);
});
test('borettslag har ingen dokumentavgift; overført fellesgjeld gir ikke falsk kontantkostnad',()=>{
 const c=calculate({...project,ownership:'borettslag',debt:500000});
 assert.equal(c.stamp,0);assert.equal(c.exposure,3500000);
 assert.equal(c.profit,calculate({...project,ownership:'borettslag',debt:0}).profit);
});
test('faktiske overskridelser erstatter oppussingsrammen; kostnader under rammen dobbeltelles ikke',()=>{
 const low=calculate({...project,expenses:[{amount:100000}]});assert.equal(low.total,calculate(project).total);
 const high=calculate({...project,expenses:[{amount:500000}]});assert.equal(high.renovation,500000);assert.equal(high.total,3802357.5);
});
test('full egenfinansiering gir null lånebehov og null renter',()=>{const c=calculate({...project,equity:5000000});assert.equal(c.loan,0);assert.equal(c.financing,0);});
test('median håndterer tomme, odde og like utvalg',()=>{assert.equal(median([]),null);assert.equal(median([4,1,3]),3);assert.equal(median([4,1,2,3]),2.5);});
test('CSV støtter BOM, norske desimaler, semikolon, komma, linjeskift og doble anførselstegn',()=>{
 const rows=parseCSV('\uFEFFid;address;district;date;area;price;lat;lng;source\r\nreal-1;"Gate; 1";Midtbyen;2026-10-02;"65,5";4000000;63.43;10.4;"Kilde ""en"""');
 assert.equal(validateSales(rows)[0].area,65.5);assert.equal(rows[0].address,'Gate; 1');assert.equal(rows[0].source,'Kilde "en"');
 assert.equal(parseCSV('id,source\na,"en\nto"')[0].source,'en\nto');
 assert.throws(()=>parseCSV('id,source\na,"uavsluttet'),/ikke avsluttet/);
 assert.throws(()=>parseCSV('id,source\na,b,c'),/feil antall/);
});
test('import avviser ugyldige datoer, fremtidige datoer, feil koordinater og manglende kilder',()=>{
 for(const patch of [{date:'2026-02-30'},{date:'2099-01-01'},{lat:59.9},{lng:12},{area:''},{price:-1},{source:''},{price:true}])assert.throws(()=>validateSale({...sale,...patch}));
 assert.throws(()=>validateSales([sale,sale]),/Samme ID/);
 assert.throws(()=>validateSales(new Array(5001).fill(sale)),/5 000/);
});
test('sikkerhetskopi gjenoppretter demo-merking og avviser ugyldige prosjekter før lagring',()=>{
 const data=validateBackup({schemaVersion:1,sales:[{...sale,demo:true}],projects:[project]});
 assert.equal(data.sales[0].demo,true);assert.equal(data.projects[0].name,project.name);
 assert.throws(()=>validateProject({...project,months:2.5}),/hele måneder/);
 assert.throws(()=>validateProject({...project,equity:0}));
 assert.throws(()=>validateBackup({schemaVersion:1,sales:[],projects:[project,project]}),/dupliserte/);
});
test('CSV-eksport runder ikke beløp og bevarer demo-merking; regnearkformler nøytraliseres',()=>{
 const rows=parseCSV(csvExport([{...sale,price:4000000.5,address:'=HYPERLINK("test")',demo:true}]));
 assert.equal(rows[0].price,'4000000.5');assert.equal(rows[0].demo,'true');assert.equal(rows[0].address[0],"'");
});
