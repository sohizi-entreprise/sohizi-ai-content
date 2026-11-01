SELECT 'CREATE DATABASE sohizi_rc' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sohizi_rc')\gexec
SELECT 'CREATE DATABASE sohizi_prod' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sohizi_prod')\gexec
SELECT 'CREATE DATABASE inngest_rc' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'inngest_rc')\gexec
SELECT 'CREATE DATABASE inngest_prod' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'inngest_prod')\gexec

\connect sohizi_rc
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

\connect sohizi_prod
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
