import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../entities/auth/user.entity';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly cacheService: CacheService,
  ) {}

  async findByEmail(email: string): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    password?: string;
    role?: string;
    displayName?: string;
    userId?: string;
    tenantId?: string;
  } | null> {
    const user = await this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.password_hash,
      password: user.password_hash, // alias for compatibility
      displayName: user.display_name || undefined,
      userId: user.id,
      tenantId: user.tenant_id,
    };
  }

  async validateCredentials(email: string, password: string): Promise<UserEntity | null> {
    const user = await this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) return null;
    const isValid = await bcrypt.compare(password, user.password_hash);
    return isValid ? user : null;
  }

  async createUser(
    email: string,
    password: string,
    roles: string[] = ['user'],
    tenantId?: string,
  ): Promise<UserEntity> {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const user = this.usersRepo.create({
      id: require('uuid').v4(),
      email: email.toLowerCase(),
      password_hash: passwordHash,
      tenant_id: tenantId || process.env.DEFAULT_TENANT_ID || '',
      is_active: true,
      is_email_verified: false,
    });
    
    return this.usersRepo.save(user);
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async list(options: { page: number; limit: number }) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [items, total] = await this.usersRepo.findAndCount({
      where: {
        /* is_active: true */
      },
      skip,
      take: limit,
      order: { created_at: 'DESC' },
      select: [
        'id',
        'email',
        'display_name',
        'is_active',
        'is_email_verified',
        'created_at',
      ],
    });

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        isActive: u.is_active,
        isEmailVerified: u.is_email_verified,
        createdAt: u.created_at,
      })),
      total,
      page,
      limit,
    };
  }

  async getOwners() {
    const cacheKey = 'users:owners';
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const users = await this.usersRepo.find({
            where: { is_active: true },
            select: ['id', 'email', 'display_name'],
            order: { email: 'ASC' },
          });
          return users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.display_name || u.email,
          }));
        } catch (error: any) {
          return [];
        }
      },
      300, // 5 minutes TTL
    );
  }

  async getAuditors() {
    const cacheKey = 'users:auditors';
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        try {
          const users = await this.usersRepo.find({
            where: { is_active: true },
            select: ['id', 'email', 'display_name'],
            order: { email: 'ASC' },
          });
          return users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.display_name || u.email,
          }));
        } catch (error: any) {
          return [];
        }
      },
      300, // 5 minutes TTL
    );
  }
}
