# Notifications Runbook

## Overview

The GRC Notification Engine provides event-driven notifications across multiple channels (in-app, email, webhook). It consists of:

- **Event Bus** (Phase 1): `@nestjs/event-emitter` based event system with `sys_event_log` persistence
- **Notification Engine** (Phase 2): Rule evaluation, template rendering, delivery tracking
- **Webhook Channel** (Phase 3): HMAC-signed webhook delivery with SSRF prevention
- **Admin UI** (Phase 5): Notification Studio for managing rules, templates, webhooks, and delivery logs

## Architecture

```
Event Source (e.g. Incident Created)
    |
    v
EventBus (NestJS EventEmitter)
    |
    v
NotificationEngineListener
    |-- Evaluates active rules (tenant-scoped, event-name match)
    |-- Checks conditions (ConditionEvaluatorService)
    |-- Checks rate limits (RateLimiterService)
    |
    v
For each matching rule:
    |-- Renders template (SafeTemplateService)
    |-- Delivers via channel:
        |-- IN_APP  -> SysUserNotification insert
        |-- EMAIL   -> (future: SMTP integration)
        |-- WEBHOOK -> WebhookDeliveryService (HMAC + SSRF guard)
    |-- Logs delivery (SysNotificationDelivery)
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `sys_event_log` | Raw event log (event name, payload, tenant) |
| `sys_notification_rules` | Rule definitions (event, condition, channels, recipients, template) |
| `sys_notification_templates` | Message templates with variable substitution |
| `sys_notification_deliveries` | Delivery log (status, channel, error, timestamps) |
| `sys_user_notifications` | In-app notifications per user (title, body, link, read status) |
| `sys_webhook_endpoints` | Webhook endpoint configuration (URL, secret, headers, retries) |

## API Endpoints

All endpoints require `Authorization: Bearer <token>` and `x-tenant-id` headers.

### Notification Rules
- `GET /api/grc/notification-rules` - List rules (Permission: NOTIFICATION_RULE_READ)
- `GET /api/grc/notification-rules/:id` - Get rule detail
- `POST /api/grc/notification-rules` - Create rule (Permission: NOTIFICATION_RULE_WRITE)
- `PUT /api/grc/notification-rules/:id` - Update rule
- `DELETE /api/grc/notification-rules/:id` - Delete rule

### Notification Templates
- `GET /api/grc/notification-templates` - List templates (Permission: NOTIFICATION_TEMPLATE_READ)
- `POST /api/grc/notification-templates` - Create template (Permission: NOTIFICATION_TEMPLATE_WRITE)
- `POST /api/grc/notification-templates/preview` - Preview rendered template

### Webhook Endpoints
- `GET /api/grc/webhook-endpoints` - List endpoints (Permission: ADMIN_SETTINGS_READ)
- `POST /api/grc/webhook-endpoints` - Create endpoint (Permission: ADMIN_SETTINGS_WRITE)
- `POST /api/grc/webhook-endpoints/:id/test` - Test delivery

### User Notifications (Bell Icon)
- `GET /api/grc/notifications/me` - List current user's notifications
- `GET /api/grc/notifications/me/unread-count` - Get unread count
- `PUT /api/grc/notifications/me/:id/read` - Mark as read

### Delivery Log
- `GET /api/grc/notification-deliveries` - List deliveries (Permission: NOTIFICATION_DELIVERY_READ)
- `POST /api/grc/notification-deliveries/:id/retry` - Retry delivery (Permission: NOTIFICATION_DELIVERY_RETRY)

## Demo Seeds

Run inside the backend container:

```bash
# Dev (with ts-node)
npm run seed:notification-demo:dev
npm run seed:webhook-demo:dev

# Production (compiled)
npm run seed:notification-demo
npm run seed:webhook-demo
```

This creates:
- **Template**: "Incident Created Alert" with variables: incident_number, short_description, priority, assigned_to
- **Rule**: "Notify admins on incident creation" - triggers on `incident.created` event, sends IN_APP to admin role
- **Webhook**: "Demo Webhook - Example Integration" pointing to example.com (disabled by default)

## Troubleshooting

### Notifications not appearing in bell icon
1. Check the rule is active: `SELECT is_active FROM sys_notification_rules WHERE tenant_id = $TENANT_ID`
2. Check the event was logged: `SELECT * FROM sys_event_log WHERE event_name = 'incident.created' ORDER BY created_at DESC LIMIT 5`
3. Check delivery status: `SELECT * FROM sys_notification_deliveries WHERE tenant_id = $TENANT_ID ORDER BY created_at DESC LIMIT 5`
4. Check user notifications: `SELECT * FROM sys_user_notifications WHERE user_id = $USER_ID ORDER BY created_at DESC LIMIT 5`

### Webhook delivery failing
1. Check endpoint is active and URL is reachable
2. Check SSRF guard: internal/private IPs are blocked by default
3. Check delivery log for error details: `SELECT error_message FROM sys_notification_deliveries WHERE channel = 'WEBHOOK'`
4. Verify secret is set for HMAC signing (optional but recommended)

### Rate limiting
- Default: 100 notifications per rule per hour
- Configurable per rule via `rate_limit_per_hour` field
- Rate limit state is in-memory (resets on restart)

## Security Considerations

- All endpoints enforce tenant isolation via `x-tenant-id` header and TenantGuard
- RBAC enforced via PermissionsGuard on all admin endpoints
- Webhook delivery includes SSRF prevention (blocks private/internal IPs)
- Webhook payloads are HMAC-SHA256 signed when endpoint has a secret configured
- Template rendering uses SafeTemplateService (no code execution, variable substitution only)
