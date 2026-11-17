import { StockDetail } from '../../../components/StockDetail';

export default async function StockDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <StockDetail code={code} />;
}
