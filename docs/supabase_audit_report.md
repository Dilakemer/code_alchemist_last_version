# Supabase Audit Report

## Scope

This repository does not currently contain a Supabase client, Supabase REST calls, or Supabase GraphQL usage in source code. The backend schema is created by Flask-SQLAlchemy via `db.create_all()` rather than by SQL migration files.

## What I Found

- Schema creation happens in `server/app.py` through `db.create_all()` at startup and again in the debug init route.
- There is one ad hoc DDL script, `server/migrate_price_try.py`, which performs a single `ALTER TABLE`.
- I found no SQL migration directory, no `GRANT` statements, no `ENABLE ROW LEVEL SECURITY`, and no `CREATE POLICY` statements in the repo.
- The app uses integer-backed `user_id` foreign keys and Flask JWTs, not Supabase Auth UUIDs. That means any future RLS policy that relies on `auth.uid()` will not match this schema without a claim bridge or a profile mapping layer.

## Tables In The `public` Schema

These are the tables defined by the ORM models in `server/models.py`.

| Table | Recommended access pattern |
| --- | --- |
| `user` | service-only unless you intentionally expose profile reads |
| `api_key` | service-only |
| `v_s_code_login_state` | service-only |
| `v_s_code_otp` | service-only |
| `xp_event` | user-owned or service-only |
| `user_badge` | user-owned |
| `user_theme` | user-owned |
| `shared_session` | user-owned |
| `collaboration_review` | user-owned |
| `collaboration_comment` | user-owned |
| `conversation` | user-owned |
| `conversation_summary` | user-owned |
| `memory_item` | user-owned |
| `memory_node` | user-owned |
| `memory_edge` | user-owned |
| `history` | user-owned |
| `answer` | user-owned |
| `post_like` | user-owned |
| `answer_like` | user-owned |
| `notification_read` | user-owned |
| `notification_hidden` | user-owned |
| `snippet` | user-owned |
| `password_reset_token` | service-only |
| `user_follow` | user-owned |
| `notification` | user-owned |
| `favorite` | user-owned |
| `feedback` | user-owned |
| `feedback_detail` | user-owned |
| `project` | user-owned |
| `project_file` | user-owned |
| `token_balance` | user-owned or service-only |
| `token_transaction` | user-owned or service-only |
| `token_package` | public read-only lookup |
| `token_purchase` | user-owned or service-only |
| `legal_consent_log` | service-only |
| `user_external_api_key` | service-only |
| `security_audit_log` | service-only |

## Risks

1. Every `public` table is currently relying on implicit behavior. There are no explicit table grants or RLS policies in the repo.
2. If this schema is deployed to Supabase with the default Data API, the tables are candidates for REST exposure unless permissions and RLS are added.
3. A naive `auth.uid()` policy would not work for this app because the model layer uses integer `user_id` values, while Supabase Auth uses UUID subjects.
4. The only table that is a plausible public lookup table is `token_package`. Everything else should be treated as private or owner-scoped.

## Exact SQL Fixes

### 1. Public lookup table: `token_package`

Use this if you want anonymous and authenticated clients to read pricing/package metadata.

```sql
begin;

alter table public.token_package enable row level security;

revoke all on table public.token_package from anon, authenticated, public;
grant select on table public.token_package to anon;
grant select on table public.token_package to authenticated;
grant all on table public.token_package to service_role;

create policy "token_package_public_read"
on public.token_package
for select
to anon, authenticated
using (true);

commit;
```

### 2. Service-only tables

Use this pattern for `v_s_code_login_state`, `v_s_code_otp`, `password_reset_token`, `legal_consent_log`, `user_external_api_key`, and `security_audit_log`.

```sql
begin;

alter table public.<table_name> enable row level security;

revoke all on table public.<table_name> from anon, authenticated, public;
grant all on table public.<table_name> to service_role;

-- No anon/authenticated policies on purpose.

commit;
```

### 3. Owner-scoped tables

Because the app currently uses integer user IDs, this policy pattern only works if you add a claim bridge that exposes the integer user id to Postgres.

```sql
begin;

create or replace function public.app_user_id()
returns bigint
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'user_id',
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    ),
    ''
  )::bigint;
$$;

alter table public.<table_name> enable row level security;

revoke all on table public.<table_name> from anon, authenticated, public;
grant select, insert, update, delete on table public.<table_name> to authenticated;
grant all on table public.<table_name> to service_role;

create policy "<table_name>_select_own"
on public.<table_name>
for select
to authenticated
using (user_id = public.app_user_id());

create policy "<table_name>_insert_own"
on public.<table_name>
for insert
to authenticated
with check (user_id = public.app_user_id());

create policy "<table_name>_update_own"
on public.<table_name>
for update
to authenticated
using (user_id = public.app_user_id())
with check (user_id = public.app_user_id());

create policy "<table_name>_delete_own"
on public.<table_name>
for delete
to authenticated
using (user_id = public.app_user_id());

commit;
```

## Future Migration Template

New migrations should start from a template that does all three things for every table:

1. Explicit table grants for `anon`, `authenticated`, and `service_role`.
2. `alter table ... enable row level security`.
3. At least one starter policy, or an explicit note that the table is service-only and intentionally has no public policies.

The repo-local template lives in `supabase/migrations/_template.sql`.

## Frontend Usage Check

- `supabase-js`: not used in source.
- REST `/rest/v1`: not used in source.
- GraphQL: not used in source.

The only GraphQL-related evidence I found is an incidental dependency in `mobile/package-lock.json`; there is no source import that talks to Supabase GraphQL.

## Production Behavior

No runtime code was changed in the app itself. The backend still uses its existing ORM startup path, so this audit does not alter current production behavior.
