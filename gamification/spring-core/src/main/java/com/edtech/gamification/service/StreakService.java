package com.edtech.gamification.service;

import com.edtech.gamification.domain.UserStreak;
import com.edtech.gamification.repository.UserStreakRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class StreakService {
    private final UserStreakRepository repo;

    public StreakService(UserStreakRepository repo) { this.repo = repo; }

    /** Chạy trong transaction của caller (MANDATORY): streak và XP phải commit/rollback cùng nhau. */
    @Transactional(propagation = Propagation.MANDATORY)
    public int recordActivity(UUID userId, LocalDate day) {
        repo.insertIfAbsent(userId);
        UserStreak streak = repo.findById(userId).orElseThrow();
        streak.recordActivity(day);
        return streak.getCurrentStreak();
    }
}
