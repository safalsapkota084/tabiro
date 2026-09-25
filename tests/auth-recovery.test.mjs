import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
const base=process.env.TABIRO_TEST_URL;
if(base&&!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(base)) throw Error('Loopback API required');
const digest=t=>createHash('sha256').update(t).digest('hex');
function client(){let cookie='',csrf='';return {get cookie(){return cookie},async call(path,method='GET',body={},overrides={}){
 const r=await fetch(base+path,{method,headers:{Cookie:overrides.cookie??cookie,'Content-Type':'application/json','X-CSRF-Token':overrides.csrf??csrf},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 for(const raw of r.headers.getSetCookie())if(raw.startsWith('tabiro_session='))cookie=raw.split(';')[0];
 const json=await r.json();if(json.data?.csrf_token)csrf=json.data.csrf_token;return {status:r.status,json};
}};}
async function messages(email){const dir=new URL('../.local/mail-test/',import.meta.url);let files;try{files=await readdir(dir)}catch{return []}const rows=await Promise.all(files.map(async f=>JSON.parse(await readFile(new URL(f,dir),'utf8'))));return rows.filter(r=>r.to===email).sort((a,b)=>a.created_at-b.created_at);}
async function clearMessages(email){const dir=new URL('../.local/mail-test/',import.meta.url);let files;try{files=await readdir(dir)}catch{return}for(const name of files){const path=new URL(name,dir);try{const message=JSON.parse(await readFile(path,'utf8'));if(message.to===email)await unlink(path);}catch{}}}
function token(message){return new URLSearchParams(new URL(message.url).hash.slice(1)).get('token');}
test('recovery and verification: private tokens, expiry, replay, CSRF, revocation and role safety',{skip:!base},async()=>{
 const db=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.TABIRO_LOCAL_PORT||33077),database:'tabiro_test',user:'tabiro_local',password:'local-only-not-production'});
 const a=client(),b=client(),reset=client();const email=`recovery-${Date.now()}@example.test`,password='initial-password-123',next='replacement-password-456';
 let id;
 try{
 await db.query('DELETE FROM auth_rate_limits');
 await a.call('/session');const reg=await a.call('/auth/register','POST',{name:'Recovery',email,password,role:'administrator'});assert.equal(reg.status,201);id=reg.json.data.user.id;
 const [roles]=await db.execute('SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE user_id=?',[id]);assert.deepEqual(roles.map(r=>r.name),['user']);
 await b.call('/session');assert.equal((await b.call('/auth/login','POST',{email,password})).status,200);const oldCookie=b.cookie;
 assert.equal((await a.call('/auth/verification-request','POST',{}, {csrf:'wrong'})).status,403);
 assert.equal((await a.call('/auth/verification-request','POST',{})).status,200);
 const verification=(await messages(email)).at(-1);assert.equal(verification.purpose,'verify_email');const vt=token(verification);assert.match(vt,/^[a-f0-9]{64}$/);
 await reset.call('/session');
 assert.equal((await reset.call('/auth/reset-password','POST',{token:vt,password:next})).status,422);
 assert.equal((await reset.call('/auth/verify-email','POST',{token:vt})).status,200);
 assert.ok((await a.call('/me')).json.data.verified_at);
 assert.equal((await reset.call('/auth/verify-email','POST',{token:vt})).status,422);
 const unknown=await reset.call('/auth/forgot-password','POST',{email:'absent-'+email});
 const known=await reset.call('/auth/forgot-password','POST',{email});assert.equal(known.status,200);assert.deepEqual(unknown,known);assert.equal(JSON.stringify(known).includes('token'),false);
 let rt=token((await messages(email)).at(-1));
 const [stored]=await db.execute('SELECT token_hash FROM auth_tokens WHERE user_id=? AND purpose=? AND consumed_at IS NULL',[id,'reset_password']);assert.equal(stored[0].token_hash,digest(rt));
 assert.equal((await reset.call('/auth/verify-email','POST',{token:rt})).status,422);
 await db.execute('UPDATE auth_tokens SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE token_hash=?',[digest(rt)]);
 assert.equal((await reset.call('/auth/reset-password','POST',{token:rt,password:next})).status,422);
 await reset.call('/auth/forgot-password','POST',{email});const superseded=token((await messages(email)).at(-1));
 await reset.call('/auth/forgot-password','POST',{email});rt=token((await messages(email)).at(-1));
 assert.equal((await reset.call('/auth/reset-password','POST',{token:superseded,password:next})).status,422);
 assert.equal((await reset.call('/auth/reset-password','POST',{token:rt,password:'short'})).status,422);
 assert.equal((await reset.call('/auth/reset-password','POST',{token:rt,password:'null\0password-long'})).status,422);
 assert.equal((await reset.call('/auth/reset-password','POST',{token:rt,password:next})).status,200);
 assert.equal((await reset.call('/auth/reset-password','POST',{token:rt,password:next})).status,422);
 assert.equal((await b.call('/me','GET',{}, {cookie:oldCookie})).status,401);
 assert.equal((await a.call('/me')).status,401);
 await db.query('DELETE FROM auth_rate_limits');
 const login=client();await login.call('/session');assert.equal((await login.call('/auth/login','POST',{email,password})).status,401);assert.equal((await login.call('/auth/login','POST',{email,password:next})).status,200);
 const [hashes]=await db.execute('SELECT password_hash FROM users WHERE id=?',[id]);assert.notEqual(hashes[0].password_hash,next);
 assert.equal((await login.call('/auth/verification-request','POST',{})).status,200);
 assert.equal((await reset.call('/auth/verification-request','POST',{})).status,401);
 for(let i=0;i<21;i++)await reset.call('/auth/forgot-password','POST',{email:'unknown@example.test'});
 assert.equal((await reset.call('/auth/forgot-password','POST',{email:'unknown@example.test'})).status,429);
 }finally{try{if(id)await db.execute('DELETE FROM users WHERE id=?',[id]);await db.query('DELETE FROM auth_rate_limits');}finally{await clearMessages(email);await db.end();}}
});
