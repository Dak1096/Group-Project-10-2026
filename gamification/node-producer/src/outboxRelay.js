'use strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Relay đọc outbox -> publish -> đánh dấu published_at.
 *  - FOR UPDATE SKIP LOCKED: chạy nhiều instance Node không giẫm chân nhau.
 *  - Lỗi publish: tăng attempts, exponential backoff qua next_attempt_at, event vẫn nằm trong DB.
 *  - At-least-once: nếu crash giữa "broker ack" và "UPDATE published_at" thì gửi lại -> consumer idempotent.
 */
class OutboxRelay {
  constructor({ pool, publisher, pollIntervalMs, batchSize, maxBackoffMs }) {
    Object.assign(this, { pool, publisher, pollIntervalMs, batchSize, maxBackoffMs });
    this.timer = null;
    this.busy = false;
    this.stopped = false;
  }

  start() {
    this.stopped = false;
    this.timer = setTimeout(() => this.#tick(), 0);
    this.purgeTimer = setInterval(() => this.#purge().catch((e) => console.error('[outbox] purge failed', e)), 3_600_000);
    this.purgeTimer.unref();
  }

  /** Đánh thức relay ngay sau khi commit để giảm latency (không bắt buộc cho tính đúng đắn). */
  kick() {
    if (this.stopped || this.busy) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.#tick(), 0);
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.purgeTimer);
    while (this.busy) await sleep(50);
  }

  async #tick() {
    if (this.stopped) return;
    this.busy = true;
    let delay = this.pollIntervalMs;
    try {
      const sent = await this.#drainOnce();
      if (sent === this.batchSize) delay = 0; // còn backlog -> chạy tiếp ngay
    } catch (err) {
      console.error('[outbox] tick failed:', err.message);
    } finally {
      this.busy = false;
      if (!this.stopped) this.timer = setTimeout(() => this.#tick(), delay);
    }
  }

  async #drainOnce() {
    const client = await this.pool.connect();
    let sent = 0;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, event_type, routing_key, payload, attempts
           FROM outbox_events
          WHERE published_at IS NULL AND next_attempt_at <= now()
          ORDER BY created_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [this.batchSize],
      );

      for (const row of rows) {
        try {
          await this.publisher.publish({
            messageId: row.id,
            type: row.event_type,
            routingKey: row.routing_key,
            body: row.payload,
          });
          await client.query('UPDATE outbox_events SET published_at = now(), last_error = NULL WHERE id = $1', [row.id]);
          sent++;
        } catch (err) {
          const attempts = row.attempts + 1;
          const backoffMs = Math.min(2 ** attempts * 1000, this.maxBackoffMs);
          await client.query(
            `UPDATE outbox_events
                SET attempts = $2, last_error = $3,
                    next_attempt_at = now() + make_interval(secs => $4::double precision)
              WHERE id = $1`,
            [row.id, attempts, String(err.message).slice(0, 500), backoffMs / 1000],
          );
          console.warn(`[outbox] publish ${row.id} failed (attempt ${attempts}): ${err.message}`);
          break; // nhiều khả năng broker down -> dừng batch, đợi backoff
        }
      }
      await client.query('COMMIT');
      return sent;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async #purge() {
    await this.pool.query("DELETE FROM outbox_events WHERE published_at < now() - interval '7 days'");
  }
}

module.exports = { OutboxRelay };
