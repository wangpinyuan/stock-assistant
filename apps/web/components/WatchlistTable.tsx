'use client';

import { useState } from 'react';
import { Button, Form, Input, message, Modal, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchApi, postApi, putApi, deleteApi } from '../lib/api';
import { ProfitText } from './ProfitText';
import { KLineChart } from './KLineChart';
import type { WatchlistView } from '@stock-assistant/shared';

interface WatchlistFormValues {
  code: string;
  note?: string;
}

interface WatchlistTableProps {
  watchlist: WatchlistView[];
  loading: boolean;
  onReload: () => void;
}

export function WatchlistTable({ watchlist, loading, onReload }: WatchlistTableProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchlistView | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<WatchlistFormValues>();

  const [klineModalOpen, setKlineModalOpen] = useState(false);
  const [selectedStockCode, setSelectedStockCode] = useState<string>('');
  const [selectedStockName, setSelectedStockName] = useState<string>('');

  const openCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row: WatchlistView) => {
    setEditingItem(row);
    form.setFieldsValue({
      code: row.code,
      note: row.note ?? undefined
    });
    setModalOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editingItem) {
        await putApi(`/watchlist/${editingItem.id}`, {
          note: values.note?.trim() || null
        });
        message.success('已更新');
      } else {
        const result = await postApi<{ ok: boolean; duplicate?: boolean }>('/watchlist', {
          code: values.code.trim()
        });
        if (result.duplicate) {
          message.warning('该代码已在自选中');
        } else {
          message.success('已新增');
        }
      }
      setModalOpen(false);
      onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteApi(`/watchlist/${id}`);
      message.success('已删除');
      onReload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const columns: ColumnsType<WatchlistView> = [
    { title: '代码', dataIndex: 'code' },
    { title: '名称', dataIndex: 'name' },
    { title: '当前价', dataIndex: 'currentPrice', align: 'right', render: (v: number | null) => v?.toFixed(2) ?? '-' },
    { title: '涨跌额', dataIndex: 'changeAmount', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} />) },
    { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, row) => (
        <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
      )
    }
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>自选股</Typography.Title>
        <Button type="primary" onClick={openCreate}>新增自选</Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={watchlist}
        pagination={false}
        columns={columns}
        scroll={{ x: 1000 }}
        onRow={(record) => ({
          onClick: () => {
            setSelectedStockCode(record.code);
            setSelectedStockName(record.name);
            setKlineModalOpen(true);
          },
          style: { cursor: 'pointer' }
        })}
      />

      <Modal
        title={editingItem ? '编辑自选' : '新增自选'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        width={480}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="股票代码" name="code" rules={[{ required: true, message: '请输入代码' }, { max: 20 }]}>
            <Input placeholder="例如 600519" disabled={Boolean(editingItem)} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${selectedStockName} (${selectedStockCode}) K线`}
        open={klineModalOpen}
        onCancel={() => setKlineModalOpen(false)}
        footer={null}
        width={900}
      >
        {selectedStockCode && <KLineChart code={selectedStockCode} />}
      </Modal>
    </>
  );
}
