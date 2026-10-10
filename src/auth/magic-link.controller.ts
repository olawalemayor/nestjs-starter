import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { MagicLinkService, Public } from '@nestjs/authentication';
import { EmailDto } from './dto/auth.dto.js';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@Public()
@Controller('auth/magic-link')
export class MagicLinkController {
  constructor(private readonly magicLinkService: MagicLinkService) {}

  @ApiOperation({
    summary: "Request a magic link to be sent to the user's email address",
    description: "Request a magic link to be sent to the user's email address",
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'The email address to send the magic link to',
              },
              redirectTo: {
                type: 'string',
                description:
                  'The URL to redirect to after consuming the magic link',
              },
            },
            required: ['email'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Magic link request accepted',
  })
  @Throttle({ default: { limit: 3, ttl: minutes(15) } })
  @Post()
  @HttpCode(202)
  async request(
    @Body() body: EmailDto,
    @Body('redirectTo') redirectTo?: string,
  ) {
    await this.magicLinkService.create(body.email, { redirectTo });
  }

  // Called by the page the link opens, which POSTs the token from its URL.
  @ApiOperation({
    summary: 'Consume a magic link using the token from the link',
    description: 'Consume a magic link using the token from the link',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'The token from the magic link',
              },
            },
            required: ['token'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Magic link consumed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired link',
  })
  @Post('consume')
  @HttpCode(200)
  async consume(@Body('token') token: string) {
    // A link opened in another browser throws MagicLinkError, which the module
    // answers: a 401 telling the customer to open it where they asked for it.
    const result = await this.magicLinkService.consume(token);
    if (!result) {
      throw new UnauthorizedException('Invalid or expired link');
    }
    return {
      redirectTo: result.redirectTo ?? '/',
      mfaRequired: result.session.mfa === 'pending',
    };
  }
}
