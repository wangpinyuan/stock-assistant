'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout, Menu, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Content, Sider } = Layout;

const menuItems = [
  { key: '/', label: <Link href="/">首页</Link> },
  { key: '/holdings', label: <Link href="/holdings">持仓</Link> },
  { key: '/watchlist', label: <Link href="/watchlist">自选</Link> },
  { key: '/market', label: <Link href="/market">市场</Link> },
  { key: '/fund-flow', label: <Link href="/fund-flow">资金流</Link> },
  { key: '/news', label: <Link href="/news">资讯</Link> },
  { key: '/ai', label: <Link href="/ai">AI分析</Link> },
  { key: '/settings', label: <Link href="/settings">设置</Link> }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const selectedKey = menuItems.find((item) => item.key !== '/' && pathname.startsWith(item.key))?.key ?? '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light">
        <div style={{ padding: 20 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Stock Assistant
          </Typography.Title>
          <Typography.Text type="secondary">本地股票研究工作台</Typography.Text>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
