# Architecture Bridge: Express ↔ NestJS

This document describes the architecture for running Express and NestJS backends side-by-side during the transition period, and how to gradually migrate functionality from Express to NestJS.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                │
│                              Port: 3000                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP (fetch/axios)
                                      │ Base URL: http://localhost:3001/api
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Express Backend (Legacy)                             │
│                              Port: 3001                                      │
│                                                                              │
│  Routes:                                                                     │
│  - /api/auth/*        Authentication (login, register, me)                  │
│  - /api/users/*       User management                                       │
│  - /api/governance/*  Policies, organizations                               │
│  - /api/risk/*        Risk management                                       │
│  - /api/compliance/*  Compliance requirements                               │
│  - /api/dashboard/*   Analytics and metrics                                 │
│  - /api/health        Health check                                          │
│                                                                              │
│  Database: SQLite (default) or PostgreSQL                                   │
│  Tables: users, policies, risks, compliance_requirements, audit_logs,       │
│          organizations, risk_assessments                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         NestJS Backend (New Core)                            │
│                              Port: 3002                                      │
│                                                                              │
│  Routes:                                                                     │
│  - /auth/*            JWT authentication                                    │
│  - /users/*           User operations (tenant-aware)                        │
│  - /tenants/*         Multi-tenancy management                              │
│  - /settings/*        System and tenant settings                            │
│  - /health/*          Health checks (live, ready)                           │
│                                                                              │
│  Database: PostgreSQL (required)                                            │
│  Tables: nest_users, nest_tenants, nest_audit_logs,                         │
│          nest_system_settings, nest_tenant_settings                         │
│                                                                              │
│  Features:                                                                   │
│  - RBAC (Role-Based Access Control)                                         │
│  - Multi-tenancy with TenantGuard                                           │
│  - Audit logging via event bus                                              │
│  - Settings with tenant override + system fallback                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                │
│                              Port: 3000                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP (fetch/axios)
                                      │ Base URL: http://localhost:3001/api
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Express Backend (Gateway + Legacy)                        │
│                              Port: 3001                                      │
│                                                                              │
│  Legacy Routes (gradually deprecated):                                       │
│  - /api/auth/*        → Will migrate to NestJS                              │
│  - /api/users/*       → Will migrate to NestJS                              │
│  - /api/governance/*  → Will migrate to NestJS                              │
│  - /api/risk/*        → Will migrate to NestJS                              │
│  - /api/compliance/*  → Will migrate to NestJS                              │
│  - /api/dashboard/*   → Will migrate to NestJS                              │
│                                                                              │
│  Proxy Routes (new):                                                         │
│  - /api/nest/*        → Forwards to NestJS backend                          │
│                                                                              │
│  Headers forwarded:                                                          │
│  - Authorization: Bearer <token>                                            │
│  - x-tenant-id: <tenant-uuid>                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP Proxy
                                      │ NEST_API_BASE_URL (default: http://localhost:3002)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (Core GRC/ITSM Service)                    │
│                              Port: 3002                                      │
│                                                                              │
│  All GRC/ITSM business logic:                                               │
│  - Authentication & Authorization                                           │
│  - User & Tenant Management                                                 │
│  - Risk Management                                                          │
│  - Compliance Management                                                    │
│  - Governance (Policies, Organizations)                                     │
│  - Audit Logging                                                            │
│  - Settings & Configuration                                                 │
│  - Dashboard Analytics                                                      │
│                                                                              │
│  Database: PostgreSQL                                                        │
│  All tables unified under NestJS management                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Migration Path

### Phase 1: Infrastructure (Current)

**Status: Complete**

- NestJS backend skeleton with TypeORM + PostgreSQL
- JWT authentication with compatible token structure
- RBAC layer (Role-Based Access Control)
- Multi-tenancy core with TenantGuard
- Audit logging via event bus
- Settings management with tenant override
- Multi-tenant repository abstraction
- Express → NestJS proxy endpoint

### Phase 2: Parallel Operation

**Status: Planned**

In this phase, both backends run simultaneously:

1. **Express** continues to serve all existing routes
2. **NestJS** handles new enterprise features
3. **Proxy** allows frontend to access NestJS features via Express

Migration steps:
1. Implement new features in NestJS first
2. Expose via Express proxy if needed for frontend compatibility
3. Gradually migrate existing Express routes to NestJS
4. Update frontend to call NestJS routes directly (optional)

### Phase 3: NestJS Primary

**Status: Future**

1. All business logic moved to NestJS
2. Express becomes thin gateway/proxy only
3. Frontend can optionally call NestJS directly
4. Express can be deprecated once all routes migrated

## How to Add New Modules

### Adding a Tenant-Aware Module in NestJS

1. **Create the entity** with `tenantId` field:

```typescript
// src/risks/risk.entity.ts
@Entity('nest_risks')
export class Risk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId: string | null;

  @Column()
  title: string;

  // ... other fields
}
```

2. **Create the service** extending `MultiTenantServiceBase`:

```typescript
// src/risks/risks.service.ts
@Injectable()
export class RisksService extends MultiTenantServiceBase<Risk> {
  constructor(
    @InjectRepository(Risk)
    repository: Repository<Risk>,
  ) {
    super(repository);
  }

  // Add domain-specific methods
  async findHighRisks(tenantId: string): Promise<Risk[]> {
    return this.findAllForTenant(tenantId, {
      where: { riskScore: MoreThan(50) },
    });
  }
}
```

3. **Create the controller** with guards:

```typescript
// src/risks/risks.controller.ts
@Controller('risks')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  @Get()
  async findAll(@Req() request: Request) {
    const tenantId = request.headers['x-tenant-id'] as string;
    return this.risksService.findAllForTenant(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() request: Request) {
    const tenantId = request.headers['x-tenant-id'] as string;
    return this.risksService.findOneForTenant(tenantId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseGuards(RolesGuard)
  async create(@Body() data: CreateRiskDto, @Req() request: Request) {
    const tenantId = request.headers['x-tenant-id'] as string;
    return this.risksService.createForTenant(tenantId, data);
  }
}
```

4. **Create the module**:

```typescript
// src/risks/risks.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Risk])],
  controllers: [RisksController],
  providers: [RisksService],
  exports: [RisksService],
})
export class RisksModule {}
```

5. **Register in AppModule**:

```typescript
// src/app.module.ts
@Module({
  imports: [
    // ... other modules
    RisksModule,
  ],
})
export class AppModule {}
```

### Exposing NestJS Routes via Express Proxy

If the frontend needs to access NestJS routes through Express:

1. **Add proxy route in Express**:

```javascript
// backend/routes/nest-proxy.js
const axios = require('axios');
const router = express.Router();

const NEST_API_BASE_URL = process.env.NEST_API_BASE_URL || 'http://localhost:3002';

// Proxy all /api/nest/* requests to NestJS
router.all('/*', async (req, res) => {
  try {
    const targetPath = req.path;
    const response = await axios({
      method: req.method,
      url: `${NEST_API_BASE_URL}${targetPath}`,
      headers: {
        'Authorization': req.headers.authorization,
        'x-tenant-id': req.headers['x-tenant-id'],
        'Content-Type': 'application/json',
      },
      data: req.body,
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(502).json({ error: 'NestJS backend unavailable' });
    }
  }
});

module.exports = router;
```

2. **Register in Express server**:

```javascript
// backend/server.js
const nestProxy = require('./routes/nest-proxy');
app.use('/api/nest', nestProxy);
```

## Authentication & Tenant Story

### JWT Token Structure

Both Express and NestJS use compatible JWT tokens:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "admin",
  "tenantId": "tenant-uuid",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Headers

All tenant-aware requests must include:

- `Authorization: Bearer <jwt-token>` - For authentication
- `x-tenant-id: <tenant-uuid>` - For tenant context

### Guard Order

When protecting routes, apply guards in this order:

1. `JwtAuthGuard` - Validates JWT, sets `req.user`
2. `TenantGuard` - Validates tenant access, emits TenantAccessedEvent
3. `RolesGuard` - Validates user role (optional)

```typescript
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get('admin-only')
adminOnly() { ... }
```

## Environment Variables

### Express Backend

```env
# NestJS proxy configuration
NEST_API_BASE_URL=http://localhost:3002
```

### NestJS Backend

```env
# Application
NODE_ENV=development
NEST_PORT=3002

# Database (PostgreSQL required)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=grc_platform

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Audit logging
NEST_AUDIT_LOG_ENABLED=true
```

## Database Strategy

During the transition period:

- **Express** uses its existing tables (`users`, `policies`, etc.)
- **NestJS** uses prefixed tables (`nest_users`, `nest_tenants`, etc.)

This prevents conflicts and allows gradual migration. Once a module is fully migrated to NestJS, the Express table can be deprecated.

## Testing Strategy

### Unit Tests

- Test services in isolation with mocked repositories
- Test guards with mocked request objects
- Test event handlers with mocked event emitter

### E2E Tests

- Test full request/response cycle
- Use test database (separate from development)
- Seed test data before each test suite

### Integration Tests

- Test Express → NestJS proxy
- Test authentication flow across both backends
- Test tenant isolation

## Monitoring & Observability

### Health Checks

- **Express**: `GET /api/health` - Basic health check
- **NestJS**: `GET /health/live` - Liveness probe
- **NestJS**: `GET /health/ready` - Readiness probe (includes DB check)

### Audit Logging

All authenticated requests to NestJS are automatically logged via the AuditInterceptor:

- User ID
- Tenant ID
- Action (HTTP method + path)
- Resource (extracted from path)
- Status code
- Timestamp
- IP address

### Domain Events

The event bus emits events for key actions:

- `UserLoggedInEvent` - After successful login
- `TenantAccessedEvent` - After tenant guard validates access
- `AuditLogEvent` - For all auditable actions

## Troubleshooting

### Common Issues

1. **"Failed to fetch" in frontend**
   - Check if Express backend is running on port 3001
   - Check CORS configuration
   - Check if the requested endpoint exists

2. **"Unauthorized" from NestJS**
   - Verify JWT_SECRET matches between Express and NestJS
   - Check token expiration
   - Verify Authorization header is being forwarded

3. **"Forbidden" from TenantGuard**
   - Verify x-tenant-id header is present
   - Verify user belongs to the requested tenant
   - Check tenant exists in database

4. **Database connection errors**
   - Verify PostgreSQL is running
   - Check DB_* environment variables
   - Verify database exists and user has permissions
