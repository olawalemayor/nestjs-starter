import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import {
  AuthenticationStorage,
  type SessionRecord,
} from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { sql } from 'drizzle-orm';
import {
  drizzle as nodePostgres,
  type NodePgDatabase,
} from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePostgres } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as pglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';
import { DrizzleAuthenticationStore } from '../src/auth/drizzle-authentication.store.js';
import { users } from '../src/database/schema.js';
import { startPostgres } from './support/postgres.js';

type Database = NodePgDatabase;

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/** The store with a cap of 3 pending entries per table, so the suite can check it. */
class CappedStore extends DrizzleAuthenticationStore {
  protected override readonly maxPending = 3;
}

/** The store on empty tables, registered nowhere: the suite builds its own registry. */
async function emptyStore(db: Database) {
  await db.execute(
    sql`TRUNCATE sessions, refresh_tokens, mfa_authenticators, mfa_recovery_codes, mfa_failures, magic_links, oidc_logins, email_tokens`,
  );
  const store = new CappedStore(db, new AuthenticationStorage());
  const sessions = {
    getSession: (id: string) => store.getSession(id),
    createSession: async (record: SessionRecord) => {
      await db
        .insert(users)
        .values({
          id: record.userId,
          email: `${record.userId}@session-contract.invalid`,
          createdAt: record.createdAt,
          roles: ['user'],
          emailVerified: false,
        })
        .onConflictDoNothing();
      await store.createSession(record);
    },
    touchSession: (id: string, lastActiveAt: Date) =>
      store.touchSession(id, lastActiveAt),
    deleteSession: (id: string) => store.deleteSession(id),
    listUserSessions: (userId: string) => store.listUserSessions(userId),
    deleteUserSessions: (userId: string) => store.deleteUserSessions(userId),
  };
  return {
    sessions,
    refreshTokens: store,
    mfa: store,
    magicLinks: store,
    oidcStates: store,
    emailTokens: store,
  };
}

describe('DrizzleAuthenticationStore on PGlite', () => {
  const client = new PGlite();
  const db = pglite({ client }) as unknown as Database;
  beforeAll(() => migratePglite(pglite({ client }), { migrationsFolder }));
  afterAll(() => client.close());

  for (const c of authenticationStoreContract(() => emptyStore(db), {
    concurrent: true,
    maxPending: 3,
  })) {
    it(c.name, c.run);
  }
});

// PostgreSQL on a pool of connections: the concurrency cases race for real.
const { postgres, reason } = await startPostgres();

describe.skipIf(!postgres)(
  `DrizzleAuthenticationStore on PostgreSQL${reason ? ` (skipped: ${reason})` : ''}`,
  () => {
    let pool: Pool;
    let db: Database;
    beforeAll(async () => {
      pool = new Pool({
        connectionString: await postgres!.createDatabase(
          'authentication_tutorial_store',
        ),
        max: 10,
      });
      db = nodePostgres({ client: pool });
      await migrateNodePostgres(db, { migrationsFolder });
    });
    afterAll(async () => {
      await pool?.end();
      await postgres!.stop();
    });

    for (const c of authenticationStoreContract(() => emptyStore(db), {
      concurrent: true,
      maxPending: 3,
    })) {
      it(c.name, c.run);
    }
  },
);
