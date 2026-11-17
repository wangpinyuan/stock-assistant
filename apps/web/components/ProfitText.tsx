export function ProfitText({ value, suffix = '', prefix = '' }: { value: number | null; suffix?: string; prefix?: string }) {
  if (value == null) return <span>-</span>;
  const className = value >= 0 ? 'positive' : 'negative';
  const sign = value > 0 ? '+' : '';

  return <span className={className}>{sign}{prefix}{value.toFixed(2)}{suffix}</span>;
}
