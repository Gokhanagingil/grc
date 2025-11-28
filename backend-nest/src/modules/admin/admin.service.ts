import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, Like, DataSource, EntityMetadata } from 'typeorm';
import { UserEntity } from '../../entities/auth/user.entity';
import { TenantEntity } from '../../entities/tenant/tenant.entity';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { RequirementEntity } from '../compliance/comp.entity';
import { BIAProcessEntity } from '../../entities/app/bia-process.entity';
import { BCPPlanEntity } from '../../entities/app/bcp-plan.entity';
import { BCPExerciseEntity } from '../../entities/app/bcp-exercise.entity';
import { RiskCatalogEntity } from '../../entities/app/risk-catalog.entity';
import { DictionaryEntity } from '../../entities/app/dictionary.entity';
import { RoleEntity } from '../../entities/auth/role.entity';
import { PermissionEntity } from '../../entities/auth/permission.entity';
import { RolePermissionEntity } from '../../entities/auth/role-permission.entity';
import { UserRoleEntity } from '../../entities/auth/user-role.entity';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import {
  AdminUserListDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminListDictionariesDto,
  AdminCreateDictionaryDto,
  AdminUpdateDictionaryDto,
  AdminCreateRoleDto,
  AdminUpdateRoleDto,
  AdminAssignRolesDto,
  AdminListRolesDto,
  AdminCreatePermissionDto,
  AdminUpdatePermissionDto,
  AdminAssignPermissionsDto,
} from './dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(PolicyEntity)
    private readonly policyRepo: Repository<PolicyEntity>,
    @InjectRepository(RequirementEntity)
    private readonly requirementRepo: Repository<RequirementEntity>,
    @InjectRepository(BIAProcessEntity)
    private readonly biaProcessRepo: Repository<BIAProcessEntity>,
    @InjectRepository(BCPPlanEntity)
    private readonly bcpPlanRepo: Repository<BCPPlanEntity>,
    @InjectRepository(BCPExerciseEntity)
    private readonly bcpExerciseRepo: Repository<BCPExerciseEntity>,
    @InjectRepository(RiskCatalogEntity)
    private readonly riskCatalogRepo: Repository<RiskCatalogEntity>,
    @InjectRepository(DictionaryEntity)
    private readonly dictionaryRepo: Repository<DictionaryEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepo: Repository<RolePermissionEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get admin summary with system statistics
   */
  async getSummary(tenantId?: string) {
    try {
      // Count users
      const userCount = await this.userRepo.count(
        tenantId ? { where: { tenant_id: tenantId } } : undefined,
      );

      // Count tenants
      const tenantCount = await this.tenantRepo.count();

      // Count policies
      const policyCount = await this.policyRepo.count(
        tenantId ? { where: { tenant_id: tenantId } } : undefined,
      );

      // Count requirements
      const requirementCount = await this.requirementRepo.count(
        tenantId ? { where: { tenant_id: tenantId } } : undefined,
      );

      // Count BCM entities
      const biaProcessCount = await this.biaProcessRepo.count(
        tenantId ? { where: { tenant_id: tenantId } } : undefined,
      );
      const bcpPlanCount = await this.bcpPlanRepo.count(
        tenantId ? { where: { tenant_id: tenantId } } : undefined,
      );
      const bcpExerciseCount = await this.bcpExerciseRepo.count(
        tenantId ? { where: { tenant_id: tenantId } } : undefined,
      );

      // Count risk catalog
      const riskCatalogCount = await this.riskCatalogRepo.count(
        tenantId ? { where: { tenant_id: tenantId } } : undefined,
      );

      // Get version from package.json
      let version = 'unknown';
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf-8'),
          );
          version = packageJson.version || 'unknown';
        }
      } catch (e) {
        this.logger.warn('Could not read package.json version:', e);
      }

      return {
        timestamp: new Date().toISOString(),
        version,
        statistics: {
          users: userCount,
          tenants: tenantCount,
          policies: policyCount,
          requirements: requirementCount,
          bcm: {
            biaProcesses: biaProcessCount,
            bcpPlans: bcpPlanCount,
            bcpExercises: bcpExerciseCount,
          },
          riskCatalog: riskCatalogCount,
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
        },
      };
    } catch (error: any) {
      this.logger.error('Error getting admin summary:', error);
      throw error;
    }
  }

  /**
   * Health check for admin endpoints
   */
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'admin',
    };
  }

  // User Management
  async listUsers(query: AdminUserListDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    // Build where clause with search support
    const qb = this.userRepo.createQueryBuilder('user');
    
    if (query.search) {
      qb.where('user.email LIKE :search', { search: `%${query.search}%` })
        .orWhere('user.display_name LIKE :search', { search: `%${query.search}%` });
    }

    qb.skip(skip)
      .take(pageSize)
      .orderBy('user.created_at', 'DESC')
      .select([
        'user.id',
        'user.email',
        'user.display_name',
        'user.roles',
        'user.tenant_id',
        'user.is_active',
        'user.is_email_verified',
        'user.failed_attempts',
        'user.locked_until',
        'user.created_at',
        'user.updated_at',
      ]);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((u: UserEntity) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        roles: u.roles || [],
        tenantId: u.tenant_id,
        isActive: u.is_active,
        isEmailVerified: u.is_email_verified,
        failedAttempts: u.failed_attempts,
        lockedUntil: u.locked_until,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getUser(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'display_name',
        'roles',
        'tenant_id',
        'is_active',
        'is_email_verified',
        'mfa_enabled',
        'failed_attempts',
        'locked_until',
        'created_at',
        'updated_at',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      roles: user.roles || [],
      tenantId: user.tenant_id,
      isActive: user.is_active,
      isEmailVerified: user.is_email_verified,
      mfaEnabled: user.mfa_enabled,
      failedAttempts: user.failed_attempts,
      lockedUntil: user.locked_until,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async createUser(dto: AdminCreateUserDto) {
    // Check if user already exists
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }

    // Generate password if not provided
    let password = dto.password;
    if (!password) {
      // Generate random password (12 characters, alphanumeric + special)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      password = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      this.logger.warn(`[AdminService] Generated random password for ${dto.email}: ${password}`);
      // In production, send password via email instead of logging
    }

    // Hash password
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Get tenant ID
    const tenantId = dto.tenantId || process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Verify tenant exists
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Create user
    const user = this.userRepo.create({
      id: randomUUID(),
      email: dto.email.toLowerCase(),
      password_hash: passwordHash,
      display_name: dto.displayName,
      roles: dto.roles || ['user'],
      tenant_id: tenantId,
      is_active: dto.isActive !== undefined ? dto.isActive : true,
      is_email_verified: false,
    });

    const saved = await this.userRepo.save(user);

    return {
      id: saved.id,
      email: saved.email,
      displayName: saved.display_name,
      roles: saved.roles || [],
      tenantId: saved.tenant_id,
      isActive: saved.is_active,
      createdAt: saved.created_at,
      // Only return password in dev mode (for testing)
      ...(process.env.NODE_ENV === 'development' && !dto.password ? { generatedPassword: password } : {}),
    };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    // Update fields
    if (dto.displayName !== undefined) {
      user.display_name = dto.displayName;
    }
    if (dto.roles !== undefined) {
      user.roles = dto.roles;
    }
    if (dto.tenantId !== undefined) {
      // Verify tenant exists
      const tenant = await this.tenantRepo.findOne({ where: { id: dto.tenantId } });
      if (!tenant) {
        throw new NotFoundException(`Tenant ${dto.tenantId} not found`);
      }
      user.tenant_id = dto.tenantId;
    }
    if (dto.isActive !== undefined) {
      user.is_active = dto.isActive;
    }
    if (dto.unlock === true) {
      user.failed_attempts = 0;
      user.locked_until = undefined;
    }

    const saved = await this.userRepo.save(user);

    return {
      id: saved.id,
      email: saved.email,
      displayName: saved.display_name,
      roles: saved.roles || [],
      tenantId: saved.tenant_id,
      isActive: saved.is_active,
      updatedAt: saved.updated_at,
    };
  }

  // Tenant Management
  async listTenants() {
    const tenants = await this.tenantRepo.find({
      order: { name: 'ASC' },
      select: ['id', 'name', 'slug', 'is_active', 'created_at', 'updated_at'],
    });

    return {
      items: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      total: tenants.length,
    };
  }

  // Dictionary Management
  async listDictionaries(dto: AdminListDictionariesDto, tenantId: string) {
    const queryBuilder = this.dictionaryRepo.createQueryBuilder('dict');

    // Filter by tenant (admin can filter by any tenant, regular users see only their tenant)
    const effectiveTenantId = dto.tenantId || tenantId;
    queryBuilder.where('dict.tenant_id = :tenantId', { tenantId: effectiveTenantId });

    // Filter by domain
    if (dto.domain) {
      queryBuilder.andWhere('dict.domain = :domain', { domain: dto.domain });
    }

    // Filter by active status
    if (dto.isActive !== undefined) {
      queryBuilder.andWhere('dict.is_active = :isActive', { isActive: dto.isActive });
    }

    // Order by domain, then by order, then by label
    queryBuilder.orderBy('dict.domain', 'ASC');
    queryBuilder.addOrderBy('dict.order', 'ASC');
    queryBuilder.addOrderBy('dict.label', 'ASC');

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map((dict) => ({
        id: dict.id,
        tenantId: dict.tenant_id,
        domain: dict.domain,
        code: dict.code,
        label: dict.label,
        description: dict.description,
        order: dict.order || 0,
        isActive: dict.is_active,
        meta: dict.meta || {},
        createdAt: dict.created_at,
        updatedAt: dict.updated_at,
      })),
      total,
    };
  }

  async createDictionary(dto: AdminCreateDictionaryDto, tenantId: string, userId?: string) {
    // Check if code already exists for this tenant + domain
    const existing = await this.dictionaryRepo.findOne({
      where: {
        tenant_id: tenantId,
        domain: dto.domain,
        code: dto.code,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Dictionary entry with code '${dto.code}' already exists for domain '${dto.domain}' in this tenant`,
      );
    }

    const dict = this.dictionaryRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      domain: dto.domain,
      code: dto.code,
      label: dto.label,
      description: dto.description,
      order: dto.order ?? 0,
      is_active: dto.isActive !== undefined ? dto.isActive : true,
      meta: dto.meta || {},
      created_by: userId,
    });

    const saved = await this.dictionaryRepo.save(dict);

    return {
      id: saved.id,
      tenantId: saved.tenant_id,
      domain: saved.domain,
      code: saved.code,
      label: saved.label,
      description: saved.description,
      order: saved.order || 0,
      isActive: saved.is_active,
      meta: saved.meta || {},
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  async updateDictionary(id: string, dto: AdminUpdateDictionaryDto, tenantId: string, userId?: string) {
    const dict = await this.dictionaryRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!dict) {
      throw new NotFoundException(`Dictionary entry ${id} not found`);
    }

    // Update fields
    if (dto.label !== undefined) {
      dict.label = dto.label;
    }
    if (dto.description !== undefined) {
      dict.description = dto.description;
    }
    if (dto.order !== undefined) {
      dict.order = dto.order;
    }
    if (dto.isActive !== undefined) {
      dict.is_active = dto.isActive;
    }
    if (dto.meta !== undefined) {
      dict.meta = dto.meta;
    }
    if (userId) {
      dict.updated_by = userId;
    }

    const saved = await this.dictionaryRepo.save(dict);

    return {
      id: saved.id,
      tenantId: saved.tenant_id,
      domain: saved.domain,
      code: saved.code,
      label: saved.label,
      description: saved.description,
      order: saved.order || 0,
      isActive: saved.is_active,
      meta: saved.meta || {},
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  async deleteDictionary(id: string, tenantId: string) {
    const dict = await this.dictionaryRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!dict) {
      throw new NotFoundException(`Dictionary entry ${id} not found`);
    }

    await this.dictionaryRepo.remove(dict);

    return { success: true };
  }

  // Role Management
  async listRoles(query: AdminListRolesDto, tenantId: string) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.roleRepo.createQueryBuilder('role');
    qb.where('role.tenant_id = :tenantId', { tenantId });

    if (query.search) {
      qb.andWhere('role.name LIKE :search', { search: `%${query.search}%` });
    }

    qb.skip(skip)
      .take(pageSize)
      .orderBy('role.created_at', 'DESC');

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
        tenantId: r.tenant_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total,
      page,
      pageSize,
    };
  }

  async createRole(dto: AdminCreateRoleDto, tenantId: string) {
    // Check if role already exists for this tenant
    const existing = await this.roleRepo.findOne({
      where: { tenant_id: tenantId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Role '${dto.name}' already exists for this tenant`);
    }

    const role = this.roleRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      name: dto.name,
      description: dto.description,
      is_system: dto.isSystem || false,
    });

    const saved = await this.roleRepo.save(role);

    return {
      id: saved.id,
      name: saved.name,
      description: saved.description,
      isSystem: saved.is_system,
      tenantId: saved.tenant_id,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  async updateRole(id: string, dto: AdminUpdateRoleDto, tenantId: string) {
    const role = await this.roleRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    if (role.is_system) {
      throw new BadRequestException('Cannot update system role');
    }

    if (dto.name !== undefined) {
      // Check if new name conflicts
      const existing = await this.roleRepo.findOne({
        where: { tenant_id: tenantId, name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Role '${dto.name}' already exists for this tenant`);
      }
      role.name = dto.name;
    }

    if (dto.description !== undefined) {
      role.description = dto.description;
    }

    const saved = await this.roleRepo.save(role);

    return {
      id: saved.id,
      name: saved.name,
      description: saved.description,
      isSystem: saved.is_system,
      tenantId: saved.tenant_id,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  async deleteRole(id: string, tenantId: string) {
    const role = await this.roleRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    if (role.is_system) {
      throw new BadRequestException('Cannot delete system role');
    }

    await this.roleRepo.remove(role);

    return { success: true };
  }

  async assignRolesToUser(userId: string, dto: AdminAssignRolesDto, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Verify all roles exist for this tenant
    const roles = await this.roleRepo.find({
      where: dto.roles.map((name) => ({ tenant_id: tenantId, name })),
    });

    if (roles.length !== dto.roles.length) {
      const foundNames = roles.map((r) => r.name);
      const missing = dto.roles.filter((name) => !foundNames.includes(name));
      throw new NotFoundException(`Roles not found: ${missing.join(', ')}`);
    }

    // Update user roles (JSON array)
    user.roles = dto.roles;
    await this.userRepo.save(user);

    return {
      userId,
      roles: user.roles,
    };
  }

  // Permission Management
  async listPermissions() {
    const permissions = await this.permissionRepo.find({
      order: { code: 'ASC' },
    });

    return {
      items: permissions.map((p) => ({
        id: p.id,
        code: p.code,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      total: permissions.length,
    };
  }

  async createPermission(dto: AdminCreatePermissionDto) {
    const existing = await this.permissionRepo.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Permission '${dto.code}' already exists`);
    }

    const permission = this.permissionRepo.create({
      id: randomUUID(),
      code: dto.code,
      description: dto.description,
    });

    const saved = await this.permissionRepo.save(permission);

    return {
      id: saved.id,
      code: saved.code,
      description: saved.description,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  async updatePermission(id: string, dto: AdminUpdatePermissionDto) {
    const permission = await this.permissionRepo.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission ${id} not found`);
    }

    if (dto.code !== undefined) {
      const existing = await this.permissionRepo.findOne({
        where: { code: dto.code },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Permission '${dto.code}' already exists`);
      }
      permission.code = dto.code;
    }

    if (dto.description !== undefined) {
      permission.description = dto.description;
    }

    const saved = await this.permissionRepo.save(permission);

    return {
      id: saved.id,
      code: saved.code,
      description: saved.description,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  }

  async deletePermission(id: string) {
    const permission = await this.permissionRepo.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission ${id} not found`);
    }

    await this.permissionRepo.remove(permission);

    return { success: true };
  }

  // Role-Permission Assignment
  async assignPermissionsToRole(roleId: string, dto: AdminAssignPermissionsDto, tenantId: string) {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, tenant_id: tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    // Verify all permissions exist (by code, not ID)
    const permissions = await this.permissionRepo.find({
      where: dto.permissions.map((code: string) => ({ code })),
    });

    if (permissions.length !== dto.permissions.length) {
      const foundCodes = permissions.map((p) => p.code);
      const missing = dto.permissions.filter((code: string) => !foundCodes.includes(code));
      throw new NotFoundException(`Permissions not found: ${missing.join(', ')}`);
    }

    // Remove existing permissions for this role
    await this.rolePermissionRepo.delete({ role_id: roleId });

    // Create new role-permission mappings
    const rolePermissions = permissions.map((permission) =>
      this.rolePermissionRepo.create({
        role_id: roleId,
        permission_id: permission.id,
      }),
    );

    await this.rolePermissionRepo.save(rolePermissions);

    return {
      roleId,
      permissionCodes: dto.permissions,
    };
  }

  async getRolePermissions(roleId: string, tenantId: string) {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, tenant_id: tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    const rolePermissions = await this.rolePermissionRepo.find({
      where: { role_id: roleId },
      relations: ['permission'],
    });

    return {
      roleId,
      permissions: rolePermissions.map((rp) => ({
        id: rp.permission_id,
        code: rp.permission?.code,
        description: rp.permission?.description,
      })),
    };
  }

  async removePermissionFromRole(roleId: string, permissionId: string, tenantId: string) {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, tenant_id: tenantId },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    const rolePermission = await this.rolePermissionRepo.findOne({
      where: { role_id: roleId, permission_id: permissionId },
    });

    if (!rolePermission) {
      throw new NotFoundException(`Permission ${permissionId} is not assigned to role ${roleId}`);
    }

    await this.rolePermissionRepo.remove(rolePermission);

    return { success: true };
  }

  // User-Role Assignment (using UserRoleEntity)
  async assignRolesToUserEntity(userId: string, dto: AdminAssignRolesDto, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Verify all roles exist for this tenant
    const roles = await this.roleRepo.find({
      where: dto.roles.map((name) => ({ tenant_id: tenantId, name })),
    });

    if (roles.length !== dto.roles.length) {
      const foundNames = roles.map((r) => r.name);
      const missing = dto.roles.filter((name) => !foundNames.includes(name));
      throw new NotFoundException(`Roles not found: ${missing.join(', ')}`);
    }

    // Remove existing user-role mappings
    await this.userRoleRepo.delete({ user_id: userId });

    // Create new user-role mappings
    const userRoles = roles.map((role) =>
      this.userRoleRepo.create({
        user_id: userId,
        role_id: role.id,
      }),
    );

    await this.userRoleRepo.save(userRoles);

    // Also update user.roles JSON array for backward compatibility
    user.roles = dto.roles;
    await this.userRepo.save(user);

    return {
      userId,
      roles: dto.roles,
    };
  }

  async getUserRoles(userId: string, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const userRoles = await this.userRoleRepo.find({
      where: { user_id: userId },
      relations: ['role'],
    });

    return {
      userId,
      roles: userRoles.map((ur) => ({
        id: ur.role_id,
        name: ur.role?.name,
        description: ur.role?.description,
      })),
    };
  }

  async removeRoleFromUser(userId: string, roleId: string, tenantId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const userRole = await this.userRoleRepo.findOne({
      where: { user_id: userId, role_id: roleId },
    });

    if (!userRole) {
      throw new NotFoundException(`Role ${roleId} is not assigned to user ${userId}`);
    }

    await this.userRoleRepo.remove(userRole);

    // Also update user.roles JSON array for backward compatibility
    if (user.roles) {
      const role = await this.roleRepo.findOne({ where: { id: roleId } });
      if (role) {
        user.roles = user.roles.filter((r) => r !== role.name);
        await this.userRepo.save(user);
      }
    }

    return { success: true };
  }

  /**
   * Infer module/domain from entity metadata
   */
  private inferModule(metadata: EntityMetadata): string {
    const tableName = metadata.tableName.toLowerCase();
    const entityName = metadata.name.toLowerCase();

    // Check entity name patterns
    if (entityName.includes('policy') || entityName.includes('standard') || entityName.includes('control') || entityName.includes('requirement')) {
      return 'GRC';
    }
    if (entityName.includes('risk')) {
      return 'Risk';
    }
    if (entityName.includes('audit')) {
      return 'Audit';
    }
    if (entityName.includes('bcp') || entityName.includes('bia') || entityName.includes('process')) {
      return 'BCM';
    }
    if (entityName.includes('user') || entityName.includes('role') || entityName.includes('permission') || entityName.includes('auth')) {
      return 'Auth';
    }
    if (entityName.includes('tenant')) {
      return 'Tenant';
    }
    if (entityName.includes('calendar') || entityName.includes('event')) {
      return 'Calendar';
    }
    if (entityName.includes('queue') || entityName.includes('event')) {
      return 'Queue';
    }
    if (entityName.includes('dictionary')) {
      return 'Core';
    }

    // Check table name patterns
    if (tableName.includes('policies') || tableName.includes('standards') || tableName.includes('controls')) {
      return 'GRC';
    }
    if (tableName.includes('risks')) {
      return 'Risk';
    }
    if (tableName.includes('audit')) {
      return 'Audit';
    }
    if (tableName.includes('bcp') || tableName.includes('bia')) {
      return 'BCM';
    }

    return 'Core';
  }

  /**
   * Get schema graph from TypeORM metadata
   */
  async getSchemaGraph() {
    try {
      if (!this.dataSource.isInitialized) {
        throw new InternalServerErrorException('Database connection not initialized');
      }

      const metadatas = this.dataSource.entityMetadatas;
      const nodes: any[] = [];
      const edges: any[] = [];
      const nodeMap = new Map<string, any>();

      // Build nodes from entity metadata
      for (const metadata of metadatas) {
        const tableName = metadata.tableName;
        const nodeId = tableName;

        // Skip if already processed
        if (nodeMap.has(nodeId)) {
          continue;
        }

        const columns = metadata.columns.map((col) => ({
          name: col.databaseName || col.propertyName,
          type: col.type.toString(),
          nullable: col.isNullable,
          primary: col.isPrimary,
        }));

        const node = {
          id: nodeId,
          label: metadata.name.replace(/Entity$/, ''),
          schema: metadata.schema || undefined,
          module: this.inferModule(metadata),
          columns,
        };

        nodes.push(node);
        nodeMap.set(nodeId, node);
      }

      // Build edges from relations
      for (const metadata of metadatas) {
        const sourceTable = metadata.tableName;

        for (const relation of metadata.relations) {
          try {
            const targetMetadata = relation.inverseEntityMetadata || relation.entityMetadata;
            if (!targetMetadata) {
              this.logger.warn(`Cannot resolve target metadata for relation ${relation.propertyName} in ${metadata.name}`);
              continue;
            }

            const targetTable = targetMetadata.tableName;

            // Determine relation type
            let relationType: '1-1' | '1-N' | 'N-1' | 'N-N' = '1-N';
            if (relation.relationType === 'one-to-one') {
              relationType = '1-1';
            } else if (relation.relationType === 'one-to-many') {
              relationType = '1-N';
            } else if (relation.relationType === 'many-to-one') {
              relationType = 'N-1';
            } else if (relation.relationType === 'many-to-many') {
              relationType = 'N-N';
            }

            // Get join column or join table - SAFE and TYPE-SAFE access
            let via: string | undefined;

            // Handle different relation types with proper null checks
            if (relation.relationType === 'many-to-many') {
              // Many-to-many: use joinTable if available
              const joinTable = (relation as any).joinTable;
              if (joinTable && typeof joinTable === 'object' && joinTable.name) {
                via = joinTable.name;
              } else {
                // Fallback to property path
                via = relation.propertyPath || relation.propertyName;
              }
            } else if (relation.relationType === 'many-to-one') {
              // Many-to-one: joinColumns should be available
              if (relation.joinColumns && Array.isArray(relation.joinColumns) && relation.joinColumns.length > 0) {
                const firstJoinCol = relation.joinColumns[0];
                if (firstJoinCol) {
                  via = firstJoinCol.databaseName || firstJoinCol.propertyName;
                } else {
                  via = relation.propertyPath || relation.propertyName;
                }
              } else {
                // Fallback to property path
                via = relation.propertyPath || relation.propertyName;
              }
            } else if (relation.relationType === 'one-to-many') {
              // One-to-many: NO joinColumns on this side, check inverseRelation
              if (relation.inverseRelation) {
                const invJoinCols = relation.inverseRelation.joinColumns;
                if (invJoinCols && Array.isArray(invJoinCols) && invJoinCols.length > 0) {
                  const firstInvJoinCol = invJoinCols[0];
                  if (firstInvJoinCol) {
                    via = firstInvJoinCol.databaseName || firstInvJoinCol.propertyName;
                  } else {
                    via = relation.propertyPath || relation.propertyName;
                  }
                } else {
                  via = relation.propertyPath || relation.propertyName;
                }
              } else {
                // Fallback to property path
                via = relation.propertyPath || relation.propertyName;
              }
            } else if (relation.relationType === 'one-to-one') {
              // One-to-one: can have joinColumns on either side
              if (relation.joinColumns && Array.isArray(relation.joinColumns) && relation.joinColumns.length > 0) {
                const firstJoinCol = relation.joinColumns[0];
                if (firstJoinCol) {
                  via = firstJoinCol.databaseName || firstJoinCol.propertyName;
                } else {
                  // Try inverse relation
                  if (relation.inverseRelation) {
                    const invJoinCols = relation.inverseRelation.joinColumns;
                    if (invJoinCols && Array.isArray(invJoinCols) && invJoinCols.length > 0) {
                      const firstInvJoinCol = invJoinCols[0];
                      if (firstInvJoinCol) {
                        via = firstInvJoinCol.databaseName || firstInvJoinCol.propertyName;
                      } else {
                        via = relation.propertyPath || relation.propertyName;
                      }
                    } else {
                      via = relation.propertyPath || relation.propertyName;
                    }
                  } else {
                    via = relation.propertyPath || relation.propertyName;
                  }
                }
              } else if (relation.inverseRelation) {
                // Try inverse relation
                const invJoinCols = relation.inverseRelation.joinColumns;
                if (invJoinCols && Array.isArray(invJoinCols) && invJoinCols.length > 0) {
                  const firstInvJoinCol = invJoinCols[0];
                  if (firstInvJoinCol) {
                    via = firstInvJoinCol.databaseName || firstInvJoinCol.propertyName;
                  } else {
                    via = relation.propertyPath || relation.propertyName;
                  }
                } else {
                  via = relation.propertyPath || relation.propertyName;
                }
              } else {
                // Fallback to property path
                via = relation.propertyPath || relation.propertyName;
              }
            } else {
              // Unknown relation type - fallback to property path
              via = relation.propertyPath || relation.propertyName;
            }

            const edge = {
              from: sourceTable,
              to: targetTable,
              type: relationType,
              via: via || undefined,
            };

            // Avoid duplicate edges
            const edgeKey = `${edge.from}-${edge.to}-${edge.type}`;
            if (!edges.find((e) => `${e.from}-${e.to}-${e.type}` === edgeKey)) {
              edges.push(edge);
            }
          } catch (err: any) {
            this.logger.warn(`Error processing relation ${relation.propertyName} in ${metadata.name}: ${err.message}`);
            // Continue processing other relations
          }
        }
      }

      return {
        nodes,
        edges,
      };
    } catch (error: any) {
      this.logger.error(`Error generating schema graph: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to generate schema graph: ${error.message}`,
      );
    }
  }
}

