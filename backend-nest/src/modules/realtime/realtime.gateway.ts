import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MetricsService } from '../metrics/metrics.service';
import { buildWsPayload, WsEventSource } from './ws-payload.helper';

@WebSocketGateway({
  namespace: '/ws/grc',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private metricsService?: MetricsService;

  constructor() {
    // MetricsService will be injected via setter to avoid circular dependency
  }

  setMetricsService(metricsService: MetricsService) {
    this.metricsService = metricsService;
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized on namespace /ws/grc');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast risk residual updated event
   */
  broadcastRiskResidualUpdated(
    riskInstanceId: string,
    residual: number,
    tenantId: string,
  ) {
    const event = 'grc.risk.residual.updated';
    const payload = buildWsPayload(
      event,
      tenantId,
      'risk-scoring',
      {
        riskInstanceId,
        residual,
      },
    );

    this.server.emit(event, payload);
    this.logger.debug(
      `Broadcasted ${event} for risk instance ${riskInstanceId}, residual: ${residual}, tenant: ${tenantId}`,
    );

    // Increment metrics counter
    if (this.metricsService) {
      try {
        const wsCounter = this.metricsService.getCounter('ws_broadcast_total');
        if (wsCounter) {
          wsCounter.inc({ event });
        }
      } catch (error: unknown) {
        // Metrics not available, ignore
        if (error instanceof Error) {
          this.logger.warn('Metrics increment failed:', error.message);
        }
      }
    }
  }

  /**
   * Broadcast CAP status updated event
   */
  broadcastCapStatusUpdated(capId: string, status: string, tenantId: string) {
    const event = 'grc.cap.status.updated';
    const payload = buildWsPayload(event, tenantId, 'cap-lifecycle', {
      capId,
      status,
    });

    this.server.emit(event, payload);
    this.logger.debug(
      `Broadcasted ${event} for CAP ${capId}, status: ${status}, tenant: ${tenantId}`,
    );

    // Increment metrics counter
    if (this.metricsService) {
      try {
        const wsCounter = this.metricsService.getCounter('ws_broadcast_total');
        if (wsCounter) {
          wsCounter.inc({ event });
        }
      } catch (error: unknown) {
        // Metrics not available, ignore
        if (error instanceof Error) {
          this.logger.warn('Metrics increment failed:', error.message);
        }
      }
    }
  }
}
