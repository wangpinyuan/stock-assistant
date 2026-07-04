export function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export function toNumberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}
