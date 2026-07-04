'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, InputNumber, Skeleton, Space, Typography, message } from 'antd';
import { useSettings } from '../../hooks/useSettings';
import { TushareSettingsCard } from '../../components/TushareSettingsCard';
import { ClaudeSettingsCard } from '../../components/ClaudeSettingsCard';
import { DEFAULT_REFRESH_INTERVAL_MINUTES, REFRESH_INTERVAL_SETTING_KEY } from '@stock-assistant/shared';

export default function SettingsPage() {
  const { settings, loading, error, load, getModelDefaults, saveItems } = useSettings();

  const byKey = useMemo(() => new Map(settings.map((s) => [s.key, s.value])), [settings]);

  const [tushareToken, setTushareToken] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [claudeDefaultModel, setClaudeDefaultModel] = useState(getModelDefaults().defaultModel);
  const [claudeDeepModel, setClaudeDeepModel] = useState(getModelDefaults().deepModel);
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL_MINUTES);

  // Sync state when settings load
  useEffect(() => {
    if (!loading && settings.length > 0) {
      const t = byKey.get('tushare.token') ?? '';
      const a = byKey.get('claude.apiKey') ?? '';
      const dm = byKey.get('claude.defaultModel') ?? getModelDefaults().defaultModel;
      const dp = byKey.get('claude.deepModel') ?? getModelDefaults().deepModel;
      const ri = byKey.get(REFRESH_INTERVAL_SETTING_KEY);
      setTushareToken(t);
      setClaudeApiKey(a);
      setClaudeDefaultModel(dm);
      setClaudeDeepModel(dp);
      setRefreshInterval(ri ? parseInt(ri, 10) : DEFAULT_REFRESH_INTERVAL_MINUTES);
    }
  }, [loading, settings, byKey, getModelDefaults]);

  const saveRefreshInterval = async () => {
    try {
      await saveItems([{ key: REFRESH_INTERVAL_SETTING_KEY, value: refreshInterval.toString() }]);
      message.success('刷新间隔已保存');
    } catch {
      message.error('保存失败');
    }
  };

  if (loading) return <Skeleton active />;
  if (error) return <Alert type="error" message="设置加载失败" description={error} />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>设置</Typography.Title>

      <Card title="Tushare" styles={{ body: { padding: 16 } }}>
        <TushareSettingsCard token={tushareToken} onTokenChange={setTushareToken} onSaved={load} />
      </Card>

      <Card title="Claude" styles={{ body: { padding: 16 } }}>
        <ClaudeSettingsCard
          apiKey={claudeApiKey} defaultModel={claudeDefaultModel} deepModel={claudeDeepModel}
          onApiKeyChange={setClaudeApiKey} onDefaultModelChange={setClaudeDefaultModel} onDeepModelChange={setClaudeDeepModel}
          onSaved={load}
        />
      </Card>

      <Card title="自动刷新" styles={{ body: { padding: 16 } }}>
        <Space align="center" size="middle">
          <Typography.Text type="secondary">市场模块自动刷新间隔</Typography.Text>
          <InputNumber
            min={1}
            max={60}
            value={refreshInterval}
            onChange={(v) => setRefreshInterval(v ?? DEFAULT_REFRESH_INTERVAL_MINUTES)}
            style={{ width: 80 }}
            size="large"
          />
          <Typography.Text>分钟</Typography.Text>
          <Button type="primary" onClick={saveRefreshInterval} size="large">保存</Button>
        </Space>
      </Card>
    </Space>
  );
}
