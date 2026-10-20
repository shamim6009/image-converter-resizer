import { describe, expect, it } from 'vitest';
import { isLightColor, normalizeHexColor } from '../color';

describe('normalizeHexColor', () => {
  it('expands three digit hex', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC');
  });

  it('accepts hex without a hash', () => {
    expect(normalizeHexColor('a1b2c3')).toBe('#A1B2C3');
  });

  it('uppercases full hex values', () => {
    expect(normalizeHexColor('#4f46e5')).toBe('#4F46E5');
  });

  it('rejects invalid values', () => {
    expect(normalizeHexColor('not-a-color')).toBe(null);
    expect(normalizeHexColor('#12345')).toBe(null);
  });
});

describe('isLightColor', () => {
  it('treats white as light', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
  });

  it('treats black as dark', () => {
    expect(isLightColor('#000000')).toBe(false);
  });
});
