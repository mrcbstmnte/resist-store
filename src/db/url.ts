// Neon's Vercel integration may name the variable differently (or add a custom
// prefix), so accept the common names. Migrations prefer the direct (unpooled)
// connection, as Neon recommends.
const RUNTIME_VARS = ['DATABASE_URL', 'POSTGRES_URL'];
const MIGRATION_VARS = ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', ...RUNTIME_VARS];

function pick(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(
    `No database connection string found (looked for ${names.join(', ')}). ` +
      'On Vercel: Storage → connect the Neon database to this project for the Production, Preview and ' +
      'Development environments, then redeploy. If you chose a custom prefix, add DATABASE_URL under ' +
      'Settings → Environment Variables with the same value.',
  );
}

export const databaseUrl = () => pick(RUNTIME_VARS);
export const migrationDatabaseUrl = () => pick(MIGRATION_VARS);
