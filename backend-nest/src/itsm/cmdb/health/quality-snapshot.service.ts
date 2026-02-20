import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CmdbQualitySnapshot,
  QualityBreakdown,
} from './cmdb-quality-snapshot.entity';

@Injectable()
export class QualitySnapshotService {
  constructor(
    @InjectRepository(CmdbQualitySnapshot)
    private readonly repository: Repository<CmdbQualitySnapshot>,
  ) {}

  async createSnapshot(
    tenantId: string,
    data: {
      score: number;
      totalCis: number;
      totalFindings: number;
      openFindings: number;
      waivedFindings: number;
      resolvedFindings: number;
      breakdown: QualityBreakdown;
    },
  ): Promise<CmdbQualitySnapshot> {
    const snapshot = this.repository.create({
      tenantId,
      ...data,
    });
    return this.repository.save(snapshot);
  }

  async getLatest(tenantId: string): Promise<CmdbQualitySnapshot | null> {
    return this.repository.findOne({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async getHistory(
    tenantId: string,
    limit = 30,
  ): Promise<CmdbQualitySnapshot[]> {
    return this.repository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
