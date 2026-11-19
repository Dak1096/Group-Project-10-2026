package com.edtech.gamification.messaging;

import java.time.Instant;
import java.util.UUID;

/** Hợp đồng message với Node producer (envelope version 1). */
public record LessonCompletedEvent(UUID eventId, String eventType, int version, Instant occurredAt, Data data) {
    public record Data(UUID attemptId, UUID userId, UUID lessonId,
                       int correctAnswers, int totalQuestions, Instant completedAt) {}
}
