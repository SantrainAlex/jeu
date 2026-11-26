-- À coller dans Supabase : menu « SQL Editor » → « New query » → coller → « Run ».
-- On peut le relancer sans risque après une mise à jour : rien n'est effacé.
-- Crée le stockage des données de chaque joueur, des collections de cartes et le stock partagé des vitraux numérotés.

-- 1. Les données de chaque joueur (profil, notes), une ligne par compte. Les cartes sont à part (point 4).
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- chacun ne peut lire et modifier que ses propres données
drop policy if exists "lire ses donnees" on public.user_data;
create policy "lire ses donnees" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "creer ses donnees" on public.user_data;
create policy "creer ses donnees" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "modifier ses donnees" on public.user_data;
create policy "modifier ses donnees" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 2. Le stock des vitraux numérotés, partagé entre tous les joueurs
create table if not exists public.vitrail_stock (
  id int primary key default 1 check (id = 1),
  total int not null,
  given int not null default 0 check (given >= 0 and given <= total)
);

insert into public.vitrail_stock (id, total, given) values (1, 300, 0) on conflict (id) do nothing;

alter table public.vitrail_stock enable row level security;

-- tout le monde peut voir combien il en reste ; personne ne peut le modifier directement
drop policy if exists "voir le stock" on public.vitrail_stock;
create policy "voir le stock" on public.vitrail_stock for select to anon, authenticated using (true);

-- 3. Réserver un vitrail : renvoie son numéro (1, 2, 3…) ou null s'il n'en reste plus.
--    Le compteur est modifié en une seule opération, donc deux joueurs ne peuvent pas avoir le même numéro.
create or replace function public.claim_vitrail()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    return null;
  end if;
  update public.vitrail_stock set given = given + 1 where id = 1 and given < total returning given into n;
  return n;
end;
$$;

-- Seul le serveur du site (clé service_role) peut réserver un vitrail, au moment où il ouvre un booster.
-- Avant, n'importe quel joueur connecté pouvait l'appeler à la chaîne et vider le stock.
revoke all on function public.claim_vitrail() from public, anon, authenticated;
grant execute on function public.claim_vitrail() to service_role;

-- 4. Les collections de cartes, une ligne par compte.
--    Chaque joueur peut LIRE sa collection, mais personne ne peut l'écrire depuis son navigateur (ni avec Postman) :
--    seul le serveur du site la modifie, après avoir vérifié les règles (recharge des boosters, atelier…).
create table if not exists public.user_cards (
  user_id uuid primary key references auth.users (id) on delete cascade,
  collection jsonb not null default '{}'::jsonb,
  -- augmente à chaque modification : deux demandes envoyées en même temps ne peuvent pas passer toutes les deux
  version int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_cards enable row level security;

drop policy if exists "lire ses cartes" on public.user_cards;
create policy "lire ses cartes" on public.user_cards
  for select to authenticated using ((select auth.uid()) = user_id);

-- aucune règle d'écriture pour les joueurs, et on retire aussi les droits par sécurité
revoke insert, update, delete, truncate on public.user_cards from anon, authenticated;

-- 5. La collection ne peut plus être enregistrée dans user_data par le navigateur : elle est retirée automatiquement.
create or replace function public.strip_collection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.data := new.data - 'collection';
  return new;
end;
$$;

-- reprise des collections déjà enregistrées (une seule fois : celles déjà reprises ne sont pas écrasées)
insert into public.user_cards (user_id, collection)
select user_id, data -> 'collection' from public.user_data where data ? 'collection'
on conflict (user_id) do nothing;

drop trigger if exists strip_collection on public.user_data;
create trigger strip_collection before insert or update on public.user_data
  for each row execute function public.strip_collection();

update public.user_data set data = data - 'collection' where data ? 'collection';

-- 6. Le classement des collectionneurs.
--    a) Le nom d'utilisateur de chaque joueur (unique, sans tenir compte des majuscules). Chacun choisit et modifie le sien.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 3 and 20 and username ~ '^[[:alnum:]_.-]+$'),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_unique on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "lire son profil" on public.profiles;
create policy "lire son profil" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "creer son profil" on public.profiles;
create policy "creer son profil" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "modifier son profil" on public.profiles;
create policy "modifier son profil" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

