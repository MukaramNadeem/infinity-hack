import pg from 'pg';
pg.types.setTypeParser(1082, value => value);
pg.types.setTypeParser(1700, Number);
pg.types.setTypeParser(20, Number);
export function createPool(config, connectionString = config.databaseUrl) {
  // pg parses URL SSL parameters after options, which would discard our CA.
  // Keep DATABASE_SSL and DATABASE_CA_CERT authoritative.
  const url = new URL(connectionString);
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
  let ssl = false;
  if (config.databaseSSL) {
    ssl = config.databaseCA ? { ca:config.databaseCA, rejectUnauthorized:true } : { rejectUnauthorized:false };
    if (!config.databaseCA) console.warn('Database TLS enabled without a CA certificate; certificate verification is disabled.');
  }
  return new pg.Pool({ connectionString:url.href, ssl, connectionTimeoutMillis:5000, max:10 });
}
