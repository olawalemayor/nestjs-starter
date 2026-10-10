import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Authenticate,
  CurrentSession,
  CurrentUser,
  MfaService,
  Public,
  SessionService,
  SignInService,
  TokenService,
} from '@nestjs/authentication';
import type { SessionRecord } from '@nestjs/authentication';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Authentication')
@ApiBearerAuth()
@Controller('auth/mfa')
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly signInService: SignInService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
  ) {}

  // Returns the otpauth:// URI for the web app to show as a QR code,
  // and the secret for people who type it in instead.
  @ApiOperation({
    summary: 'Enroll a new MFA device for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA device enrolled successfully',
  })
  @Post('enroll')
  enroll(@CurrentUser() user: User) {
    return this.mfaService.enroll(user.id, user.email);
  }

  // A new phone. The current authenticator keeps working until /confirm
  // receives a code from the new one.
  @ApiOperation({
    summary:
      'Replace the current MFA device with a new one for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA device replacement initiated successfully',
  })
  @Authenticate({ mfa: true })
  @Post('replace')
  replace(@CurrentUser() user: User) {
    return this.mfaService.enroll(user.id, user.email, { replace: true });
  }

  // The first code proves the authenticator works, and that this browser has
  // it: the session passes the second factor from here on, under a new cookie.
  // Recovery codes are shown once.
  @ApiOperation({
    summary: 'Confirm the enrollment of a new MFA device for the current user',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'The code from the new MFA device',
              },
            },
            required: ['code'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'MFA device confirmed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid code',
  })
  @Post('confirm')
  @HttpCode(200)
  async confirm(@CurrentUser('id') userId: string, @Body('code') code: string) {
    if (!(await this.signInService.confirmMfa(userId, code))) {
      throw new UnauthorizedException('Invalid code');
    }
    return {
      recoveryCodes: await this.mfaService.generateRecoveryCodes(userId),
    };
  }

  // Second step of signing in. A pending session counts as signed in
  // nowhere, so the route is public: completeMfa() reads the session cookie.
  @ApiOperation({
    summary: 'Verify the MFA code or recovery code for the current user',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'The MFA code from the current user',
              },
              recoveryCode: {
                type: 'string',
                description: 'The recovery code from the current user',
              },
            },
            required: ['code', 'recoveryCode'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'MFA verification successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid code',
  })
  @Public()
  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body('code') code: string | undefined,
    @Body('recoveryCode') recoveryCode: string | undefined,
  ) {
    const issued = await this.signInService.completeMfa({ code, recoveryCode });
    if (!issued) {
      throw new UnauthorizedException('Invalid code');
    }
    return { mfa: issued.session.mfa };
  }

  // Takes a verified session and a fresh code: a session left signed in on a
  // shared computer isn't enough.
  @ApiOperation({
    summary: 'Disable MFA for the current user',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'The code from the current user',
              },
            },
            required: ['code'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description: 'MFA disabled successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid code',
  })
  @Authenticate({ mfa: true })
  @Post('disable')
  @HttpCode(204)
  async disable(
    @CurrentUser('id') userId: string,
    @CurrentSession() current: SessionRecord,
    @Body('code') code: string,
  ) {
    if (!(await this.mfaService.verifyTotp(userId, code))) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.mfaService.disable(userId);
    // The other sessions and refresh tokens passed the second factor, and still would.
    await this.sessionService.revokeAll(userId, { except: current.id });
    await this.tokenService.revokeAll(userId);
  }
}
