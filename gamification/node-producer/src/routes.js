'use strict';
const express = require('express');
const { z } = require('zod');
const { completeLesson } = require('./lessonService');

const bodySchema = z
  .object({
    lessonId: z.string().uuid(),
    clientRequestId: z.string().uuid(),
    correctAnswers: z.number().int().min(0),
    totalQuestions: z.number().int().min(1).max(500),
    durationSec: z.number().int().min(0).optional(),
  })
  .refine((v) => v.correctAnswers <= v.totalQuestions, {
    path: ['correctAnswers'],
    message: 'correctAnswers must be <= totalQuestions',
  });

/** TODO: thay bằng middleware verify JWT; ở đây đọc header do API Gateway gắn sau khi xác thực. */
function auth(req, res, next) {
  const parsed = z.string().uuid().safeParse(req.header('x-user-id'));
  if (!parsed.success) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  req.userId = parsed.data;
  next();
}

function buildRouter({ relay }) {
  const router = express.Router();

  router.post('/lessons/complete', auth, async (req, res, next) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
    }
    try {
      const result = await completeLesson({ userId: req.userId, ...parsed.data });
      if (!result.duplicate) relay.kick();
      // 201: tạo mới | 200: request lặp (idempotent)
      return res.status(result.duplicate ? 200 : 201).json({ attemptId: result.attemptId, status: 'ACCEPTED' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { buildRouter };
