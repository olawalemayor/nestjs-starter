import { Module, ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthenticationModule, google } from '@nestjs/authentication';
import {
  MailModule,
  SmtpTransport,
  LogMailTransport,
  FileTemplateEngine,
} from '@nestjs/mail';
import { join } from 'node:path';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';
import { AuthThrottlerGuard } from './auth/auth-throttler.guard.js';
import { DrizzleModule } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      useFactory: () => ({ drizzle, connection: process.env.DATABASE_URL! }),
    }),
    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),
    MailModule.forRootAsync({
      useFactory: () => ({
        // Your provider in production. In development, each email (links
        // included) is printed to the log.
        transport: process.env.SMTP_URL
          ? new SmtpTransport({ url: process.env.SMTP_URL })
          : new LogMailTransport(),
        // The emails' HTML: the templates in mail/templates, next to this file
        templates: new FileTemplateEngine({
          dir: join(import.meta.dirname, 'mail/templates'),
        }),
        from: 'Accounts <accounts@example.com>',
      }),
    }),
    AuthenticationModule.forRootAsync({
      useFactory: () => ({
        session: {
          absoluteTtl: '14d',
          idleTtl: '3d',
          metadata: (request) => ({
            userAgent: request.headers['user-agent'],
          }),
        },
        oidc: {
          callbackUrl: `${process.env.APP_URL}/auth/oidc/:provider/callback`,
          providers: {
            google: google({
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            }),
          },
        },
        emailVerification: { url: `${process.env.APP_URL}/verify-email` },
        passwordReset: { url: `${process.env.APP_URL}/reset-password` },
        accessToken: {
          key: process.env.JWT_SECRET!,
          issuer: 'https://api.example.com',
          audience: 'mobile-app',
          ttl: '15m',
        },
        refreshToken: false,
        mfa: {
          issuer: 'example.com',
          encryption: { keys: [process.env.TOTP_ENCRYPTION_KEY!] },
        },
        magicLink: { url: `${process.env.APP_URL}/sign-in/magic` },
      }),
    }),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_GUARD, useClass: AuthThrottlerGuard },
  ],
})
export class AppModule {}
