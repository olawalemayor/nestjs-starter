import {
  Body,
  ConflictException,
  Controller,
  Get,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  Authenticate,
  CurrentUser,
  EmailVerificationService,
} from '@nestjs/authentication';
import { EmailDto } from '../auth/dto/auth.dto.js';
import { UsersRepository } from './users.repository.js';
import { ApiTags } from '@nestjs/swagger';
import { User } from './entities/user.entity.js';

@ApiTags('Current User')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({
    status: 200,
    description: 'Current user retrieved successfully',
    type: User,
  })
  @Get()
  me(@CurrentUser() user: User) {
    return user;
  }

  @ApiOperation({ summary: 'Change current user email' })
  @ApiResponse({
    status: 200,
    description: 'Current user email changed successfully',
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  // The email address is how an account is recovered: changing it needs a
  // session (or token) that passed the second factor.
  @Authenticate({ mfa: true })
  @Patch('email')
  async changeEmail(@CurrentUser('id') userId: string, @Body() body: EmailDto) {
    if (await this.usersRepository.findByEmail(body.email)) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.usersRepository.updateEmail(userId, body.email);
    if (user) {
      // The new address is unverified until the customer uses this link.
      await this.emailVerificationService.send(user);
    }
    return user;
  }
}
