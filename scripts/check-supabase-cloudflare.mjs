// Integration against real local GoTrue + PostgREST + PostgreSQL and Cloudflare workerd.
// No hosted Supabase/Cloudflare account, real company data or production secret is used.
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {randomBytes,createHmac} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import assert from 'node:assert/strict';
const output=process.env.OUTPUT_DIR||'test-results/supabase-cloudflare';await mkdir(output,{recursive:true});await rm(output+'/failure.json',{force:true});await rm(output+'/results.json',{force:true});
const prefix='lagerraum-check-'+randomBytes(4).toString('hex');const network=prefix;const containers=[];const passed=[];const pageErrors=[];let mf,browser,gateway,authPort,restPort;
const temp=await mkdtemp('/tmp/lagerraum-supabase-');
const secret=randomBytes(48).toString('base64url');
const jwt=role=>{const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const b=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200});return b+'.'+createHmac('sha256',secret).update(b).digest('base64url');};
const anon=jwt('anon'),service=jwt('service_role');
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:2e6});if(r.status!==0)throw Error('Docker '+args[0]+' fehlgeschlagen: '+r.stderr);return r.stdout.trim();}
async function wait(fn,label){const end=Date.now()+90000;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(e){last=e;}await new Promise(r=>setTimeout(r,300));}throw Error(label+' nicht bereit: '+String(last||''));}
function run(name,image,env,port){const cname=prefix+'-'+name;containers.push(cname);docker(['run','-d','--name',cname,'--network',network,'--network-alias',name,'-p','127.0.0.1::'+port,...Object.entries(env).flatMap(([k,v])=>['-e',k+'='+v]),image]);return Number(docker(['port',cname,String(port)]).split(':').at(-1));}
const sql=text=>docker(['exec','-i',prefix+'-db','psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],text);
const pass=s=>{passed.push(s);console.log('OK '+s);};
try{
 docker(['network','create',network]);
 const dbPort=run('db','postgres:16-alpine',{POSTGRES_HOST_AUTH_METHOD:'trust'},5432);
 await wait(()=>{try{return docker(['exec',prefix+'-db','pg_isready','-h','127.0.0.1','-U','postgres']).includes('accepting');}catch{return false;}},'PostgreSQL');
 sql(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create role supabase_auth_admin login createrole;create schema auth authorization supabase_auth_admin;grant usage on schema public to anon,authenticated,service_role,supabase_auth_admin;grant all on schema auth to supabase_auth_admin;create extension if not exists pgcrypto;alter role supabase_auth_admin set search_path=auth,public;`);
 gateway=createServer(async(req,res)=>{try{let target;if(req.url.startsWith('/auth/v1/'))target='http://127.0.0.1:'+authPort+req.url.slice('/auth/v1'.length);else if(req.url.startsWith('/rest/v1/'))target='http://127.0.0.1:'+restPort+req.url.slice('/rest/v1'.length);else{res.writeHead(404);res.end();return;}const chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers};delete headers.host;const r=await fetch(target,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual'});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(502);res.end('Local gateway unavailable');}});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));const supabaseUrl='http://127.0.0.1:'+gateway.address().port;
 authPort=run('auth','supabase/gotrue:v2.186.0',{GOTRUE_API_HOST:'0.0.0.0',PORT:'9999',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:supabaseUrl,GOTRUE_SITE_URL:'http://localhost:8788',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:'postgres://supabase_auth_admin@db:5432/postgres?sslmode=disable',GOTRUE_DB_NAMESPACE:'auth',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_DISABLE_SIGNUP:'true',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_LOG_LEVEL:'error'},9999);
 await wait(async()=>{const r=await fetch(supabaseUrl+'/auth/v1/health');return r.ok;},'Supabase Auth');
 sql(`create or replace function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
 sql(await readFile('supabase/migrations/202610270001_lagerraum.sql','utf8'));
 restPort=run('rest','postgrest/postgrest:v13.0.4',{PGRST_DB_URI:'postgres://postgres@db:5432/postgres',PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_SERVER_PORT:'3000'},3000);
 await wait(async()=>{const r=await fetch(supabaseUrl+'/rest/v1/');return r.ok;},'PostgREST');
 const serviceClient=createClient(supabaseUrl,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const adminPassword=randomBytes(24).toString('base64url');
 const created=await serviceClient.auth.admin.createUser({email:'test-admin@example.invalid',password:adminPassword,email_confirm:true,user_metadata:{name:'Test Administration'}});assert.ifError(created.error);const adminId=created.data.user.id;
 const firstAdmin=(await readFile('supabase/first-admin.sql','utf8')).replace('HIER-EIGENE-ADMIN-EMAIL-EINTRAGEN','test-admin@example.invalid');sql(firstAdmin);assert.throws(()=>sql(firstAdmin));
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:resolve('.cloudflare-build/index.js'),compatibilityDate:'2026-10-27',compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',port:0,bindings:{SUPABASE_URL:supabaseUrl,SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,LAGERRAUM_TEST_MODE:'local'},serviceBindings:{ASSETS:async request=>{let path=new URL(request.url).pathname;if(path==='/')path='/index.html';if(path.includes('..'))return new Response('Forbidden',{status:403});let bytes;try{bytes=await readFile(resolve('dist','.'+path));}catch{path='/index.html';bytes=await readFile('dist/index.html');}return new Response(bytes,{headers:{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream'}});}}}));
 const base=String(await mf.ready).replace(/\/$/,'');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const contexts=[];async function page(){const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});contexts.push(ctx);const p=await ctx.newPage();p.on('response',async r=>{if(r.url().includes('/api/')&&r.status()>=400){try{const d=await r.json();console.log('API-Diagnose',new URL(r.url()).pathname,r.status(),d.error||'');}catch{}}});p.on('pageerror',e=>pageErrors.push(e.message));return p;}
 async function request(p,path,body){return p.context().request.fetch(base+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{Origin:base,'Content-Type':'application/json'},data:body});}
 async function data(p,path,body){const r=await request(p,path,body);const v=await r.json();assert(r.ok(),JSON.stringify(v));return v;}
 async function login(p,email,pw){await p.goto(base);await p.getByLabel('Benutzername oder E-Mail',{exact:true}).fill(email);await p.getByLabel('Passwort',{exact:true}).fill(pw);await p.getByRole('button',{name:'Anmelden',exact:true}).click();}
 const a=await page();await login(a,'test-admin@example.invalid',adminPassword);await expect(a.getByRole('heading',{name:'Benutzerverwaltung',exact:true})).toBeVisible({timeout:20000});assert.equal((await data(a,'/api/me')).store.warehouses.length,0);
 assert.equal((await request(a,'/api/auth/sign-up/email',{email:'public@example.invalid',password:'NotARealPassword123'})).status(),404);
 const directSignup=await fetch(supabaseUrl+'/auth/v1/signup',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:'public@example.invalid',password:'NotARealPassword123'})});assert(!directSignup.ok);
 const ck=await a.context().cookies();assert(ck.some(c=>c.name==='lr_access'&&c.httpOnly&&c.sameSite==='Lax'));
 pass('Echte lokale Supabase-Auth-Anmeldung über Cloudflare workerd, HttpOnly-Sitzung, Admin ohne Lager und Registrierung auf beiden Wegen gesperrt');
 await a.getByRole('button',{name:'Zugewiesene Lager öffnen'}).click();await a.getByRole('button',{name:'Zwei reine Beispiellager anlegen'}).click();await expect(a.getByRole('button',{name:'Lagerverwaltung: BEISPIEL · Testlager A',exact:true})).toBeVisible({timeout:20000});
 const state=await data(a,'/api/store');assert.equal(state.warehouses.length,2);assert.deepEqual(await data(a,'/api/demo',{}),state);const wa=state.warehouses.find(w=>w.name.endsWith('A')),wb=state.warehouses.find(w=>w.name.endsWith('B'));assert.equal(wa.data.materials[0].number,'00007045210');
 const reader=await data(a,'/api/admin/users',{name:'Test Leser',login:'test-reader',role:'reader',active:true,permissions:['warehouse.read'],warehouseIds:[wa.id]});
 const bpage=await page();await login(bpage,'test-reader',reader.temporaryPassword);await expect(bpage.getByRole('heading',{name:'Startpasswort ändern'})).toBeVisible({timeout:20000});assert.equal((await request(bpage,'/api/store')).status(),403);
 const readerPassword=randomBytes(24).toString('base64url');await bpage.getByLabel('Neues Passwort',{exact:true}).fill(readerPassword);await bpage.getByRole('button',{name:'Passwort ändern',exact:true}).click();await expect(bpage.getByRole('button',{name:'Lagerverwaltung: BEISPIEL · Testlager A',exact:true})).toBeVisible({timeout:20000});
 assert.equal((await data(bpage,'/api/store')).warehouses.length,1);assert.equal((await request(bpage,'/api/warehouses/'+wb.id)).status(),403);
 const attempted=structuredClone(await data(bpage,'/api/store'));attempted.warehouses[0].name='Verboten';assert.equal((await request(bpage,'/api/store/commit',attempted)).status(),403);
 pass('Beispiele ausdrücklich angelegt; Konto zugewiesen, Startpasswort erzwungen, getrennte Sitzung sieht nur Lager A und kann auch direkt nicht schreiben');
 const anonClient=createClient(supabaseUrl,anon,{auth:{persistSession:false}});const rawReader=await anonClient.auth.signInWithPassword({email:'test-reader@users.lagerraum.invalid',password:readerPassword});assert.ifError(rawReader.error);
 const rawRead=await anonClient.from('lr_warehouses').select('id');assert(rawRead.error||rawRead.data.length===0);const rawRPC=await anonClient.rpc('lr_store');assert(rawRPC.error);
 const rawWrite=await anonClient.from('lr_warehouses').update({name:'Verboten'}).eq('id',wa.id);assert(rawWrite.error);await anonClient.auth.signOut({scope:'local'});
 const admittedCookies=await bpage.context().cookies();const access=admittedCookies.find(c=>c.name==='lr_access').value;
 const admitted=createClient(supabaseUrl,anon,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+decodeURIComponent(access)}}});
 const visible=await admitted.from('lr_warehouses').select('id');assert.ifError(visible.error);assert.deepEqual(visible.data.map(w=>w.id),[wa.id]);
 const forbidden=await admitted.rpc('lr_commit',{payload:attempted});assert.equal(forbidden.error.code,'42501');
 assert((await admitted.rpc('lr_admin_dashboard')).error);assert((await admitted.from('lr_profiles').update({role:'admin'}).eq('id',reader.id)).error);
 pass('Direkte Supabase-Anmeldung ohne freigegebene Anwendungssitzung erhält weder Lagerdaten noch RPC- oder Tabellen-Schreibzugriff');
 // Browser B stays open while A saves. B must refresh its actual material UI automatically.
 await bpage.getByRole('button',{name:'Materialien',exact:true}).click();
 const worker=await data(a,'/api/admin/users',{name:'Test Mitarbeiter',login:'test-worker',role:'worker',active:true,permissions:['warehouse.read','stock.assign','sap.manage'],warehouseIds:[wa.id]});
 const wp=await page();await login(wp,'test-worker',worker.temporaryPassword);await expect(wp.getByRole('heading',{name:'Startpasswort ändern'})).toBeVisible({timeout:20000});await wp.getByLabel('Neues Passwort',{exact:true}).fill(randomBytes(24).toString('base64url'));await wp.getByRole('button',{name:'Passwort ändern',exact:true}).click();await expect(wp.getByRole('button',{name:'Lagerverwaltung: BEISPIEL · Testlager A',exact:true})).toBeVisible({timeout:20000});
 const workerStore=await data(wp,'/api/store');const workerData=workerStore.warehouses[0].data;workerData.stock.push({id:crypto.randomUUID(),materialId:workerData.materials[0].id,slotId:workerData.racks[0].slots[0].id,quantity:2});
 const workerSaved=await data(wp,'/api/store/commit',workerStore);workerSaved.warehouses[0].data.racks[0].width=5;assert.equal((await request(wp,'/api/store/commit',workerSaved)).status(),403);
 pass('Mitarbeiter darf Bestand und Zuordnung schreiben, jedoch auch durch direkte RPC-Anfragen keine Regalstruktur ändern');
 await a.bringToFront();await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.getByRole('button',{name:'Materialien',exact:true}).click();await expect(a.locator('tbody tr').filter({hasText:'00007045210'})).toContainText('2 Stk.',{timeout:20000});
 console.log('Prüfe Speichern über Materialdialog und Synchronisierung');
 let changed=structuredClone(await data(a,'/api/store'));changed.warehouses.find(w=>w.id===wa.id).data.materials[0].name='Veralteter Stand';
 await a.getByRole('button',{name:'Materialien',exact:true}).click();await a.getByRole('button',{name:'00007045210 bearbeiten',exact:true}).click();await a.getByLabel('Materialbezeichnung',{exact:true}).fill('Synchronisiert aus Sitzung A');const concurrent=await data(wp,'/api/store');concurrent.warehouses[0].data.stock[0].quantity=3;await data(wp,'/api/store/commit',concurrent);
 await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(a.getByText('Zentrale Änderung vorhanden. Ihre Eingabe bleibt erhalten; bitte Bearbeitung abschließen oder abbrechen.',{exact:true})).toBeVisible({timeout:20000});
 await expect(a.getByLabel('Materialbezeichnung',{exact:true})).toHaveValue('Synchronisiert aus Sitzung A');await a.getByRole('button',{name:'Material speichern',exact:true}).click();await expect(a.getByRole('heading',{name:'Material bearbeiten',exact:true})).toBeVisible();await expect(a.getByLabel('Materialbezeichnung',{exact:true})).toHaveValue('Synchronisiert aus Sitzung A');
 await a.getByRole('button',{name:'Abbrechen',exact:true}).click();changed=await data(a,'/api/store');await a.getByRole('button',{name:'00007045210 bearbeiten',exact:true}).click();await a.getByLabel('Materialbezeichnung',{exact:true}).fill('Synchronisiert aus Sitzung A');await a.getByRole('button',{name:'Material speichern',exact:true}).click();await expect(a.getByRole('heading',{name:'Material bearbeiten',exact:true})).not.toBeVisible();
 console.log('Materialdialog gespeichert');
 const committed=await data(a,'/api/store');assert.equal(committed.warehouses.find(w=>w.id===wa.id).revision,changed.warehouses.find(w=>w.id===wa.id).revision+1);
 await expect(bpage.getByText('Synchronisiert aus Sitzung A',{exact:true}).first()).toBeVisible({timeout:25000});
 const afterSync=await data(bpage,'/api/store');assert.equal(afterSync.warehouses[0].data.materials[0].name,'Synchronisiert aus Sitzung A');assert.equal(afterSync.warehouses[0].data.materials[0].number,'00007045210');
 await bpage.screenshot({path:output+'/01-synchronisierte-sitzung-b.png'});
 console.log('Synchronisierte Materialansicht in B bestätigt');
 const stale=structuredClone(changed);stale.warehouses.find(w=>w.id===wa.id).data.materials[0].name='Veralteter Stand';assert.equal((await request(a,'/api/store/commit',stale)).status(),409);
 console.log('Revisionskonflikt bestätigt');
 await bpage.reload();await expect(bpage.getByRole('button',{name:'Lagerverwaltung: BEISPIEL · Testlager A',exact:true})).toBeVisible({timeout:20000});
 pass('Zwei unabhängige Browser-Sitzungen: Speichern in A erscheint automatisch in B; führende Nullen und Neuladen erhalten; veraltete Version mit 409 abgewiesen und offene Formulare erhalten');
 const reset=await data(a,'/api/admin/users/'+reader.id+'/reset',{});assert.equal((await request(bpage,'/api/store')).status(),401);
 const c=await page();await login(c,'test-reader',readerPassword);await expect(c.getByRole('alert')).toContainText('Anmeldung nicht möglich');await login(c,'test-reader',reset.temporaryPassword);await expect(c.getByRole('heading',{name:'Startpasswort ändern'})).toBeVisible({timeout:20000});
 const updatedPassword=randomBytes(24).toString('base64url');await c.getByLabel('Neues Passwort',{exact:true}).fill(updatedPassword);await c.getByRole('button',{name:'Passwort ändern',exact:true}).click();await expect(c.getByRole('button',{name:'Lagerverwaltung: BEISPIEL · Testlager A',exact:true})).toBeVisible({timeout:20000});
 await data(a,'/api/admin/users/'+reader.id,{name:'Test Leser',role:'reader',active:false,permissions:['warehouse.read'],warehouseIds:[wa.id]});assert.equal((await request(c,'/api/store')).status(),401);await login(c,'test-reader',updatedPassword);await expect(c.getByRole('alert')).toContainText('Anmeldung nicht möglich');
 pass('Supabase-Passwort-Reset sperrt alte Kennwörter und Sitzungen; neuer Wechsel funktioniert; Deaktivierung verhindert Anmeldung');
 await data(a,'/api/auth/sign-out',{});assert.equal((await request(a,'/api/store')).status(),401);assert.equal(pageErrors.length,0);
 pass('Abmeldung sperrt Datenzugriff; keine unbehandelten Browserfehler');
 await writeFile(output+'/results.json',JSON.stringify({date:new Date().toISOString(),passed,pageErrors,backend:'local PostgreSQL16 + Supabase GoTrue + PostgREST + Cloudflare workerd',hostedDeploymentTested:false,syntheticDataOnly:true},null,2));
}catch(e){const clean=String(e).split('Call log:')[0];await writeFile(output+'/failure.json',JSON.stringify({date:new Date().toISOString(),passed,error:clean,pageErrors},null,2));throw new Error(clean);}
finally{if(browser)await browser.close();if(mf)await mf.dispose();if(gateway)await new Promise(r=>gateway.close(r));for(const c of containers.reverse())spawnSync('docker',['rm','-f',c],{stdio:'ignore'});spawnSync('docker',['network','rm',network],{stdio:'ignore'});await rm(temp,{recursive:true,force:true});}
