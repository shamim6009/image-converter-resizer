import { describe, expect, it } from 'vitest';
import type { ProcessSettings } from '../../types/image';
import { DEFAULT_SETTINGS } from '../settings';
import { MAX_OUTPUT_DIMENSION, resolveGeometry, roundedDownToEven } from '../geometry';

function makeSettings(patch: Partial<ProcessSettings>): ProcessSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('resolveGeometry', () => {
  it('keeps the original resolution in original mode', () => {
    const geometry = resolveGeometry(640, 480, makeSettings({ resizeMode: 'original' }));
    expect(geometry.outputWidth).toBe(640);
    expect(geometry.outputHeight).toBe(480);
    expect(geometry.upscaled).toBe(false);
  });

  it('scales by percentage', () => {
    const geometry = resolveGeometry(
      800,
      600,
      makeSettings({ resizeMode: 'percentage', percentage: 50 }),
    );
    expect(geometry.outputWidth).toBe(400);
    expect(geometry.outputHeight).toBe(300);
  });

  it('preserves the aspect ratio when auto resizing by width', () => {
    const geometry = resolveGeometry(
      4000,
      2000,
      makeSettings({ resizeMode: 'auto', autoBy: 'width', autoValue: 1000 }),
    );
    expect(geometry.outputWidth).toBe(1000);
    expect(geometry.outputHeight).toBe(500);
  });

  it('never upscales in auto max mode and fits inside the box', () => {
    const geometry = resolveGeometry(
      4000,
      2000,
      makeSettings({ resizeMode: 'auto', autoBy: 'max', maxWidth: 1920, maxHeight: 1080 }),
    );
    expect(geometry.outputWidth).toBe(1920);
    expect(geometry.outputHeight).toBe(960);
    expect(geometry.upscaled).toBe(false);
  });

  it('centers a contained image with letterbox offsets', () => {
    const geometry = resolveGeometry(
      200,
      100,
      makeSettings({
        resizeMode: 'custom',
        customWidth: 100,
        customHeight: 100,
        preserveAspect: false,
        fitMode: 'contain',
      }),
    );
    expect(geometry.drawWidth).toBe(100);
    expect(geometry.drawHeight).toBe(50);
    expect(geometry.drawX).toBe(0);
    expect(geometry.drawY).toBe(25);
  });

  it('crops beyond the canvas in cover mode', () => {
    const geometry = resolveGeometry(
      200,
      100,
      makeSettings({
        resizeMode: 'custom',
        customWidth: 100,
        customHeight: 100,
        preserveAspect: false,
        fitMode: 'cover',
      }),
    );
    expect(geometry.drawWidth).toBe(200);
    expect(geometry.drawHeight).toBe(100);
    expect(geometry.drawX).toBe(-50);
    expect(geometry.notes.some((note) => note.includes('crops'))).toBe(true);
  });

  it('never upscales in fit-within mode', () => {
    const geometry = resolveGeometry(
      100,
      100,
      makeSettings({
        resizeMode: 'custom',
        customWidth: 500,
        customHeight: 500,
        preserveAspect: false,
        fitMode: 'fit-within',
      }),
    );
    expect(geometry.outputWidth).toBe(100);
    expect(geometry.outputHeight).toBe(100);
  });

  it('reports an ICO note', () => {
    const geometry = resolveGeometry(300, 300, makeSettings({ format: 'ico' }));
    expect(geometry.notes.some((note) => note.startsWith('ICO'))).toBe(true);
  });

  it('throws when custom mode has no dimensions', () => {
    expect(() =>
      resolveGeometry(
        100,
        100,
        makeSettings({
          resizeMode: 'custom',
          customWidth: null,
          customHeight: null,
        }),
      ),
    ).toThrowError(/width or height/i);
  });

  it('throws when the output exceeds the browser-safe dimension limit', () => {
    expect(() =>
      resolveGeometry(2000, 2000, makeSettings({ resizeMode: 'percentage', percentage: 1000 })),
    ).toThrowError(/maximum supported dimension/i);
  });

  it('exposes a sane maximum dimension', () => {
    expect(MAX_OUTPUT_DIMENSION).toBe(16384);
  });
});

describe('roundedDownToEven', () => {
  it('rounds odd numbers down', () => {
    expect(roundedDownToEven(7.9)).toBe(6);
  });

  it('keeps even numbers', () => {
    expect(roundedDownToEven(8)).toBe(8);
  });
});
