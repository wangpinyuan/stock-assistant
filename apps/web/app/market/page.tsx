'use client';

import { useState } from 'react';
import { Space, Typography } from 'antd';
import { MarketOverviewCard } from '../../components/MarketOverviewCard';
import { FundFlowCard } from '../../components/FundFlowCard';
import { NewsCard } from '../../components/NewsCard';
import { StockKLineModal } from '../../components/StockKLineModal';
import { BreadthListModal } from '../../components/BreadthListModal';
import { useMarketOverview } from '../../hooks/useMarketOverview';
import { useFundFlow } from '../../hooks/useFundFlow';
import { useNews } from '../../hooks/useNews';

export default function MarketPage() {
  const [klineModalOpen, setKlineModalOpen] = useState(false);
  const [selectedStockCode, setSelectedStockCode] = useState('');
  const [selectedStockName, setSelectedStockName] = useState('');
  const [breadthModal, setBreadthModal] = useState<{ type: 'limitUp' | 'limitDown' | 'strong' | 'weak'; label: string } | null>(null);

  const market = useMarketOverview();
  const fundFlow = useFundFlow();
  const news = useNews();

  const handleNameClick = (code: string, name: string) => {
    setSelectedStockCode(code);
    setSelectedStockName(name);
    setKlineModalOpen(true);
  };

  const handleBreadthClick = (type: 'limitUp' | 'limitDown' | 'strong' | 'weak', label: string) => {
    setBreadthModal({ type, label });
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>市场</Typography.Title>
      <MarketOverviewCard
        data={market.data}
        loading={market.loading}
        error={market.error}
        lastUpdateTime={market.lastUpdateTime}
        updating={market.updating}
        onRefresh={market.refresh}
        onNameClick={handleNameClick}
        onBreadthClick={handleBreadthClick}
      />
      <FundFlowCard
        tab={fundFlow.tab}
        tabs={fundFlow.tabLabel}
        data={fundFlow.data}
        loading={fundFlow.loading}
        error={fundFlow.error}
        onTabChange={fundFlow.setTab}
        onNameClick={handleNameClick}
      />
      <NewsCard
        tab={news.tab}
        data={news.data}
        loading={news.loading}
        error={news.error}
        onTabChange={news.setTab}
      />
      <StockKLineModal
        open={klineModalOpen}
        code={selectedStockCode}
        name={selectedStockName}
        onClose={() => setKlineModalOpen(false)}
      />
      <BreadthListModal
        open={breadthModal !== null}
        title={breadthModal?.label ?? ''}
        onClose={() => setBreadthModal(null)}
        onNameClick={handleNameClick}
        type={breadthModal?.type ?? 'limitUp'}
      />
    </Space>
  );
}
