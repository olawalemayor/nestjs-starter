import { Module } from '@nestjs/common';
import { DrizzleAuthenticationStore } from './drizzle-authentication.store.js';
import { SessionAuth } from './session-auth.provider.js';
import { ApiKeyAuth } from './api-key-auth.provider.js';
import { UsersModule } from '../users/users.module.js';
import { OidcController } from './oidc.controller.js';
import { AuthController } from './auth.controller.js';
import { AccountLinker } from './account-linker.js';
import { CredentialsService } from './credential.service.js';
import { EmailVerificationMailer } from './email-verification.mailer.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { PasswordResetMailer } from './password-reset.mailer.js';
import { PasswordResetController } from './password-reset.controller.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { TokensController } from './tokens.controller.js';
import { MagicLinkMailer } from './magic-link.mailer.js';
import { MagicLinkController } from './magic-link.controller.js';
import { SessionsController } from './sessions.controller.js';
import { MfaController } from './mfa.controller.js';
import { ApiKeysController } from './api-keys.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [
    AuthController,
    EmailVerificationController,
    PasswordResetController,
    TokensController,
    MfaController,
    OidcController,
    MagicLinkController,
    SessionsController,
    ApiKeysController,
  ],
  providers: [
    SessionAuth,
    JwtAuth,
    CredentialsService,
    EmailVerificationMailer,
    PasswordResetMailer,
    AccountLinker,
    MagicLinkMailer,
    DrizzleAuthenticationStore,
    ApiKeyAuth,
  ],
})
export class AuthModule {}
