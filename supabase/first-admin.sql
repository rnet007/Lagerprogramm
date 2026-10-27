-- Run once, only in the NEW Lagerraum project's SQL Editor.
-- First create your own user with your own password under Authentication > Users.
-- Replace this email with EXACTLY that user's email. No passwords belong in SQL.
do $$
declare email_to_promote text := 'HIER-EIGENE-ADMIN-EMAIL-EINTRAGEN'; uid uuid;
begin
 if exists(select 1 from public.lr_profiles where role='admin' and active) then
  raise exception 'Administrator bereits vorhanden. Weitere Nutzer im Dashboard verwalten.';
 end if;
 select id into uid from auth.users where lower(email)=lower(email_to_promote);
 if uid is null then raise exception 'Zuerst den eigenen Auth-Nutzer anlegen und die E-Mail im Skript ersetzen.'; end if;
 if not exists(select 1 from public.lr_profiles where id=uid) then
  raise exception 'Nutzer nach der Datenbankmigration anlegen; Profil fehlt.';
 end if;
 update public.lr_profiles set role='admin',active=true,must_change=false,pass_expires=null,
 permissions=array['warehouse.read','warehouse.manage','stock.assign','sap.manage','warehouse.create'] where id=uid;
 -- Still NO warehouse membership. Examples/empty warehouses are created explicitly.
 insert into public.lr_audit(actor,action,subject) values(uid,'first_admin.created',uid::text);
end $$;
