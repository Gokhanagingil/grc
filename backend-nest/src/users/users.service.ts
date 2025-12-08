import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';
import { MultiTenantServiceBase } from '../common/multi-tenant-service.base';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  QueryUsersDto,
} from './dto';

/**
 * Paginated users response
 */
export interface PaginatedUsersResponse {
  users: Omit<User, 'passwordHash'>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * User statistics response
 */
export interface UserStatistics {
  total: number;
  admins: number;
  managers: number;
  users: number;
  inactive: number;
}

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

  /**
   * Find all users for a tenant with pagination and filtering
   */
  async findAllUsersForTenant(
    tenantId: string,
    query: QueryUsersDto,
  ): Promise<PaginatedUsersResponse> {
    const { page = 1, limit = 10, role, department, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .where('user.tenant_id = :tenantId', { tenantId });

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (department) {
      queryBuilder.andWhere('user.department = :department', { department });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.first_name ILIKE :search OR user.last_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('user.created_at', 'DESC').skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    const usersWithoutPassword = users.map((user) => {
      const userResponse = { ...user };
      delete (userResponse as { passwordHash?: string }).passwordHash;
      return userResponse;
    });

    return {
      users: usersWithoutPassword,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new user for a tenant
   */
  async createUserForTenant(
    tenantId: string,
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = this.usersRepository.create({
      email: createUserDto.email,
      passwordHash,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      department: createUserDto.department,
      role: createUserDto.role || UserRole.USER,
      isActive: createUserDto.isActive ?? true,
      tenantId,
    });

    const savedUser = await this.usersRepository.save(user);
    const userResponse = { ...savedUser };
    delete (userResponse as { passwordHash?: string }).passwordHash;
    return userResponse;
  }

  /**
   * Update a user for a tenant
   */
  async updateUserForTenant(
    tenantId: string,
    userId: string,
    updateUserDto: UpdateUserDto,
    requestingUserId: string,
    requestingUserRole: UserRole | string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOneForTenant(tenantId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = String(requestingUserRole) === String(UserRole.ADMIN);
    const isSelf = requestingUserId === userId;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('Access denied');
    }

    if (!isAdmin && isSelf) {
      if (updateUserDto.role !== undefined) {
        throw new ForbiddenException('Only admins can change user roles');
      }
      if (updateUserDto.isActive !== undefined) {
        throw new ForbiddenException('Only admins can change user status');
      }
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
    }

    if (updateUserDto.email !== undefined) user.email = updateUserDto.email;
    if (updateUserDto.firstName !== undefined)
      user.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined)
      user.lastName = updateUserDto.lastName;
    if (updateUserDto.department !== undefined)
      user.department = updateUserDto.department;
    if (updateUserDto.role !== undefined && isAdmin)
      user.role = updateUserDto.role;
    if (updateUserDto.isActive !== undefined && isAdmin)
      user.isActive = updateUserDto.isActive;

    const savedUser = await this.usersRepository.save(user);
    const userResponse = { ...savedUser };
    delete (userResponse as { passwordHash?: string }).passwordHash;
    return userResponse;
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(
    tenantId: string,
    userId: string,
    role: UserRole,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.findOneForTenant(tenantId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.role = role;
    const savedUser = await this.usersRepository.save(user);
    const userResponse = { ...savedUser };
    delete (userResponse as { passwordHash?: string }).passwordHash;
    return userResponse;
  }

  /**
   * Change user password
   */
  async changePassword(
    tenantId: string,
    userId: string,
    changePasswordDto: ChangePasswordDto,
    requestingUserId: string,
  ): Promise<{ message: string }> {
    if (requestingUserId !== userId) {
      throw new ForbiddenException('You can only change your own password');
    }

    const user = await this.findOneForTenant(tenantId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValidPassword = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isValidPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      saltRounds,
    );
    await this.usersRepository.save(user);

    return { message: 'Password updated successfully' };
  }

  /**
   * Activate user (admin only)
   */
  async activateUser(
    tenantId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const user = await this.findOneForTenant(tenantId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = true;
    await this.usersRepository.save(user);

    return { message: 'User activated successfully' };
  }

  /**
   * Deactivate user (admin only)
   */
  async deactivateUser(
    tenantId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const user = await this.findOneForTenant(tenantId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = false;
    await this.usersRepository.save(user);

    return { message: 'User deactivated successfully' };
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(tenantId: string, userId: string): Promise<boolean> {
    const deleted = await this.deleteForTenant(tenantId, userId);

    if (!deleted) {
      throw new NotFoundException('User not found');
    }

    return true;
  }

  /**
   * Get user statistics for a tenant
   */
  async getStatisticsForTenant(tenantId: string): Promise<UserStatistics> {
    const [total, admins, managers, users, inactive] = await Promise.all([
      this.usersRepository.count({
        where: { tenantId, isActive: true },
      }),
      this.usersRepository.count({
        where: { tenantId, role: UserRole.ADMIN, isActive: true },
      }),
      this.usersRepository.count({
        where: { tenantId, role: UserRole.MANAGER, isActive: true },
      }),
      this.usersRepository.count({
        where: { tenantId, role: UserRole.USER, isActive: true },
      }),
      this.usersRepository.count({
        where: { tenantId, isActive: false },
      }),
    ]);

    return { total, admins, managers, users, inactive };
  }

  /**
   * Get distinct departments for a tenant
   */
  async getDepartmentsForTenant(tenantId: string): Promise<string[]> {
    const result = await this.usersRepository
      .createQueryBuilder('user')
      .select('DISTINCT user.department', 'department')
      .where('user.tenant_id = :tenantId', { tenantId })
      .andWhere('user.department IS NOT NULL')
      .orderBy('user.department', 'ASC')
      .getRawMany();

    return result
      .map((r: { department: string }) => r.department)
      .filter(Boolean);
  }
}
