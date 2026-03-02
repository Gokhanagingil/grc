import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysNotificationPreference } from '../entities/sys-notification-preference.entity';

@Injectable()
export class NotificationPreferenceService {
  constructor(
    @InjectRepository(SysNotificationPreference)
    private readonly prefRepo: Repository<SysNotificationPreference>,
  ) {}

  /**
   * Get or create default preferences for a user.
   */
  async getOrCreate(
    tenantId: string,
    userId: string,
  ): Promise<SysNotificationPreference> {
    let pref = await this.prefRepo.findOne({
      where: { tenantId, userId },
    });

    if (!pref) {
      pref = this.prefRepo.create({
        tenantId,
        userId,
        notifyOnAssignment: true,
        notifyOnDueDate: true,
        notifyOnGroupAssignment: false, // default OFF to prevent spam
        notifyOnSystem: true,
      });
      pref = await this.prefRepo.save(pref);
    }

    return pref;
  }

  /**
   * Update user preferences.
   */
  async update(
    tenantId: string,
    userId: string,
    updates: Partial<Pick<
      SysNotificationPreference,
      'notifyOnAssignment' | 'notifyOnDueDate' | 'notifyOnGroupAssignment' | 'notifyOnSystem'
    >>,
  ): Promise<SysNotificationPreference> {
    const pref = await this.getOrCreate(tenantId, userId);

    if (updates.notifyOnAssignment !== undefined) {
      pref.notifyOnAssignment = updates.notifyOnAssignment;
    }
    if (updates.notifyOnDueDate !== undefined) {
      pref.notifyOnDueDate = updates.notifyOnDueDate;
    }
    if (updates.notifyOnGroupAssignment !== undefined) {
      pref.notifyOnGroupAssignment = updates.notifyOnGroupAssignment;
    }
    if (updates.notifyOnSystem !== undefined) {
      pref.notifyOnSystem = updates.notifyOnSystem;
    }

    return this.prefRepo.save(pref);
  }

  /**
   * Check if a user wants group assignment notifications.
   */
  async isGroupNotificationEnabled(
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const pref = await this.prefRepo.findOne({
      where: { tenantId, userId },
    });
    // Default OFF if no preference record exists
    return pref?.notifyOnGroupAssignment ?? false;
  }
}
