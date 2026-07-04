'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Skeleton, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { deleteApi, putApi } from '../../lib/api';
import { useSettings, type SettingEntry } from '../../hooks/useSettings';
import { TushareSettingsCard } from '../../components/TushareSettingsCard';
import { ClaudeSettingsCard } from '../../components/ClaudeSettingsCard';

const SECRET_KEYS = new Set(['tushare.token', 'claude.apiKey']);

function mask(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}

export default function SettingsPage() {
  const { settings, loading, error, load, getModelDefaults } = useSettings();
  const [editForm] = Form.useForm<{ key: string; value: string }>();
  const [editing, setEditing] = useState<SettingEntry | null>(null);

  const [tushareToken, setTushareToken] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [claudeDefaultModel, setClaudeDefaultModel] = useState('');
  const [claudeDeepModel, setClaudeDeepModel] = useState('');

  const byKey = useMemo(() => new Map(settings.map((s) => [s.key, s.value])), [settings]);

  const columns: ColumnsType<SettingEntry> = [
    { title: '键', dataIndex: 'key', width: 240 },
    { title: '值', dataIndex: 'value', ellipsis: true, render: (v: string, row) => (SECRET_KEYS.has(row.key) && v ? mask(v) : v) },
    { title: '更新时间', dataIndex: 'updatedAt', width: 200, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => { setEditing(row); editForm.setFieldsValue({ key: row.key, value: SECRET_KEYS.has(row.key) ? '' : row.value }); }}>编辑</Button>
          <Popconfirm title={`确认删除 "${row.key}"？`} onConfirm={async () => { await deleteApi(`/settings?key=${encodeURIComponent(row.key)}`); await load(); }} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const submitEdit = async () => {
    if (!editing) return;
    const values = await editForm.validateFields();
    const trimmedKey = values.key.trim();
    if (!trimmedKey) return;
    try {
      if (trimmedKey !== editing.key) await deleteApi(`/settings?key=${encodeURIComponent(editing.key)}`);
      await putApi('/settings', { items: [{ key: trimmedKey, value: values.value }] });
      setEditing(null);
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  if (loading) return <Skeleton active />;
  if (error) return <Alert type="error" message="设置加载失败" description={error} />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2} style={{ margin: 0 }}>设置</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Tushare">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">当前 Token：{byKey.get('tushare.token') ? mask(byKey.get('tushare.token') ?? '') : '未配置'}</Typography.Text>
              <TushareSettingsCard token={tushareToken} onTokenChange={setTushareToken} onSaved={load} getToken={() => byKey.get('tushare.token') ?? ''} />
            </Space>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Claude">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">当前 API Key：{byKey.get('claude.apiKey') ? mask(byKey.get('claude.apiKey') ?? '') : '未配置'}</Typography.Text>
              <ClaudeSettingsCard
                apiKey={claudeApiKey} defaultModel={claudeDefaultModel} deepModel={claudeDeepModel}
                onApiKeyChange={setClaudeApiKey} onDefaultModelChange={setClaudeDefaultModel} onDeepModelChange={setClaudeDeepModel}
                onSaved={load}
                getApiKey={() => byKey.get('claude.apiKey') ?? ''}
                getDefaultModel={() => byKey.get('claude.defaultModel') ?? getModelDefaults().defaultModel}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="全部设置项">
        <Table rowKey="id" dataSource={settings} pagination={false} columns={columns} />
      </Card>

      <Modal title="编辑设置" open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={submitEdit} destroyOnClose width={520}>
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item label="键" name="key" rules={[{ required: true, max: 100 }]}><Input placeholder="例如 claude.defaultModel" /></Form.Item>
          <Form.Item label="值" name="value"><Input.TextArea rows={4} maxLength={10000} placeholder={editing && SECRET_KEYS.has(editing.key) ? '留空表示保持原值' : ''} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
