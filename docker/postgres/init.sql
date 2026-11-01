CREATE DATABASE sohizi_rc;
CREATE DATABASE sohizi_prod;
CREATE DATABASE inngest_rc;
CREATE DATABASE inngest_prod;

\connect sohizi_rc
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

\connect sohizi_prod
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
