# Sprint 5.2 - Admin User Management Fix & Audit Create UI

## PHASE 0: Diagnosis

### Issue 1: Admin User List is Empty

**Root Cause Analysis:**

1. The frontend `AdminUsers.tsx` uses `userClient` from `userClient.ts`
2. The `userClient` is configured via `userApiConfig.ts` which defaults `REACT_APP_USER_API_MODE` to `'express'`
3. When in Express mode, the client calls `http://localhost:3001/api/users`
4. However, the seeded admin user is created in the NestJS backend's `nest_users` table (see `user.entity.ts` line 29: `@Entity('nest_users')`)
5. The Express backend uses a different `users` table, which may be empty or not exist

**Evidence:**
- `userApiConfig.ts` line 22: `USER_API_MODE: 'express' as UserApiMode`
- `user.entity.ts` line 29: `@Entity('nest_users')` - NestJS uses a separate table
- `seed-grc.ts` creates users in the NestJS backend's database

**Solution:**
Change the default User API mode to `'nest'` so the frontend calls the NestJS backend where users are actually seeded.

### Issue 2: User Creation Fails

**Root Cause Analysis:**

1. When the frontend calls the Express backend (default mode), the Express backend may:
   - Not have the `/users` endpoint implemented
   - Have different validation rules
   - Use a different database table

2. The `userClient.ts` properly transforms data to camelCase for NestJS (`toNestUserData` function), but this is only used when `mode === 'nest'`

3. The NestJS `CreateUserDto` expects camelCase fields: `email`, `password`, `firstName`, `lastName`, `department`, `role`, `isActive`

**Evidence:**
- `CreateUserDto` in `backend-nest/src/users/dto/create-user.dto.ts` uses camelCase
- `userClient.ts` has separate `toExpressUserData` (snake_case) and `toNestUserData` (camelCase) functions
- Default mode is Express, but users are in NestJS

**Solution:**
Same as Issue 1 - switch to NestJS backend for user management.

### Issue 3: No "New Audit" Button Visible

**Root Cause Analysis:**

1. The `AuditList.tsx` DOES have a "New Audit" button (lines 239-247)
2. The button visibility depends on `canCreate` state (line 239: `{canCreate && (...)}`)
3. `canCreate` is fetched from `GET /grc/audits/can/create` (line 122)
4. The `canCreate` endpoint in `grc-audit.controller.ts` (line 88-91) calls `this.auditService.canCreate()`

**The issue is likely:**
- The `canCreate()` method in the service may not be checking permissions correctly
- OR the user doesn't have `GRC_AUDIT_WRITE` permission
- OR the endpoint is returning `{ allowed: false }`

Looking at the controller:
```typescript
@Get('can/create')
@Permissions(Permission.GRC_AUDIT_READ)
canCreate() {
  const allowed = this.auditService.canCreate();
  return { allowed };
}
```

The endpoint only requires `GRC_AUDIT_READ` permission to check, but the actual `canCreate()` method needs to verify if the user has `GRC_AUDIT_WRITE` permission.

**Evidence:**
- `AuditList.tsx` line 239-247: Button exists but is conditional on `canCreate`
- `grc-audit.controller.ts` line 88-91: `canCreate()` endpoint exists
- The seeded admin user may not have the correct permissions mapped

**Solution:**
1. Verify the `canCreate()` service method returns `true` for admin users
2. Ensure the seeded admin user has all necessary GRC permissions

### Issue 4: Audit List is Empty

**Root Cause Analysis:**

1. The audit list fetches from `GET /grc/audits` (line 105)
2. The endpoint requires `x-tenant-id` header and `GRC_AUDIT_READ` permission
3. If no audits are seeded, the list will be empty (this is expected)
4. The seed script (`seed-grc.ts`) does NOT seed any audits - only risks, policies, requirements, controls, and processes

**Solution:**
This is expected behavior - the list is empty because no audits have been created. Once the "New Audit" button works, users can create audits.

---

## Summary of Required Changes

### PHASE 1 - Admin User Management

1. **Change default User API mode to NestJS**: Update `userApiConfig.ts` to default to `'nest'` mode
2. **Verify NestJS user endpoints work correctly**: The endpoints exist and should work
3. **Ensure seeded admin user has correct permissions**: Already seeded with `UserRole.ADMIN`

### PHASE 2 - Audit Create UI

1. **Fix `canCreate()` method**: Ensure it returns `true` for users with `GRC_AUDIT_WRITE` permission
2. **Verify AuditDetail handles create mode**: Already implemented (line 159: `const isNew = id === 'new'`)
3. **Test the full create flow**: Navigate to `/audits/new`, fill form, submit

---

## Files to Modify

1. `frontend/src/services/userApiConfig.ts` - Change default mode to 'nest'
2. `backend-nest/src/grc/services/grc-audit.service.ts` - Fix `canCreate()` method
3. Potentially add tests for user creation and audit creation
