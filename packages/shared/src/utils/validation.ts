// 验证股票代码格式（6位纯数字）
export function isValidStockCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// 验证并清理 codes 数组
export function validateStockCodes(codes: string[]): string[] {
  return codes.filter(isValidStockCode);
}

// 格式化大数字
export function formatLargeNumber(value: number, precision = 2): string {
  const absV = Math.abs(value);
  if (absV >= 1_000_000_000_000) return `${(absV / 1_000_000_000_000).toFixed(precision)}万亿`;
  if (absV >= 100_000_000_000) return `${(absV / 100_000_000_000).toFixed(precision)}千亿`;
  if (absV >= 100_000_000) return `${(absV / 100_000_000).toFixed(precision)}亿`;
  if (absV >= 10_000) return `${(absV / 10_000).toFixed(precision)}万`;
  return `${absV.toFixed(precision)}`;
}
