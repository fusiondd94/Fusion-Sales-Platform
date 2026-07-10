alter table public.crm_leads
  add column if not exists industry text,
  add column if not exists goal text,
  add column if not exists timeline text,
  add column if not exists budget text,
  add column if not exists objection text;

alter table public.crm_leads
  alter column package_key set default 'fusion-custom';

alter table public.crm_clients
  add column if not exists portal_status text default 'pending',
  add column if not exists onboarding_status text default 'lead';

alter table public.stripe_events
  add column if not exists stripe_event_id text,
  add column if not exists event_type text;

update public.stripe_events
set stripe_event_id = coalesce(stripe_event_id, id),
    event_type = coalesce(event_type, type)
where stripe_event_id is null or event_type is null;

create unique index if not exists crm_clients_lead_id_key on public.crm_clients (lead_id);
create unique index if not exists stripe_events_stripe_event_id_key on public.stripe_events (stripe_event_id);
