export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const short = /^#?([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  if (full) return `#${full[1].toUpperCase()}`;
  return null;
}

export function isLightColor(hex: string): boolean {
  const normalized = normalizeHexColor(hex) ?? '#FFFFFF';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}
