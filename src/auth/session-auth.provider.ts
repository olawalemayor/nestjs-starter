import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class SessionAuth extends SessionCookieProvider<User> {
  constructor(registry: AuthenticationRegistry) {
    super();
    // Adds this provider to the chain the guard runs for every request.
    registry.registerProvider(this);
  }

  // Called for every request with a live session cookie.
  // Returning null (the user was deleted) ends the session.

  validate(session: SessionRecord) {
    return session.extra?.user ?? null;
  }
}
