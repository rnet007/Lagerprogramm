import Database from 'better-sqlite3';
import {betterAuth} from 'better-auth';
import {admin} from 'better-auth/plugins';
import {APIError} from 'better-auth/api';
import {getMigrations} from 'better-auth/db/migration';
import {mkdirSync,existsSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
export const dir=resolve(process.env.LAGERRAUM_DATA_DIR||'server-data');mkdirSync(dir,{recursive:true,mode:0o700});
let secret=process.env.BETTER_AUTH_SECRET;if(!secret){if(process.env.NODE_ENV==='production')throw Error('BETTER_AUTH_SECRET fehlt.');const path=resolve(dir,'auth-secret');if(!existsSync(path))writeFileSync(path,randomBytes(48).toString('base64url'),{mode:0o600});secret=readFileSync(path,'utf8');}if(secret.length<32)throw Error('BETTER_AUTH_SECRET benötigt mindestens 32 Zeichen.');
export const baseURL=process.env.PUBLIC_BASE_URL||'http://localhost:5176';if(process.env.NODE_ENV==='production'&&!baseURL.startsWith('https://'))throw Error('Öffentlicher Betrieb erfordert PUBLIC_BASE_URL mit HTTPS.');
export const db=new Database(resolve(dir,'lagerraum.sqlite'));chmodSync(resolve(dir,'lagerraum.sqlite'),0o600);db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS app_profile (user_id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, permissions TEXT NOT NULL, favorite TEXT, last_warehouse TEXT, must_change INTEGER NOT NULL DEFAULT 1, pass_expires INTEGER, last_login TEXT);
CREATE TABLE IF NOT EXISTS warehouses (id TEXT PRIMARY KEY,name TEXT NOT NULL,buildings TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS warehouse_members (user_id TEXT NOT NULL,warehouse_id TEXT NOT NULL,PRIMARY KEY(user_id,warehouse_id),FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS login_events (user_id TEXT NOT NULL,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY,actor TEXT,action TEXT,subject TEXT,at TEXT NOT NULL);`);
const options={database:db,baseURL,secret,trustedOrigins:[baseURL],emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:12,maxPasswordLength:128},session:{expiresIn:60*60*12,updateAge:60*30,cookieCache:{enabled:false}},rateLimit:{enabled:true,window:60,max:100,customRules:{'/sign-in/email':{window:60,max:10}}},plugins:[admin()],databaseHooks:{session:{create:{before:async(session)=>{const p=db.prepare('SELECT * FROM app_profile WHERE user_id=?').get(session.userId) as any;if(!p||!p.active||p.must_change&&p.pass_expires&&p.pass_expires<Date.now())throw new APIError('UNAUTHORIZED',{message:'Anmeldung nicht möglich. Zugang oder Startpasswort prüfen.'});return {data:session};},after:async(session,ctx)=>{if(ctx?.path!=='/sign-in/email')return;const at=new Date().toISOString();db.prepare('UPDATE app_profile SET last_login=? WHERE user_id=?').run(at,session.userId);db.prepare('INSERT INTO login_events VALUES (?,?)').run(session.userId,at);}}}}} satisfies Parameters<typeof betterAuth>[0];
const migrations=await getMigrations(options);await migrations.runMigrations();
export const auth=betterAuth(options);
export type Role='admin'|'manager'|'worker'|'reader';
export const permissions=['warehouse.read','warehouse.manage','stock.assign','sap.manage','warehouse.create'] as const;
export const defaults:Record<Role,string[]>={admin:['warehouse.read'],manager:[...permissions],worker:['warehouse.read','stock.assign','sap.manage'],reader:['warehouse.read']};
export const emailFor=(login:string)=>login.includes('@')?login.toLowerCase():`${login.toLowerCase()}@users.lagerraum.invalid`;
export const audit=(actor:string,action:string,subject:string)=>db.prepare('INSERT INTO audit(actor,action,subject,at) VALUES (?,?,?,?)').run(actor,action,subject,new Date().toISOString());
export async function createUser(login:string,name:string,role:Role,password:string,grants=defaults[role]){if(typeof login!=='string'||typeof name!=='string'||!/^[a-zA-Z0-9._@+\-]{3,120}$/.test(login)||!name.trim()||!['admin','manager','worker','reader'].includes(role))throw Error('Name, Benutzername/E-Mail und Rolle prüfen.');if(password.length<12||password.length>128)throw Error('Passwort benötigt 12 bis 128 Zeichen.');const created=await auth.api.createUser({body:{email:emailFor(login),name,role:role==='admin'?'admin':'user',password}});db.prepare('INSERT INTO app_profile(user_id,login,role,permissions,must_change,pass_expires) VALUES (?,?,?,?,1,?)').run(created.user.id,login.toLowerCase(),role,JSON.stringify(grants),Date.now()+60*60*1000);return created.user.id;}
export async function resetPassword(id:string){const password=randomBytes(24).toString('base64url'),ctx=await auth.$context;await ctx.internalAdapter.updatePassword(id,await ctx.password.hash(password));await ctx.internalAdapter.deleteUserSessions(id);db.prepare('UPDATE app_profile SET must_change=1,pass_expires=? WHERE user_id=?').run(Date.now()+60*60*1000,id);return {temporaryPassword:password,expiresAt:new Date(Date.now()+60*60*1000).toISOString()};}