--    b) Les points d'une collection (mêmes règles que src/lib/score.ts) :
--       Commune 1, Rare 3, Épique 10, Légendaire 25, Mythique 100 par carte différente (les doublons ne comptent pas),
--       x2 en finition argent, x3 en or, et 150 points par vitrail numéroté.
create or replace function public.collection_score(c jsonb)
returns int
language sql
immutable
set search_path = public
as $$
  select (
    coalesce((
      select sum(
        case e.value -> 'card' ->> 'rarity'
          when 'commune' then 1 when 'rare' then 3 when 'epique' then 10
          when 'legendaire' then 25 when 'mythique' then 100 else 0 end
        * case e.value ->> 'finish' when 'or' then 3 when 'argent' then 2 else 1 end
      )
      from jsonb_each(case when jsonb_typeof(c -> 'cards') = 'object' then c -> 'cards' else '{}'::jsonb end) e
      where coalesce((e.value ->> 'count')::numeric, 0) - coalesce((e.value ->> 'used')::numeric, 0) >= 1
    ), 0)
    + 150 * case when jsonb_typeof(c -> 'vitraux') = 'array' then jsonb_array_length(c -> 'vitraux') else 0 end
  )::int
$$;

--    c) Les points sont recalculés par la base à chaque changement de collection : personne ne peut les choisir.
alter table public.user_cards add column if not exists score int not null default 0;

create or replace function public.set_card_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.score := public.collection_score(new.collection);
  return new;
end;
$$;

drop trigger if exists set_card_score on public.user_cards;
create trigger set_card_score before insert or update on public.user_cards
  for each row execute function public.set_card_score();

-- calcul des points des collections déjà enregistrées
update public.user_cards set score = public.collection_score(collection) where score <> public.collection_score(collection);

create index if not exists user_cards_score on public.user_cards (score desc);

--    d) Le classement public : seulement le nom et les points (jamais l'e-mail ni le détail des cartes).
--       Seuls les joueurs qui ont choisi un nom et qui ont au moins 1 point apparaissent.
create or replace function public.leaderboard(lim int default 100)
returns table (rank bigint, username text, score int)
language sql
stable
security definer
set search_path = public
as $$
  select rank() over (order by c.score desc), p.username, c.score
  from public.user_cards c
  join public.profiles p on p.user_id = c.user_id
  where c.score > 0
  order by c.score desc, lower(p.username)
  limit least(greatest(coalesce(lim, 100), 1), 200)
$$;

revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;

--    e) Ta place à toi, même si tu n'es pas dans le haut du classement.
create or replace function public.my_rank()
returns table (rank bigint, username text, score int)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when p.username is null or coalesce(c.score, 0) = 0 then null else (
      select count(*) + 1
      from public.user_cards c2
      join public.profiles p2 on p2.user_id = c2.user_id
      where c2.score > coalesce(c.score, 0)
    ) end,
    p.username,
    coalesce(c.score, 0)
  from (select (select auth.uid()) as uid) me
  left join public.user_cards c on c.user_id = me.uid
  left join public.profiles p on p.user_id = me.uid
  where me.uid is not null
$$;

revoke all on function public.my_rank() from public;
grant execute on function public.my_rank() to authenticated;

-- 7. Les avis des joueurs sur la résolution et les FPS d'un jeu, par plateforme.
--    Un avis par joueur, par jeu et par plateforme. Chacun ne voit et ne modifie que les siens ;
--    tout le monde voit seulement le résumé (nombre d'avis, résolution et FPS les plus cités), jamais qui a voté.
create table if not exists public.perf_reports (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id int not null,
  platform text not null check (platform in ('switch', 'switch-2', 'pc', 'ps5', 'ps4', 'xbox', 'xbox-one', 'mobile')),
  resolution text not null check (resolution in ('720p', '900p', '1080p', '1440p', '4k')),
  fps int not null check (fps in (30, 40, 60, 120)),
  stable boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, platform)
);

create index if not exists perf_reports_game on public.perf_reports (game_id);

alter table public.perf_reports enable row level security;

drop policy if exists "lire ses avis perf" on public.perf_reports;
create policy "lire ses avis perf" on public.perf_reports
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "creer ses avis perf" on public.perf_reports;
create policy "creer ses avis perf" on public.perf_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "modifier ses avis perf" on public.perf_reports;
create policy "modifier ses avis perf" on public.perf_reports
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "effacer ses avis perf" on public.perf_reports;
create policy "effacer ses avis perf" on public.perf_reports
  for delete to authenticated using ((select auth.uid()) = user_id);

--    Le résumé public d'un jeu : pour chaque plateforme, le nombre d'avis, la résolution et les FPS les plus cités,
--    et la part des joueurs qui trouvent le jeu fluide.
create or replace function public.perf_summary(gid int)
returns table (platform text, votes int, resolution text, fps int, stable_pct int)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.platform,
    count(*)::int,
    mode() within group (order by r.resolution),
    mode() within group (order by r.fps),
    round(100.0 * count(*) filter (where r.stable) / count(*))::int
  from public.perf_reports r
  where r.game_id = gid
  group by r.platform
$$;

revoke all on function public.perf_summary(int) from public;
grant execute on function public.perf_summary(int) to anon, authenticated;
