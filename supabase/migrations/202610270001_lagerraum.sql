-- Lagerraum, separate Supabase project only. No company data or credentials.
-- Intentionally preserves existing auth/users and never drops business tables.
begin;
create table public.lr_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null, login text not null unique, email text not null,
 role text not null default 'reader' check(role in ('admin','manager','worker','reader')),
 active boolean not null default false,
 permissions text[] not null default array['warehouse.read'],
 favorite text, last_warehouse text, must_change boolean not null default true,
 pass_expires timestamptz, last_login timestamptz
);
create table public.lr_warehouses (
 id text primary key, name text not null check(length(trim(name)) between 1 and 160),
 buildings jsonb not null default '[]', data jsonb not null,
 revision integer not null default 1, updated_at timestamptz not null default now()
);
create table public.lr_members (
 user_id uuid references public.lr_profiles(id) on delete cascade,
 warehouse_id text references public.lr_warehouses(id) on delete cascade,
 primary key(user_id,warehouse_id)
);
-- Only Pages Functions (service key) may admit a verified Supabase Auth session.
-- Reset/deactivation deletes admissions, immediately blocking still-live JWTs.
create table public.lr_sessions (
 session_id uuid primary key, user_id uuid not null references public.lr_profiles(id) on delete cascade,
 admitted_at timestamptz not null default now()
);
create index lr_sessions_user on public.lr_sessions(user_id);
create table public.lr_login_events (
 id bigint generated always as identity primary key,
 user_id uuid references public.lr_profiles(id) on delete cascade,
 at timestamptz not null default now()
);
create index lr_login_events_time on public.lr_login_events(at);
create table public.lr_audit (
 id bigint generated always as identity primary key,
 actor uuid references public.lr_profiles(id) on delete set null,
 action text not null, subject text, at timestamptz not null default now()
);

create function public.lr_auth_user_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.lr_profiles(id,name,login,email,pass_expires)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),new.email),lower(new.email),lower(new.email),now()+interval '1 hour');
 return new;
end $$;
create trigger lr_auth_user_created after insert on auth.users for each row execute function public.lr_auth_user_created();

create function public.lr_actor(allow_password boolean default false) returns public.lr_profiles
language plpgsql stable security definer set search_path='' as $$
declare p public.lr_profiles;
begin
 select * into p from public.lr_profiles where id=auth.uid();
 if p.id is null or not p.active or not exists(
  select 1 from public.lr_sessions where user_id=p.id and session_id=(auth.jwt()->>'session_id')::uuid and admitted_at>now()-interval '12 hours'
 ) then raise exception 'Bitte anmelden.' using errcode='42501'; end if;
 if p.must_change and p.pass_expires is not null and p.pass_expires<=now() then
  raise exception 'Startpasswort abgelaufen.' using errcode='42501'; end if;
 if p.must_change and not allow_password then raise exception 'Zuerst Startpasswort ändern.' using errcode='42501'; end if;
 return p;
end $$;
create function public.lr_readable(wid text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare p public.lr_profiles;
begin
 p:=public.lr_actor();
 return 'warehouse.read'=any(p.permissions) and exists(select 1 from public.lr_members where user_id=p.id and warehouse_id=wid);
end $$;

alter table public.lr_profiles enable row level security;
alter table public.lr_warehouses enable row level security;
alter table public.lr_members enable row level security;
alter table public.lr_sessions enable row level security;
alter table public.lr_login_events enable row level security;
alter table public.lr_audit enable row level security;
revoke all on public.lr_profiles,public.lr_warehouses,public.lr_members,public.lr_sessions,public.lr_login_events,public.lr_audit from anon,authenticated;
grant select on public.lr_warehouses to authenticated;
create policy lr_warehouse_select on public.lr_warehouses for select to authenticated using(public.lr_readable(id));
-- Profiles, sessions, catalog and mutations are available only through checked RPCs.

create function public.lr_safe_user(uid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'login',p.login,'role',p.role,'active',p.active,
 'permissions',p.permissions,'warehouseIds',coalesce((select jsonb_agg(m.warehouse_id order by m.warehouse_id) from public.lr_members m where m.user_id=p.id),'[]'),
 'warehouses',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name) order by w.name) from public.lr_warehouses w join public.lr_members m on m.warehouse_id=w.id where m.user_id=p.id),'[]'),
 'favorite',p.favorite,'lastWarehouse',p.last_warehouse,'mustChangePassword',p.must_change,'lastLogin',p.last_login)
 from public.lr_profiles p where p.id=uid
