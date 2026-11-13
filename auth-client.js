import {apiFetch,setApiToken,remoteApi} from './api-client.js';
// The app's login routes are separate from hosting providers' /api/auth routes.
export async function readApiResponse(response){
 const type=response.headers.get('content-type')||'';
 if(!/\bapplication\/(?:[\w.+-]+\+)?json\b/i.test(type)){
  const detail=response.status===404?'Kontroller at du bruker den publiserte Kvadrat-adressen.':'Last siden på nytt og prøv igjen.';
  throw new Error(`Innloggingstjenesten returnerte et uventet svar (HTTP ${response.status}). ${detail}`);
 }
 let result;try{result=await response.json();}catch{throw new Error('Svaret fra serveren var ufullstendig. Prøv igjen.');}
 if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('Serveren returnerte et ugyldig svar. Prøv igjen.');
 return result;
}

export async function postAuth(path,body={},fetcher=apiFetch){
 if(!['login','logout','password'].includes(path))throw new Error('Ukjent innloggingshandling.');
 const response=await fetcher('/kvadrat-auth/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},
  body:new URLSearchParams(body).toString(),signal:AbortSignal.timeout(20000)});
 const result=await readApiResponse(response);
 if(!response.ok)throw new Error(result.error||'Forespørselen feilet.');
 if(path==='login'&&result.user?.username!=='admin')throw new Error('Innloggingen kunne ikke bekreftes. Prøv igjen.');
 if((path==='login'||path==='password')&&remoteApi&&fetcher===apiFetch){
  if(!/^[a-f0-9]{64}$/.test(result.sessionToken||''))throw new Error('Serveren bekreftet ikke innloggingsøkten.');
  setApiToken(result.sessionToken);
 }
 if(path==='logout')setApiToken('');
 return result;
}
