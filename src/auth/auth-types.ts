import { User } from '../users/entities/user.entity.js';

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    // ...
    refreshTokens: false;
    sessionExtra: { user: User };
  }
}
