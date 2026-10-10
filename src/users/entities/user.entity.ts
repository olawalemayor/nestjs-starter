import { ApiProperty } from '@nestjs/swagger';

export type Role = 'user' | 'admin';

export class User {
  id: string;

  @ApiProperty({
    description: 'The email address of the user.',
    example: 'user@example.com',
  })
  email: string;

  /** Whether the owner proved the address to us, e.g. by using a magic link. */
  @ApiProperty({
    description:
      'Whether the owner proved the address to us, e.g. by using a magic link.',
    example: true,
  })
  emailVerified: boolean;

  @ApiProperty({
    enum: ['user', 'admin'],
    isArray: true,
    example: ['user'],
    description: 'The roles assigned to the user.',
  })
  roles: Role[];
}
