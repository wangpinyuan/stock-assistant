export function ProfitText({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  if (!Number.isFinite(value)) return <span className="neutral">-</span>;
  const className = value >= 0 ? 'positive' : 'negative';
  const sign = value > 0 ? '+' : '';

  return <span className={className}>{sign}{prefix}{value.toFixed(2)}{suffix}</span>;
}
