-- Deployment identity applies this migration transactionally. A dedicated local
-- identity role needs USAGE and SELECT/INSERT/UPDATE/DELETE only. No ownership,
-- schema CREATE, TRUNCATE, REFERENCES or TRIGGER; never grant these tables to the
-- public demo, audit reader, feed worker or ordinary business owners.
create schema dread_local;
revoke all on schema dread_local from public;
create table dread_local.authority (
  workspace_id uuid primary key,
  actor_id uuid not null,
  revision uuid not null,
  generation uuid not null,
  code_digest text check (code_digest ~ '^[0-9a-f]{64}$'),
  code_wall bigint,
  code_tick bigint,
  failed_at bigint[] not null default '{}',
  check (actor_id <> workspace_id),
  check (cardinality(failed_at) <= 5 and array_position(failed_at,null) is null),
  check ((code_digest is null and code_wall is null and code_tick is null) or
    (code_digest is not null and code_wall is not null and code_tick is not null and code_wall between 0 and 9007199254740991 and code_tick between 0 and 9007199254740991))
);
create table dread_local.sessions (
  workspace_id uuid not null references dread_local.authority(workspace_id),
  generation uuid not null,
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  created_wall bigint not null check (created_wall between 0 and 9007199254740991),
  created_tick bigint not null check (created_tick between 0 and 9007199254740991),
  active_wall bigint not null check (active_wall between created_wall and 9007199254740991),
  active_tick bigint not null check (active_tick between created_tick and 9007199254740991),
  primary key (workspace_id,digest)
);
revoke all on all tables in schema dread_local from public;
