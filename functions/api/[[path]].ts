import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { validate } from '../../src/model';
import { defaultGrants, type Account } from '../../src/accounts';
import { exampleStore } from '../../cloudflare/examples';
export interface Env { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; LAGERRAUM_TEST_MODE?: string; }
type Context={request:Request;env:Env};
class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
const cookieNames=['lr_access','lr_refresh'];
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const password=()=>{const b=crypto.getRandomValues(new Uint8Array(24));return Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');};
const emailFor=(s:string)=>s.includes('@')?s.toLowerCase():s.toLowerCase()+'@users.lagerraum.invalid';
const check=(r:{error:any})=>{if(r.error)throw new HttpError(r.error.code==='42501'?403:['40001','PT409'].includes(r.error.code)?409:400,'Die Anfrage wurde abgelehnt: '+r.error.message);};
async function jsonBody(req:Request){if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON erforderlich.');const reader=req.body?.getReader();let length=0;const chunks:Uint8Array[]=[];if(reader)while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>12_000_000){await reader.cancel();fail(413,'Maximal 12 MB.');}chunks.push(value);}const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Ungültiges JSON.');}}
function sessionId(token:string){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id as string;}catch{fail(401,'Bitte erneut anmelden.');}}
export async function onRequest({request:req,env}:Context):Promise<Response>{
 const url=new URL(req.url),path=url.pathname;const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
 const secure=url.protocol==='https:';
 const setCookie=(name:string,value:string,maxAge:number)=>headers.append('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`);
 const clear=()=>cookieNames.forEach(n=>setCookie(n,'',0));
 const setSession=(s:Session)=>{setCookie('lr_access',s.access_token,s.expires_in||3600);setCookie('lr_refresh',s.refresh_token,43200);};
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
 try{
  if(!['GET','POST'].includes(req.method))fail(405,'Methode nicht verfügbar.');
  if(req.method==='POST'&&req.headers.get('origin')!==url.origin)fail(403,'Ungültiger Ursprung der Anfrage.');
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)fail(503,'Supabase ist noch nicht verbunden. Cloudflare-Secrets und Datenbankmigration prüfen.');
  if(!env.SUPABASE_URL.startsWith('https://')&&!(env.LAGERRAUM_TEST_MODE==='local'&&/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.SUPABASE_URL)))fail(503,'Eine sichere Supabase-URL ist erforderlich.');
  const anon=()=>createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,options);
  const service=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
  const b=req.method==='POST'?await jsonBody(req):undefined;
  if(path==='/api/health')return reply({backend:'supabase',registration:false});
  const cookies=Object.fromEntries((req.headers.get('cookie')||'').split(';').filter(v=>v.includes('=')).map(v=>{const i=v.indexOf('=');return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1))];}));
  if(path==='/api/auth/sign-in/email'&&req.method==='POST'){
   if(typeof b.email!=='string'||typeof b.password!=='string')fail(400,'Zugangsdaten fehlen.');
   const client=anon();const result=await client.auth.signInWithPassword({email:b.email.toLowerCase(),password:b.password});
   if(result.error||!result.data.session)fail(401,'Anmeldung nicht möglich.');
   const s=result.data.session;const p=await service.from('lr_profiles').select('active,must_change,pass_expires').eq('id',s.user.id).single();
   if(p.error||!p.data.active||p.data.must_change&&p.data.pass_expires&&new Date(p.data.pass_expires).getTime()<=Date.now()){await client.auth.signOut();fail(401,'Anmeldung nicht möglich.');}
   check(await service.from('lr_sessions').insert({session_id:sessionId(s.access_token),user_id:s.user.id}));
   check(await service.from('lr_login_events').insert({user_id:s.user.id}));
   check(await service.from('lr_profiles').update({last_login:new Date().toISOString()}).eq('id',s.user.id));
   setSession(s);return reply({ok:true});
  }
  if(path.startsWith('/api/auth/')&&!['/api/auth/sign-out','/api/auth/get-session'].includes(path))fail(404,'Nicht verfügbar.');
  let token=cookies.lr_access;
  // Verify tokens with Supabase Auth. Refresh only this admitted session.
  let client=anon();let verified=token?await client.auth.getUser(token):null;
  if((!verified||verified.error)&&cookies.lr_refresh){const refreshed=await client.auth.refreshSession({refresh_token:cookies.lr_refresh});if(!refreshed.error&&refreshed.data.session){token=refreshed.data.session.access_token;verified=await client.auth.getUser(token);setSession(refreshed.data.session);}}
  if(!token||!verified?.data.user||verified.error){clear();fail(401,'Bitte anmelden.');}
  client=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{...options,global:{headers:{Authorization:'Bearer '+token}}});
  const me=await client.rpc('lr_me');if(me.error){clear();fail(401,'Bitte erneut anmelden. Zugang oder Startpasswort prüfen.');}
  const user=me.data.user as Account;
  const admin=()=>{if(user.role!=='admin'||user.mustChangePassword)fail(403,'Nur Administratoren.');};
  if(path==='/api/me'||path==='/api/auth/get-session')return reply({...me.data,backend:'supabase'});
  if(path==='/api/auth/sign-out'&&req.method==='POST'){
   check(await service.from('lr_sessions').delete().eq('session_id',sessionId(token)).eq('user_id',user.id));
   await service.auth.admin.signOut(token,'local');clear();return reply({ok:true});
  }
  if(path==='/api/me/password'&&req.method==='POST'){
   if(typeof b.currentPassword!=='string'||typeof b.newPassword!=='string'||b.newPassword.length<12||b.newPassword.length>128)fail(400,'Passwort: 12–128 Zeichen erforderlich.');
   const proof=anon();const current=await proof.auth.signInWithPassword({email:user.email,password:b.currentPassword});
   if(current.error)fail(403,'Aktuelles Passwort ungültig.');
   // Fresh credential verification is required even for a valid browser session.
   const update=await proof.auth.updateUser({password:b.newPassword});check(update);
   await service.auth.admin.signOut(token,'global');
   check(await service.from('lr_sessions').delete().eq('user_id',user.id));
   check(await service.from('lr_profiles').update({must_change:false,pass_expires:null}).eq('id',user.id));
   const fresh=await anon().auth.signInWithPassword({email:user.email,password:b.newPassword});
   if(fresh.error||!fresh.data.session){clear();fail(401,'Passwort geändert. Bitte erneut anmelden.');}
   check(await service.from('lr_sessions').insert({session_id:sessionId(fresh.data.session.access_token),user_id:user.id}));setSession(fresh.data.session);return reply({ok:true});
  }
  if(user.mustChangePassword)fail(403,'Zuerst Startpasswort ändern.');
  if(path==='/api/me/preferences'&&req.method==='POST'){const r=await client.rpc('lr_preferences',{preferences:b});check(r);return reply(r.data);}
  if(path==='/api/admin/dashboard'&&req.method==='GET'){admin();const r=await client.rpc('lr_admin_dashboard');check(r);return reply(r.data);}
  if(path==='/api/admin/users'&&req.method==='POST'){
   admin();if(typeof b.login!=='string'||! /^[A-Za-z0-9._@+\-]{3,120}$/.test(b.login)||typeof b.name!=='string'||!b.name.trim())fail(400,'Kennung und Name prüfen.');
   const temporaryPassword=password(),email=emailFor(b.login);
   const made=await service.auth.admin.createUser({email,password:temporaryPassword,email_confirm:true,user_metadata:{name:b.name}});check(made);
   const id=made.data.user!.id;
   const save=await client.rpc('lr_admin_save',{uid:id,details:{...b,permissions:b.permissions||defaultGrants[b.role as Account['role']],active:b.active!==false,warehouseIds:b.warehouseIds||[]}});
   if(save.error){await service.auth.admin.deleteUser(id);check(save);}
   check(await service.from('lr_profiles').update({login:b.login.toLowerCase()}).eq('id',id));
   return reply({id,temporaryPassword,expiresAt:new Date(Date.now()+3600000).toISOString()},201);
  }
  const match=path.match(/^\/api\/admin\/users\/([0-9a-f-]+)(\/reset)?$/i);
  if(match&&req.method==='POST'){
   admin();const id=match[1];
   if(match[2]){
    if(id===user.id)fail(400,'Eigenes Passwort über Mein Profil ändern.');
    const temporaryPassword=password();check(await service.auth.admin.updateUserById(id,{password:temporaryPassword}));
    const expiresAt=new Date(Date.now()+3600000).toISOString();check(await service.from('lr_profiles').update({must_change:true,pass_expires:expiresAt}).eq('id',id));
    check(await service.from('lr_sessions').delete().eq('user_id',id));
    check(await service.from('lr_audit').insert({actor:user.id,action:'user.reset',subject:id}));return reply({temporaryPassword,expiresAt});
   }
   const r=await client.rpc('lr_admin_save',{uid:id,details:b});check(r);return reply(r.data);
  }
  if(path==='/api/store'&&req.method==='GET'){const r=await client.rpc('lr_store');check(r);return reply(r.data);}
  if(path==='/api/store/commit'&&req.method==='POST'){
   if(b.version!==2||!Array.isArray(b.warehouses))fail(400,'Ungültige Lagerverwaltung.');
   for(const w of b.warehouses)validate(w.data);
   const r=await client.rpc('lr_commit',{payload:b});check(r);return reply(r.data);
  }
  if(path==='/api/demo'&&req.method==='POST'){
   if(!user.permissions.includes('warehouse.create')||!user.permissions.includes('warehouse.manage'))fail(403,'Verwaltungs- und Erstellrecht erforderlich.');
   // Exactly two clearly labelled examples; all identifiers are confined to this account.
   let store=me.data.store;const examples=exampleStore(user.id);
   const missing=examples.warehouses.filter(w=>!store.warehouses.some((v:any)=>v.id===w.id));
   if(missing.length){const empty=missing.map(w=>({...w,data:{version:1,racks:[],materials:[],stock:[]}}));const created=await client.rpc('lr_commit',{payload:{...store,activeId:empty[0].id,warehouses:[...store.warehouses,...empty]}});check(created);store=created.data;
    store={...store,warehouses:store.warehouses.map((w:any)=>{const sample=missing.find(v=>v.id===w.id);return sample?{...sample,revision:w.revision}:w;})};
    const seeded=await client.rpc('lr_commit',{payload:store});check(seeded);store=seeded.data;
   }
   return reply(store);
  }
  const wp=path.match(/^\/api\/warehouses\/([^/]+)$/);
  if(wp&&req.method==='GET'){const w=me.data.store.warehouses.find((v:any)=>v.id===wp[1]);if(!w)fail(403,'Kein Zugriff auf dieses Lager.');return reply(w);}
  fail(404,'Nicht verfügbar.');
 }catch(e){const err=e as Error;return reply({error:err instanceof HttpError?err.message:'Anfrage fehlgeschlagen. Supabase-Konfiguration und Verbindung prüfen.'},err instanceof HttpError?err.status:500);}
}
