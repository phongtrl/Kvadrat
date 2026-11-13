export const BACKEND_ORIGIN='https://kvadrat-trondheim-phong.fearlesswaterbuck8.chatgpt.site';
export const SESSION_STORAGE_KEY='kvadrat.session.v1';
export function createApiClient(origin,fetcher=fetch,storage){
 const remote=origin==='https://phongtrl.github.io';
 const base=remote?BACKEND_ORIGIN:origin;
 let sessionToken='';
 try{storage=storage===undefined?globalThis.localStorage:storage;}catch{storage=null;}
 const valid=value=>/^[a-f0-9]{64}$/.test(value||'')?value:'';
 function restore(){if(remote&&storage)try{sessionToken=valid(storage.getItem(SESSION_STORAGE_KEY));}catch{}return sessionToken;}
 restore();
 function setToken(value){sessionToken=valid(value);if(remote&&storage)try{if(sessionToken)storage.setItem(SESSION_STORAGE_KEY,sessionToken);else storage.removeItem(SESSION_STORAGE_KEY);}catch{}}
 return {
  remote,
  setToken,
  async request(path,options={}){
   if(typeof path!=='string'||!/^\/(?:api\/|kvadrat-auth\/)/.test(path))throw new Error('Ugyldig API-adresse.');
   const headers=new Headers(options.headers);headers.set('Accept','application/json');
   if(remote&&restore())headers.set('Authorization','Bearer '+sessionToken);
   const response=await fetcher(new URL(path,base).href,{...options,headers,credentials:remote?'omit':'same-origin',redirect:'error'});
   if(remote&&response.status===401)setToken('');
   return response;
  }
 };
}
const client=createApiClient(globalThis.location?.origin||'https://kvadrat.test');
export const apiFetch=(path,options)=>client.request(path,options);
export const setApiToken=value=>client.setToken(value);
export const remoteApi=client.remote;
