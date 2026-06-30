import { Card, Statistic } from 'antd';

interface MetricCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  precision?: number;
  profitColor?: boolean;
}

export function MetricCard({ title, value, prefix, suffix, precision = 2, profitColor }: MetricCardProps) {
  const numericValue = typeof value === 'number' ? value : Number.NaN;
  const valueStyle = profitColor && Number.isFinite(numericValue) ? { color: numericValue >= 0 ? '#d9363e' : '#389e0d' } : undefined;

  return (
    <Card>
      <Statistic title={title} value={value} prefix={prefix} precision={typeof value === 'number' ? precision : undefined} suffix={suffix} valueStyle={valueStyle} />
    </Card>
  );
}
