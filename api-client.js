export const BACKEND_ORIGIN='https://kvadrat-trondheim-phong.fearlesswaterbuck8.chatgpt.site';
export function createApiClient(origin,fetcher=fetch){
 const remote=origin==='https://phongtrl.github.io';
 const base=remote?BACKEND_ORIGIN:origin;
 let sessionToken='';
 return {
  remote,
  setToken(value){sessionToken=/^[a-f0-9]{64}$/.test(value||'')?value:'';},
  async request(path,options={}){
   if(typeof path!=='string'||!/^\/(?:api\/|kvadrat-auth\/)/.test(path))throw new Error('Ugyldig API-adresse.');
   const headers=new Headers(options.headers);headers.set('Accept','application/json');
   if(remote&&sessionToken)headers.set('Authorization','Bearer '+sessionToken);
   return fetcher(new URL(path,base).href,{...options,headers,credentials:remote?'omit':'same-origin',redirect:'error'});
  }
 };
}
const client=createApiClient(globalThis.location?.origin||'https://kvadrat.test');
export const apiFetch=(path,options)=>client.request(path,options);
export const setApiToken=value=>client.setToken(value);
export const remoteApi=client.remote;
