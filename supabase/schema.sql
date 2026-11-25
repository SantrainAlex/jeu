-- À coller une seule fois dans Supabase : menu « SQL Editor » → « New query » → coller → « Run ».
-- Crée le stockage des données de chaque joueur et le stock partagé des vitraux numérotés.

-- 1. Les données de chaque joueur (profil, notes, collection de cartes), une ligne par compte
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

revoke all on function public.claim_vitrail() from public, anon;
grant execute on function public.claim_vitrail() to authenticated;
