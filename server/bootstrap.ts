import {auth,db,createUser,defaults} from './auth';
const login=process.env.LAGERRAUM_ADMIN_LOGIN,name=process.env.LAGERRAUM_ADMIN_NAME||'Administration';
if(!login)throw Error('LAGERRAUM_ADMIN_LOGIN angeben. Passwort ausschließlich über Standardeingabe bereitstellen.');
if(db.prepare("SELECT 1 FROM app_profile WHERE role='admin'").get())throw Error('Administrator existiert bereits. Weitere Nutzer über das Dashboard anlegen.');
if(process.stdin.isTTY)throw Error('Passwort verdeckt mit read -s erfassen und über Standardeingabe übergeben; siehe BENUTZERKONTEN.md.');
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>512)throw Error('Eingabe zu lang.');}const password=input.replace(/\r?\n$/,'');
const id=await createUser(login,name,'admin',password,defaults.admin);db.prepare('UPDATE app_profile SET must_change=0,pass_expires=NULL WHERE user_id=?').run(id);console.log('Erster Administrator angelegt. Kein Lagerzugriff wurde vergeben.');db.close();
