'use client';

import { Alert, Button, Input, message, Space } from 'antd';
import { useState } from 'react';
import { putApi, postApi } from '../lib/api';

interface Props {
  token: string;
  onTokenChange: (v: string) => void;
  onSaved: () => void;
}

export function TushareSettingsCard({ token, onTokenChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = async () => {
    if (!token.trim()) {
      message.warning('请粘贴新的 Tushare Token');
      return;
    }
    setSaving(true);
    try {
      await putApi('/settings', { items: [{ key: 'tushare.token', value: token.trim() }] });
      message.success('Tushare Token 已保存');
      onSaved();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!token.trim()) { message.warning('请先输入 Tushare Token'); return; }
    setTesting(true);
    setResult(null);
    try {
      const r = await postApi<{ ok: boolean; message: string }>('/settings/test-tushare', { token: token.trim() });
      setResult(r);
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : '请求失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Input.Password
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
        placeholder="粘贴新的 Tushare Token"
        size="large"
      />
      <Space>
        <Button type="primary" onClick={save} loading={saving} size="large">保存</Button>
        <Button loading={testing} onClick={test} size="large">测试连接</Button>
      </Space>
      {result && <Alert type={result.ok ? 'success' : 'error'} message={result.message} showIcon />}
    </Space>
  );
}
