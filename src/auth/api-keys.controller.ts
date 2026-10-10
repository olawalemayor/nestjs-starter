import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { apiKeys } from '../database/schema.js';
import { ApiKeyAuth } from './api-key-auth.provider.js';
import { SessionAuth } from './session-auth.provider.js';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';

const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

// Managed from the web app, signed in with a session: a key can't create or revoke keys.
@ApiTags('Authentication')
@ApiBearerAuth()
@Authenticate({ providers: [SessionAuth] })
@Controller('auth/api-keys')
export class ApiKeysController {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    private readonly apiKeyAuth: ApiKeyAuth,
  ) {}

  // The only response that contains the key: the table keeps its hash.
  @ApiOperation({ summary: 'Create a new API key for the current user' })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
  })
  @Post()
  async create(@CurrentUser('id') userId: string) {
    const { key, id, hash } = this.apiKeyAuth.generate();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ONE_YEAR);
    await this.db
      .insert(apiKeys)
      .values({ id, userId, hash, createdAt, expiresAt });
    return { id, key, createdAt, expiresAt };
  }

  @ApiOperation({ summary: 'List all API keys for the current user' })
  @ApiResponse({
    status: 200,
    description: 'API keys retrieved successfully',
  })
  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.db
      .select({
        id: apiKeys.id,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
  }

  // Revoked from the next request on. Another customer's key is a 404.
  @ApiOperation({ summary: 'Revoke an API key for the current user' })
  @ApiResponse({
    status: 204,
    description: 'API key revoked successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found',
  })
  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const revoked = await this.db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();
    if (revoked.length === 0) {
      throw new NotFoundException();
    }
  }
}
