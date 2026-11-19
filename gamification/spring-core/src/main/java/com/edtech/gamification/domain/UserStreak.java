package com.edtech.gamification.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "user_streaks")
public class UserStreak {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak;

    @Column(name = "last_activity_date")
    private LocalDate lastActivityDate;

    @Version
    private Long version;

    protected UserStreak() {}

    /** Hôm nay học: cùng ngày -> giữ nguyên; liền kề -> +1; đứt quãng -> reset 1; event cũ/out-of-order -> bỏ qua. */
    public void recordActivity(LocalDate day) {
        if (lastActivityDate == null) {
            currentStreak = 1;
            lastActivityDate = day;
            return;
        }
        if (!day.isAfter(lastActivityDate)) return;
        currentStreak = day.isEqual(lastActivityDate.plusDays(1)) ? currentStreak + 1 : 1;
        lastActivityDate = day;
    }

    public int getCurrentStreak() { return currentStreak; }
}
