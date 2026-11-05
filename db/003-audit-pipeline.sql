-- Apply after the exact 002 schema, using the deployment identity in one
-- transaction. Existing successful administrative entries remain unchanged.
-- PostgreSQL 18.6 assigns this name in the reviewed 002 schema; missing/drifted
-- constraints fail the migration rather than being silently skipped.
alter table dread_audit.events drop constraint events_encoded_check4;
alter table dread_audit.events add constraint events_outcome_check
  check (encoded::jsonb->>'outcome' in ('attempted','success','failure','denied','rolled_back','unknown'));
-- Receipt semantics remain success-only after adding unsuccessful events.
alter table dread_audit.events add column outcome text generated always as (encoded::jsonb->>'outcome') stored;
alter table dread_audit.events add constraint events_receipt_outcome_key unique(company_id,producer_ref,operation_ref,event_id,outcome);
alter table dread_audit.mutation_receipts add column outcome text not null default 'success' check(outcome='success');
alter table dread_audit.mutation_receipts add constraint mutation_receipts_success_fkey foreign key(company_id,producer_ref,operation_ref,event_id,outcome)
  references dread_audit.events(company_id,producer_ref,operation_ref,event_id,outcome);
create table dread_audit.conflicts (
  company_id text not null,
  producer_ref text not null,
  original_operation_ref text not null,
  event_id uuid not null,
  conflict_id uuid not null,
  candidate text not null check (octet_length(candidate) between 1 and 8192),
  ingested_at timestamptz not null default clock_timestamp(),
  primary key (company_id,conflict_id),
  foreign key (company_id,producer_ref,original_operation_ref,event_id) references dread_audit.events(company_id,producer_ref,operation_ref,event_id),
  check ((candidate::jsonb->>'tenant_ref')=company_id),
  check ((candidate::jsonb->>'producer_ref')=producer_ref),
  check ((candidate::jsonb->>'event_id')=event_id::text),
  check (candidate::jsonb ?& array['tenant_ref','producer_ref','event_id'])
);
create table dread_audit.checkpoints (
  company_id text not null check (company_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  producer_ref text not null check (producer_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  generation bigint not null default 0 check (generation between 0 and 9007199254740991),
  sequence bigint not null check (sequence between 0 and 9007199254740991),
  primary key(company_id,producer_ref)
);
create table dread_audit.probes (
  company_id text not null check (company_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  producer_ref text not null check (producer_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  sequence bigint not null check (sequence between 0 and 9007199254740991),
  primary key(company_id,producer_ref)
);
revoke all on all tables in schema dread_audit from public;
-- Writer: SELECT/INSERT events + conflicts; SELECT/INSERT/UPDATE checkpoints.
-- Independent monitor: SELECT checkpoints; SELECT/INSERT/UPDATE probes only.
-- Neither owns tables or receives UPDATE/DELETE/TRUNCATE over audit history.
