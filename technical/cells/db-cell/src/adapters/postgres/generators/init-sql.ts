import { DbAdapterConfig } from '../../../types'

export function generateInitSql(config: DbAdapterConfig): string {
  const database = config.database
  const role = config.app_role ?? `${database}_app`
  const password = config.app_password ?? role

  return `-- Auto-generated from Technical DNA — db-cell postgres adapter
-- Run once on first database init (mounted to /docker-entrypoint-initdb.d/)

-- Create application role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} WITH LOGIN PASSWORD '${password}';
  END IF;
END
$$;

-- Grant connect
GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${role};

-- Set default privileges so the app role owns future objects
\\c ${database}
GRANT ALL ON SCHEMA public TO ${role};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${role};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${role};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO ${role};
`
}
