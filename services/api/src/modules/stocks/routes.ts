import type { FastifyInstance } from 'fastify';
import { codeSchema, periodSchema } from './schema';

import {
  getStockAnalysisSignals,
  getStockDetail,
  getStockFundFlow,
  getStockKline,
  getStockNews,
  getStockQuote
} from './service';

export async function stocksRoutes(app: FastifyInstance) {
  app.get('/:code', async (request, reply) => {
    const item = await getStockDetail(codeSchema.parse(request.params).code);
    return item ?? reply.code(404).send({ error: '证券不存在' });
  });

  app.get('/:code/quote', async (request, reply) => {
    const item = await getStockQuote(codeSchema.parse(request.params).code);
    return item ?? reply.code(404).send({ error: '行情不存在' });
  });

  app.get('/:code/kline', async (request) => {
    const { code } = codeSchema.parse(request.params);
    const { period } = periodSchema.parse(request.query);
    return getStockKline(code, period);
  });

  app.get('/:code/fund-flow', async (request) =>
    getStockFundFlow(codeSchema.parse(request.params).code)
  );

  app.get('/:code/news', async (request) => getStockNews(codeSchema.parse(request.params).code));

  app.get('/:code/analysis-signals', async (request) =>
    getStockAnalysisSignals(codeSchema.parse(request.params).code)
  );
}
