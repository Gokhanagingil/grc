import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { MultiTenantServiceBase } from '../common/multi-tenant-service.base';

/**
 * Users Service
 *
 * Provides business logic for user operations.
 * Extends MultiTenantServiceBase to provide tenant-aware CRUD operations.
 *
 * This service demonstrates how to use the multi-tenant abstraction:
 * - Inherits findAllForTenant, findOneForTenant, createForTenant, etc.
 * - Adds domain-specific methods like findByEmail, findById
 * - All tenant-aware queries automatically filter by tenantId
 *
 * @example
 * ```typescript
 * // Get all users for a tenant
 * const users = await usersService.findAllForTenant(tenantId);
 *
 * // Get a specific user ensuring they belong to the tenant
 * const user = await usersService.findOneForTenant(tenantId, userId);
 *
 * // Create a user for a tenant
 * const newUser = await usersService.createForTenant(tenantId, { email, passwordHash });
 * ```
 */
@Injectable()
export class UsersService extends MultiTenantServiceBase<User> {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {
    super(usersRepository);
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Get total count of users
   */
  async count(): Promise<number> {
    return this.usersRepository.count();
  }

  /**
   * Create a new user
   */
  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  /**
   * Find all users (with optional pagination)
   */
  async findAll(options?: { skip?: number; take?: number }): Promise<User[]> {
    return this.usersRepository.find({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }
}
