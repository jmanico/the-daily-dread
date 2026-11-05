-- REQ-PLATFORM-011. Apply in a deployment-owned transaction, never as the runtime
-- role. The installer owns checksums/ordering/privilege grants; it is not present
-- in this slice. No IF NOT EXISTS hides an incompatible pre-existing schema.
CREATE SCHEMA dread_work;
CREATE TABLE dread_work.admission (
  singleton boolean PRIMARY KEY CHECK (singleton),
  lock_epoch bigint NOT NULL CHECK (lock_epoch BETWEEN 0 AND 9007199254740991)
);
INSERT INTO dread_work.admission VALUES (true,0);
CREATE TABLE dread_work.jobs (
  company_id varchar(128) NOT NULL CHECK (company_id ~ '^[A-Za-z0-9_-]+$'),
  job_id uuid NOT NULL,
  event_id varchar(128) NOT NULL CHECK (event_id ~ '^[A-Za-z0-9_-]+$'),
  event_revision bigint NOT NULL CHECK (event_revision BETWEEN 1 AND 9007199254740991),
  repository_id varchar(128) NOT NULL CHECK (repository_id ~ '^[A-Za-z0-9_-]+$'),
  grant_id varchar(128) NOT NULL CHECK (grant_id ~ '^[A-Za-z0-9_-]+$'),
  repository_revision bigint NOT NULL CHECK (repository_revision BETWEEN 1 AND 9007199254740991),
  grant_revision bigint NOT NULL CHECK (grant_revision BETWEEN 1 AND 9007199254740991),
  state text NOT NULL CHECK (state IN ('queued','running','succeeded','failed','blocked')),
  attempt_token uuid,
  lease_until timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 9007199254740991),
  attempts bigint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 9007199254740991),
  decoded_bytes bigint NOT NULL DEFAULT 0 CHECK (decoded_bytes BETWEEN 0 AND 268435456),
  tree_entries integer NOT NULL DEFAULT 0 CHECK (tree_entries BETWEEN 0 AND 100000),
  active_ms integer NOT NULL DEFAULT 0 CHECK (active_ms BETWEEN 0 AND 900000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(company_id,job_id),
  UNIQUE(company_id,event_id,event_revision,repository_id),
  CHECK ((state='running') = (attempt_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK ((attempt_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX jobs_ready ON dread_work.jobs(company_id,created_at,job_id) WHERE state='queued';
CREATE INDEX jobs_expired ON dread_work.jobs(company_id,lease_until,job_id) WHERE state='running';
CREATE TABLE dread_work.attempts (
  company_id varchar(128) NOT NULL,
  job_id uuid NOT NULL,
  attempt_token uuid NOT NULL,
  ordinal bigint NOT NULL CHECK (ordinal BETWEEN 1 AND 9007199254740991),
  operation_id varchar(128) NOT NULL CHECK (operation_id ~ '^[A-Za-z0-9_-]+$'),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  outcome text NOT NULL CHECK (outcome IN ('running','interrupted','succeeded','failed','blocked')),
  PRIMARY KEY(company_id,job_id,attempt_token),
  UNIQUE(company_id,job_id,ordinal),
  UNIQUE(company_id,operation_id),
  FOREIGN KEY(company_id,job_id) REFERENCES dread_work.jobs(company_id,job_id),
  CHECK ((outcome='running') = (finished_at IS NULL))
);
