import { describe, expect, it } from 'vitest';
import { apiArray, apiObject } from './api';

describe('API response shape helpers', () => {
  it('keeps bare arrays unchanged', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(apiArray(rows)).toEqual(rows);
  });

  it('unwraps paginated and nested list responses', () => {
    expect(apiArray<{ id: string }>({ items: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
    expect(apiArray<{ id: string }>({ data: { rows: [{ id: 'b' }] } })).toEqual([{ id: 'b' }]);
    expect(apiArray<{ id: string }>({ data: { properties: [{ id: 'c' }] } }, ['properties']))
      .toEqual([{ id: 'c' }]);
  });

  it('returns an empty array for malformed list payloads', () => {
    expect(apiArray(null)).toEqual([]);
    expect(apiArray({ message: 'not a list' })).toEqual([]);
    expect(apiArray('not json')).toEqual([]);
  });

  it('unwraps object response envelopes', () => {
    expect(apiObject<{ id: string }>({ data: { id: 'a' } })).toEqual({ id: 'a' });
    expect(apiObject<{ id: string }>({ id: 'b' })).toEqual({ id: 'b' });
    expect(apiObject(null)).toBeNull();
  });
});
