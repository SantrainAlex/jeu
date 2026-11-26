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
