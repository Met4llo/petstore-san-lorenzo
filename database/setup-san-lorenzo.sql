-- Eseguire esclusivamente nel NUOVO progetto Supabase di San Lorenzo.
-- Non eseguire nel progetto di La Malfa. Nessuna tabella legacy viene modificata.
begin;
create table public.sl_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id text not null default 'san-lorenzo' check (store_id = 'san-lorenzo'),
  display_name text not null check (display_name in ('Sepi','Liborio','Daniela','Francesco','Amministratore')),
  role text not null check (role in ('operator','manager','admin')),
  active boolean not null default true,
  check ((role = 'admin' and display_name = 'Amministratore') or (role = 'manager' and display_name = 'Sepi') or (role = 'operator' and display_name in ('Liborio','Daniela','Francesco'))),
  unique(store_id, display_name)
);
create table public.sl_products (
  store_id text not null default 'san-lorenzo' check (store_id = 'san-lorenzo'),
  ean text not null check (ean ~ '^[0-9]{5,14}$'),
  name text not null check (char_length(name) between 1 and 240),
  supplier text not null check (char_length(supplier) between 1 and 240),
  expiry date,
  no_expiry boolean not null default false,
  signaled boolean not null default false,
  managed boolean not null default false,
  absent boolean not null default false,
  note text not null default '' check (char_length(note) <= 280),
  version bigint not null default 1 check (version >= 1),
  updated_by uuid not null references auth.users(id),
  updated_by_name text not null,
  updated_at timestamptz not null default now(),
  primary key(store_id,ean),
  check (not no_expiry or (expiry is null and not signaled and not managed)),
  check (not signaled or expiry is not null),
  check (not managed or signaled)
);
create table public.sl_product_log (
  id bigint generated always as identity primary key,
  store_id text not null check (store_id = 'san-lorenzo'),
  ean text not null,
  actor_id uuid not null references auth.users(id),
  actor_name text not null,
  changed_at timestamptz not null default now(),
  old_value jsonb,
  new_value jsonb not null
);
create index sl_product_log_ean on public.sl_product_log(store_id,ean,id desc);
create table public.sl_messages (
  id bigint generated always as identity primary key,
  store_id text not null default 'san-lorenzo' check (store_id = 'san-lorenzo'),
  author_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.sl_profiles enable row level security;
alter table public.sl_products enable row level security;
alter table public.sl_product_log enable row level security;
alter table public.sl_messages enable row level security;

create function public.sl_has_access(p_store text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sl_profiles p where p.user_id = auth.uid() and p.active and p.store_id = p_store);
$$;
revoke all on function public.sl_has_access(text) from public, anon;
grant execute on function public.sl_has_access(text) to authenticated;
create policy profile_self on public.sl_profiles for select to authenticated using (user_id = auth.uid());
create policy product_read on public.sl_products for select to authenticated using (public.sl_has_access(store_id));
create policy log_read on public.sl_product_log for select to authenticated using (public.sl_has_access(store_id));
create policy message_read on public.sl_messages for select to authenticated using (public.sl_has_access(store_id));
create policy message_add on public.sl_messages for insert to authenticated with check (public.sl_has_access(store_id) and author_id = auth.uid());
-- Nessuna policy di scrittura diretta su prodotti, log o profili.
revoke all on public.sl_profiles,public.sl_products,public.sl_product_log,public.sl_messages from anon,authenticated;
grant select on public.sl_profiles,public.sl_products,public.sl_product_log,public.sl_messages to authenticated;
grant insert(store_id,author_id,body) on public.sl_messages to authenticated;
grant usage on sequence public.sl_messages_id_seq to authenticated;

create function public.sl_save_product(p_store text, p_product jsonb, p_expected_version bigint)
returns public.sl_products
language plpgsql security definer set search_path = '' as $$
declare
  actor public.sl_profiles;
  previous public.sl_products;
  saved public.sl_products;
  code text := p_product->>'ean';
begin
  select * into actor from public.sl_profiles where user_id = auth.uid() and active and store_id = p_store;
  if not found then raise exception 'Accesso non autorizzato' using errcode = '42501'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'Versione non valida'; end if;
  -- Serializza anche il primo inserimento dello stesso EAN.
  perform pg_advisory_xact_lock(hashtextextended(p_store || ':' || code, 0));
  select * into previous from public.sl_products where store_id = p_store and ean = code for update;
  if coalesce(previous.version,0) <> p_expected_version then
    raise exception 'CONFLICT: prodotto aggiornato da un altro utente. Ricarica e confronta le modifiche.' using errcode = 'P0001';
  end if;
  insert into public.sl_products(store_id,ean,name,supplier,expiry,no_expiry,signaled,managed,absent,note,version,updated_by,updated_by_name)
  values(p_store,code,btrim(p_product->>'name'),btrim(p_product->>'supplier'),nullif(p_product->>'expiry','')::date,
    (p_product->>'no_expiry')::boolean,(p_product->>'signaled')::boolean,(p_product->>'managed')::boolean,(p_product->>'absent')::boolean,
    coalesce(p_product->>'note',''),p_expected_version+1,actor.user_id,actor.display_name)
  on conflict(store_id,ean) do update set name=excluded.name,supplier=excluded.supplier,expiry=excluded.expiry,
    no_expiry=excluded.no_expiry,signaled=excluded.signaled,managed=excluded.managed,absent=excluded.absent,note=excluded.note,
    version=excluded.version,updated_by=excluded.updated_by,updated_by_name=excluded.updated_by_name,updated_at=now()
  returning * into saved;
  insert into public.sl_product_log(store_id,ean,actor_id,actor_name,old_value,new_value)
  values(p_store,code,actor.user_id,actor.display_name,case when previous.version is null then null else to_jsonb(previous) end,to_jsonb(saved));
  return saved;
end;
$$;
revoke all on function public.sl_save_product(text,jsonb,bigint) from public,anon;
grant execute on function public.sl_save_product(text,jsonb,bigint) to authenticated;
commit;
