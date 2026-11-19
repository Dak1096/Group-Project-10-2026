package com.edtech.gamification.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Thuần tính toán, không phụ thuộc DB -> dễ unit test. Dùng số nguyên để tránh sai số float. */
@Component
public class XpCalculator {
    private final int xpPerCorrect;
    private final int streakThreshold;
    private final int bonusPercent;

    public XpCalculator(@Value("${app.xp.per-correct-answer}") int xpPerCorrect,
                        @Value("${app.xp.streak-bonus-threshold}") int streakThreshold,
                        @Value("${app.xp.streak-bonus-percent}") int bonusPercent) {
        this.xpPerCorrect = xpPerCorrect;
        this.streakThreshold = streakThreshold;
        this.bonusPercent = bonusPercent;
    }

    public long calculate(int correctAnswers, int currentStreak) {
        long base = (long) correctAnswers * xpPerCorrect;
        return currentStreak > streakThreshold ? base * bonusPercent / 100 : base;
    }
}
