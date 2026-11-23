-- Migration 002 — Registre des salariés
-- À exécuter UNE FOIS dans Supabase > SQL Editor si schema.sql a déjà été lancé avant le 18/11/2026.
-- Sans risque : ne supprime rien, rattache les demandes existantes à leur salarié.

create table if not exists public.salaries (
  id                uuid primary key default gen_random_uuid(),
  email             text unique not null,
  nom               text not null,
  poste             text,
  site              text,
  premiere_demande  timestamptz not null default now(),
  derniere_demande  timestamptz not null default now()
);
alter table public.salaries enable row level security;

alter table public.demandes add column if not exists salarie_id   uuid references public.salaries (id);
alter table public.demandes add column if not exists rang_salarie int;
create index if not exists demandes_salarie_idx on public.demandes (salarie_id);

-- Reprise des demandes déjà enregistrées
insert into public.salaries (email, nom, poste, site, premiere_demande, derniere_demande)
select distinct on (lower(email)) lower(email), demandeur, poste, site,
       min(cree_le) over (partition by lower(email)), max(cree_le) over (partition by lower(email))
from public.demandes
where email is not null and email <> ''
order by lower(email), cree_le desc
on conflict (email) do nothing;

update public.demandes d set salarie_id = s.id
from public.salaries s
where d.salarie_id is null and lower(d.email) = s.email;

update public.demandes d set rang_salarie = r.rang
from (select id, row_number() over (partition by salarie_id order by cree_le) as rang
      from public.demandes where salarie_id is not null) r
where d.id = r.id and d.rang_salarie is null;

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
revoke all on public.salaries_synthese from anon, authenticated;
