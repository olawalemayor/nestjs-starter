import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

/** A single-connection client keeps test queries and cleanup predictable. */
export const postgresClient = connectionString
  ? postgres(connectionString, { max: 1 })
  : undefined;
export const db = postgresClient
  ? drizzle({ client: postgresClient })
  : undefined;

export interface TestPostgres {
  createDatabase(name: string): Promise<string>;
  stop(): Promise<void>;
}

export interface StartPostgresResult {
  postgres: TestPostgres | undefined;
  reason?: string;
}

/** Connect to the configured PostgreSQL server for tests that need a real pool. */
export async function startPostgres(): Promise<StartPostgresResult> {
  if (!connectionString) {
    return {
      postgres: undefined,
      reason: 'Set TEST_DATABASE_URL or DATABASE_URL to run PostgreSQL tests.',
    };
  }

  const client = postgres(connectionString, { max: 1 });

  try {
    await client`SELECT 1`;
  } catch (error) {
    await client.end();
    const message = error instanceof Error ? error.message : String(error);
    return {
      postgres: undefined,
      reason: `Could not connect to the configured PostgreSQL server: ${message}`,
    };
  }

  return {
    postgres: {
      async createDatabase(name: string): Promise<string> {
        const existing = await client`
          SELECT 1 FROM pg_database WHERE datname = ${name}
        `;
        if (existing.length === 0) {
          const quotedName = `"${name.replaceAll('"', '""')}"`;
          await client.unsafe(`CREATE DATABASE ${quotedName}`);
        }

        const databaseUrl = new URL(connectionString);
        databaseUrl.pathname = `/${name}`;
        return databaseUrl.toString();
      },
      stop: () => client.end(),
    },
  };
}

/** Remove test data while preserving Drizzle's migration history. */
export async function resetPostgres(): Promise<void> {
  if (!postgresClient) {
    throw new Error(
      'Set TEST_DATABASE_URL or DATABASE_URL to run PostgreSQL tests.',
    );
  }

  const tables = await postgresClient<
    { schemaname: string; tablename: string }[]
  >`
		SELECT schemaname, tablename
		FROM pg_tables
		WHERE schemaname = 'public'
			AND tablename <> '__drizzle_migrations'
	`;

  if (tables.length === 0) return;

  const qualifiedTables = tables
    .map(
      ({ schemaname, tablename }) =>
        `${postgresClient.unsafe(`SELECT quote_ident(${JSON.stringify(schemaname)})`).toString()}.${postgresClient.unsafe(`SELECT quote_ident(${JSON.stringify(tablename)})`).toString()}`,
    )
    .join(', ');

  await postgresClient.unsafe(
    `TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`,
  );
}

export async function closePostgres(): Promise<void> {
  await postgresClient?.end();
}
