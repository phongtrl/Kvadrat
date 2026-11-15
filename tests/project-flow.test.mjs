import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectFlow} from '../project-flow.js';
test('project steps reveal invalid fields and protect unsaved changes on close and page unload',async t=>{
 const previous={document:globalThis.document,window:globalThis.window};t.after(()=>Object.assign(globalThis,previous));
 const node=()=>({hidden:false,events:{},classList:{toggle(){}},setAttribute(){},addEventListener(name,callback){this.events[name]=callback;},focus(){},querySelectorAll(){return[];}});
 const tabs=[node(),node(),node()],panels=[node(),node(),node()],close=node(),form=node(),dialog=node(),back=node(),next=node();dialog.open=true;dialog.close=()=>dialog.open=false;
 form.querySelectorAll=selector=>selector==='[data-project-step]'?tabs:selector==='[data-project-panel]'?panels:[close];
 const fields=[{valid:true,checkValidity(){return this.valid;},reportValidity(){this.reported=true;}},{checkValidity:()=>true}];panels[0].querySelectorAll=()=>fields;panels.forEach((p,i)=>p.contains=target=>target.panel===i);
 const windowEvents={};Object.assign(globalThis,{window:{addEventListener:(name,callback)=>windowEvents[name]=callback},document:{querySelector:selector=>({'#project-form':form,'#project-dialog':dialog,'#project-back':back,'#project-next':next}[selector])}});
 let value='original',allow=false;const flow=createProjectFlow({snapshot:()=>value,confirmDiscard:async()=>allow,onLocation(){}});flow.open();assert.equal(panels[0].hidden,false);assert.equal(panels[1].hidden,true);assert.equal(flow.dirty(),false);
 fields[0].valid=false;next.onclick();assert.equal(fields[0].reported,true);assert.equal(panels[1].hidden,true);
 fields[0].valid=true;next.onclick();assert.equal(panels[1].hidden,false);
 form.events.invalid({target:{panel:2}});assert.equal(panels[2].hidden,false);
 value='edited';await close.onclick();assert.equal(dialog.open,true);let prevented=false;windowEvents.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,true);
 allow=true;await close.onclick();assert.equal(dialog.open,false);
});
