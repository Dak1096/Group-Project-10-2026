package com.edtech.gamification.repository;

import com.edtech.gamification.domain.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.UUID;

public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, UUID> {
    /** @return 1 nếu đây là lần xử lý đầu tiên; 0 nếu event đã xử lý trước đó. */
    @Modifying
    @Query(value = "INSERT INTO processed_events (event_id, event_type, processed_at) " +
            "VALUES (:eventId, :eventType, now()) ON CONFLICT (event_id) DO NOTHING", nativeQuery = true)
    int insertIfAbsent(@Param("eventId") UUID eventId, @Param("eventType") String eventType);
}
