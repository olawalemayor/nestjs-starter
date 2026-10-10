import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { ConflictException } from '@nestjs/common';
import { drizzle as pglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { UsersRepository } from '../src/users/users.repository.js';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

describe('UsersRepository on PGlite', () => {
  const client = new PGlite();
  const db = pglite({ client });
  const repository = new UsersRepository(db as unknown as NodePgDatabase);

  beforeAll(() => migrate(db, { migrationsFolder }));
  afterAll(() => client.close());

  it('persists normalized users and credentials in PostgreSQL', async () => {
    const user = await repository.create('  Ada@Example.com  ', {
      passwordHash: 'hashed-password',
    });

    expect(user).toMatchObject({
      email: 'ada@example.com',
      emailVerified: false,
      roles: ['user'],
    });
    expect(await repository.findById(user.id)).toEqual(user);
    expect(await repository.findByEmail('ADA@example.com')).toEqual(user);
    expect(await repository.findCredentials('ada@example.com')).toEqual({
      user,
      passwordHash: 'hashed-password',
    });
  });

  it('rejects duplicate normalized email addresses', async () => {
    await repository.create('unique@example.com');

    await expect(repository.create(' Unique@Example.com ')).rejects.toThrow(
      ConflictException,
    );
  });

  it('changes and verifies only the current email address', async () => {
    const user = await repository.create('before@example.com', {
      emailVerified: true,
    });

    expect(
      await repository.markEmailVerified(user.id, 'different@example.com'),
    ).toBe(false);

    const updated = await repository.updateEmail(user.id, 'after@example.com');
    expect(updated).toMatchObject({
      id: user.id,
      email: 'after@example.com',
      emailVerified: false,
    });
    expect(
      await repository.markEmailVerified(user.id, 'before@example.com'),
    ).toBe(false);
    expect(
      await repository.markEmailVerified(user.id, 'AFTER@example.com'),
    ).toBe(true);
  });

  it('persists identity links and prevents linking an identity to another user', async () => {
    const first = await repository.create('identity-first@example.com');
    const second = await repository.create('identity-second@example.com');

    expect(
      await repository.linkIdentity(first.id, 'google', 'subject-1'),
    ).toEqual(first);
    expect(await repository.findByIdentity('google', 'subject-1')).toEqual(
      first,
    );
    await expect(
      repository.linkIdentity(second.id, 'google', 'subject-1'),
    ).rejects.toThrow(ConflictException);
    expect(
      await repository.linkIdentity('missing-user', 'google', 'subject-2'),
    ).toBeNull();
  });
});
