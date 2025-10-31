import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/auth/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(UserEntity) private readonly usersRepo: Repository<UserEntity>) {}

  async findByEmail(email: string): Promise<{ id: string; email: string; passwordHash: string; password?: string; role?: string; displayName?: string; userId?: string } | null> {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.password_hash,
      password: user.password_hash, // alias for compatibility
      displayName: user.display_name || undefined,
      userId: user.id,
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { id } });
  }
}

