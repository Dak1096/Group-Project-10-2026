'use strict';
const amqp = require('amqplib');

/**
 * Publisher dùng ConfirmChannel:
 *  - persistent: true      -> message ghi xuống đĩa
 *  - mandatory: true       -> nếu không có queue nào bind, broker trả message về (không âm thầm drop)
 *  - publisher confirm     -> chỉ coi là "đã gửi" khi broker ack
 * Tự reconnect lười (lazy): mất kết nối thì lần publish kế tiếp sẽ kết nối lại.
 * Queue do Spring sở hữu; Node chỉ assert exchange (durable) để không lệch tham số queue.
 */
class RabbitPublisher {
  constructor({ url, exchange }) {
    this.url = url;
    this.exchange = exchange;
    this.conn = null;
    this.ch = null;
    this.connecting = null;
    this.returned = new Set();
  }

  async #connect() {
    const conn = await amqp.connect(this.url, { heartbeat: 30 });
    conn.on('error', (e) => console.error('[rabbit] connection error:', e.message));
    conn.on('close', () => { console.warn('[rabbit] connection closed'); this.conn = null; this.ch = null; });

    const ch = await conn.createConfirmChannel();
    ch.on('error', (e) => console.error('[rabbit] channel error:', e.message));
    ch.on('close', () => { this.ch = null; });
    ch.on('return', (msg) => this.returned.add(msg.properties.messageId));
    await ch.assertExchange(this.exchange, 'direct', { durable: true });

    this.conn = conn;
    this.ch = ch;
    console.info('[rabbit] connected');
  }

  async #ensureChannel() {
    if (this.ch) return this.ch;
    this.connecting ??= this.#connect().finally(() => { this.connecting = null; });
    await this.connecting;
    return this.ch;
  }

  /** Throw nếu chưa được broker xác nhận (mất kết nối, nack, unroutable). */
  async publish({ messageId, type, routingKey, body }) {
    const ch = await this.#ensureChannel();
    await new Promise((resolve, reject) => {
      ch.publish(
        this.exchange,
        routingKey,
        Buffer.from(JSON.stringify(body)),
        {
          persistent: true,
          mandatory: true,
          contentType: 'application/json',
          messageId,
          type,
          timestamp: Math.floor(Date.now() / 1000),
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    if (this.returned.delete(messageId)) {
      throw new Error(`Unroutable message ${messageId}: no queue bound for "${routingKey}"`);
    }
  }

  async close() {
    try { await this.ch?.close(); } catch (_) { /* ignore */ }
    try { await this.conn?.close(); } catch (_) { /* ignore */ }
  }
}

module.exports = { RabbitPublisher };