$$;
create function public.lr_store(selected text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.lr_profiles; ws jsonb; chosen text;
begin
 p:=public.lr_actor();
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'buildings',w.buildings,'data',w.data,'revision',w.revision) order by w.name,w.id),'[]') into ws
 from public.lr_warehouses w join public.lr_members m on m.warehouse_id=w.id
 where m.user_id=p.id and 'warehouse.read'=any(p.permissions);
 select candidate.id into chosen from unnest(array[selected,p.favorite,p.last_warehouse,ws->0->>'id']) as candidate(id)
 where exists(select 1 from jsonb_array_elements(ws) w where w->>'id'=candidate.id) limit 1;
 return jsonb_build_object('version',2,'builderExampleAdded',true,'activeId',coalesce(chosen,''),'warehouses',ws);
end $$;
create function public.lr_me() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.lr_profiles;
begin
 p:=public.lr_actor(true);
 return jsonb_build_object('user',public.lr_safe_user(p.id),'store',case when p.must_change then null else public.lr_store() end);
end $$;
create function public.lr_preferences(preferences jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.lr_profiles; v text;
begin
 p:=public.lr_actor();
 foreach v in array array[preferences->>'favorite',preferences->>'lastWarehouse'] loop
  if v is not null and not public.lr_readable(v) then raise exception 'Kein Lagerzugriff.' using errcode='42501'; end if;
 end loop;
 update public.lr_profiles set
 favorite=case when preferences?'favorite' then preferences->>'favorite' else favorite end,
 last_warehouse=case when preferences?'lastWarehouse' then preferences->>'lastWarehouse' else last_warehouse end where id=p.id;
 return jsonb_build_object('user',public.lr_safe_user(p.id));
end $$;

create function public.lr_validate_data(d jsonb) returns void language plpgsql immutable set search_path='' as $$
declare r jsonb; a jsonb; s jsonb; m jsonb; b jsonb; ids text[]:=array[]::text[]; slots text[]:=array[]::text[]; mats text[]:=array[]::text[];
begin
 if d->>'version' is distinct from '1' or jsonb_typeof(d->'racks') is distinct from 'array' or jsonb_typeof(d->'materials') is distinct from 'array' or jsonb_typeof(d->'stock') is distinct from 'array'
 then raise exception 'Ungültige Lagerdaten.'; end if;
 if jsonb_array_length(d->'racks')>100 or jsonb_array_length(d->'materials')>10000 or jsonb_array_length(d->'stock')>50000 then raise exception 'Prototyp-Grenze überschritten.'; end if;
 for r in select * from jsonb_array_elements(d->'racks') loop
  if coalesce(r->>'id','')='' or r->>'id'=any(ids) then raise exception 'Doppelte/fehlende ID.'; end if;
  ids:=array_append(ids,r->>'id');
  if coalesce(r->>'name','')='' or coalesce(r->>'building','')='' or coalesce(r->>'number','')='' or
   jsonb_typeof(r->'width') is distinct from 'number' or jsonb_typeof(r->'height') is distinct from 'number' or jsonb_typeof(r->'depth') is distinct from 'number' or jsonb_typeof(r->'x') is distinct from 'number' or jsonb_typeof(r->'z') is distinct from 'number' or jsonb_typeof(r->'rotation') is distinct from 'number' or jsonb_typeof(r->'areas') is distinct from 'array' or jsonb_typeof(r->'slots') is distinct from 'array' or
   not ((r->>'width')::numeric between .1 and 100 and (r->>'height')::numeric between .1 and 100 and (r->>'depth')::numeric between .1 and 100) then raise exception 'Ungültiges Regal.'; end if;
  if jsonb_array_length(r->'areas') not between 1 and 10 or jsonb_array_length(r->'slots')>4000 then raise exception 'Ungültige Unterteilung.'; end if;
  for a in select * from jsonb_array_elements(r->'areas') loop
   if coalesce(a->>'id','')='' or a->>'id'=any(ids) or coalesce(a->>'name','')='' or coalesce(a->>'prefix','')='' or jsonb_typeof(a->'columns') is distinct from 'number' or jsonb_typeof(a->'levels') is distinct from 'number' or not((a->>'columns')::numeric between 1 and 20 and (a->>'levels')::numeric between 1 and 20 and (a->>'columns')::numeric=trunc((a->>'columns')::numeric) and (a->>'levels')::numeric=trunc((a->>'levels')::numeric)) then raise exception 'Ungültiger Bereich.'; end if;
   ids:=array_append(ids,a->>'id');
  end loop;
  for s in select * from jsonb_array_elements(r->'slots') loop
   if jsonb_typeof(s->'number') is distinct from 'number' or (s->>'number')::numeric<>trunc((s->>'number')::numeric) or coalesce(s->>'id','')='' or s->>'id'=any(ids) then raise exception 'Doppelte/fehlende Fach-ID.'; end if;
   select value into a from jsonb_array_elements(r->'areas') where value->>'id'=s->>'areaId';
   if a is null or not ((s->>'number')::numeric between 1 and (a->>'columns')::numeric*(a->>'levels')::numeric) then raise exception 'Ungültiges Fach.'; end if;
   ids:=array_append(ids,s->>'id');slots:=array_append(slots,s->>'id');
  end loop;
 end loop;
 for m in select * from jsonb_array_elements(d->'materials') loop
  if jsonb_typeof(m->'number') is distinct from 'string' or coalesce(m->>'number','')='' or coalesce(m->>'name','')='' or coalesce(m->>'id','')='' or m->>'id'=any(ids) then raise exception 'Materialnummer muss eindeutiger Text sein; ID und Name erforderlich.'; end if;
  ids:=array_append(ids,m->>'id');mats:=array_append(mats,m->>'id');
  if exists(select 1 from jsonb_array_elements_text(coalesce(m->'assignedSlotIds','[]')) q where not(q=any(slots))) then raise exception 'Unbekanntes zugeordnetes Fach.'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(d->'materials'))<>(select count(distinct value->>'number') from jsonb_array_elements(d->'materials')) then raise exception 'Doppelte Materialnummer.'; end if;
 for b in select * from jsonb_array_elements(d->'stock') loop
  if jsonb_typeof(b->'quantity') is distinct from 'number' or coalesce(b->>'id','')='' or b->>'id'=any(ids) or not coalesce(b->>'slotId'=any(slots),false) or not coalesce(b->>'materialId'=any(mats),false) or not coalesce((b->>'quantity')::numeric between 0 and 1000000000,false) then raise exception 'Ungültiger Bestand.'; end if;
  ids:=array_append(ids,b->>'id');
 end loop;
