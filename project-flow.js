export function createProjectFlow({snapshot,confirmDiscard,onLocation}){
 const form=document.querySelector('#project-form'),dialog=document.querySelector('#project-dialog'),tabs=[...form.querySelectorAll('[data-project-step]')],panels=[...form.querySelectorAll('[data-project-panel]')];let baseline='',step=0;
 function select(index){step=index;panels.forEach((p,i)=>p.hidden=i!==index);tabs.forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});document.querySelector('#project-back').hidden=index===0;document.querySelector('#project-next').hidden=index===panels.length-1;if(index===0)onLocation();}
 const dirty=()=>dialog.open&&snapshot()!==baseline;
 async function close(){if(dirty()&&!await confirmDiscard())return;dialog.close();}
 tabs.forEach((button,i)=>{button.onclick=()=>select(i);button.addEventListener('keydown',e=>{const next=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next!==null){e.preventDefault();select(next);tabs[next].focus();}});});
 document.querySelector('#project-back').onclick=()=>select(Math.max(0,step-1));
 document.querySelector('#project-next').onclick=()=>{for(const input of panels[step].querySelectorAll('input,select,textarea'))if(!input.checkValidity()){input.reportValidity();return;}select(Math.min(panels.length-1,step+1));};
 form.addEventListener('invalid',e=>{const index=panels.findIndex(p=>p.contains(e.target));if(index>=0&&index!==step)select(index);},true);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 form.querySelectorAll('.close-dialog').forEach(button=>button.onclick=close);
 window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
 return {open(){select(0);baseline=snapshot();},dirty,close};
}
