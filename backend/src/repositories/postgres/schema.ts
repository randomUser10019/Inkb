import { getPool } from "./client.ts";

const SQL = `
create table if not exists upstream_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists upstream_cache_expires_idx on upstream_cache (expires_at);

create table if not exists media_probe (
  lesson_id text primary key,
  archived boolean not null,
  checked_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  kind text not null,
  state text not null,
  pct integer not null default 0,
  step text not null default '',
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists catalog_search (
  id text primary key,
  title text not null,
  topic text not null default '',
  educator text not null default '',
  href text not null,
  document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(topic, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(educator, '')), 'C')
  ) stored
);
create index if not exists catalog_search_document_idx on catalog_search using gin (document);
`;

export async function ensureSchema(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(SQL);
}
