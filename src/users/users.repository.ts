import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { userIdentities, users } from '../database/schema.js';
import { User } from './entities/user.entity.js';

type UserRow = typeof users.$inferSelect;

@Injectable()
export class UsersRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async create(
    email: string,
    {
      passwordHash = null,
      emailVerified = false,
    }: { passwordHash?: string | null; emailVerified?: boolean } = {},
  ): Promise<User> {
    try {
      const [row] = await this.db
        .insert(users)
        .values({
          id: randomUUID(),
          email: normalize(email),
          createdAt: new Date(),
          emailVerified,
          roles: ['user'],
          passwordHash,
        })
        .returning();

      if (!row) {
        throw new Error('User insert did not return a row');
      }
      return toUser(row);
    } catch (error) {
      throwIfDuplicateEmail(error);
    }
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.findRow(email);
    return row ? toUser(row) : null;
  }

  /** For password sign-in only. */
  async findCredentials(
    email: string,
  ): Promise<{ user: User; passwordHash: string | null } | null> {
    const row = await this.findRow(email);
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async updateEmail(id: string, email: string): Promise<User | null> {
    try {
      const [row] = await this.db
        .update(users)
        .set({ email: normalize(email), emailVerified: false })
        .where(eq(users.id, id))
        .returning();
      return row ? toUser(row) : null;
    } catch (error) {
      throwIfDuplicateEmail(error);
    }
  }

  private async findRow(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(email)))
      .limit(1);
    return row;
  }

  /** Marks the email verified only if it still matches the stored address. */
  async markEmailVerified(id: string, email: string): Promise<boolean> {
    const rows = await this.db
      .update(users)
      .set({ emailVerified: true })
      .where(and(eq(users.id, id), eq(users.email, normalize(email))))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  async findByIdentity(
    provider: string,
    subject: string,
  ): Promise<User | null> {
    const [identity] = await this.db
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, provider),
          eq(userIdentities.subject, subject),
        ),
      )
      .limit(1);
    if (!identity) {
      return null;
    }
    return this.findById(identity.userId);
  }

  async linkIdentity(
    id: string,
    provider: string,
    subject: string,
  ): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) {
      return null;
    }

    await this.db
      .insert(userIdentities)
      .values({ userId: id, provider, subject })
      .onConflictDoNothing();

    const [identity] = await this.db
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, provider),
          eq(userIdentities.subject, subject),
        ),
      )
      .limit(1);
    if (identity?.userId !== id) {
      throw new ConflictException(
        'This identity is already linked to another user',
      );
    }

    return user;
  }
}

const normalize = (email: string) =>
  email.trim().normalize('NFC').toLowerCase();

const toUser = ({ id, email, emailVerified, roles }: UserRow): User => ({
  id,
  email,
  emailVerified,
  roles: [...roles],
});

function throwIfDuplicateEmail(error: unknown): never {
  if (hasConstraintViolation(error, 'users_email_unique')) {
    throw new ConflictException('Email already registered');
  }
  throw error;
}

function hasConstraintViolation(error: unknown, constraint: string): boolean {
  const visited = new Set<object>();
  let current = error;

  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      return false;
    }
    visited.add(current);

    if (
      'code' in current &&
      current.code === '23505' &&
      'constraint' in current &&
      current.constraint === constraint
    ) {
      return true;
    }

    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}
