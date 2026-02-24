import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CabMeetingService } from './cab-meeting.service';
import { CabMeeting, CabMeetingStatus } from './cab-meeting.entity';
import { CabAgendaItem, CabDecisionStatus } from './cab-agenda-item.entity';

describe('CabMeetingService', () => {
  let service: CabMeetingService;
  let meetingRepo: jest.Mocked<Repository<CabMeeting>>;
  let agendaRepo: jest.Mocked<Repository<CabAgendaItem>>;

  const TENANT = '00000000-0000-0000-0000-000000000001';
  const USER = '00000000-0000-0000-0000-000000000002';
  const MEETING_ID = '00000000-0000-0000-0000-000000000010';
  const CHANGE_A = '00000000-0000-0000-0000-0000000000a1';
  const CHANGE_B = '00000000-0000-0000-0000-0000000000a2';
  const ITEM_A = '00000000-0000-0000-0000-0000000000b1';
  const ITEM_B = '00000000-0000-0000-0000-0000000000b2';

  const makeMeeting = (overrides: Partial<CabMeeting> = {}): CabMeeting =>
    ({
      id: MEETING_ID,
      tenantId: TENANT,
      code: 'CAB-00001',
      title: 'Weekly CAB',
      meetingAt: new Date('2026-03-01T10:00:00Z'),
      endAt: new Date('2026-03-01T11:00:00Z'),
      status: CabMeetingStatus.DRAFT,
      chairpersonId: null,
      chairperson: null,
      notes: null,
      summary: null,
      isDeleted: false,
      createdBy: USER,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as CabMeeting;

  const makeAgendaItem = (
    overrides: Partial<CabAgendaItem> = {},
  ): CabAgendaItem =>
    ({
      id: ITEM_A,
      tenantId: TENANT,
      cabMeetingId: MEETING_ID,
      changeId: CHANGE_A,
      orderIndex: 0,
      decisionStatus: CabDecisionStatus.PENDING,
      decisionAt: null,
      decisionNote: null,
      conditions: null,
      decisionById: null,
      decisionBy: null,
      cabMeeting: makeMeeting(),
      change: { id: CHANGE_A, number: 'CHG-001', title: 'Test Change' },
      isDeleted: false,
      createdBy: USER,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as CabAgendaItem;

  beforeEach(async () => {
    const mockMeetingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      merge: jest
        .fn()
        .mockImplementation((entity, data) => ({ ...entity, ...data })),
    };

    const mockAgendaRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
      merge: jest
        .fn()
        .mockImplementation((entity, data) => ({ ...entity, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CabMeetingService,
        {
          provide: getRepositoryToken(CabMeeting),
          useValue: mockMeetingRepo,
        },
        {
          provide: getRepositoryToken(CabAgendaItem),
          useValue: mockAgendaRepo,
        },
      ],
    }).compile();

    service = module.get<CabMeetingService>(CabMeetingService);
    meetingRepo = module.get(getRepositoryToken(CabMeeting));
    agendaRepo = module.get(getRepositoryToken(CabAgendaItem));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────
  // MEETING CRUD
  // ──────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create a meeting with auto-generated code', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      meetingRepo.create.mockImplementation((data) => data as CabMeeting);
      meetingRepo.save.mockImplementation((e) =>
        Promise.resolve({ ...(e as CabMeeting), id: MEETING_ID }),
      );

      const result = await service.create(TENANT, USER, {
        title: 'New CAB',
        meetingAt: new Date('2026-04-01T10:00:00Z'),
      });

      expect(result).toBeDefined();
      expect(meetingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          code: 'CAB-00001',
          title: 'New CAB',
          status: CabMeetingStatus.DRAFT,
          createdBy: USER,
          isDeleted: false,
        }),
      );
    });

    it('should increment code based on existing count', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      meetingRepo.create.mockImplementation((data) => data as CabMeeting);
      meetingRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabMeeting),
      );

      await service.create(TENANT, USER, {
        title: 'CAB 6',
        meetingAt: new Date(),
      });

      expect(meetingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'CAB-00006' }),
      );
    });

    it('should default to DRAFT status when not provided', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      meetingRepo.create.mockImplementation((data) => data as CabMeeting);
      meetingRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabMeeting),
      );

      await service.create(TENANT, USER, { title: 'Test' });

      expect(meetingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: CabMeetingStatus.DRAFT }),
      );
    });

    it('should use provided status when specified', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      meetingRepo.create.mockImplementation((data) => data as CabMeeting);
      meetingRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabMeeting),
      );

      await service.create(TENANT, USER, {
        title: 'Test',
        status: CabMeetingStatus.SCHEDULED,
      });

      expect(meetingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: CabMeetingStatus.SCHEDULED }),
      );
    });
  });

  describe('findById', () => {
    it('should return meeting when found', async () => {
      const meeting = makeMeeting();
      meetingRepo.findOne.mockResolvedValue(meeting);

      const result = await service.findById(TENANT, MEETING_ID);

      expect(result).toEqual(meeting);
      expect(meetingRepo.findOne).toHaveBeenCalledWith({
        where: { id: MEETING_ID, tenantId: TENANT, isDeleted: false },
        relations: ['chairperson'],
      });
    });

    it('should return null when meeting not found', async () => {
      meetingRepo.findOne.mockResolvedValue(null);

      const result = await service.findById(TENANT, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update meeting fields', async () => {
      const existing = makeMeeting();
      meetingRepo.findOne.mockResolvedValue(existing);
      meetingRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabMeeting),
      );

      const result = await service.update(TENANT, USER, MEETING_ID, {
        title: 'Updated Title',
        status: CabMeetingStatus.SCHEDULED,
      });

      expect(result).toBeDefined();
      expect(result!.title).toBe('Updated Title');
      expect(result!.updatedBy).toBe(USER);
    });

    it('should return null when meeting not found', async () => {
      meetingRepo.findOne.mockResolvedValue(null);

      const result = await service.update(TENANT, USER, 'non-existent', {
        title: 'X',
      });

      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should soft delete meeting', async () => {
      const existing = makeMeeting();
      meetingRepo.findOne.mockResolvedValue(existing);
      meetingRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabMeeting),
      );

      const result = await service.softDelete(TENANT, USER, MEETING_ID);

      expect(result).toBe(true);
      expect(meetingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: true,
          updatedBy: USER,
        }),
      );
    });

    it('should return false when meeting not found', async () => {
      meetingRepo.findOne.mockResolvedValue(null);

      const result = await service.softDelete(TENANT, USER, 'non-existent');

      expect(result).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // AGENDA MANAGEMENT
  // ──────────────────────────────────────────────────────────────────
  describe('listAgenda', () => {
    it('should list agenda items ordered by orderIndex', async () => {
      const items = [
        makeAgendaItem({ id: ITEM_A, orderIndex: 0 }),
        makeAgendaItem({ id: ITEM_B, orderIndex: 1, changeId: CHANGE_B }),
      ];
      agendaRepo.find.mockResolvedValue(items);

      const result = await service.listAgenda(TENANT, MEETING_ID);

      expect(result).toHaveLength(2);
      expect(agendaRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT,
          cabMeetingId: MEETING_ID,
          isDeleted: false,
        },
        relations: ['change'],
        order: { orderIndex: 'ASC', createdAt: 'ASC' },
      });
    });

    it('should return empty array when no agenda items', async () => {
      agendaRepo.find.mockResolvedValue([]);

      const result = await service.listAgenda(TENANT, MEETING_ID);

      expect(result).toEqual([]);
    });
  });

  describe('addAgendaItem', () => {
    it('should add a new agenda item', async () => {
      agendaRepo.findOne.mockResolvedValue(null);

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxIdx: 2 }),
      };
      agendaRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      agendaRepo.create.mockImplementation((data) => data as CabAgendaItem);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.addAgendaItem(
        TENANT,
        USER,
        MEETING_ID,
        CHANGE_A,
      );

      expect(result).toBeDefined();
      expect(agendaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          cabMeetingId: MEETING_ID,
          changeId: CHANGE_A,
          orderIndex: 3, // maxIdx(2) + 1
          decisionStatus: 'PENDING',
          createdBy: USER,
          isDeleted: false,
        }),
      );
    });

    it('should return existing item if change already on agenda', async () => {
      const existingItem = makeAgendaItem();
      agendaRepo.findOne.mockResolvedValue(existingItem);

      const result = await service.addAgendaItem(
        TENANT,
        USER,
        MEETING_ID,
        CHANGE_A,
      );

      expect(result).toEqual(existingItem);
      expect(agendaRepo.create).not.toHaveBeenCalled();
    });

    it('should use provided orderIndex when specified', async () => {
      agendaRepo.findOne.mockResolvedValue(null);
      agendaRepo.create.mockImplementation((data) => data as CabAgendaItem);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      await service.addAgendaItem(TENANT, USER, MEETING_ID, CHANGE_A, 5);

      expect(agendaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderIndex: 5 }),
      );
    });

    it('should start at index 0 when no existing items', async () => {
      agendaRepo.findOne.mockResolvedValue(null);

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxIdx: null }),
      };
      agendaRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      agendaRepo.create.mockImplementation((data) => data as CabAgendaItem);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      await service.addAgendaItem(TENANT, USER, MEETING_ID, CHANGE_A);

      expect(agendaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderIndex: 0 }),
      );
    });
  });

  describe('removeAgendaItem', () => {
    it('should soft delete an agenda item', async () => {
      const item = makeAgendaItem();
      agendaRepo.findOne.mockResolvedValue(item);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.removeAgendaItem(
        TENANT,
        USER,
        MEETING_ID,
        ITEM_A,
      );

      expect(result).toBe(true);
      expect(agendaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: true,
          updatedBy: USER,
        }),
      );
    });

    it('should return false when item not found', async () => {
      agendaRepo.findOne.mockResolvedValue(null);

      const result = await service.removeAgendaItem(
        TENANT,
        USER,
        MEETING_ID,
        'non-existent',
      );

      expect(result).toBe(false);
    });
  });

  describe('reorderAgenda', () => {
    it('should update order indices and return reordered list', async () => {
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      agendaRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      agendaRepo.find.mockResolvedValue([
        makeAgendaItem({ id: ITEM_B, orderIndex: 0 }),
        makeAgendaItem({ id: ITEM_A, orderIndex: 1 }),
      ]);

      const result = await service.reorderAgenda(TENANT, USER, MEETING_ID, [
        ITEM_B,
        ITEM_A,
      ]);

      expect(result).toHaveLength(2);
      // Should have called execute twice (one per item)
      expect(mockQb.execute).toHaveBeenCalledTimes(2);
    });

    it('should handle empty itemIds array', async () => {
      agendaRepo.find.mockResolvedValue([]);

      const result = await service.reorderAgenda(TENANT, USER, MEETING_ID, []);

      expect(result).toEqual([]);
      expect(agendaRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should bound large input arrays to MAX_AGENDA_ITEMS (500)', async () => {
      const largeArray = Array.from({ length: 600 }, (_, i) => `item-${i}`);
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      agendaRepo.createQueryBuilder.mockReturnValue(mockQb as never);
      agendaRepo.find.mockResolvedValue([]);

      await service.reorderAgenda(TENANT, USER, MEETING_ID, largeArray);

      // Should only process 500, not 600
      expect(mockQb.execute).toHaveBeenCalledTimes(500);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // DECISION RECORDING
  // ──────────────────────────────────────────────────────────────────
  describe('recordDecision', () => {
    it('should record APPROVED decision', async () => {
      const item = makeAgendaItem();
      agendaRepo.findOne.mockResolvedValue(item);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.recordDecision(
        TENANT,
        USER,
        MEETING_ID,
        ITEM_A,
        CabDecisionStatus.APPROVED,
        'Approved with no issues',
      );

      expect(result).toBeDefined();
      expect(result!.decisionStatus).toBe(CabDecisionStatus.APPROVED);
      expect(result!.decisionNote).toBe('Approved with no issues');
      expect(result!.decisionAt).toBeInstanceOf(Date);
      expect(result!.decisionById).toBe(USER);
      expect(result!.updatedBy).toBe(USER);
    });

    it('should record REJECTED decision', async () => {
      const item = makeAgendaItem();
      agendaRepo.findOne.mockResolvedValue(item);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.recordDecision(
        TENANT,
        USER,
        MEETING_ID,
        ITEM_A,
        CabDecisionStatus.REJECTED,
        'Risk too high',
      );

      expect(result!.decisionStatus).toBe(CabDecisionStatus.REJECTED);
      expect(result!.decisionNote).toBe('Risk too high');
    });

    it('should record DEFERRED decision', async () => {
      const item = makeAgendaItem();
      agendaRepo.findOne.mockResolvedValue(item);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.recordDecision(
        TENANT,
        USER,
        MEETING_ID,
        ITEM_A,
        CabDecisionStatus.DEFERRED,
        'Needs more info',
      );

      expect(result!.decisionStatus).toBe(CabDecisionStatus.DEFERRED);
    });

    it('should record CONDITIONAL decision with conditions', async () => {
      const item = makeAgendaItem();
      agendaRepo.findOne.mockResolvedValue(item);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.recordDecision(
        TENANT,
        USER,
        MEETING_ID,
        ITEM_A,
        CabDecisionStatus.CONDITIONAL,
        'Approved with conditions',
        'Must complete rollback plan',
      );

      expect(result!.decisionStatus).toBe(CabDecisionStatus.CONDITIONAL);
      expect(result!.conditions).toBe('Must complete rollback plan');
    });

    it('should return null when agenda item not found', async () => {
      agendaRepo.findOne.mockResolvedValue(null);

      const result = await service.recordDecision(
        TENANT,
        USER,
        MEETING_ID,
        'non-existent',
        CabDecisionStatus.APPROVED,
      );

      expect(result).toBeNull();
    });

    it('should set decisionNote to null when not provided', async () => {
      const item = makeAgendaItem();
      agendaRepo.findOne.mockResolvedValue(item);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.recordDecision(
        TENANT,
        USER,
        MEETING_ID,
        ITEM_A,
        CabDecisionStatus.APPROVED,
      );

      expect(result!.decisionNote).toBeNull();
      expect(result!.conditions).toBeNull();
    });

    it('should overwrite previous decision', async () => {
      const item = makeAgendaItem({
        decisionStatus: CabDecisionStatus.DEFERRED,
        decisionNote: 'Old note',
        decisionAt: new Date('2026-01-01'),
        decisionById: 'old-user',
      });
      agendaRepo.findOne.mockResolvedValue(item);
      agendaRepo.save.mockImplementation((e) =>
        Promise.resolve(e as CabAgendaItem),
      );

      const result = await service.recordDecision(
        TENANT,
        USER,
        MEETING_ID,
        ITEM_A,
        CabDecisionStatus.APPROVED,
        'Now approved',
      );

      expect(result!.decisionStatus).toBe(CabDecisionStatus.APPROVED);
      expect(result!.decisionNote).toBe('Now approved');
      expect(result!.decisionById).toBe(USER);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // CAB SUMMARY FOR CHANGE DETAIL
  // ──────────────────────────────────────────────────────────────────
  describe('getCabSummaryForChange', () => {
    it('should return meetings and latest decision', async () => {
      const meeting1 = makeMeeting({
        id: 'meeting-1',
        code: 'CAB-00001',
        title: 'Meeting 1',
        meetingAt: new Date('2026-03-01T10:00:00Z'),
      });
      const meeting2 = makeMeeting({
        id: 'meeting-2',
        code: 'CAB-00002',
        title: 'Meeting 2',
        meetingAt: new Date('2026-03-15T10:00:00Z'),
      });

      const items: CabAgendaItem[] = [
        makeAgendaItem({
          id: 'item-1',
          cabMeeting: meeting1,
          decisionStatus: CabDecisionStatus.DEFERRED,
          decisionAt: new Date('2026-03-01T11:00:00Z'),
          decisionNote: 'Deferred for review',
        }),
        makeAgendaItem({
          id: 'item-2',
          cabMeeting: meeting2,
          decisionStatus: CabDecisionStatus.APPROVED,
          decisionAt: new Date('2026-03-15T11:00:00Z'),
          decisionNote: 'Approved',
        }),
      ];
      agendaRepo.find.mockResolvedValue(items);

      const result = await service.getCabSummaryForChange(TENANT, CHANGE_A);

      expect(result.meetings).toHaveLength(2);
      expect(result.latestDecision).toBeDefined();
      expect(result.latestDecision!.decisionStatus).toBe(
        CabDecisionStatus.APPROVED,
      );
      expect(result.latestDecision!.meetingCode).toBe('CAB-00002');
    });

    it('should return null latestDecision when all items are PENDING', async () => {
      const items: CabAgendaItem[] = [
        makeAgendaItem({
          decisionStatus: CabDecisionStatus.PENDING,
          decisionAt: null,
        }),
      ];
      agendaRepo.find.mockResolvedValue(items);

      const result = await service.getCabSummaryForChange(TENANT, CHANGE_A);

      expect(result.meetings).toHaveLength(1);
      expect(result.latestDecision).toBeNull();
    });

    it('should return empty result when change has no agenda items', async () => {
      agendaRepo.find.mockResolvedValue([]);

      const result = await service.getCabSummaryForChange(TENANT, CHANGE_A);

      expect(result.meetings).toEqual([]);
      expect(result.latestDecision).toBeNull();
    });

    it('should filter out deleted meetings', async () => {
      const deletedMeeting = makeMeeting({
        id: 'deleted',
        isDeleted: true,
      });
      const items: CabAgendaItem[] = [
        makeAgendaItem({ cabMeeting: deletedMeeting }),
      ];
      agendaRepo.find.mockResolvedValue(items);

      const result = await service.getCabSummaryForChange(TENANT, CHANGE_A);

      expect(result.meetings).toHaveLength(0);
    });

    it('should pick latest decision by decisionAt timestamp', async () => {
      const meeting = makeMeeting();
      const items: CabAgendaItem[] = [
        makeAgendaItem({
          id: 'older',
          cabMeeting: meeting,
          decisionStatus: CabDecisionStatus.REJECTED,
          decisionAt: new Date('2026-01-01T10:00:00Z'),
          decisionNote: 'Old rejection',
        }),
        makeAgendaItem({
          id: 'newer',
          changeId: CHANGE_B,
          cabMeeting: meeting,
          decisionStatus: CabDecisionStatus.APPROVED,
          decisionAt: new Date('2026-02-01T10:00:00Z'),
          decisionNote: 'Newer approval',
        }),
      ];
      agendaRepo.find.mockResolvedValue(items);

      const result = await service.getCabSummaryForChange(TENANT, CHANGE_A);

      expect(result.latestDecision!.decisionStatus).toBe(
        CabDecisionStatus.APPROVED,
      );
      expect(result.latestDecision!.decisionNote).toBe('Newer approval');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // FINDALL (LIST)
  // ──────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([makeMeeting()]),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      const result = await service.findAll(TENANT, {});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should filter by status', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findAll(TENANT, {
        status: CabMeetingStatus.SCHEDULED,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('m.status = :status', {
        status: CabMeetingStatus.SCHEDULED,
      });
    });

    it('should filter by date range', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findAll(TENANT, {
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('m.meetingAt >= :dateFrom', {
        dateFrom: '2026-03-01',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('m.meetingAt <= :dateTo', {
        dateTo: '2026-03-31',
      });
    });

    it('should search by title or code', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findAll(TENANT, { search: 'weekly' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(m.title ILIKE :search OR m.code ILIKE :search)',
        { search: '%weekly%' },
      );
    });

    it('should fallback to meetingAt sort when invalid sortBy provided', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      meetingRepo.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findAll(TENANT, { sortBy: 'invalidField' });

      expect(mockQb.orderBy).toHaveBeenCalledWith('m.meetingAt', 'DESC');
    });
  });
});
