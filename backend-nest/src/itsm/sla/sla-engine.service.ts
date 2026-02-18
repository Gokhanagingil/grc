import { Injectable } from '@nestjs/common';
import { SlaDefinition, SlaSchedule } from './sla-definition.entity';

@Injectable()
export class SlaEngineService {
  computeDueAt(definition: SlaDefinition, startAt: Date): Date {
    if (definition.schedule === SlaSchedule.TWENTY_FOUR_SEVEN) {
      return new Date(startAt.getTime() + definition.targetSeconds * 1000);
    }

    return this.computeBusinessHoursDueAt(
      startAt,
      definition.targetSeconds,
      definition.businessStartHour,
      definition.businessEndHour,
      definition.businessDays,
    );
  }

  computeElapsedSeconds(
    definition: SlaDefinition,
    startAt: Date,
    endAt: Date,
    pausedDurationSeconds: number,
  ): number {
    if (definition.schedule === SlaSchedule.TWENTY_FOUR_SEVEN) {
      const totalSeconds = Math.floor(
        (endAt.getTime() - startAt.getTime()) / 1000,
      );
      return Math.max(0, totalSeconds - pausedDurationSeconds);
    }

    const businessSeconds = this.computeBusinessSeconds(
      startAt,
      endAt,
      definition.businessStartHour,
      definition.businessEndHour,
      definition.businessDays,
    );
    return Math.max(0, businessSeconds - pausedDurationSeconds);
  }

  computeRemainingSeconds(
    definition: SlaDefinition,
    elapsedSeconds: number,
  ): number {
    return Math.max(0, definition.targetSeconds - elapsedSeconds);
  }

  isBreached(definition: SlaDefinition, elapsedSeconds: number): boolean {
    return elapsedSeconds >= definition.targetSeconds;
  }

  shouldApply(
    definition: SlaDefinition,
    priority: string | undefined,
    serviceId: string | undefined,
  ): boolean {
    if (
      definition.priorityFilter &&
      definition.priorityFilter.length > 0 &&
      priority
    ) {
      if (!definition.priorityFilter.includes(priority)) {
        return false;
      }
    }

    if (definition.serviceIdFilter && serviceId) {
      if (definition.serviceIdFilter !== serviceId) {
        return false;
      }
    }

    return definition.isActive;
  }

  shouldStop(definition: SlaDefinition, state: string): boolean {
    return definition.stopOnStates.includes(state);
  }

  shouldPause(definition: SlaDefinition, state: string): boolean {
    if (!definition.pauseOnStates || definition.pauseOnStates.length === 0) {
      return false;
    }
    return definition.pauseOnStates.includes(state);
  }

  private computeBusinessHoursDueAt(
    startAt: Date,
    targetSeconds: number,
    startHour: number,
    endHour: number,
    businessDays: number[],
  ): Date {
    const hoursPerDay = endHour - startHour;
    if (hoursPerDay <= 0) {
      return new Date(startAt.getTime() + targetSeconds * 1000);
    }

    let remainingSeconds = targetSeconds;
    const current = new Date(startAt);

    const maxIterations = 365;
    let iterations = 0;

    while (remainingSeconds > 0 && iterations < maxIterations) {
      iterations++;
      const dayOfWeek = current.getUTCDay();

      if (!businessDays.includes(dayOfWeek)) {
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(startHour, 0, 0, 0);
        continue;
      }

      const currentHour =
        current.getUTCHours() +
        current.getUTCMinutes() / 60 +
        current.getUTCSeconds() / 3600;

      if (currentHour < startHour) {
        current.setUTCHours(startHour, 0, 0, 0);
        continue;
      }

      if (currentHour >= endHour) {
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(startHour, 0, 0, 0);
        continue;
      }

      const secondsUntilEndOfDay = (endHour - currentHour) * 3600;

      if (remainingSeconds <= secondsUntilEndOfDay) {
        return new Date(current.getTime() + remainingSeconds * 1000);
      }

      remainingSeconds -= secondsUntilEndOfDay;
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(startHour, 0, 0, 0);
    }

    return current;
  }

  private computeBusinessSeconds(
    startAt: Date,
    endAt: Date,
    startHour: number,
    endHour: number,
    businessDays: number[],
  ): number {
    const hoursPerDay = endHour - startHour;
    if (hoursPerDay <= 0) {
      return Math.floor((endAt.getTime() - startAt.getTime()) / 1000);
    }

    let totalSeconds = 0;
    const current = new Date(startAt);

    const maxIterations = 365;
    let iterations = 0;

    while (current < endAt && iterations < maxIterations) {
      iterations++;
      const dayOfWeek = current.getUTCDay();

      if (!businessDays.includes(dayOfWeek)) {
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(startHour, 0, 0, 0);
        continue;
      }

      const currentHour =
        current.getUTCHours() +
        current.getUTCMinutes() / 60 +
        current.getUTCSeconds() / 3600;

      if (currentHour < startHour) {
        current.setUTCHours(startHour, 0, 0, 0);
        continue;
      }

      if (currentHour >= endHour) {
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(startHour, 0, 0, 0);
        continue;
      }

      const endOfBusinessDay = new Date(current);
      endOfBusinessDay.setUTCHours(endHour, 0, 0, 0);

      const periodEnd = endAt < endOfBusinessDay ? endAt : endOfBusinessDay;
      const periodSeconds = Math.floor(
        (periodEnd.getTime() - current.getTime()) / 1000,
      );
      totalSeconds += Math.max(0, periodSeconds);

      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(startHour, 0, 0, 0);
    }

    return totalSeconds;
  }
}
