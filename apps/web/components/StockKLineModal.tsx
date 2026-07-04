'use client';

import { Modal } from 'antd';
import { KLineChart } from './KLineChart';

interface StockKLineModalProps {
  open: boolean;
  code: string;
  name?: string;
  onClose: () => void;
  width?: number;
}

export function StockKLineModal({ open, code, name, onClose, width = 900 }: StockKLineModalProps) {
  return (
    <Modal
      title={name ? `${name} (${code}) K线` : `${code} K线`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      destroyOnClose
    >
      {open && code && <KLineChart code={code} />}
    </Modal>
  );
}
