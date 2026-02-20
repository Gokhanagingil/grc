import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiCatalogService } from './services/api-catalog.service';
import { ApiGatewayService } from './services/api-gateway.service';
import { StructuredLoggerService } from '../common/logger';

@Controller('grc/public/v1')
export class PublicApiGatewayController {
  private readonly logger: StructuredLoggerService;

  constructor(
    private readonly catalogService: ApiCatalogService,
    private readonly gatewayService: ApiGatewayService,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('PublicApiGatewayController');
  }

  @Get(':apiName/records')
  async listRecords(
    @Param('apiName') apiName: string,
    @Headers('x-api-key') apiKey: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Req() req?: Request,
  ) {
    const startTime = Date.now();
    const keyResult = await this.authenticateKey(apiKey);
    const api = await this.catalogService.findApiByName(
      keyResult.tenantId,
      apiName,
    );

    if (!api) throw new NotFoundException('API not found');
    if (!api.allowList)
      throw new ForbiddenException('List operation not allowed for this API');

    this.enforceScope(keyResult.key.scopes, api.name, 'read');
    this.enforceRateLimit(api.id, api.rateLimitPerMinute);

    const result = await this.gatewayService.listRecords(api, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      sort,
      order,
    });

    await this.gatewayService.logAccess(
      keyResult.tenantId,
      keyResult.key.id,
      api.id,
      'GET',
      req?.path || `/public/v1/${apiName}/records`,
      200,
      Date.now() - startTime,
      req?.ip || null,
      {},
    );

    return {
      items: result.items,
      total: result.total,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 50,
    };
  }

  @Post(':apiName/records')
  @HttpCode(HttpStatus.CREATED)
  async createRecord(
    @Param('apiName') apiName: string,
    @Headers('x-api-key') apiKey: string,
    @Body() body: Record<string, unknown>,
    @Req() req?: Request,
  ) {
    const startTime = Date.now();
    const keyResult = await this.authenticateKey(apiKey);
    const api = await this.catalogService.findApiByName(
      keyResult.tenantId,
      apiName,
    );

    if (!api) throw new NotFoundException('API not found');
    if (!api.allowCreate)
      throw new ForbiddenException('Create operation not allowed for this API');

    this.enforceScope(keyResult.key.scopes, api.name, 'write');
    this.enforceRateLimit(api.id, api.rateLimitPerMinute);

    const disallowedFields = Object.keys(body).filter(
      (f) => !api.allowedFields.write.includes(f),
    );
    if (disallowedFields.length > 0) {
      throw new BadRequestException(
        `Fields not allowed for write: ${disallowedFields.join(', ')}`,
      );
    }

    const record = await this.gatewayService.createRecord(api, body);

    await this.gatewayService.logAccess(
      keyResult.tenantId,
      keyResult.key.id,
      api.id,
      'POST',
      req?.path || `/public/v1/${apiName}/records`,
      201,
      Date.now() - startTime,
      req?.ip || null,
      body,
    );

    return record;
  }

  @Put(':apiName/records/:recordId')
  async updateRecord(
    @Param('apiName') apiName: string,
    @Param('recordId') recordId: string,
    @Headers('x-api-key') apiKey: string,
    @Body() body: Record<string, unknown>,
    @Req() req?: Request,
  ) {
    const startTime = Date.now();
    const keyResult = await this.authenticateKey(apiKey);
    const api = await this.catalogService.findApiByName(
      keyResult.tenantId,
      apiName,
    );

    if (!api) throw new NotFoundException('API not found');
    if (!api.allowUpdate)
      throw new ForbiddenException('Update operation not allowed for this API');

    this.enforceScope(keyResult.key.scopes, api.name, 'write');
    this.enforceRateLimit(api.id, api.rateLimitPerMinute);

    const disallowedFields = Object.keys(body).filter(
      (f) => !api.allowedFields.write.includes(f),
    );
    if (disallowedFields.length > 0) {
      throw new BadRequestException(
        `Fields not allowed for write: ${disallowedFields.join(', ')}`,
      );
    }

    const record = await this.gatewayService.updateRecord(api, recordId, body);

    if (!record) throw new NotFoundException('Record not found');

    await this.gatewayService.logAccess(
      keyResult.tenantId,
      keyResult.key.id,
      api.id,
      'PUT',
      req?.path || `/public/v1/${apiName}/records/${recordId}`,
      200,
      Date.now() - startTime,
      req?.ip || null,
      body,
    );

    return record;
  }

  @Get(':apiName/openapi.json')
  async getOpenApiSpec(
    @Param('apiName') apiName: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    const keyResult = await this.authenticateKey(apiKey);
    const api = await this.catalogService.findApiByName(
      keyResult.tenantId,
      apiName,
    );

    if (!api) throw new NotFoundException('API not found');

    return this.catalogService.generateOpenApiSpec(api);
  }

  private async authenticateKey(apiKey: string): Promise<{
    key: { id: string; scopes: string[] };
    tenantId: string;
  }> {
    if (!apiKey) {
      throw new UnauthorizedException('X-API-Key header is required');
    }

    const result = await this.catalogService.validateApiKey(apiKey);
    if (!result) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    return result;
  }

  private enforceScope(
    scopes: string[],
    apiName: string,
    operation: string,
  ): void {
    if (scopes.length === 0) return;

    const requiredScope = `${apiName}:${operation}`;
    const wildcard = `${apiName}:*`;
    const globalWildcard = '*:*';

    if (
      !scopes.includes(requiredScope) &&
      !scopes.includes(wildcard) &&
      !scopes.includes(globalWildcard)
    ) {
      throw new ForbiddenException(
        `API key does not have scope: ${requiredScope}`,
      );
    }
  }

  private enforceRateLimit(apiId: string, limitPerMinute: number): void {
    if (!this.gatewayService.checkRateLimit(apiId, limitPerMinute)) {
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
