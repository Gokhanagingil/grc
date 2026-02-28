import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    role: UserRole.USER,
    firstName: 'Test',
    lastName: 'User',
    department: 'Engineering',
    isActive: true,
    tenantId: '00000000-0000-0000-0000-000000000010',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return a user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should return null when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('count', () => {
    it('should return the total count of users', async () => {
      repository.count.mockResolvedValue(10);

      const result = await service.count();

      expect(result).toBe(10);
      expect(repository.count).toHaveBeenCalled();
    });
  });

  describe('findAllUsersForTenant', () => {
    it('should return paginated users for a tenant', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockUser], 1]);

      const result = await service.findAllUsersForTenant(mockUser.tenantId!, {
        page: 1,
        limit: 10,
      });

      expect(result.users).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.pages).toBe(1);
    });

    it('should filter by role when provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockUser], 1]);

      await service.findAllUsersForTenant(mockUser.tenantId!, {
        page: 1,
        limit: 10,
        role: UserRole.ADMIN,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.role = :role',
        { role: UserRole.ADMIN },
      );
    });

    it('should filter by search term when provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockUser], 1]);

      await service.findAllUsersForTenant(mockUser.tenantId!, {
        page: 1,
        limit: 10,
        search: 'test',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.email ILIKE :search OR user.first_name ILIKE :search OR user.last_name ILIKE :search)',
        { search: '%test%' },
      );
    });
  });

  describe('createUserForTenant', () => {
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
      department: 'Sales',
    };

    it('should create a new user successfully', async () => {
      repository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      repository.create.mockReturnValue({ ...mockUser, ...createUserDto });
      repository.save.mockResolvedValue({ ...mockUser, ...createUserDto });

      const result = await service.createUserForTenant(
        mockUser.tenantId!,
        createUserDto,
      );

      expect(result).not.toHaveProperty('passwordHash');
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.createUserForTenant(mockUser.tenantId!, createUserDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUserForTenant', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update user successfully as admin', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, ...updateUserDto });

      const result = await service.updateUserForTenant(
        mockUser.tenantId!,
        mockUser.id,
        updateUserDto,
        'admin-user-id',
        UserRole.ADMIN,
      );

      expect(result.firstName).toBe('Updated');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should update user successfully as self', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, ...updateUserDto });

      const result = await service.updateUserForTenant(
        mockUser.tenantId!,
        mockUser.id,
        updateUserDto,
        mockUser.id,
        UserRole.USER,
      );

      expect(result.firstName).toBe('Updated');
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserForTenant(
          mockUser.tenantId!,
          'nonexistent-id',
          updateUserDto,
          'admin-user-id',
          UserRole.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-admin tries to update another user', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.updateUserForTenant(
          mockUser.tenantId!,
          mockUser.id,
          updateUserDto,
          'other-user-id',
          UserRole.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if non-admin tries to change role', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.updateUserForTenant(
          mockUser.tenantId!,
          mockUser.id,
          { role: UserRole.ADMIN },
          mockUser.id,
          UserRole.USER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldpassword',
      newPassword: 'newpassword123',
    };

    it('should change password successfully', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');
      repository.save.mockResolvedValue(mockUser);

      const result = await service.changePassword(
        mockUser.tenantId!,
        mockUser.id,
        changePasswordDto,
        mockUser.id,
      );

      expect(result.message).toBe('Password updated successfully');
    });

    it('should throw ForbiddenException if trying to change another user password', async () => {
      await expect(
        service.changePassword(
          mockUser.tenantId!,
          mockUser.id,
          changePasswordDto,
          'other-user-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if current password is incorrect', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(
          mockUser.tenantId!,
          mockUser.id,
          changePasswordDto,
          mockUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('activateUser', () => {
    it('should activate user successfully', async () => {
      repository.findOne.mockResolvedValue({ ...mockUser, isActive: false });
      repository.save.mockResolvedValue({ ...mockUser, isActive: true });

      const result = await service.activateUser(
        mockUser.tenantId!,
        mockUser.id,
      );

      expect(result.message).toBe('User activated successfully');
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.activateUser(mockUser.tenantId!, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, isActive: false });

      const result = await service.deactivateUser(
        mockUser.tenantId!,
        mockUser.id,
      );

      expect(result.message).toBe('User deactivated successfully');
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.deactivateUser(mockUser.tenantId!, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.remove.mockResolvedValue(mockUser);

      const result = await service.deleteUser(mockUser.tenantId!, mockUser.id);

      expect(result).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteUser(mockUser.tenantId!, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLocale', () => {
    it('should update user locale successfully', async () => {
      repository.findOne.mockResolvedValue(mockUser);
      repository.save.mockResolvedValue({ ...mockUser, locale: 'tr-TR' });

      const result = await service.updateLocale(mockUser.id, 'tr-TR');

      expect(result.locale).toBe('tr-TR');
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'tr-TR' }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateLocale('nonexistent-id', 'tr-TR'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatisticsForTenant', () => {
    it('should return user statistics', async () => {
      repository.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(2) // admins
        .mockResolvedValueOnce(3) // managers
        .mockResolvedValueOnce(5) // users
        .mockResolvedValueOnce(1); // inactive

      const result = await service.getStatisticsForTenant(mockUser.tenantId!);

      expect(result).toEqual({
        total: 10,
        admins: 2,
        managers: 3,
        users: 5,
        inactive: 1,
      });
    });
  });

  describe('getDepartmentsForTenant', () => {
    it('should return list of departments', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { department: 'Engineering' },
        { department: 'Sales' },
        { department: 'Marketing' },
      ]);

      const result = await service.getDepartmentsForTenant(mockUser.tenantId!);

      expect(result).toEqual(['Engineering', 'Sales', 'Marketing']);
    });
  });
});
