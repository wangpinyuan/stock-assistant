'use client';

import { useCallback, useState } from 'react';
import { Alert, Button, Space, Typography } from 'antd';
import { StockKLineModal } from '../../components/StockKLineModal';
import { MarketOverview } from '../../features/market/MarketOverview';
import { FundFlowPanel } from '../../features/market/FundFlowPanel';
import { NewsPanel } from '../../features/market/NewsPanel';
import { useDataUpdate } from '../../features/market/useDataUpdate';

const MARKET_UPDATES = ['market', 'fund-flow', 'news'] as const;

export default function MarketPage() {
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const reload = useCallback(async () => { setRefreshVersion(version => version + 1); }, []);
  const refresh = useDataUpdate(MARKET_UPDATES, reload);
  const openChart = (code: string, name: string) => setSelected({ code, name });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>市场</Typography.Title>
        <Button type="primary" loading={refresh.updating} onClick={refresh.update}>刷新</Button>
      </Space>
      {refresh.error && <Alert type="error" message="部分市场数据刷新失败" description={refresh.error} />}
      <MarketOverview onNameClick={openChart} refreshVersion={refreshVersion} />
      <FundFlowPanel onNameClick={openChart} refreshVersion={refreshVersion} />
      <NewsPanel refreshVersion={refreshVersion} />
      <StockKLineModal open={selected != null} code={selected?.code ?? ''} name={selected?.name} onClose={() => setSelected(null)} />
    </Space>
  );
}
