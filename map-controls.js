// Let Leaflet handle Ctrl+wheel with its native cursor-centred, debounced zoom.
// Block unmodified wheel events from reaching Leaflet without cancelling page scrolling.
const attached=new WeakSet();
export function enableCtrlWheelZoom(container){
 if(attached.has(container))return;attached.add(container);
 container.addEventListener('wheel',event=>{
  if(event.ctrlKey)event.preventDefault();
  else event.stopImmediatePropagation();
 },{capture:true,passive:false});
}
