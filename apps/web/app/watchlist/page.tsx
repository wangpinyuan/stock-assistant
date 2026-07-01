'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { deleteApi, fetchApi, postApi, putApi } from '../../lib/api';
import { ProfitText } from '../../components/ProfitText';
import type { WatchlistView } from '@stock-assistant/shared';

interface WatchlistFormValues {
  code: string;
  name?: string;
  sortOrder?: number;
  note?: string;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistView[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WatchlistView | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<WatchlistFormValues>();

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchApi<{ items: WatchlistView[] }>('/watchlist');
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
    form.setFieldsValue({ sortOrder: 0 });
    setModalOpen(true);
  };

  const openEdit = (row: WatchlistView) => {
    setEditing(row);
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      sortOrder: row.sortOrder,
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
        name: values.name?.trim() || undefined,
        sortOrder: values.sortOrder,
        note: values.note?.trim() || null
      };
      if (editing) {
        await putApi(`/watchlist/${editing.id}`, {
          sortOrder: payload.sortOrder,
          note: payload.note
        });
        message.success('已更新');
      } else {
        const result = await postApi<{ ok: boolean; duplicate?: boolean }>('/watchlist', payload);
        if (result.duplicate) {
          message.warning('该代码已在自选中');
        } else {
          message.success('已新增');
        }
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
      await deleteApi(`/watchlist/${id}`);
      message.success('已删除');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const columns: ColumnsType<WatchlistView> = [
    { title: '排序', dataIndex: 'sortOrder', width: 80, align: 'right' },
    { title: '名称', dataIndex: 'name' },
    { title: '代码', dataIndex: 'code' },
    { title: '当前价', dataIndex: 'currentPrice', align: 'right', render: (v: number | null) => v?.toFixed(2) ?? '-' },
    { title: '涨跌额', dataIndex: 'changeAmount', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} />) },
    { title: '涨跌幅', dataIndex: 'changePercent', align: 'right', render: (v: number | null) => (v == null ? '-' : <ProfitText value={v} suffix="%" />) },
    { title: '信号', dataIndex: 'signalTags', render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>) },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v: string | null) => v ?? '-' },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm title="确认从自选移除？" onConfirm={() => remove(row.id)} okText="移除" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>自选股</Typography.Title>
        <Button type="primary" onClick={openCreate}>新增自选</Button>
      </div>

      <Card>
        <Table rowKey="id" loading={loading} dataSource={items} pagination={false} columns={columns} scroll={{ x: 1000 }} />
      </Card>

      <Modal
        title={editing ? '编辑自选' : '新增自选'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        width={480}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="股票代码" name="code" rules={[{ required: true, message: '请输入代码' }, { max: 20 }]}>
            <Input placeholder="例如 600519" disabled={Boolean(editing)} />
          </Form.Item>
          {!editing && (
            <Form.Item label="股票名称" name="name">
              <Input placeholder="可选，自动获取" maxLength={50} />
            </Form.Item>
          )}
          <Form.Item label="排序" name="sortOrder">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
