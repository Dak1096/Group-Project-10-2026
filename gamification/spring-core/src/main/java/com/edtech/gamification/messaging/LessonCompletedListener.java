package com.edtech.gamification.messaging;

import com.edtech.gamification.service.LessonXpService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class LessonCompletedListener {
    private static final Logger log = LoggerFactory.getLogger(LessonCompletedListener.class);
    private final LessonXpService lessonXpService;

    public LessonCompletedListener(LessonXpService lessonXpService) {
        this.lessonXpService = lessonXpService;
    }

    /**
     * Không có try/catch nuốt lỗi: exception -> không ack -> retry (backoff) -> hết lượt thì DLQ.
     * Message hỏng (poison) thì reject ngay, không retry vô ích.
     */
    @RabbitListener(queues = "${app.rabbit.queue}")
    public void onMessage(LessonCompletedEvent event) {
        validate(event);
        log.debug("Received LessonCompleted eventId={}", event.eventId());
        lessonXpService.process(event);
    }

    private void validate(LessonCompletedEvent e) {
        if (e == null || e.eventId() == null || e.data() == null || e.data().userId() == null
                || e.data().completedAt() == null) {
            throw new AmqpRejectAndDontRequeueException("Malformed LessonCompleted event");
        }
        if (!"LessonCompleted".equals(e.eventType())) {
            throw new AmqpRejectAndDontRequeueException("Unexpected eventType " + e.eventType());
        }
        var d = e.data();
        if (d.correctAnswers() < 0 || d.totalQuestions() <= 0 || d.correctAnswers() > d.totalQuestions()) {
            throw new AmqpRejectAndDontRequeueException("Invalid answer counts in event " + e.eventId());
        }
    }
}
