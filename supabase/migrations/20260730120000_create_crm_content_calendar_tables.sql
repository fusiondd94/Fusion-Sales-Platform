-- Content calendar: scheduled social/WhatsApp posts and per-platform delivery results.

create table if not exists crm_content_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm_organizations(id) on delete cascade,
  title text not null default '',
  caption text not null default '',
  content_type text not null default 'text' check (content_type in ('text', 'image', 'carousel')),
  media_urls text[] not null default '{}',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'publishing', 'published', 'partially_published', 'failed', 'canceled')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_content_posts_org_scheduled_idx on crm_content_posts (organization_id, scheduled_at);
create index if not exists crm_content_posts_status_scheduled_idx on crm_content_posts (status, scheduled_at);

create table if not exists crm_content_post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references crm_content_posts(id) on delete cascade,
  platform text not null check (platform in ('facebook_page', 'instagram', 'whatsapp_broadcast')),
  status text not null default 'pending' check (status in ('pending', 'publishing', 'published', 'failed')),
  external_post_id text,
  recipient_count integer,
  error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, platform)
);

create index if not exists crm_content_post_targets_post_idx on crm_content_post_targets (post_id);

alter table crm_content_posts enable row level security;
alter table crm_content_post_targets enable row level security;

-- Storage bucket for post media. Must be public: Instagram's Graph API requires a
-- publicly reachable HTTPS URL for image containers (it cannot accept a direct file upload).
insert into storage.buckets (id, name, public)
values ('content-media', 'content-media', true)
on conflict (id) do nothing;
