import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const testToken=user=>createHash('sha256').update('test-only:'+user).digest('hex');
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
export function database(users=[]){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('../../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../../drizzle/'+file,import.meta.url),'utf8'));
 for(const user of users){
  sqlite.prepare('INSERT INTO auth_accounts VALUES (?, ?, ?, 1)').run(user,'test-only','test-only');
  sqlite.prepare('INSERT INTO auth_sessions VALUES (?, ?, 1, ?)').run(tokenHash(testToken(user)),user,Date.now()+1000000);
 }
 return {sqlite,DB:{prepare(sql){return{bind(...args){return{async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){const result=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(result.changes)}};}};}};}}};
}
