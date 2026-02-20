import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionService } from './permission.service';
import { Permission } from './permission.enum';
import { UserRole } from '../../users/user.entity';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let permissionService: PermissionService;

  beforeEach(() => {
    reflector = new Reflector();
    permissionService = new PermissionService();
    guard = new PermissionsGuard(reflector, permissionService);
  });

  const createMockContext = (
    role: string,
    requiredPermissions: Permission[] | undefined,
  ): ExecutionContext => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(requiredPermissions);

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            sub: 'test-user-id',
            email: 'test@example.com',
            role,
            tenantId: '00000000-0000-0000-0000-000000000001',
          },
          headers: { 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
          path: '/grc/itsm/changes',
          method: 'GET',
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('should allow access when no permissions are required', () => {
    const context = createMockContext('admin', undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when required permissions list is empty', () => {
    const context = createMockContext('admin', []);
    expect(guard.canActivate(context)).toBe(true);
  });

  describe('ITSM Change permissions (regression test for 403 bug)', () => {
    it('should allow admin to access ITSM_CHANGE_READ', () => {
      const context = createMockContext(UserRole.ADMIN, [
        Permission.ITSM_CHANGE_READ,
      ]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow admin to access ITSM_CHANGE_WRITE', () => {
      const context = createMockContext(UserRole.ADMIN, [
        Permission.ITSM_CHANGE_WRITE,
      ]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow manager to access ITSM_CHANGE_READ', () => {
      const context = createMockContext(UserRole.MANAGER, [
        Permission.ITSM_CHANGE_READ,
      ]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow manager to access ITSM_CHANGE_WRITE', () => {
      const context = createMockContext(UserRole.MANAGER, [
        Permission.ITSM_CHANGE_WRITE,
      ]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow user to access ITSM_CHANGE_READ', () => {
      const context = createMockContext(UserRole.USER, [
        Permission.ITSM_CHANGE_READ,
      ]);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny user access to ITSM_CHANGE_WRITE', () => {
      const context = createMockContext(UserRole.USER, [
        Permission.ITSM_CHANGE_WRITE,
      ]);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('All ITSM permissions for admin (regression test)', () => {
    const itsmReadPermissions = [
      Permission.ITSM_INCIDENT_READ,
      Permission.ITSM_SERVICE_READ,
      Permission.ITSM_CHANGE_READ,
      Permission.ITSM_SLA_READ,
      Permission.ITSM_WORKFLOW_READ,
      Permission.ITSM_BUSINESS_RULE_READ,
      Permission.ITSM_UI_POLICY_READ,
      Permission.ITSM_STATISTICS_READ,
    ];

    const itsmWritePermissions = [
      Permission.ITSM_INCIDENT_WRITE,
      Permission.ITSM_SERVICE_WRITE,
      Permission.ITSM_CHANGE_WRITE,
      Permission.ITSM_SLA_WRITE,
      Permission.ITSM_WORKFLOW_WRITE,
      Permission.ITSM_BUSINESS_RULE_WRITE,
      Permission.ITSM_UI_POLICY_WRITE,
    ];

    it.each(itsmReadPermissions)(
      'should allow admin to access %s',
      (permission) => {
        const context = createMockContext(UserRole.ADMIN, [permission]);
        expect(guard.canActivate(context)).toBe(true);
      },
    );

    it.each(itsmWritePermissions)(
      'should allow admin to access %s',
      (permission) => {
        const context = createMockContext(UserRole.ADMIN, [permission]);
        expect(guard.canActivate(context)).toBe(true);
      },
    );
  });

  describe('Access denied scenarios', () => {
    it('should deny access when user is not present', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Permission.ITSM_CHANGE_READ]);

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
            headers: {},
            path: '/grc/itsm/changes',
            method: 'GET',
          }),
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny access for unknown role', () => {
      const context = createMockContext('unknown_role', [
        Permission.ITSM_CHANGE_READ,
      ]);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
