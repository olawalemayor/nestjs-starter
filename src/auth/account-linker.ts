import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AuthenticationRegistry,
  OidcAccountResolver,
  type OAuthTokens,
  type OidcProfile,
  type OidcResolveContext,
} from '@nestjs/authentication';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class AccountLinker extends OidcAccountResolver {
  constructor(
    private readonly usersRepository: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('oidc', this);
  }

  async resolveUser(
    profile: OidcProfile,
    _tokens: OAuthTokens,
    { linkTo }: OidcResolveContext,
  ) {
    const linked = await this.usersRepository.findByIdentity(
      profile.provider,
      profile.subject,
    );

    // "Connect Google" from the account page: link to the signed-in customer.
    if (linkTo) {
      if (linked && linked.id !== linkTo.id) {
        throw new ConflictException(
          'This Google account belongs to another customer',
        );
      }
      return this.usersRepository.linkIdentity(
        linkTo.id,
        profile.provider,
        profile.subject,
      );
    }

    // A returning Google account: sign in the user it is linked to.
    if (linked) {
      return linked;
    }

    // First visit. Trust only an address Google verified, or anyone could
    // claim any account.
    if (!profile.email || !profile.emailVerified) {
      return null; // 403
    }
    const existing = await this.usersRepository.findByEmail(profile.email);
    if (!existing) {
      const user = await this.usersRepository.create(profile.email, {
        emailVerified: true,
      });
      return this.usersRepository.linkIdentity(
        user.id,
        profile.provider,
        profile.subject,
      );
    }
    // Link by email only if the account's owner proved the address to us too.
    // Otherwise whoever signed up with it, with a password of their choosing,
    // would share the account with the customer.
    if (!existing.emailVerified) {
      throw new ForbiddenException(
        'Sign in with your password, then connect Google from your account',
      );
    }
    return this.usersRepository.linkIdentity(
      existing.id,
      profile.provider,
      profile.subject,
    );
  }
}
