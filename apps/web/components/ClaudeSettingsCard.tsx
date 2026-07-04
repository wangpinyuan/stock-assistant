'use client';

import { Alert, Button, Input, message, Space } from 'antd';
import { useState } from 'react';
import { putApi, postApi } from '../lib/api';
import { DEFAULT_CLAUDE_MODEL, DEEP_CLAUDE_MODEL } from '@stock-assistant/shared';

interface Props {
  apiKey: string;
  defaultModel: string;
  deepModel: string;
  onApiKeyChange: (v: string) => void;
  onDefaultModelChange: (v: string) => void;
  onDeepModelChange: (v: string) => void;
  onSaved: () => void;
  getApiKey: () => string;
  getDefaultModel: () => string;
}

export function ClaudeSettingsCard({
  apiKey, defaultModel, deepModel,
  onApiKeyChange, onDefaultModelChange, onDeepModelChange,
  onSaved, getApiKey, getDefaultModel
}: Props) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = async () => {
    if (!apiKey.trim() && !defaultModel.trim() && !deepModel.trim()) {
      message.warning('未提供任何更新');
      return;
    }
    const items: Array<{ key: string; value: string }> = [];
    if (apiKey.trim()) items.push({ key: 'claude.apiKey', value: apiKey.trim() });
    if (defaultModel.trim()) items.push({ key: 'claude.defaultModel', value: defaultModel.trim() });
    if (deepModel.trim()) items.push({ key: 'claude.deepModel', value: deepModel.trim() });
    if (items.length === 0) { message.warning('请输入至少一项内容'); return; }
    setSaving(true);
    try {
      await putApi('/settings', { items });
      message.success('Claude 配置已保存');
      onApiKeyChange('');
      onSaved();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const key = apiKey.trim() || getApiKey();
    const model = defaultModel.trim() || getDefaultModel() || DEFAULT_CLAUDE_MODEL;
    if (!key) { message.warning('未配置 Claude API Key'); return; }
    setTesting(true);
    setResult(null);
    try {
      const r = await postApi<{ ok: boolean; message: string }>('/settings/test-claude', { apiKey: key, model });
      setResult(r);
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : '请求失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Input.Password value={apiKey} onChange={(e) => onApiKeyChange(e.target.value)} placeholder="粘贴新 API Key 以更新（留空仅测试）" />
      <Space.Compact style={{ width: '100%' }}>
        <span style={{ lineHeight: '32px', padding: '0 12px', background: '#f0f0f0', border: '1px solid #d9d9d9', borderRight: 0, borderRadius: '6px 0 0 6px' }}>默认模型</span>
        <Input value={defaultModel} onChange={(e) => onDefaultModelChange(e.target.value)} placeholder="例如 claude-sonnet-4-6" style={{ flex: 1 }} />
      </Space.Compact>
      <Space.Compact style={{ width: '100%' }}>
        <span style={{ lineHeight: '32px', padding: '0 12px', background: '#f0f0f0', border: '1px solid #d9d9d9', borderRight: 0, borderRadius: '6px 0 0 6px' }}>深度模型</span>
        <Input value={deepModel} onChange={(e) => onDeepModelChange(e.target.value)} placeholder="例如 claude-opus-4-7" style={{ flex: 1 }} />
      </Space.Compact>
      <Space>
        <Button type="primary" onClick={save} loading={saving}>保存</Button>
        <Button loading={testing} onClick={test}>测试连接</Button>
      </Space>
      {result && <Alert type={result.ok ? 'success' : 'error'} message={result.message} showIcon />}
    </>
  );
}
