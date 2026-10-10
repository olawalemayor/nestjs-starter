import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public, TokenService } from '@nestjs/authentication';
import { TokenRequestDto } from './dto/auth.dto.js';
import { CredentialsService } from './credential.service.js';
import { Throttle, minutes } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@Public()
@Controller('auth/token')
export class TokensController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokenService: TokenService,
  ) {}

  @ApiOperation({
    summary: 'Issue a new access token using user credentials',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'The email of the user',
              },
              password: {
                type: 'string',
                description: 'The password of the user',
              },
              code: {
                type: 'string',
                description: 'The MFA code from the current user',
              },
              recoveryCode: {
                type: 'string',
                description: 'The recovery code from the current user',
              },
            },
            required: ['email', 'password'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Access token issued successfully',
  })
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @Post()
  @HttpCode(200)
  async issue(@Body() body: TokenRequestDto) {
    const user = await this.credentialsService.verify(
      body.email,
      body.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokenService.issue(user.id, {
      method: 'password',
      // `amr` goes into this access token and into every refreshed one.
      claims: { amr: ['pwd'] },
      // Checked only for customers with an authenticator.
      secondFactor: { code: body.code, recoveryCode: body.recoveryCode },
    });
  }

  // An unknown, expired or reused refresh token gets a 401.
  @ApiOperation({
    summary: 'Refresh an access token using a refresh token',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              refreshToken: {
                type: 'string',
                description:
                  'The refresh token to use for obtaining a new access token',
              },
            },
            required: ['refreshToken'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
  })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.tokenService.refresh(refreshToken);
  }

  // Signs the mobile app out on this device. Unknown tokens get the same
  // answer, as in RFC 7009.
  @ApiOperation({
    summary: 'Revoke a refresh token',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              refreshToken: {
                type: 'string',
                description: 'The refresh token to use for revoking it',
              },
            },
            required: ['refreshToken'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description: 'Refresh token revoked successfully',
  })
  @Post('revoke')
  @HttpCode(204)
  async revoke(@Body('refreshToken') refreshToken: string) {
    await this.tokenService.revoke(refreshToken);
  }
}
