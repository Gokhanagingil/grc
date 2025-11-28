import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [], // ÖNEMLİ: MetricsModule'u import etme - circular dependency önlemek için
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
