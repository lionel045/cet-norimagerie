-- Schéma Supabase — demandes CET Norimagerie
-- À coller dans Supabase > SQL Editor > New query > Run (une seule fois).

-- ── Numérotation annuelle CET-AAAA-NNNN (atomique, sans doublon) ──
create table if not exists public.compteurs (
  annee  int primary key,
  valeur int not null default 0
);

create or replace function public.prochain_numero()
returns text language plpgsql as $$
declare
  an int := extract(year from now() at time zone 'Europe/Paris');
  v  int;
begin
  insert into public.compteurs (annee, valeur) values (an, 1)
  on conflict (annee) do update set valeur = public.compteurs.valeur + 1
  returning valeur into v;
  return 'CET-' || an || '-' || lpad(v::text, 4, '0');
end $$;

-- ── Salariés (un par adresse mail, créé à la 1re demande) ──
create table if not exists public.salaries (
  id                uuid primary key default gen_random_uuid(),
  email             text unique not null,
  nom               text not null,
  poste             text,
  site              text,
  premiere_demande  timestamptz not null default now(),
  derniere_demande  timestamptz not null default now()
);

-- ── Demandes ──
create table if not exists public.demandes (
  id                 uuid primary key default gen_random_uuid(),
  numero             text unique not null default public.prochain_numero(),
  statut             text not null default 'attente' check (statut in ('attente', 'acceptee', 'refusee')),
  cree_le            timestamptz not null default now(),
  type               text not null check (type in ('Versement', 'Utilisation')),
  demandeur          text not null,
  email              text,
  poste              text,
  site               text,
  jours              numeric not null default 0,
  motif              text,
  horodatage_client  text,
  champs             jsonb not null default '[]',
  pdf_path           text,
  decision_motif     text,
  decision_par       text,
  decision_par_email text,
  decision_le        timestamptz,
  vue_par            text[] not null default '{}',
  salarie_id         uuid references public.salaries (id),
  rang_salarie       int
);
create index if not exists demandes_cree_le_idx on public.demandes (cree_le desc);
create index if not exists demandes_statut_idx  on public.demandes (statut);
create index if not exists demandes_salarie_idx on public.demandes (salarie_id);

-- ── Synthèse par salarié (nombre de demandes, décisions, jours accordés) ──
create or replace view public.salaries_synthese with (security_invoker = true) as
select s.*,
  count(d.id)                                              as nb_demandes,
  count(d.id) filter (where d.statut = 'attente')          as nb_attente,
  count(d.id) filter (where d.statut = 'acceptee')         as nb_acceptees,
  count(d.id) filter (where d.statut = 'refusee')          as nb_refusees,
  coalesce(sum(d.jours) filter (where d.statut = 'acceptee' and d.type = 'Versement'), 0)   as jours_verses,
  coalesce(sum(d.jours) filter (where d.statut = 'acceptee' and d.type = 'Utilisation'), 0) as jours_utilises
from public.salaries s
left join public.demandes d on d.salarie_id = s.id
group by s.id;

-- ── Historique de chaque demande ──
create table if not exists public.evenements (
  id          bigint generated always as identity primary key,
  demande_id  uuid not null references public.demandes (id) on delete cascade,
  at          timestamptz not null default now(),
  type        text not null,
  par         text,
  detail      text
);
create index if not exists evenements_demande_idx on public.evenements (demande_id, at);

-- ── Journal d'audit (non modifiable) ──
create table if not exists public.audit (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  type        text not null,
  demande_id  uuid,
  numero      text,
  par         text,
  statut      text,
  motif       text,
  detail      text
);
create index if not exists audit_at_idx on public.audit (at desc);

create or replace function public.audit_lecture_seule()
returns trigger language plpgsql as $$
begin
  raise exception 'Le journal d''audit ne peut pas être modifié ni supprimé';
end $$;
drop trigger if exists audit_immuable on public.audit;
create trigger audit_immuable before update or delete on public.audit
  for each row execute function public.audit_lecture_seule();

-- ── Comptes Direction (mots de passe hachés par l'appli) ──
create table if not exists public.utilisateurs (
  email        text primary key,
  nom          text not null,
  fonction     text,
  mot_de_passe text not null,
  doit_changer boolean not null default true,
  cree_le      timestamptz not null default now()
);

-- ── Marquer une demande comme consultée (atomique) ──
create or replace function public.marquer_vue(p_id uuid, p_email text, p_nom text)
returns void language plpgsql as $$
begin
  update public.demandes set vue_par = array_append(vue_par, p_email)
   where id = p_id and not (p_email = any (vue_par));
  if found then
    insert into public.evenements (demande_id, type, par, detail)
    values (p_id, 'consultation', p_nom, 'Première consultation');
  end if;
end $$;

-- ── Sécurité : RLS activé SANS politique ──
-- → aucun accès avec la clé publique (anon). Seul le serveur, avec la clé service_role, peut lire/écrire.
alter table public.demandes     enable row level security;
alter table public.evenements   enable row level security;
alter table public.audit        enable row level security;
alter table public.utilisateurs enable row level security;
alter table public.compteurs    enable row level security;
alter table public.salaries     enable row level security;
revoke all on public.salaries_synthese from anon, authenticated;
revoke execute on function public.prochain_numero() from public, anon, authenticated;
revoke execute on function public.marquer_vue(uuid, text, text) from public, anon, authenticated;

-- ── Stockage des PDF (bucket privé) ──
insert into storage.buckets (id, name, public)
values ('demandes-pdf', 'demandes-pdf', false)
on conflict (id) do nothing;
