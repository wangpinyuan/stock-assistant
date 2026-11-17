import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function freePort() {
    const server = createServer();
    await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}
const apiPort = await freePort();
const webPort = await freePort();
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const production = process.env.UI_MODE === 'production';
const require = createRequire(resolve(root, 'package.json'));
const { PrismaClient } = require('@prisma/client');
const directory = await mkdtemp(resolve(tmpdir(), 'stock-ui-'));
const url = `file:${directory}/test.db`;
const prisma = new PrismaClient({ datasources: { db: { url } } });
const children = [];
const outputs = [];
let browser;
async function start(args, env, log) {
    const output = await open(resolve(directory, log), 'w');
    outputs.push(output);
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', output.fd, output.fd] });
    children.push(child);
    return child;
}
async function ready(url, child) {
    for (let i = 0; i < 90; i++) {
        if (child.exitCode != null)
            throw new Error('Server exited, inspect ' + directory);
        try {
            if ((await fetch(url)).ok)
                return;
        }
        catch { }
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Server readiness timeout');
}
try {
    const migration = await readFile(resolve(root, 'prisma/migrations/20260630151412_init/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(s => s.trim()))
        await prisma.$executeRawUnsafe(statement);
    await prisma.stock.create({ data: { code: '000001', name: '测试持仓' } });
    await prisma.stock.create({ data: { code: '000002', name: '测试流出' } });
    await prisma.fundFlow.createMany({ data: [{ level: 'stock', code: '000001', name: '测试持仓', flowDate: new Date('2026-11-13'), mainNetInflow: 100, largeOrderNetInflow: 125000000 }, { level: 'stock', code: '000002', name: '测试流出', flowDate: new Date('2026-11-13'), mainNetInflow: -50, largeOrderNetInflow: -10000 }] });
    await prisma.fundFlow.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ level: 'sector', name: `测试概念板块${i}`, flowDate: new Date('2026-11-13'), changePercent: 3 })) });
    await prisma.fundFlow.createMany({ data: [
        { level: 'stock', code: '000001', name: '小额资金', flowDate: new Date('2026-11-13'), mainNetInflow: 200, largeOrderNetInflow: 999.5 },
        { level: 'stock', code: '000001', name: '零额资金', flowDate: new Date('2026-11-13'), mainNetInflow: 300, largeOrderNetInflow: 0 },
        { level: 'stock', code: '000001', name: '缺失资金', flowDate: new Date('2026-11-13'), mainNetInflow: 400 }
    ] });
    await prisma.newsItem.create({ data: { type: '资讯', code: '000001', title: '页面测试新闻', publishDate: new Date('2026-11-13'), impactOnHolding: true } });
    await prisma.holding.create({ data: { code: '000001', name: '测试持仓', assetType: 'stock', quantity: 10, averageCost: 8, buyDate: new Date('2020-01-02') } });
    await prisma.quote.create({ data: { code: '000001', tradeDate: new Date('2026-11-13'), currentPrice: 10, preClose: 9, changeAmount: 1 } });
    for (let i = 0; i < 25; i++) {
        const date = new Date(Date.UTC(2026, 9, i + 1));
        const data = { code: '000001', open: 9, high: 11, low: 8, close: 10, volume: 100, ma5: i > 4 ? 10 : null };
        await prisma.klineDaily.create({ data: { ...data, tradeDate: date } });
        await prisma.klineWeekly.create({ data: { ...data, weekDate: new Date(Date.UTC(2026, 0, i * 7 + 1)) } });
        await prisma.klineMonthly.create({ data: { ...data, monthDate: new Date(Date.UTC(2024, i, 1)) } });
    }
    const api = await start((production ? ['services/api/dist/index.js'] : ['--import', 'tsx', 'services/api/src/index.ts']), { DATABASE_URL: url, API_PORT: String(apiPort), API_HOST: '127.0.0.1', WEB_ORIGIN: webUrl, WORKER_PYTHON: '/nonexistent/python' }, 'api.log');
    await ready(`${apiUrl}/health`, api);
    const web = await start(['node_modules/next/dist/bin/next', production ? 'start' : 'dev', 'apps/web', '-p', String(webPort)], { NEXT_PUBLIC_API_BASE_URL: apiUrl }, 'web.log');
    await ready(webUrl, web);
    browser = await chromium.launch({ channel: process.env.UI_BROWSER_CHANNEL || 'chrome', headless: true });
    const page = await browser.newPage();
    await page.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (['fetch', 'xhr'].includes(request.resourceType()) && url.origin !== webUrl) {
            const response = await route.fetch({ url: apiUrl + url.pathname + url.search });
            await route.fulfill({ response });
        }
        else
            await route.continue();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(webUrl);
    const total = page.locator('.ant-card').filter({ hasText: '总市值' }).locator('.ant-statistic-content-value');
    await total.getByText('100', { exact: true }).waitFor();
    await page.getByRole('button', { name: /编\s*辑/ }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.locator('#buyDate').inputValue(), '2020-01-02');
    await dialog.locator('#quantity').fill('20');
    await dialog.getByRole('button', { name: 'OK', exact: true }).click();
    await total.getByText('200', { exact: true }).waitFor();
    assert.equal((await prisma.holding.findFirstOrThrow()).buyDate.toISOString().slice(0, 10), '2020-01-02');
    await page.getByRole('row').filter({ hasText: '测试持仓' }).click();
    await page.locator('.ant-modal canvas').first().waitFor({ state: 'visible' });
    await page.getByText('周K', { exact: true }).click();
    await page.locator('.ant-modal canvas').first().waitFor({ state: 'visible' });
    await page.getByText('月K', { exact: true }).click();
    await page.locator('.ant-modal canvas').first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: '自选', exact: true }).click();
    await page.getByRole('button', { name: '新增自选', exact: true }).click();
    const watch = page.getByRole('dialog');
    await watch.locator('#code').fill('000001');
    await watch.locator('#note').fill('保存测试备注');
    await watch.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('row').filter({ hasText: '测试持仓' }).waitFor();
    assert.equal((await prisma.watchlistItem.findFirstOrThrow()).note, '保存测试备注');
    await page.getByText(/已新增，行情更新失败/).waitFor();
    await page.getByRole('link', { name: '市场', exact: true }).click();
    const breadthCard = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title').getByText('涨跌家数', { exact: true }) });
    const sectorCard = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title').getByText('板块表现', { exact: true }) });
    const indexCard = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title').getByText('主要指数', { exact: true }) });
    const flowCard = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title').getByText('资金流', { exact: true }) });
    const marketNews = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title').getByText('资讯', { exact: true }) });
    await sectorCard.getByRole('row').filter({ hasText: '测试概念板块0' }).waitFor();
    assert.equal(await page.locator('.ant-card-head').getByRole('button').count(), 0);
    const refreshButton = page.getByRole('button', { name: /刷\s*新/ });
    assert.equal(await refreshButton.count(), 1);
    assert.ok((await refreshButton.boundingBox()).y < (await breadthCard.boundingBox()).y);
    const upperBottom = Math.max(...await Promise.all([breadthCard, indexCard].map(async card => {
        const box = await card.boundingBox();
        return box.y + box.height;
    })));
    const sectorBox = await sectorCard.boundingBox();
    assert.ok(sectorBox.y - upperBottom >= 20);
    assert.ok(sectorBox.height <= 500);
    assert.ok(await sectorCard.evaluate(element => {
        element.scrollTop = 100;
        return element.scrollHeight > element.clientHeight && element.scrollTop > 0;
    }));
    assert.equal(await indexCard.getByRole('columnheader', { name: '代码', exact: true }).count(), 0);
    assert.equal(await marketNews.getByRole('columnheader', { name: '代码', exact: true }).count(), 0);
    assert.equal(await marketNews.getByRole('columnheader', { name: '情绪', exact: true }).count(), 0);
    await flowCard.getByRole('row').filter({ hasText: '测试持仓' }).getByText('+1.25亿元', { exact: true }).waitFor();
    await flowCard.getByRole('row').filter({ hasText: '小额资金' }).getByText('+999.50元', { exact: true }).waitFor();
    await flowCard.getByRole('row').filter({ hasText: '零额资金' }).getByText('0.00元', { exact: true }).waitFor();
    const missingCells = await flowCard.getByRole('row').filter({ hasText: '缺失资金' }).getByRole('cell').allTextContents();
    assert.equal(missingCells[4], '-');
    await page.getByRole('tab', { name: '流出前10', exact: true }).click();
    await page.getByRole('row').filter({ hasText: '测试流出' }).getByText('-1.00万元', { exact: true }).waitFor();
    await page.getByRole('tab', { name: '持仓影响', exact: true }).click();
    await page.getByRole('row').filter({ hasText: '页面测试新闻' }).waitFor();
    await page.getByRole('button', { name: /刷\s*新/ }).first().click();
    await page.getByText(/spawn.*nonexistent.*ENOENT/).waitFor();
    const updates = { market: 0, 'fund-flow': 0, news: 0 };
    await page.route('**/update/market', async route => {
        updates.market++;
        assert.deepEqual(route.request().postDataJSON(), { source: 'sina' });
        await prisma.quote.updateMany({ data: { changePercent: -4 } });
        await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/update/fund-flow', async route => {
        updates['fund-flow']++;
        await prisma.fundFlow.updateMany({ where: { name: '测试流出' }, data: { largeOrderNetInflow: -200000000 * updates['fund-flow'] } });
        await prisma.fundFlow.updateMany({ where: { level: 'sector' }, data: { changePercent: 6 } });
        await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/update/news', async route => {
        updates.news++;
        await prisma.newsItem.updateMany({ data: { title: '统一刷新后的新闻' } });
        await route.fulfill({ json: { ok: true } });
    });
    await refreshButton.click();
    await marketNews.getByText('统一刷新后的新闻', { exact: true }).waitFor();
    await flowCard.getByText('-2.00亿元', { exact: true }).waitFor();
    await sectorCard.getByText('+6.00%', { exact: true }).first().waitFor();
    await breadthCard.getByText('下跌', { exact: true }).locator('..').getByText('1', { exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: '流出前10', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('tab', { name: '持仓影响', exact: true }).getAttribute('aria-selected'), 'true');
    assert.deepEqual(updates, { market: 1, 'fund-flow': 1, news: 1 });
    await page.route('**/update/news', route => route.fulfill({ json: { ok: false, error: '资讯源暂时不可用' } }));
    await refreshButton.click();
    await page.getByText(/资讯源暂时不可用/).waitFor();
    await flowCard.getByText('-4.00亿元', { exact: true }).waitFor();
    await page.getByRole('link', { name: '设置', exact: true }).click();
    const card = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title').getByText('Tushare', { exact: true }) });
    const tokenInput = card.locator('input[type="password"]');
    await tokenInput.fill('page-fixture-token');
    const savedResponse = page.waitForResponse(response => response.url().endsWith('/settings') && response.request().method() === 'PUT');
    await card.getByRole('button', { name: /保\s*存/ }).click();
    const saved = await savedResponse;
    assert.equal((await saved.text()).includes('page-fixture-token'), false);
    await card.getByText(/当前 Token：已配置/).waitFor();
    assert.equal(await tokenInput.inputValue(), '');
    await page.route('**/settings/test-tushare', async (route) => {
        assert.equal(route.request().postDataJSON().token, '');
        await route.fulfill({ json: { ok: true, message: '测试连接成功' } });
    });
    await card.getByRole('button', { name: '测试连接', exact: true }).click();
    await card.getByText('测试连接成功', { exact: true }).waitFor();
    const settingsResponse = await page.request.get(`${apiUrl}/settings`);
    assert.equal((await settingsResponse.text()).includes('page-fixture-token'), false);
    assert.equal((await prisma.setting.findUniqueOrThrow({ where: { key: 'tushare.token' } })).value, 'page-fixture-token');
    await page.goto(`${webUrl}/stocks/000001`);
    await page.getByText('10.00', { exact: true }).first().waitFor();
    await page.locator('canvas').first().waitFor({ state: 'visible' });
    // Empty caches initialize once, failed initialization remains manually retryable.
    await prisma.fundFlow.deleteMany();
    await prisma.newsItem.deleteMany();
    let flowUpdates = 0;
    let newsUpdates = 0;
    let flowWrite;
    await page.route('**/update/fund-flow', async (route) => {
        flowUpdates++;
        flowWrite ??= prisma.fundFlow.createMany({ data: [
            { level: 'stock', code: '000001', name: '首次加载资金流', flowDate: new Date('2026-11-13'), mainNetInflow: 200 },
            { level: 'sector', name: '首次加载板块', flowDate: new Date('2026-11-13'), changePercent: 5 }
        ] });
        await flowWrite;
        await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/update/news', async (route) => {
        newsUpdates++;
        if (newsUpdates === 1) {
            await route.fulfill({ json: { ok: false, error: '首次资讯抓取失败' } });
            return;
        }
        await prisma.newsItem.create({ data: { type: '资讯', title: '重试加载资讯', publishDate: new Date('2026-11-13') } });
        await route.fulfill({ json: { ok: true } });
    });
    await page.goto(`${webUrl}/market`);
    await page.getByRole('row').filter({ hasText: '首次加载板块' }).waitFor();
    await page.getByRole('row').filter({ hasText: '首次加载资金流' }).waitFor();
    await page.getByText('首次资讯抓取失败', { exact: true }).waitFor();
    await page.waitForTimeout(1000);
    assert.equal(newsUpdates, 1);
    assert.ok(flowUpdates >= 1 && flowUpdates <= 2);
    await page.getByRole('button', { name: /刷\s*新/ }).click();
    await page.getByRole('row').filter({ hasText: '重试加载资讯' }).waitFor();
    assert.equal(newsUpdates, 2);
    assert.deepEqual(errors, []);
    console.log('PASS holdings/summary, K-line lifecycle, watchlist notes, update errors, market tabs, secret settings, stock details, empty market initialization and retry, unified refresh, market layout, adaptive money units');
}
catch (error) {
    console.error(error);
    console.error('UI logs at', directory);
    process.exitCode = 1;
}
finally {
    await browser?.close();
    for (const child of children) {
        try {
            process.kill(-child.pid, 'SIGTERM');
        }
        catch { }
    }
    for (const output of outputs)
        await output.close();
    await prisma.$disconnect();
    if (!process.exitCode)
        await rm(directory, { recursive: true, force: true });
}
