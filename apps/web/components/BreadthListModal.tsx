'use client';

import { useState, useEffect } from 'react';
import { Modal, Table, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchApi } from '../lib/api';

type BreadthType = 'limitUp' | 'limitDown' | 'strong' | 'weak';

interface BreadthStockItem {
  code: string;
  name: string;
  changePercent: number | null;
  currentPrice: number | null;
}

interface Props {
  open: boolean;
  title: string;
  type: BreadthType;
  onClose: () => void;
  onNameClick: (code: string, name: string) => void;
}

export function BreadthListModal({ open, title, type, onClose, onNameClick }: Props) {
  const [data, setData] = useState<BreadthStockItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const pathMap: Record<BreadthType, string> = {
      limitUp: '/market/limit-up',
      limitDown: '/market/limit-down',
      strong: '/market/strong',
      weak: '/market/weak'
    };
    fetchApi<{ items: BreadthStockItem[] }>(pathMap[type])
      .then((res) => setData(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, type]);

  const columns: ColumnsType<BreadthStockItem> = [
    { title: '代码', dataIndex: 'code', width: 120 },
    {
      title: '名称',
      dataIndex: 'name',
      width: 120,
      render: (v: string, row) => (
        <span style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => onNameClick(row.code, v)}>
          {v}
        </span>
      )
    },
    {
      title: '涨跌幅',
      dataIndex: 'changePercent',
      align: 'right',
      width: 120,
      render: (v: number | null) => v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
    },
    {
      title: '现价',
      dataIndex: 'currentPrice',
      align: 'right',
      width: 120,
      render: (v: number | null) => v == null ? '-' : v.toFixed(2)
    }
  ];

  return (
    <Modal title={title} open={open} onCancel={onClose} footer={null} width={520} destroyOnHidden>
      {loading ? <Skeleton active /> : (
        <Table
          rowKey="code"
          dataSource={data}
          size="small"
          pagination={{ pageSize: 20, size: 'small' }}
          columns={columns}
        />
      )}
    </Modal>
  );
}
