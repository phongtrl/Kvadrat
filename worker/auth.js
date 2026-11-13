const COOKIE='__Host-kvadrat_session';
const TTL=8*60*60;
const authReply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
export async function passwordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256));
}
function equals(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
function tokenFrom(request){return (request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function cookie(value,age=TTL){return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;}
export async function authenticate(request,env){
 if(!env.DB)return null;
 const token=tokenFrom(request);if(!/^[a-f0-9]{64}$/.test(token))return null;
 return env.DB.prepare('SELECT s.username, a.password_version FROM auth_sessions s JOIN auth_accounts a ON a.username = s.username AND a.password_version = s.password_version WHERE s.token_hash = ? AND s.expires_at > ?').bind(await digest(token),Date.now()).first();
}
async function issueSession(username,version,env){
 const token=hex(crypto.getRandomValues(new Uint8Array(32)));
 await env.DB.prepare('INSERT INTO auth_sessions (token_hash, username, password_version, expires_at) VALUES (?, ?, ?, ?)').bind(await digest(token),username,version,Date.now()+TTL*1000).run();
 return cookie(token);
}
async function credentials(request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new Error('Forventet JSON.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Tom forespørsel.');let size=0;const parts=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error('For stor forespørsel.');}parts.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object')throw new Error('Ugyldige opplysninger.');return value;
}
async function consumeAttempt(request,env,action){
 const now=Date.now(),window=Math.floor(now/900000),ip=request.headers.get('cf-connecting-ip')||'unknown';
 const key=`${action}:${await digest(ip)}:${window}`;
 await env.DB.prepare('INSERT INTO auth_attempts (bucket_key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT (bucket_key) DO UPDATE SET attempts = attempts + 1').bind(key,(window+1)*900000).run();
 const row=await env.DB.prepare('SELECT attempts FROM auth_attempts WHERE bucket_key = ?').bind(key).first();
 return row.attempts<=10;
}
export async function handleAuth(request,env){
 const path=new URL(request.url).pathname;
 if(!env.DB)return authReply({error:'Innloggingen er midlertidig utilgjengelig.'},503);
 if(path==='/api/auth/session'){
  if(request.method!=='GET')return authReply({error:'Metoden er ikke tillatt.'},405);
  const user=await authenticate(request,env);return user?authReply({user:{username:user.username}}):authReply({error:'Logg inn for å fortsette.'},401);
 }
 if(!['/api/auth/login','/api/auth/logout','/api/auth/password'].includes(path))return authReply({error:'Fant ikke endepunktet.'},404);
 if(request.method!=='POST')return authReply({error:'Metoden er ikke tillatt.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return authReply({error:'Forespørselen må komme fra Kvadrat.'},403);
 if(path==='/api/auth/logout'){
  const token=tokenFrom(request);if(token)await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(token)).run();
  return authReply({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(!await consumeAttempt(request,env,path))return authReply({error:'For mange forsøk. Prøv igjen om 15 minutter.'},429,{'Retry-After':'900'});
 let values;try{values=await credentials(request);}catch{return authReply({error:'Ugyldige innloggingsopplysninger.'},400);}
 if(path==='/api/auth/login'){
  let seed;try{seed=JSON.parse(env.ADMIN_BOOTSTRAP_HASH||'null');}catch{}
  if(!seed||!/^\w{32,128}$/.test(seed.salt)||!/^([a-f0-9]{64})$/.test(seed.hash))return authReply({error:'Innloggingen er ikke konfigurert.'},503);
  await env.DB.prepare('INSERT OR IGNORE INTO auth_accounts (username, password_hash, salt, password_version) VALUES (?, ?, ?, 1)').bind('admin',seed.hash,seed.salt).run();
  const account=await env.DB.prepare('SELECT username, password_hash, salt, password_version FROM auth_accounts WHERE username = ?').bind('admin').first();
  if(typeof values.password!=='string'||values.password.length>256||typeof values.username!=='string')return authReply({error:'Feil brukernavn eller passord.'},401);
  const hash=await passwordHash(values.password,account.salt);
  if(!equals(values.username,account.username)||!equals(hash,account.password_hash))return authReply({error:'Feil brukernavn eller passord.'},401);
  await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(Date.now()).run();
  await env.DB.prepare('DELETE FROM auth_attempts WHERE expires_at <= ?').bind(Date.now()).run();
  return authReply({user:{username:account.username}},200,{'Set-Cookie':await issueSession(account.username,account.password_version,env)});
 }
 const user=await authenticate(request,env);if(!user)return authReply({error:'Logg inn for å endre passord.'},401);
 const account=await env.DB.prepare('SELECT password_hash, salt, password_version FROM auth_accounts WHERE username = ?').bind(user.username).first();
 if(typeof values.currentPassword!=='string'||values.currentPassword.length>256||!equals(await passwordHash(values.currentPassword,account.salt),account.password_hash))return authReply({error:'Nåværende passord er feil.'},403);
 if(typeof values.newPassword!=='string'||values.newPassword.length<12||values.newPassword.length>256)return authReply({error:'Det nye passordet må være mellom 12 og 256 tegn.'},400);
 const salt=hex(crypto.getRandomValues(new Uint8Array(24))),hash=await passwordHash(values.newPassword,salt),version=account.password_version+1;
 const result=await env.DB.prepare('UPDATE auth_accounts SET password_hash = ?, salt = ?, password_version = ? WHERE username = ? AND password_version = ?').bind(hash,salt,version,user.username,account.password_version).run();
 if(result.meta.changes!==1)return authReply({error:'Passordet ble endret i en annen økt. Logg inn på nytt.'},409);
 await env.DB.prepare('DELETE FROM auth_sessions WHERE username = ? AND password_version < ?').bind(user.username,version).run();
 return authReply({ok:true},200,{'Set-Cookie':await issueSession(user.username,version,env)});
}
