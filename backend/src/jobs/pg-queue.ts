import { postgresConfigured, query, withClient } from "../repositories/postgres/client.ts";

export const CLAIM_SQL = `
update job_queue
set state = 'running', started_at = now()
where id = (
  select id from job_queue
  where state = 'queued'
  order by created_at
  for update skip locked
  limit 1
)
returning id, kind, payload
`;

export async function ensureJobQueue(): Promise<boolean> {
  if (!postgresConfigured()) return false;
  await query(`create table if not exists job_queue (
    id text primary key,
    kind text not null,
    state text not null,
    payload jsonb not null default '{}'::jsonb,
    error text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz
  )`);
  return true;
}

export async function mirrorJob(job: {
  id: string;
  kind: string;
  state: string;
  error?: string;
  payload: unknown;
}): Promise<boolean> {
  if (!postgresConfigured()) return false;
  await ensureJobQueue();
  await query(
    `insert into job_queue (id, kind, state, payload, error)
     values ($1, $2, $3, $4::jsonb, $5)
     on conflict (id) do update
       set state = excluded.state,
           error = excluded.error,
           payload = excluded.payload,
           finished_at = case when excluded.state in ('done', 'error', 'cancelled') then now() else job_queue.finished_at end`,
    [job.id, job.kind, job.state, JSON.stringify(job.payload ?? {}), job.error ?? null],
  );
  return true;
}

export type ClaimedJob = { id: string; kind: string; payload: unknown };

/** One queued row becomes running. A second worker skips a locked row. */
export async function claimQueuedJob(): Promise<ClaimedJob | null> {
  if (!postgresConfigured()) return null;
  await ensureJobQueue();
  const row = await withClient(async (client) => {
    await client.query("begin");
    try {
      const res = await client.query<ClaimedJob>(CLAIM_SQL);
      await client.query("commit");
      return res.rows[0] ?? null;
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  });
  return row;
}
