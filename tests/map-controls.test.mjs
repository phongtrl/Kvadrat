import test from 'node:test';
import assert from 'node:assert/strict';
import {enableCtrlWheelZoom} from '../map-controls.js';
test('Ctrl+wheel reaches Leaflet while preventing browser zoom; normal wheel retains page scrolling',()=>{
 let listener,options,registered=0;const container={addEventListener(name,fn,opts){assert.equal(name,'wheel');listener=fn;options=opts;registered++;}};
 enableCtrlWheelZoom(container);enableCtrlWheelZoom(container);assert.equal(registered,1);assert.deepEqual(options,{capture:true,passive:false});
 const wheel=ctrlKey=>{const event={ctrlKey,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};listener(event);return event;};
 const normal=wheel(false);assert.equal(normal.prevented,false);assert.equal(normal.stopped,true);
 for(const direction of [-1,1]){const ctrl=wheel(true);assert.equal(ctrl.prevented,true);assert.equal(ctrl.stopped,false);}
});
