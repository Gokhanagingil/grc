/**
 * Notification Provider Interface
 *
 * Defines the contract for notification providers (Email, Webhook, etc.)
 * All providers must implement this interface to be used by NotificationService.
 */

export interface NotificationResult {
  success: boolean;
  messageCode: string;
  providerType: string;
  correlationId: string;
  timestamp: string;
  details?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

export interface NotificationPayload {
  correlationId: string;
  tenantId: string;
  userId?: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly providerType: string;
  readonly isEnabled: boolean;

  send(payload: NotificationPayload): Promise<NotificationResult> | NotificationResult;
  validateConfig(): boolean;
}
