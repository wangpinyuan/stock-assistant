export function ProfitText({ value, suffix = '' }: { value: number; suffix?: string }) {
  const className = value >= 0 ? 'positive' : 'negative';
  const sign = value > 0 ? '+' : '';

  return <span className={className}>{sign}{value.toFixed(2)}{suffix}</span>;
}
