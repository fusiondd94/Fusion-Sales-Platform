-- Link crm_leads and crm_clients to crm_contacts / crm_companies so a person
-- and the company they represent are shared records instead of free-text
-- duplicates, and backfill existing rows.

alter table public.crm_leads
  add column if not exists contact_id uuid references public.crm_contacts(id) on delete set null,
  add column if not exists company_id uuid references public.crm_companies(id) on delete set null;

create index if not exists crm_leads_contact_id_idx on public.crm_leads (contact_id);
create index if not exists crm_leads_company_id_idx on public.crm_leads (company_id);

alter table public.crm_clients
  add column if not exists contact_id uuid references public.crm_contacts(id) on delete set null,
  add column if not exists company_id uuid references public.crm_companies(id) on delete set null;

create index if not exists crm_clients_contact_id_idx on public.crm_clients (contact_id);
create index if not exists crm_clients_company_id_idx on public.crm_clients (company_id);

do $$
declare
  r record;
  v_company_id uuid;
  v_contact_id uuid;
  v_existing_company_id uuid;
  v_norm_email text;
  v_norm_phone text;
  v_parts text[];
  v_first_name text;
  v_last_name text;
begin
  -- Backfill existing leads that predate the sync.
  for r in
    select id, organization_id, customer_name, customer_email, customer_phone, company, status
    from public.crm_leads
    where contact_id is null and organization_id is not null
  loop
    v_company_id := null;

    if r.company is not null and length(trim(r.company)) > 0 then
      insert into public.crm_companies (organization_id, company_name, lifecycle_status, lead_source)
      values (r.organization_id, trim(r.company), 'prospect', 'Website')
      on conflict (organization_id, company_name) do update set updated_at = now()
      returning id into v_company_id;
    end if;

    v_norm_email := lower(trim(r.customer_email));
    v_contact_id := null;
    v_existing_company_id := null;

    select id, company_id into v_contact_id, v_existing_company_id
    from public.crm_contacts
    where organization_id = r.organization_id and normalized_email = v_norm_email
    limit 1;

    if v_contact_id is null then
      v_parts := regexp_split_to_array(trim(r.customer_name), '\s+');
      v_first_name := coalesce(nullif(v_parts[1], ''), 'Unnamed');
      v_last_name := case when array_length(v_parts, 1) > 1 then array_to_string(v_parts[2:array_length(v_parts, 1)], ' ') else null end;
      v_norm_phone := regexp_replace(coalesce(r.customer_phone, ''), '[^0-9+]', '', 'g');

      insert into public.crm_contacts (
        organization_id, company_id, first_name, last_name, display_name,
        email, normalized_email, phone, normalized_phone, lead_source
      )
      values (
        r.organization_id, v_company_id, v_first_name, v_last_name, trim(r.customer_name),
        r.customer_email, v_norm_email, nullif(r.customer_phone, ''), nullif(v_norm_phone, ''), 'Website'
      )
      returning id into v_contact_id;
    elsif v_existing_company_id is null and v_company_id is not null then
      update public.crm_contacts set company_id = v_company_id, updated_at = now() where id = v_contact_id;
    end if;

    if v_company_id is not null and v_contact_id is not null then
      insert into public.crm_company_contacts (company_id, contact_id, relationship, is_primary)
      values (v_company_id, v_contact_id, 'contact', not exists (select 1 from public.crm_company_contacts where company_id = v_company_id))
      on conflict (company_id, contact_id) do nothing;
    end if;

    update public.crm_leads set contact_id = v_contact_id, company_id = v_company_id where id = r.id;
  end loop;

  -- Backfill existing clients, reusing the originating lead's links when present.
  for r in
    select cl.id, cl.organization_id, cl.customer_name, cl.customer_email, cl.company,
           l.contact_id as lead_contact_id, l.company_id as lead_company_id
    from public.crm_clients cl
    left join public.crm_leads l on l.id = cl.lead_id
    where cl.contact_id is null and cl.organization_id is not null
  loop
    v_company_id := r.lead_company_id;
    v_contact_id := r.lead_contact_id;

    if v_company_id is null and r.company is not null and length(trim(r.company)) > 0 then
      insert into public.crm_companies (organization_id, company_name, lifecycle_status, lead_source)
      values (r.organization_id, trim(r.company), 'client', 'Website')
      on conflict (organization_id, company_name) do update set updated_at = now()
      returning id into v_company_id;
    end if;

    if v_contact_id is null then
      v_norm_email := lower(trim(r.customer_email));

      select id into v_contact_id
      from public.crm_contacts
      where organization_id = r.organization_id and normalized_email = v_norm_email
      limit 1;

      if v_contact_id is null then
        v_parts := regexp_split_to_array(trim(r.customer_name), '\s+');
        v_first_name := coalesce(nullif(v_parts[1], ''), 'Unnamed');
        v_last_name := case when array_length(v_parts, 1) > 1 then array_to_string(v_parts[2:array_length(v_parts, 1)], ' ') else null end;

        insert into public.crm_contacts (organization_id, company_id, first_name, last_name, display_name, email, normalized_email, lead_source, lifecycle_status)
        values (r.organization_id, v_company_id, v_first_name, v_last_name, trim(r.customer_name), r.customer_email, v_norm_email, 'Website', 'client')
        returning id into v_contact_id;
      end if;
    end if;

    update public.crm_contacts set lifecycle_status = 'client', updated_at = now() where id = v_contact_id and lifecycle_status is distinct from 'client';
    if v_company_id is not null then
      update public.crm_companies set lifecycle_status = 'client', updated_at = now() where id = v_company_id and lifecycle_status is distinct from 'client';
      insert into public.crm_company_contacts (company_id, contact_id, relationship, is_primary)
      values (v_company_id, v_contact_id, 'contact', not exists (select 1 from public.crm_company_contacts where company_id = v_company_id))
      on conflict (company_id, contact_id) do nothing;
    end if;

    update public.crm_clients set contact_id = v_contact_id, company_id = v_company_id where id = r.id;
    update public.crm_leads set contact_id = v_contact_id, company_id = v_company_id
      where id = (select lead_id from public.crm_clients where id = r.id) and contact_id is null;
  end loop;
end $$;
