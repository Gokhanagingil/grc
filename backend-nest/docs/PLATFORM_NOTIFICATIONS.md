# Platform Notifications

## Overview

The Platform Notifications module provides a unified notification infrastructure for the GRC Platform. It supports multiple notification providers (Email and Webhook) with audit logging, tenant-scoped delivery, and admin visibility.

## Architecture

### Components

1. **NotificationService** - Central service for sending notifications through various providers
2. **EmailProvider** - SMTP-based email notification provider (config-driven, OFF by default)
3. **WebhookProvider** - Generic HTTP POST webhook notification provider
4. **NotificationLog** - TypeORM entity for audit logging of notification attempts
5. **NotificationsController** - Admin endpoints for status, testing, and logs

### Provider Interface

All notification providers implement the `NotificationProvider` interface:

```typescript
interface NotificationProvider {
  readonly providerType: string;
  readonly isEnabled: boolean;
  send(payload: NotificationPayload): Promise<NotificationResult>;
  validateConfig(): boolean;
}
```

## Configuration

### Environment Variables

#### Email Provider (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_ENABLED` | No | `false` | Enable SMTP email notifications |
| `SMTP_HOST` | If enabled | - | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | If enabled | - | SMTP authentication username |
| `SMTP_PASSWORD` | If enabled | - | SMTP authentication password (sensitive) |
| `SMTP_FROM` | If enabled | - | Sender email address |
| `SMTP_SECURE` | No | `false` | Use TLS for SMTP connection |

#### Webhook Provider

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_ENABLED` | No | `false` | Enable webhook notifications |
| `WEBHOOK_URL` | If enabled | - | Webhook endpoint URL |
| `WEBHOOK_SECRET` | No | - | Webhook authentication secret (sensitive) |
| `WEBHOOK_TIMEOUT_MS` | No | `5000` | Webhook request timeout in milliseconds |

### Example Configuration

```bash
# Email Provider
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@example.com
SMTP_SECURE=true

# Webhook Provider
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://hooks.example.com/grc-notifications
WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_TIMEOUT_MS=10000
```

## API Endpoints

All endpoints require authentication and `ADMIN_SETTINGS_READ` or `ADMIN_SETTINGS_WRITE` permission.

### GET /admin/notifications/status

Returns notification provider status and recent log summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "email": {
      "enabled": true,
      "configured": true
    },
    "webhook": {
      "enabled": false,
      "configured": false
    },
    "recentLogs": {
      "total": 42,
      "success": 38,
      "failed": 4,
      "lastAttempt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### GET /admin/notifications/logs

Returns recent notification logs for the current tenant.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "tenant-uuid",
      "userId": "user-uuid",
      "correlationId": "correlation-uuid",
      "providerType": "email",
      "status": "success",
      "messageCode": "NOTIFICATION_EMAIL_SENT",
      "subject": "Test Notification",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /admin/notifications/test

Send a test notification. Requires `ADMIN_SETTINGS_WRITE` permission.

**Request:**
```json
{
  "provider": "email" | "webhook"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "messageCode": "NOTIFICATION_EMAIL_SENT",
    "providerType": "email",
    "correlationId": "uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Message Codes

The notification system uses message codes instead of raw text for i18n-readiness:

| Code | Description |
|------|-------------|
| `NOTIFICATION_EMAIL_SENT` | Email notification sent successfully |
| `NOTIFICATION_EMAIL_DISABLED` | Email provider is disabled |
| `NOTIFICATION_EMAIL_CONFIG_INVALID` | Email provider configuration is invalid |
| `NOTIFICATION_EMAIL_FAILED` | Email notification failed to send |
| `NOTIFICATION_WEBHOOK_SENT` | Webhook notification sent successfully |
| `NOTIFICATION_WEBHOOK_DISABLED` | Webhook provider is disabled |
| `NOTIFICATION_WEBHOOK_CONFIG_INVALID` | Webhook provider configuration is invalid |
| `NOTIFICATION_WEBHOOK_FAILED` | Webhook notification failed to send |
| `NOTIFICATION_WEBHOOK_TIMEOUT` | Webhook request timed out |

## Audit Logging

All notification attempts are logged to the `notification_logs` table with:

- `correlationId` - Request correlation ID for tracing
- `tenantId` - Tenant scope
- `userId` - User who triggered the notification (if applicable)
- `providerType` - Provider used (email, webhook)
- `status` - Result status (success, failed, disabled)
- `messageCode` - i18n-ready message code
- `subject` - Notification subject
- `body` - Notification body (truncated for large payloads)
- `errorCode` / `errorMessage` - Error details if failed
- `metadata` - Additional context
- `createdAt` - Timestamp

## Security Considerations

1. **Credentials**: All sensitive credentials (SMTP_PASSWORD, WEBHOOK_SECRET) are stored in environment variables, never in code or database
2. **Tenant Isolation**: All notifications are tenant-scoped; logs are filtered by tenant
3. **Permission Guard**: Admin endpoints require `ADMIN_SETTINGS_READ` or `ADMIN_SETTINGS_WRITE` permission
4. **Audit Trail**: All notification attempts are logged for compliance and debugging
5. **Timeout Protection**: Webhook requests have configurable timeouts to prevent hanging

## Usage Example

```typescript
// Inject NotificationsService
constructor(private readonly notificationsService: NotificationsService) {}

// Send notification to all enabled providers
const result = await this.notificationsService.send({
  tenantId: 'tenant-uuid',
  userId: 'user-uuid',
  subject: 'Risk Assessment Complete',
  body: 'The risk assessment for Q1 2024 has been completed.',
  metadata: {
    riskId: 'risk-uuid',
    assessmentDate: '2024-01-15',
  },
});

// Send to specific provider only
const result = await this.notificationsService.send({
  tenantId: 'tenant-uuid',
  subject: 'Webhook Event',
  body: JSON.stringify({ event: 'risk.created', data: { ... } }),
  providers: ['webhook'],
});
```

## Admin UI

The Admin System page includes a "Notification Status" section showing:

- Email provider status (enabled/disabled, configured/not configured)
- Webhook provider status (enabled/disabled, configured/not configured)
- Recent notification logs summary (total, success, failed, last attempt)
- Test notification buttons for each enabled provider
