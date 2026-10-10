import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  EmailVerificationService,
  Public,
} from '@nestjs/authentication';
import type { User } from '../users/entities/user.entity.js';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth/email')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  // Called by the page the link opens, which POSTs the token from its URL.
  @ApiOperation({
    summary: 'Verify the email address using the token from the link',
    description:
      'Verifies the email address using the token from the email verification link',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'The token from the email verification link',
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
    description: 'Email address verified successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired link',
  })
  @Public()
  @Post('verify')
  @HttpCode(200)
  async verify(@Body('token') token: string) {
    const verified = await this.emailVerificationService.verify(token);
    if (!verified) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { email: verified.email, emailVerified: true };
  }

  // "Send the link again", to the signed-in customer's current address.
  @ApiOperation({
    summary: 'Resend the email verification link to the current user',
  })
  @ApiResponse({
    status: 202,
    description: 'Email verification link resent successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Email address already verified',
  })
  @Post('verification')
  @HttpCode(202)
  async resend(@CurrentUser() user: User) {
    if (user.emailVerified) {
      throw new ConflictException('Email address already verified');
    }
    await this.emailVerificationService.send(user);
  }
}
