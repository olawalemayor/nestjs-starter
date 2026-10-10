import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EmailVerificationService,
  Public,
  SignInService,
} from '@nestjs/authentication';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SignInDto, SignUpDto } from './dto/auth.dto.js';
import { CredentialsService } from './credential.service.js';
import { Throttle, minutes } from '@nestjs/throttler';
import { User } from '../users/entities/user.entity.js';

@ApiTags('Authentication')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: User,
  })
  @Post('sign-up')
  async signUp(@Body() body: SignUpDto) {
    const user = await this.credentialsService.register(
      body.email,
      body.password,
    );
    await this.signInService.signIn(user.id, { method: 'password' });
    // The link in this email proves the customer owns the address.
    await this.emailVerificationService.send(user);
    return user;
  }

  @ApiOperation({ summary: 'Sign in an existing user' })
  @ApiResponse({
    status: 200,
    description: 'User signed in successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
  })
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: SignInDto) {
    const user = await this.credentialsService.verify(
      body.email,
      body.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const { session } = await this.signInService.signIn(user.id, {
      method: 'password',
    });
    return { mfaRequired: session.mfa === 'pending' };
  }
}
