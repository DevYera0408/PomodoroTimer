import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    version: '1.0.0',
    serverTime: new Date().toISOString(),
  }));
};
