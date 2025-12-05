import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { User } from '../users/user.entity';

/**
 * Tenants Service
 *
 * Provides tenant-related business logic and database operations.
 */
@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Find a tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { id } });
  }

  /**
   * Find a tenant by name
   */
  async findByName(name: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({ where: { name } });
  }

  /**
   * Create a new tenant
   */
  async create(name: string, description?: string): Promise<Tenant> {
    const tenant = this.tenantRepository.create({
      name,
      description,
    });
    return this.tenantRepository.save(tenant);
  }

  /**
   * Get all users for a tenant
   */
  async getUsersForTenant(tenantId: string): Promise<User[]> {
    return this.userRepository.find({
      where: { tenantId },
      select: [
        'id',
        'email',
        'role',
        'firstName',
        'lastName',
        'isActive',
        'createdAt',
      ],
    });
  }

  /**
   * Check if a user belongs to a tenant
   */
  async userBelongsToTenant(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId, tenantId },
    });
    return !!user;
  }

  /**
   * Assign a user to a tenant
   */
  async assignUserToTenant(
    userId: string,
    tenantId: string,
  ): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }
    user.tenantId = tenantId;
    return this.userRepository.save(user);
  }

  /**
   * Get or create a demo tenant
   * Used for seeding/demo purposes
   */
  async getOrCreateDemoTenant(): Promise<Tenant> {
    const demoTenantName = 'Demo Organization';
    let tenant = await this.findByName(demoTenantName);

    if (!tenant) {
      tenant = await this.create(
        demoTenantName,
        'Default demo tenant for testing and development',
      );
    }

    return tenant;
  }

  /**
   * Count all tenants
   */
  async count(): Promise<number> {
    return this.tenantRepository.count();
  }

  /**
   * Get all tenants
   */
  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }
}
