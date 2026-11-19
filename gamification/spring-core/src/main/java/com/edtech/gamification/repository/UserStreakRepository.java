package com.edtech.gamification.repository;

import com.edtech.gamification.domain.UserStreak;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.UUID;

public interface UserStreakRepository extends JpaRepository<UserStreak, UUID> {
    @Modifying
    @Query(value = "INSERT INTO user_streaks (user_id, current_streak, version) VALUES (:userId, 0, 0) " +
            "ON CONFLICT (user_id) DO NOTHING", nativeQuery = true)
    int insertIfAbsent(@Param("userId") UUID userId);
}
