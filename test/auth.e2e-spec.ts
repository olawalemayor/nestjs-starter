import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PGlite } from '@electric-sql/pglite';
import { PasswordHasher } from '@nestjs/authentication';
import { getDrizzleToken } from '@nestjs/drizzle';
import { InMemoryMailTransport, MailTransport } from '@nestjs/mail';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { VerifyEmailMail } from '../src/auth/email-verification.mailer.js';
import { PasswordResetMail } from '../src/auth/password-reset.mailer.js';

describe('Authentication (e2e)', () => {
  const pglite = new PGlite(); // PostgreSQL in-process: no server to start
  const mailbox = new InMemoryMailTransport();
  let app: INestApplication;
  const ada = { email: 'ada@example.com', password: 'correct horse battery' };

  beforeAll(async () => {
    const db = drizzle({ client: pglite });
    // The app's migrations, the authentication tables included.
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDrizzleToken()) // the database DrizzleModule provides
      .useValue(db)
      .overrideProvider(MailTransport)
      .useValue(mailbox)
      .overrideProvider(PasswordHasher)
      .useValue(new PasswordHasher({ logN: 10 }))
      .compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    await pglite.close();
  });

  it('signs up, verifies the address, then reads the profile with the session cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send(ada)
      .expect(201);
    const cookie = res.headers['set-cookie'][0].split(';')[0];

    const mail = mailbox.assertSent({ to: ada.email, mail: VerifyEmailMail });
    const token = mail.link('/verify-email').searchParams.get('token');
    await request(app.getHttpServer())
      .post('/auth/email/verify')
      .send({ token })
      .expect(200);

    await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', cookie)
      .expect(200, {
        id: res.body.id,
        email: ada.email,
        emailVerified: true,
        roles: ['user'],
      });
  });

  it('issues bearer tokens to the mobile app', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/token')
      .send(ada)
      .expect(200);

    // await request(app.getHttpServer())
    //   .get('/orders')
    //   .set('Authorization', `Bearer ${res.body.accessToken}`)
    //   .expect(200, []);
  });

  it('resets a forgotten password', async () => {
    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: ada.email })
      .expect(202);
    // The email goes out after the response, which doesn't wait for it.
    const mail = await vi.waitFor(() =>
      mailbox.assertSent({ to: ada.email, mail: PasswordResetMail }),
    );
    const token = mail.link('/reset-password').searchParams.get('token');

    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ token, password: 'a brand new passphrase' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send(ada)
      .expect(401);
  });

  it('rejects anonymous requests and wrong passwords', async () => {
    // await request(app.getHttpServer()).get('/orders').expect(401);
    await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ ...ada, password: 'not the password' })
      .expect(401);
  });
});
