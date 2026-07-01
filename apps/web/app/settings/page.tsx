'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Skeleton,
  Space,
  Table,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { deleteApi, fetchApi, postApi, putApi } from '../../lib/api';

interface SettingEntry {
  id: number;
  key: string;
  value: string;
  updatedAt: string;
}

const SECRET_KEYS = new Set(['tushare.token', 'claude.apiKey']);

function mask(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tushareToken, setTushareToken] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [claudeDefaultModel, setClaudeDefaultModel] = useState('');
  const [claudeDeepModel, setClaudeDeepModel] = useState('');
  const [testingTushare, setTestingTushare] = useState(false);
  const [testingClaude, setTestingClaude] = useState(false);
  const [tushareResult, setTushareResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [claudeResult, setClaudeResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [editing, setEditing] = useState<SettingEntry | null>(null);
  const [editForm] = Form.useForm<{ key: string; value: string }>();

  const byKey = useMemo(() => new Map(settings.map((s) => [s.key, s.value])), [settings]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{ items: SettingEntry[] }>('/settings');
      setSettings(data.items);
      setTushareToken('');
      setClaudeApiKey('');
      setClaudeDefaultModel(data.items.find((s) => s.key === 'claude.defaultModel')?.value ?? 'claude-sonnet-4-6');
      setClaudeDeepModel(data.items.find((s) => s.key === 'claude.deepModel')?.value ?? 'claude-opus-4-7');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveTushare = async () => {
    if (!tushareToken.trim()) {
      message.warning('请粘贴新的 Tushare Token，留空表示不修改');
      return;
    }
    try {
      await putApi('/settings', { items: [{ key: 'tushare.token', value: tushareToken.trim() }] });
      message.success('Tushare Token 已保存');
      setTushareToken('');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  const saveClaude = async () => {
    if (!claudeApiKey.trim() && !claudeDefaultModel.trim() && !claudeDeepModel.trim()) {
      message.warning('未提供任何更新');
      return;
    }
    try {
      const items: Array<{ key: string; value: string }> = [];
      if (claudeApiKey.trim()) items.push({ key: 'claude.apiKey', value: claudeApiKey.trim() });
      if (claudeDefaultModel.trim()) items.push({ key: 'claude.defaultModel', value: claudeDefaultModel.trim() });
      if (claudeDeepModel.trim()) items.push({ key: 'claude.deepModel', value: claudeDeepModel.trim() });
      if (items.length === 0) {
        message.warning('请输入至少一项内容');
        return;
      }
      await putApi('/settings', { items });
      message.success('Claude 配置已保存');
      setClaudeApiKey('');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  const testTushare = async () => {
    const token = tushareToken.trim() || byKey.get('tushare.token') || '';
    if (!token) {
      message.warning('未配置 Tushare Token');
      return;
    }
    setTestingTushare(true);
    setTushareResult(null);
    try {
      const result = await postApi<{ ok: boolean; message: string }>('/settings/test-tushare', { token });
      setTushareResult(result);
    } catch (err) {
      setTushareResult({ ok: false, message: err instanceof Error ? err.message : '请求失败' });
    } finally {
      setTestingTushare(false);
    }
  };

  const testClaude = async () => {
    const apiKey = claudeApiKey.trim() || byKey.get('claude.apiKey') || '';
    const model = claudeDefaultModel.trim() || byKey.get('claude.defaultModel') || 'claude-sonnet-4-6';
    if (!apiKey) {
      message.warning('未配置 Claude API Key');
      return;
    }
    setTestingClaude(true);
    setClaudeResult(null);
    try {
      const result = await postApi<{ ok: boolean; message: string }>('/settings/test-claude', { apiKey, model });
      setClaudeResult(result);
    } catch (err) {
      setClaudeResult({ ok: false, message: err instanceof Error ? err.message : '请求失败' });
    } finally {
      setTestingClaude(false);
    }
  };

  const openEdit = (row: SettingEntry) => {
    setEditing(row);
    editForm.setFieldsValue({ key: row.key, value: SECRET_KEYS.has(row.key) ? '' : row.value });
  };

  const submitEdit = async () => {
    if (!editing) return;
    const values = await editForm.validateFields();
    const trimmedKey = values.key.trim();
    if (!trimmedKey) {
      message.error('键不能为空');
      return;
    }
    try {
      if (trimmedKey !== editing.key) {
        await deleteApi(`/settings?key=${encodeURIComponent(editing.key)}`);
      }
      await putApi('/settings', { items: [{ key: trimmedKey, value: values.value }] });
      message.success('已保存');
      setEditing(null);
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  const remove = async (key: string) => {
    try {
      await deleteApi(`/settings?key=${encodeURIComponent(key)}`);
      message.success('已删除');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ColumnsType<SettingEntry> = [
    { title: '键', dataIndex: 'key', width: 240 },
    {
      title: '值',
      dataIndex: 'value',
      ellipsis: true,
      render: (value: string, row) => (SECRET_KEYS.has(row.key) && value ? mask(value) : value)
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 200, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title={`确认删除 “${row.key}”？`} onConfirm={() => remove(row.key)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (loading) {
    return <Skeleton active />;
  }

  if (error) {
    return <Alert type="error" message="设置加载失败" description={error} />;
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>设置</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Tushare">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                当前 Token：{byKey.get('tushare.token') ? mask(byKey.get('tushare.token') ?? '') : '未配置'}
              </Typography.Text>
              <Input.Password
                value={tushareToken}
                onChange={(e) => setTushareToken(e.target.value)}
                placeholder="粘贴新 Token 以更新（留空仅测试）"
              />
              <Space>
                <Button type="primary" onClick={saveTushare} disabled={!tushareToken.trim()}>保存</Button>
                <Button loading={testingTushare} onClick={testTushare}>测试连接</Button>
              </Space>
              {tushareResult && (
                <Alert type={tushareResult.ok ? 'success' : 'error'} message={tushareResult.message} showIcon />
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="Claude">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                当前 API Key：{byKey.get('claude.apiKey') ? mask(byKey.get('claude.apiKey') ?? '') : '未配置'}
              </Typography.Text>
              <Input.Password
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                placeholder="粘贴新 API Key 以更新（留空仅测试）"
              />
              <Space.Compact>
                <span style={{ lineHeight: '32px', padding: '0 12px', background: '#f0f0f0', border: '1px solid #d9d9d9', borderRight: 0, borderRadius: '6px 0 0 6px' }}>默认模型</span>
                <Input
                  value={claudeDefaultModel}
                  onChange={(e) => setClaudeDefaultModel(e.target.value)}
                  placeholder="例如 claude-sonnet-4-6"
                  style={{ flex: 1 }}
                />
              </Space.Compact>
              <Space.Compact>
                <span style={{ lineHeight: '32px', padding: '0 12px', background: '#f0f0f0', border: '1px solid #d9d9d9', borderRight: 0, borderRadius: '6px 0 0 6px' }}>深度模型</span>
                <Input
                  value={claudeDeepModel}
                  onChange={(e) => setClaudeDeepModel(e.target.value)}
                  placeholder="例如 claude-opus-4-7"
                  style={{ flex: 1 }}
                />
              </Space.Compact>
              <Space>
                <Button type="primary" onClick={saveClaude}>保存</Button>
                <Button loading={testingClaude} onClick={testClaude}>测试连接</Button>
              </Space>
              {claudeResult && (
                <Alert type={claudeResult.ok ? 'success' : 'error'} message={claudeResult.message} showIcon />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="全部设置项">
        <Table rowKey="id" dataSource={settings} pagination={false} columns={columns} />
      </Card>

      <Modal
        title="编辑设置"
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={submitEdit}
        destroyOnClose
        width={520}
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item label="键" name="key" rules={[{ required: true, max: 100 }]}>
            <Input placeholder="例如 claude.defaultModel" />
          </Form.Item>
          <Form.Item label="值" name="value">
            <Input.TextArea rows={4} maxLength={10000} placeholder={editing && SECRET_KEYS.has(editing.key) ? '留空表示保持原值' : ''} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
