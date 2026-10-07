-- Run as a PostgreSQL administrator with psql (not inside a transaction).
-- A new role is restricted to its own databases, without superuser privileges.
-- The password is supplied through NW_DATABASE_PASSWORD, never embedded here.
\set ON_ERROR_STOP on
\getenv app_password NW_DATABASE_PASSWORD
SELECT 'CREATE ROLE novaworks LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'novaworks') \gexec
SELECT format('ALTER ROLE novaworks PASSWORD %L', :'app_password') \gexec
SELECT 'CREATE DATABASE novaworks OWNER novaworks'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'novaworks') \gexec
SELECT 'CREATE DATABASE novaworks_test OWNER novaworks'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'novaworks_test') \gexec
SELECT current_setting('port') AS port, current_setting('server_version') AS server_version;
