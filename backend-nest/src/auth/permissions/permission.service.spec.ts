import { PermissionService } from './permission.service';
import { Permission } from './permission.enum';
import { UserRole } from '../../users/user.entity';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ADMIN role permissions', () => {
    it('should have all admin panel permissions', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.ADMIN);

      // Admin panel permissions
      expect(adminPermissions).toContain(Permission.ADMIN_USERS_READ);
      expect(adminPermissions).toContain(Permission.ADMIN_USERS_WRITE);
      expect(adminPermissions).toContain(Permission.ADMIN_ROLES_READ);
      expect(adminPermissions).toContain(Permission.ADMIN_ROLES_WRITE);
      expect(adminPermissions).toContain(Permission.ADMIN_SETTINGS_READ);
      expect(adminPermissions).toContain(Permission.ADMIN_SETTINGS_WRITE);
      expect(adminPermissions).toContain(Permission.ADMIN_TENANTS_READ);
      expect(adminPermissions).toContain(Permission.ADMIN_TENANTS_WRITE);
    });

    it('should have Platform Builder permissions (ADMIN_TABLES_READ, ADMIN_TABLES_WRITE)', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.ADMIN);

      // Platform Builder permissions - this test prevents regression of the
      // "Failed to fetch tables" bug where these permissions were missing
      expect(adminPermissions).toContain(Permission.ADMIN_TABLES_READ);
      expect(adminPermissions).toContain(Permission.ADMIN_TABLES_WRITE);
    });

    it('should have Dynamic Data permissions (DATA_RECORDS_READ, DATA_RECORDS_WRITE)', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.ADMIN);

      // Dynamic Data permissions for Platform Builder runtime
      expect(adminPermissions).toContain(Permission.DATA_RECORDS_READ);
      expect(adminPermissions).toContain(Permission.DATA_RECORDS_WRITE);
    });

    it('should have all GRC permissions', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.ADMIN);

      // GRC permissions
      expect(adminPermissions).toContain(Permission.GRC_RISK_READ);
      expect(adminPermissions).toContain(Permission.GRC_RISK_WRITE);
      expect(adminPermissions).toContain(Permission.GRC_POLICY_READ);
      expect(adminPermissions).toContain(Permission.GRC_POLICY_WRITE);
      expect(adminPermissions).toContain(Permission.GRC_REQUIREMENT_READ);
      expect(adminPermissions).toContain(Permission.GRC_REQUIREMENT_WRITE);
      expect(adminPermissions).toContain(Permission.GRC_AUDIT_READ);
      expect(adminPermissions).toContain(Permission.GRC_AUDIT_WRITE);
      expect(adminPermissions).toContain(Permission.GRC_CONTROL_READ);
      expect(adminPermissions).toContain(Permission.GRC_CONTROL_WRITE);
      expect(adminPermissions).toContain(Permission.GRC_CONTROL_DELETE);
      expect(adminPermissions).toContain(Permission.GRC_ADMIN);
    });

    it('should have all ITSM permissions (incident, service, change, sla, workflow, business-rule, ui-policy)', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.ADMIN);

      expect(adminPermissions).toContain(Permission.ITSM_INCIDENT_READ);
      expect(adminPermissions).toContain(Permission.ITSM_INCIDENT_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_SERVICE_READ);
      expect(adminPermissions).toContain(Permission.ITSM_SERVICE_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_CHANGE_READ);
      expect(adminPermissions).toContain(Permission.ITSM_CHANGE_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_SLA_READ);
      expect(adminPermissions).toContain(Permission.ITSM_SLA_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_WORKFLOW_READ);
      expect(adminPermissions).toContain(Permission.ITSM_WORKFLOW_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_BUSINESS_RULE_READ);
      expect(adminPermissions).toContain(Permission.ITSM_BUSINESS_RULE_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_UI_POLICY_READ);
      expect(adminPermissions).toContain(Permission.ITSM_UI_POLICY_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_STATISTICS_READ);
    });

    it('should have ITSM Calendar and Freeze Window permissions', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.ADMIN);

      expect(adminPermissions).toContain(Permission.ITSM_CALENDAR_READ);
      expect(adminPermissions).toContain(Permission.ITSM_CALENDAR_WRITE);
      expect(adminPermissions).toContain(Permission.ITSM_FREEZE_READ);
      expect(adminPermissions).toContain(Permission.ITSM_FREEZE_WRITE);
    });

    it('should have ITSM Journal permissions', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.ADMIN);

      expect(adminPermissions).toContain(Permission.ITSM_JOURNAL_READ);
      expect(adminPermissions).toContain(Permission.ITSM_JOURNAL_WRITE);
    });
  });

  describe('MANAGER role ITSM permissions', () => {
    it('should have all ITSM read and write permissions', () => {
      const managerPermissions = service.getPermissionsForRole(
        UserRole.MANAGER,
      );

      expect(managerPermissions).toContain(Permission.ITSM_INCIDENT_READ);
      expect(managerPermissions).toContain(Permission.ITSM_INCIDENT_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_SERVICE_READ);
      expect(managerPermissions).toContain(Permission.ITSM_SERVICE_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_CHANGE_READ);
      expect(managerPermissions).toContain(Permission.ITSM_CHANGE_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_SLA_READ);
      expect(managerPermissions).toContain(Permission.ITSM_SLA_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_WORKFLOW_READ);
      expect(managerPermissions).toContain(Permission.ITSM_WORKFLOW_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_BUSINESS_RULE_READ);
      expect(managerPermissions).toContain(Permission.ITSM_BUSINESS_RULE_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_UI_POLICY_READ);
      expect(managerPermissions).toContain(Permission.ITSM_UI_POLICY_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_STATISTICS_READ);
    });

    it('should have ITSM Calendar and Freeze Window permissions', () => {
      const managerPermissions = service.getPermissionsForRole(
        UserRole.MANAGER,
      );

      expect(managerPermissions).toContain(Permission.ITSM_CALENDAR_READ);
      expect(managerPermissions).toContain(Permission.ITSM_CALENDAR_WRITE);
      expect(managerPermissions).toContain(Permission.ITSM_FREEZE_READ);
      expect(managerPermissions).toContain(Permission.ITSM_FREEZE_WRITE);
    });
  });

  describe('USER role ITSM permissions', () => {
    it('should have ITSM read-only permissions', () => {
      const userPermissions = service.getPermissionsForRole(UserRole.USER);

      expect(userPermissions).toContain(Permission.ITSM_INCIDENT_READ);
      expect(userPermissions).toContain(Permission.ITSM_SERVICE_READ);
      expect(userPermissions).toContain(Permission.ITSM_CHANGE_READ);
      expect(userPermissions).toContain(Permission.ITSM_SLA_READ);
      expect(userPermissions).toContain(Permission.ITSM_WORKFLOW_READ);
      expect(userPermissions).toContain(Permission.ITSM_BUSINESS_RULE_READ);
      expect(userPermissions).toContain(Permission.ITSM_UI_POLICY_READ);
    });

    it('should NOT have ITSM write permissions', () => {
      const userPermissions = service.getPermissionsForRole(UserRole.USER);

      expect(userPermissions).not.toContain(Permission.ITSM_INCIDENT_WRITE);
      expect(userPermissions).not.toContain(Permission.ITSM_SERVICE_WRITE);
      expect(userPermissions).not.toContain(Permission.ITSM_CHANGE_WRITE);
      expect(userPermissions).not.toContain(Permission.ITSM_SLA_WRITE);
      expect(userPermissions).not.toContain(Permission.ITSM_STATISTICS_READ);
    });

    it('should have ITSM Calendar and Freeze Window read-only permissions', () => {
      const userPermissions = service.getPermissionsForRole(UserRole.USER);

      expect(userPermissions).toContain(Permission.ITSM_CALENDAR_READ);
      expect(userPermissions).toContain(Permission.ITSM_FREEZE_READ);
      expect(userPermissions).not.toContain(Permission.ITSM_CALENDAR_WRITE);
      expect(userPermissions).not.toContain(Permission.ITSM_FREEZE_WRITE);
    });
  });

  describe('roleHasPermission', () => {
    it('should return true when admin has ADMIN_TABLES_READ permission', () => {
      expect(
        service.roleHasPermission(UserRole.ADMIN, Permission.ADMIN_TABLES_READ),
      ).toBe(true);
    });

    it('should return false when user role does not have admin permissions', () => {
      expect(
        service.roleHasPermission(UserRole.USER, Permission.ADMIN_TABLES_READ),
      ).toBe(false);
    });
  });

  describe('roleHasAllPermissions', () => {
    it('should return true when admin has all Platform Builder permissions', () => {
      const platformBuilderPermissions = [
        Permission.ADMIN_TABLES_READ,
        Permission.ADMIN_TABLES_WRITE,
        Permission.DATA_RECORDS_READ,
        Permission.DATA_RECORDS_WRITE,
      ];

      expect(
        service.roleHasAllPermissions(
          UserRole.ADMIN,
          platformBuilderPermissions,
        ),
      ).toBe(true);
    });
  });
});
