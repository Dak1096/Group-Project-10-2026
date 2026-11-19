'use strict';
const { randomUUID } = require('crypto');
const { withTx } = require('./db');
const config = require('./config');

/**
 * Lưu bài làm + ghi outbox trong CÙNG MỘT transaction.
 * -> Hoặc có cả hai, hoặc không có gì. Không bao giờ có bài làm mà thiếu event.
 * Việc gửi RabbitMQ do OutboxRelay đảm nhiệm (tách khỏi request path).
 */
async function completeLesson({ userId, lessonId, clientRequestId, correctAnswers, totalQuestions, durationSec }) {
  return withTx(async (db) => {
    const attemptId = randomUUID();
    const completedAt = new Date();

    const inserted = await db.query(
      `INSERT INTO lesson_attempts
         (id, user_id, lesson_id, client_request_id, correct_answers, total_questions, duration_sec, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, client_request_id) DO NOTHING
       RETURNING id`,
      [attemptId, userId, lessonId, clientRequestId, correctAnswers, totalQuestions, durationSec ?? null, completedAt],
    );

    if (inserted.rowCount === 0) {
      // Client retry cùng clientRequestId -> trả lại kết quả cũ, KHÔNG tạo event thứ hai
      const existing = await db.query(
        'SELECT id FROM lesson_attempts WHERE user_id = $1 AND client_request_id = $2',
        [userId, clientRequestId],
      );
      return { attemptId: existing.rows[0].id, duplicate: true };
    }

    const eventId = randomUUID();
    const envelope = {
      eventId,
      eventType: 'LessonCompleted',
      version: 1,
      occurredAt: completedAt.toISOString(),
      data: { attemptId, userId, lessonId, correctAnswers, totalQuestions, completedAt: completedAt.toISOString() },
    };

    await db.query(
      `INSERT INTO outbox_events (id, aggregate_id, event_type, routing_key, payload)
       VALUES ($1,$2,$3,$4,$5)`,
      [eventId, attemptId, 'LessonCompleted', config.rabbit.routingKey, envelope],
    );

    return { attemptId, eventId, duplicate: false };
  });
}

module.exports = { completeLesson };
