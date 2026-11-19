'use strict';
const express = require('express');
const config = require('./config');
const { pool } = require('./db');
const { RabbitPublisher } = require('./rabbit');
const { OutboxRelay } = require('./outboxRelay');
const { buildRouter } = require('./routes');

async function main() {
  const publisher = new RabbitPublisher(config.rabbit);
  const relay = new OutboxRelay({ pool, publisher, ...config.relay });

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Health chỉ phụ thuộc DB: RabbitMQ chết thì API vẫn nhận bài làm (outbox giữ event).
  app.get('/healthz', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'db_unavailable' }); }
  });
  app.use('/api/v1', buildRouter({ relay }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[http] unhandled', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });

  const server = app.listen(config.port, () => console.info(`[http] listening on :${config.port}`));
  relay.start();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[app] ${signal} received, shutting down`);
    server.close();
    await relay.stop();
    await publisher.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => { console.error('[app] fatal', err); process.exit(1); });
