'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { deleteApi, fetchApi, postApi, putApi } from '../../lib/api';
import { ProfitText } from '../../components/ProfitText';
import type { AssetType, HoldingView } from '@stock-assistant/shared';

interface HoldingFormValues {
  code: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  averageCost: number;
  buyDate: Dayjs | null;
  tags?: string;
  note?: string;
}

const percent = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function HoldingsPage() {
  const [items, setItems] = useState<HoldingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HoldingView | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<HoldingFormValues>();

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchApi<{ items: HoldingView[] }>('/holdings');
      setItems(data.items);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ assetType: 'stock', buyDate: null });
    setModalOpen(true);
  };

  const openEdit = (row: HoldingView) => {
    setEditing(row);
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      assetType: row.assetType,
      quantity: row.quantity,
      averageCost: row.averageCost,
      buyDate: null,
      tags: row.tags ?? undefined,
      note: row.note ?? undefined
    });
    setModalOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        code: values.code.trim(),
        quantity: values.quantity,
        averageCost: values.averageCost,
        assetType: values.assetType,
        buyDate: values.buyDate ? values.buyDate.format('YYYY-MM-DD') : null,
        tags: values.tags?.trim() || null,
        note: values.note?.trim() || null
      };
      if (editing) {
        await putApi(`/holdings/${editing.id}`, payload);
        message.success('已更新');
      } else {
        await postApi('/holdings', { ...payload, name: values.name?.trim() || values.code.trim() });
        message.success('已新增');
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteApi(`/holdings/${id}`);
      message.success('已删除');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const columns: ColumnsType<HoldingView> = [
    { title: '名称', dataIndex: 'name' },
    { title: '代码', dataIndex: 'code' },
    { title: '类型', dataIndex: 'assetType', render: (value: AssetType) => (value === 'stock' ? '股票' : 'ETF') },
    { title: '当前价', dataIndex: 'currentPrice', align: 'right', render: (v: number) => v.toFixed(2) },
    { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number) => <ProfitText value={v} suffix="%" /> },
    { title: '持仓数量', dataIndex: 'quantity', align: 'right' },
    { title: '平均成本', dataIndex: 'averageCost', align: 'right', render: (v: number) => v.toFixed(2) },
    { title: '当前市值', dataIndex: 'marketValue', align: 'right', render: (v: number) => v.toFixed(2) },
    { title: '权重', dataIndex: 'weight', align: 'right', render: percent },
    { title: '今日盈亏', dataIndex: 'todayProfit', align: 'right', render: (v: number) => <ProfitText value={v} /> },
    { title: '总盈亏', dataIndex: 'totalProfit', align: 'right', render: (v: number) => <ProfitText value={v} /> },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认删除该持仓？" onConfirm={() => remove(row.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>持仓管理</Typography.Title>
        <Button type="primary" onClick={openCreate}>新增持仓</Button>
      </div>

      <Card>
        <Table rowKey="id" loading={loading} dataSource={items} pagination={false} columns={columns} scroll={{ x: 1200 }} />
      </Card>

      <Modal
        title={editing ? '编辑持仓' : '新增持仓'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="股票代码" name="code" rules={[{ required: true, message: '请输入代码' }, { max: 20 }]}>
            <Input placeholder="例如 600519" disabled={Boolean(editing)} />
          </Form.Item>
          {!editing && (
            <Form.Item label="股票名称" name="name" rules={[{ max: 50 }]}>
              <Input placeholder="可选，未填将使用代码" />
            </Form.Item>
          )}
          <Form.Item label="资产类型" name="assetType" rules={[{ required: true }]}>
            <Select
              disabled={Boolean(editing)}
              options={[
                { value: 'stock', label: '股票' },
                { value: 'etf', label: 'ETF' }
              ]}
            />
          </Form.Item>
          <Form.Item label="持仓数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="平均成本" name="averageCost" rules={[{ required: true, message: '请输入成本' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="买入日期" name="buyDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="例如 核心观察 / 新能源" maxLength={200} />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} maxLength={1000} placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