end $$;

create function public.lr_commit(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.lr_profiles; w jsonb; old public.lr_warehouses; d jsonb; m jsonb; previous jsonb; sid text; seen text[]:=array[]::text[];
begin
 p:=public.lr_actor();
 if payload->>'version' is distinct from '2' or jsonb_typeof(payload->'warehouses') is distinct from 'array' or jsonb_array_length(payload->'warehouses')>100 or octet_length(payload::text)>12000000 then raise exception 'Ungültige Lagerverwaltung.'; end if;
 for w in select * from jsonb_array_elements(payload->'warehouses') order by value->>'id' loop
  sid:=w->>'id';d:=w->'data';
  if coalesce(sid,'')='' or length(sid)>160 or sid=any(seen) or coalesce(trim(w->>'name'),'')='' or length(w->>'name')>160 or jsonb_typeof(w->'buildings') is distinct from 'array' then raise exception 'Ungültiges Lager.'; end if;
  seen:=array_append(seen,sid);perform public.lr_validate_data(d);
  if exists(select 1 from jsonb_array_elements(d->'racks') r where not(w->'buildings' ? (r->>'building'))) or exists(select 1 from jsonb_array_elements(coalesce(d->'layout'->'halls','[]')) h where not(w->'buildings' ? (h->>'building'))) then raise exception 'Gebäudezuordnung fehlt.'; end if;
  select * into old from public.lr_warehouses where id=sid for update;
  if found then
   if not public.lr_readable(sid) then raise exception 'Kein Lagerzugriff.' using errcode='42501'; end if;
   if old.name=w->>'name' and old.buildings=w->'buildings' and old.data=d then continue; end if;
   if old.revision is distinct from (w->>'revision')::integer then raise exception 'Lager inzwischen geändert. Neu laden; diese Änderung wurde nicht gespeichert.' using errcode='PT409'; end if;
   if not('warehouse.manage'=any(p.permissions)) then
    if old.name is distinct from w->>'name' or old.buildings is distinct from w->'buildings' then raise exception 'Keine Verwaltungsberechtigung.' using errcode='42501'; end if;
    if 'stock.assign'=any(p.permissions) then
     if (old.data-array['materials','stock','sap']) is distinct from (d-array['materials','stock','sap']) or jsonb_array_length(old.data->'materials')<>jsonb_array_length(d->'materials') then raise exception 'Keine Struktur-/Stammdatenberechtigung.' using errcode='42501'; end if;
     for m in select * from jsonb_array_elements(old.data->'materials') loop
      select value into previous from jsonb_array_elements(d->'materials') where value->>'id'=m->>'id';
      if previous is null or (m-array['assignedSlotIds','oldLocations','pendingLocations']) is distinct from (previous-array['assignedSlotIds','oldLocations','pendingLocations']) then raise exception 'Keine Stammdatenberechtigung.' using errcode='42501'; end if;
     end loop;
    elsif not('sap.manage'=any(p.permissions)) or (old.data-'sap') is distinct from (d-'sap') then raise exception 'Keine Schreibberechtigung.' using errcode='42501'; end if;
    if not('sap.manage'=any(p.permissions)) and old.data->'sap' is distinct from d->'sap' then raise exception 'Keine SAP-Berechtigung.' using errcode='42501'; end if;
    if not(coalesce(old.data->'sap'->'events','[]') <@ coalesce(d->'sap'->'events','[]')) then raise exception 'Vorhandener SAP-Verlauf muss erhalten bleiben.' using errcode='42501'; end if;
   end if;
   update public.lr_warehouses set name=w->>'name',buildings=w->'buildings',data=d,revision=revision+1,updated_at=now() where id=sid;
  else
   if not('warehouse.create'=any(p.permissions)) or d<>'{"version":1,"racks":[],"materials":[],"stock":[]}'::jsonb then raise exception 'Neue Lager müssen leer sein und erfordern Erstellrecht.' using errcode='42501'; end if;
   insert into public.lr_warehouses(id,name,buildings,data) values(sid,w->>'name',w->'buildings',d);
   insert into public.lr_members values(p.id,sid);
  end if;
  insert into public.lr_audit(actor,action,subject) values(p.id,'warehouse.saved',sid);
 end loop;
 sid:=payload->>'activeId';
 if coalesce(sid,'')<>'' then
  if not(sid=any(seen)) or not public.lr_readable(sid) then raise exception 'Ausgewähltes Lager nicht zugänglich.' using errcode='42501'; end if;
  update public.lr_profiles set last_warehouse=sid where id=p.id;
 end if;
 return public.lr_store(sid);
end $$;

create function public.lr_admin_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.lr_profiles;
begin
 p:=public.lr_actor();if p.role<>'admin' then raise exception 'Nur Administratoren.' using errcode='42501'; end if;
 return jsonb_build_object('users',coalesce((select jsonb_agg(public.lr_safe_user(id) order by name) from public.lr_profiles),'[]'),
 'warehouses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.lr_warehouses),'[]'),
 'stats',jsonb_build_object('total',(select count(*) from public.lr_profiles),'enabled',(select count(*) from public.lr_profiles where active),
 'disabled',(select count(*) from public.lr_profiles where not active),'warehouses',(select count(*) from public.lr_warehouses),
 'active7',(select count(distinct user_id) from public.lr_login_events where at>=now()-interval '7 days'),
 'active30',(select count(distinct user_id) from public.lr_login_events where at>=now()-interval '30 days')));
end $$;
create function public.lr_admin_save(uid uuid, details jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.lr_profiles; target public.lr_profiles; grants text[]; wid text; r text;
begin
 p:=public.lr_actor();if p.role<>'admin' then raise exception 'Nur Administratoren.' using errcode='42501'; end if;
 -- Serialize privilege changes so two admins cannot disable the last two concurrently.
 perform id from public.lr_profiles where role='admin' order by id for update;
 select * into target from public.lr_profiles where id=uid for update;
 if target.id is null then raise exception 'Nutzer fehlt.'; end if;
 r:=details->>'role';
 if r not in ('admin','manager','worker','reader') or r is null or jsonb_typeof(details->'active') is distinct from 'boolean' or coalesce(trim(details->>'name'),'')='' or jsonb_typeof(details->'permissions') is distinct from 'array' or jsonb_typeof(details->'warehouseIds') is distinct from 'array' then raise exception 'Ungültiges Profil.'; end if;
 select coalesce(array_agg(distinct v),'{}') into grants from jsonb_array_elements_text(details->'permissions') v;
 if not(grants <@ array['warehouse.read','warehouse.manage','stock.assign','sap.manage','warehouse.create']) or
 (r='reader' and not(grants <@ array['warehouse.read'])) or (r='worker' and not(grants <@ array['warehouse.read','stock.assign','sap.manage'])) then raise exception 'Berechtigungen passen nicht zur Rolle.'; end if;
 if target.role='admin' and target.active and (r<>'admin' or not(details->>'active')::boolean) and (select count(*) from public.lr_profiles where role='admin' and active)<=1 then raise exception 'Letzter aktiver Administrator bleibt geschützt.'; end if;
 for wid in select * from jsonb_array_elements_text(details->'warehouseIds') loop
  if not exists(select 1 from public.lr_warehouses where id=wid) then raise exception 'Unbekanntes Lager.'; end if;
 end loop;
 update public.lr_profiles set name=trim(details->>'name'),role=r,active=(details->>'active')::boolean,permissions=grants where id=uid;
 delete from public.lr_members where user_id=uid;
 insert into public.lr_members select uid,value from (select distinct value from jsonb_array_elements_text(details->'warehouseIds')) t;
 update public.lr_profiles set favorite=case when exists(select 1 from public.lr_members where user_id=uid and warehouse_id=favorite) then favorite end,
 last_warehouse=case when exists(select 1 from public.lr_members where user_id=uid and warehouse_id=last_warehouse) then last_warehouse end where id=uid;
 delete from public.lr_sessions where user_id=uid;
 insert into public.lr_audit(actor,action,subject) values(p.id,'user.updated',uid::text);
 return jsonb_build_object('ok',true);
end $$;

-- Deny helper functions to the browser. SECURITY DEFINER alone never grants access.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lr\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
grant execute on function public.lr_readable(text),public.lr_me(),public.lr_store(text),public.lr_preferences(jsonb),public.lr_commit(jsonb),public.lr_admin_dashboard(),public.lr_admin_save(uuid,jsonb) to authenticated;
grant all on public.lr_profiles,public.lr_warehouses,public.lr_members,public.lr_sessions,public.lr_login_events,public.lr_audit to service_role;
grant usage,select on sequence public.lr_login_events_id_seq,public.lr_audit_id_seq to service_role;

commit;
