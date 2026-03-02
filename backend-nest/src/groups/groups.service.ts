import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysGroup } from './entities/group.entity';
import { SysGroupMembership } from './entities/group-membership.entity';
import { CreateGroupDto, UpdateGroupDto, QueryGroupsDto } from './dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(SysGroup)
    private readonly groupRepo: Repository<SysGroup>,
    @InjectRepository(SysGroupMembership)
    private readonly membershipRepo: Repository<SysGroupMembership>,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Group CRUD                                                          */
  /* ------------------------------------------------------------------ */

  async findAll(
    tenantId: string,
    query: QueryGroupsDto,
  ): Promise<{ items: SysGroup[]; total: number }> {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);

    const qb = this.groupRepo
      .createQueryBuilder('g')
      .where('g.tenant_id = :tenantId', { tenantId });

    if (query.search) {
      qb.andWhere('g.name ILIKE :search', { search: `%${query.search}%` });
    }

    const total = await qb.getCount();
    qb.orderBy('g.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const items = await qb.getMany();
    return { items, total };
  }

  async findOne(tenantId: string, groupId: string): Promise<SysGroup> {
    const group = await this.groupRepo.findOne({
      where: { id: groupId, tenantId },
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async create(tenantId: string, dto: CreateGroupDto): Promise<SysGroup> {
    const existing = await this.groupRepo.findOne({
      where: { tenantId, name: dto.name },
    });
    if (existing) throw new ConflictException('Group name already exists');

    const group = this.groupRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description || null,
    });
    return this.groupRepo.save(group);
  }

  async update(
    tenantId: string,
    groupId: string,
    dto: UpdateGroupDto,
  ): Promise<SysGroup> {
    const group = await this.findOne(tenantId, groupId);

    if (dto.name !== undefined && dto.name !== group.name) {
      const existing = await this.groupRepo.findOne({
        where: { tenantId, name: dto.name },
      });
      if (existing) throw new ConflictException('Group name already exists');
      group.name = dto.name;
    }
    if (dto.description !== undefined) group.description = dto.description;
    if (dto.isActive !== undefined) group.isActive = dto.isActive;

    return this.groupRepo.save(group);
  }

  async remove(tenantId: string, groupId: string): Promise<boolean> {
    const group = await this.findOne(tenantId, groupId);
    await this.membershipRepo.delete({ tenantId, groupId: group.id });
    const result = await this.groupRepo.delete({ id: groupId, tenantId });
    return (result.affected || 0) > 0;
  }

  /* ------------------------------------------------------------------ */
  /* Membership                                                          */
  /* ------------------------------------------------------------------ */

  async getMembers(
    tenantId: string,
    groupId: string,
  ): Promise<SysGroupMembership[]> {
    await this.findOne(tenantId, groupId); // ensure group exists
    return this.membershipRepo.find({
      where: { tenantId, groupId },
      order: { createdAt: 'ASC' },
    });
  }

  async addMember(
    tenantId: string,
    groupId: string,
    userId: string,
  ): Promise<SysGroupMembership> {
    await this.findOne(tenantId, groupId);
    const existing = await this.membershipRepo.findOne({
      where: { tenantId, groupId, userId },
    });
    if (existing) throw new ConflictException('User is already a member');

    const membership = this.membershipRepo.create({ tenantId, groupId, userId });
    return this.membershipRepo.save(membership);
  }

  async removeMember(
    tenantId: string,
    groupId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.membershipRepo.delete({
      tenantId,
      groupId,
      userId,
    });
    return (result.affected || 0) > 0;
  }

  /** Get all user IDs that belong to a group. */
  async getGroupUserIds(
    tenantId: string,
    groupId: string,
  ): Promise<string[]> {
    const memberships = await this.membershipRepo.find({
      where: { tenantId, groupId },
    });
    return memberships.map((m) => m.userId);
  }
}
