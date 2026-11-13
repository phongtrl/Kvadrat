// Clean up old native-GET form URLs without ever forwarding their query.
const clean=new URL(location.href);
if(clean.searchParams.has('username')||clean.searchParams.has('password')){
 clean.searchParams.delete('username');clean.searchParams.delete('password');
 history.replaceState(null,'',clean.pathname+clean.search+clean.hash);
}
const form=document.querySelector('#login-form');
form.addEventListener('submit',event=>{if(form.dataset.ready!=='true')event.preventDefault();});
import('./app.js?v=github-login-v3').catch(()=>{
 const error=document.querySelector('#login-error');error.textContent='Appen kunne ikke starte. Last siden på nytt med Ctrl + F5.';error.hidden=false;
});
