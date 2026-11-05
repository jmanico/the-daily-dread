-- Deployment identity only. Apply transactionally before granting the runtime
-- SELECT/INSERT on these tables and USAGE on this schema. Never grant ownership,
-- UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER or schema CREATE to runtime roles.
create schema dread_audit;
revoke all on schema dread_audit from public;
create table dread_audit.events (
  company_id text not null check (company_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  producer_ref text not null check (producer_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  event_id uuid not null,
  operation_ref text not null check (operation_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  encoded text not null check (octet_length(encoded) between 1 and 8192),
  ingested_at timestamptz not null default clock_timestamp(),
  primary key (producer_ref,event_id),
  unique (company_id,producer_ref,operation_ref,event_id),
  check (jsonb_typeof(encoded::jsonb)='object'),
  check ((encoded::jsonb->>'schema_version')='1'),
  check ((encoded::jsonb->>'event')='dread.audit.config_change'),
  check ((encoded::jsonb->>'tenant_ref')=company_id),
  check ((encoded::jsonb->>'producer_ref')=producer_ref),
  check ((encoded::jsonb->>'event_id')=event_id::text),
  check ((encoded::jsonb->>'operation_ref')=operation_ref),
  check ((encoded::jsonb->>'outcome')='success'),
  check ((encoded::jsonb->>'audit_required')='true'),
  check (encoded::jsonb ?& array['schema_version','event','tenant_ref','producer_ref','event_id','operation_ref','outcome','audit_required'])
);
create table dread_audit.mutation_receipts (
  company_id text not null,
  producer_ref text not null,
  operation_ref text not null check (operation_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  event_id uuid not null,
  primary key (company_id,producer_ref,operation_ref),
  foreign key (company_id,producer_ref,operation_ref,event_id) references dread_audit.events(company_id,producer_ref,operation_ref,event_id)
);
revoke all on all tables in schema dread_audit from public;
