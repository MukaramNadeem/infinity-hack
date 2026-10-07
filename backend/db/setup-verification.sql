-- Optional isolated clean-install verification databases; never resets the demo DB.
\set ON_ERROR_STOP on
SELECT 'CREATE DATABASE novaworks_verify OWNER novaworks'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='novaworks_verify') \gexec
SELECT 'CREATE DATABASE novaworks_verify_test OWNER novaworks'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='novaworks_verify_test') \gexec
