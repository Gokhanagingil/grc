import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Repository } from 'typeorm';
import { RequirementEntity } from './comp.entity';
import {
  CreateRequirementDto,
  UpdateRequirementDto,
  QueryRequirementDto,
} from './comp.dto';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { parseSort } from '../../common/http/listing.util';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(RequirementEntity)
    private readonly repo: Repository<RequirementEntity>,
  ) {}

  async list(q: QueryRequirementDto, tenantId: string) {
    const page = Math.max(parseInt(q.page ?? '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit ?? q.pageSize ?? '20', 10), 1), 200);
    const where: FindOptionsWhere<RequirementEntity> = {
      ...tenantWhere(tenantId),
      deleted_at: IsNull(),
    } as any;
    
    // Text search (q or search parameter)
    const searchTerm = q.q || q.search;
    if (searchTerm) {
      (where as any).title = ILike(`%${searchTerm}%`);
    }
    
    if (q.status) (where as any).status = q.status;
    if (q.regulation) (where as any).regulation = q.regulation;
    if (q.category) (where as any).category = q.category;
    
    // Parse sort with whitelist
    const { column, direction } = parseSort(
      q.sort,
      ['created_at', 'title', 'status', 'regulation', 'updated_at'],
      'created_at',
      'DESC',
    );
    
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { [column]: direction },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, pageSize: limit };
  }

  async get(id: string, tenantId: string) {
    const row = await this.repo.findOne({ 
      where: { 
        id,
        ...tenantWhere(tenantId),
      } 
    });
    if (!row) throw new NotFoundException('Requirement not found');
    return row;
  }

  create(dto: CreateRequirementDto, tenantId: string) {
    // NormalizationPipe handles empty string → undefined automatically
    const regulationId = dto.regulation_id;
    
    // Handle category: prefer categories array, fallback to category string
    const categories = dto.categories && Array.isArray(dto.categories) && dto.categories.length > 0
      ? dto.categories
      : undefined;
    // NormalizationPipe handles empty string → undefined automatically
    const category = dto.category;
    
    // Handle regulation: prefer regulation_id, fallback to regulation string
    // NormalizationPipe handles empty string → undefined automatically
    const regulation = dto.regulation;
    
    const row = this.repo.create({
      tenant_id: tenantId,
      title: dto.title,
      description: dto.description,
      regulation_id: regulationId,
      regulation: regulation, // Backward compatibility
      categories: categories, // Multi-select support
      category: category, // Backward compatibility
      status: dto.status ?? 'pending',
      // TODO: Add status validation and transition rules (e.g., via centralized status dictionary)
      // TODO: Consider code generator for status dictionaries and UI policy engine
      due_date: dto.dueDate,
      evidence: dto.evidence,
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateRequirementDto, tenantId: string) {
    const row = await this.get(id, tenantId);
    
    // NormalizationPipe handles empty string → undefined automatically
    const regulationId = dto.regulation_id !== undefined
      ? dto.regulation_id
      : row.regulation_id;
    
    // Handle category: prefer categories array, fallback to category string
    const categories = dto.categories !== undefined
      ? (dto.categories && Array.isArray(dto.categories) && dto.categories.length > 0 ? dto.categories : undefined)
      : row.categories;
    const category = dto.category !== undefined
      ? dto.category
      : row.category;
    
    // Handle regulation: prefer regulation_id, fallback to regulation string
    const regulation = dto.regulation !== undefined
      ? dto.regulation
      : row.regulation;
    
    Object.assign(row, {
      title: dto.title ?? row.title,
      description: dto.description ?? row.description,
      regulation_id: regulationId,
      regulation: regulation, // Backward compatibility
      categories: categories, // Multi-select support
      category: category, // Backward compatibility
      status: dto.status ?? row.status,
      due_date: dto.dueDate ?? row.due_date,
      evidence: dto.evidence ?? row.evidence,
    });
    return this.repo.save(row);
  }

  async remove(id: string, tenantId: string) {
    await this.get(id, tenantId);
    await this.repo.softDelete(id);
    return { success: true };
  }
}
