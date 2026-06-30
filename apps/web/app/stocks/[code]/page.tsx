import { PlaceholderPage } from '../../../components/PlaceholderPage';

export default function StockDetailPage({ params }: { params: { code: string } }) {
  return <PlaceholderPage title={`个股详情：${params.code}`} description="下一阶段实现技术分析、资讯公告、持仓视角和 AI 分析 tab。" />;
}
