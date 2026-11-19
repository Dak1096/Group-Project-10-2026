'use strict';

const env = (key, fallback) => {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${key}`);
  return v;
};

module.exports = {
  port: Number(env('PORT', '3000')),
  databaseUrl: env('DATABASE_URL', 'postgres://app:app@localhost:5432/lessons'),
  rabbit: {
    url: env('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
    exchange: 'gamification.events',
    routingKey: 'lesson.completed',
  },
  relay: {
    pollIntervalMs: 1000,
    batchSize: 50,
    maxBackoffMs: 60_000,
  },
};
