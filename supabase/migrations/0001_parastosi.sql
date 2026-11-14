-- Парастоси: шема базе.
-- Један власник (podesavanja.vlasnik) чита и мења све; нико други ништа.
-- Породица уписује само преко Edge функције (service_role), никад директно.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;

-- ---------------------------------------------------------------- подешавања
create table public.podesavanja (
  id smallint primary key default 1 check (id = 1),
  vlasnik uuid references auth.users (id) on delete set null,
  dana_unapred smallint not null default 14 check (dana_unapred between 1 and 60),
  cas_slanja smallint not null default 8 check (cas_slanja between 0 and 23),
  dana_40 smallint not null default 40 check (dana_40 in (39, 40)),
  poslednje_slanje date
);
insert into public.podesavanja default values;

create function private.je_vlasnik() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.podesavanja
    where id = 1 and vlasnik = (select auth.uid())
  );
$$;
revoke execute on function private.je_vlasnik() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.je_vlasnik() to authenticated;

-- -------------------------------------------------------------------- линкови
create table public.linkovi (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (length(token) between 32 and 128),
  naziv text check (length(naziv) <= 120),
  jezik text not null default 'sr' check (jezik in ('sr', 'fr')),
  jednokratan boolean not null default false,
  broj_prijava integer not null default 0,
  istice timestamptz not null default (now() + interval '30 days'),
  opozvan boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ покојници
create table public.pokojnici (
  id uuid primary key default gen_random_uuid(),
  ime_prezime text not null check (length(btrim(ime_prezime)) between 1 and 160),
  datum_smrti date,
  datum_sahrane date,
  godina_rodjenja smallint check (godina_rodjenja between 1850 and 2100),
  mesto_sahrane text check (length(mesto_sahrane) <= 200),
  kremacija boolean not null default false,
  kontakt_ime text check (length(kontakt_ime) <= 160),
  kontakt_telefon text check (length(kontakt_telefon) <= 40),
  whatsapp boolean not null default false,
  napomena text check (length(napomena) <= 2000),
  izvor text not null default 'rucno' check (izvor in ('rucno', 'uvoz', 'link')),
  novo boolean not null default false,
  za_proveru boolean not null default false,
  link_id uuid references public.linkovi (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pokojnici_datum_smrti_idx on public.pokojnici (datum_smrti);
create index pokojnici_link_id_idx on public.pokojnici (link_id);

create function private.dodirni_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger pokojnici_updated_at before update on public.pokojnici
  for each row execute function private.dodirni_updated_at();

-- ------------------------------------------------- стање помена (по покојнику)
create table public.pomen_stanje (
  pokojnik_id uuid not null references public.pokojnici (id) on delete cascade,
  vrsta text not null check (vrsta in ('40', 'pola', 'godina')),
  obavljeno boolean not null default false,
  obavesten_u timestamptz,
  primary key (pokojnik_id, vrsta)
);

-- ------------------------------------------------------------ push претплате
create table public.push_pretplate (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  uredjaj text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------ RLS
alter table public.podesavanja enable row level security;
alter table public.linkovi enable row level security;
alter table public.pokojnici enable row level security;
alter table public.pomen_stanje enable row level security;
alter table public.push_pretplate enable row level security;

revoke all on public.podesavanja, public.linkovi, public.pokojnici,
  public.pomen_stanje, public.push_pretplate from anon, authenticated;

grant select on public.podesavanja to authenticated;
grant update (dana_unapred, cas_slanja, dana_40) on public.podesavanja to authenticated;
grant select, insert, update, delete on public.linkovi, public.pokojnici,
  public.pomen_stanje, public.push_pretplate to authenticated;

create policy vlasnik_cita on public.podesavanja for select to authenticated
  using ((select private.je_vlasnik()));
create policy vlasnik_menja on public.podesavanja for update to authenticated
  using ((select private.je_vlasnik())) with check ((select private.je_vlasnik()));

create policy vlasnik_sve on public.linkovi for all to authenticated
  using ((select private.je_vlasnik())) with check ((select private.je_vlasnik()));
create policy vlasnik_sve on public.pokojnici for all to authenticated
  using ((select private.je_vlasnik())) with check ((select private.je_vlasnik()));
create policy vlasnik_sve on public.pomen_stanje for all to authenticated
  using ((select private.je_vlasnik())) with check ((select private.je_vlasnik()));
create policy vlasnik_sve on public.push_pretplate for all to authenticated
  using ((select private.je_vlasnik())) with check ((select private.je_vlasnik()));

-- ----------------------------------------- функције само за сервер (service_role)
-- Тајне (VAPID кључеви, тајна за распоред, код за прво подешавање) стоје у Vault-у.
create function public.tajne() returns jsonb
language sql security definer set search_path = ''
as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('vapid_public', 'vapid_private', 'cron_secret', 'setup_kod');
$$;
revoke execute on function public.tajne() from public, anon, authenticated;
grant execute on function public.tajne() to service_role;

-- Прво подешавање: уписује власника и троши код.
create function public.postavi_vlasnika(p_vlasnik uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  update public.podesavanja set vlasnik = p_vlasnik where id = 1 and vlasnik is null;
  get diagnostics n = row_count;
  if n = 1 then
    delete from vault.secrets where name = 'setup_kod';
  end if;
  return n = 1;
end;
$$;
revoke execute on function public.postavi_vlasnika(uuid) from public, anon, authenticated;
grant execute on function public.postavi_vlasnika(uuid) to service_role;

-- Пријава породице преко линка: проверава линк и уписује покојника у једном кораку.
create function public.prijava_preko_linka(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  l public.linkovi;
  v_id uuid;
begin
  select * into l from public.linkovi where token = p_token for update;
  if not found or l.opozvan or l.istice < now()
     or (l.jednokratan and l.broj_prijava >= 1) or l.broj_prijava >= 50 then
    return jsonb_build_object('ok', false);
  end if;

  insert into public.pokojnici (
    ime_prezime, datum_smrti, datum_sahrane, godina_rodjenja, mesto_sahrane,
    kremacija, kontakt_ime, kontakt_telefon, whatsapp, napomena,
    izvor, novo, link_id
  ) values (
    btrim(p ->> 'ime_prezime'),
    nullif(p ->> 'datum_smrti', '')::date,
    nullif(p ->> 'datum_sahrane', '')::date,
    nullif(p ->> 'godina_rodjenja', '')::smallint,
    nullif(btrim(p ->> 'mesto_sahrane'), ''),
    coalesce((p ->> 'kremacija')::boolean, false),
    nullif(btrim(p ->> 'kontakt_ime'), ''),
    nullif(btrim(p ->> 'kontakt_telefon'), ''),
    coalesce((p ->> 'whatsapp')::boolean, false),
    nullif(btrim(p ->> 'napomena'), ''),
    'link', true, l.id
  ) returning id into v_id;

  update public.linkovi set broj_prijava = broj_prijava + 1 where id = l.id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke execute on function public.prijava_preko_linka(text, jsonb) from public, anon, authenticated;
grant execute on function public.prijava_preko_linka(text, jsonb) to service_role;

-- -------------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.pokojnici;
