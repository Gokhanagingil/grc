import { QueryFailedError } from 'typeorm';
import { isMissingRelation } from './settings.service';

describe('isMissingRelation', () => {
  it('should return true for QueryFailedError with missing relation message', () => {
    const error = new QueryFailedError(
      'SELECT * FROM nest_system_settings',
      [],
      new Error('relation "nest_system_settings" does not exist'),
    );
    expect(isMissingRelation(error, 'nest_system_settings')).toBe(true);
  });

  it('should return false for QueryFailedError with different relation name', () => {
    const error = new QueryFailedError(
      'SELECT * FROM other_table',
      [],
      new Error('relation "other_table" does not exist'),
    );
    expect(isMissingRelation(error, 'nest_system_settings')).toBe(false);
  });

  it('should return false for QueryFailedError with different error message', () => {
    const error = new QueryFailedError(
      'SELECT * FROM nest_system_settings',
      [],
      new Error('connection refused'),
    );
    expect(isMissingRelation(error, 'nest_system_settings')).toBe(false);
  });

  it('should return false for non-QueryFailedError', () => {
    const error = new Error('relation "nest_system_settings" does not exist');
    expect(isMissingRelation(error, 'nest_system_settings')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isMissingRelation(null, 'nest_system_settings')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isMissingRelation(undefined, 'nest_system_settings')).toBe(false);
  });

  it('should return false for string error', () => {
    expect(
      isMissingRelation(
        'relation "nest_system_settings" does not exist',
        'nest_system_settings',
      ),
    ).toBe(false);
  });
});
