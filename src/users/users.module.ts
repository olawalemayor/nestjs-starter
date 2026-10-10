import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';
import { MeController } from './me.controller.js';

@Module({
  controllers: [MeController],
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
