package com.edtech.gamification.service;

import com.edtech.gamification.domain.Wallet;
import com.edtech.gamification.domain.XpTransaction;
import com.edtech.gamification.messaging.LessonCompletedEvent;
import com.edtech.gamification.repository.ProcessedEventRepository;
import com.edtech.gamification.repository.WalletRepository;
import com.edtech.gamification.repository.XpTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.ZoneOffset;

@Service
public class LessonXpService {
    private static final Logger log = LoggerFactory.getLogger(LessonXpService.class);

    private final ProcessedEventRepository processedEvents;
    private final WalletRepository wallets;
    private final XpTransactionRepository xpTransactions;
    private final StreakService streakService;
    private final XpCalculator calculator;

    public LessonXpService(ProcessedEventRepository processedEvents, WalletRepository wallets,
                           XpTransactionRepository xpTransactions, StreakService streakService,
                           XpCalculator calculator) {
        this.processedEvents = processedEvents;
        this.wallets = wallets;
        this.xpTransactions = xpTransactions;
        this.streakService = streakService;
        this.calculator = calculator;
    }

    /**
     * Một transaction duy nhất: processed_events + streak + wallet + xp_transactions.
     * Bất kỳ lỗi nào (kể cả OptimisticLockingFailure) -> rollback TẤT CẢ, kể cả dòng processed_events,
     * nên lần redelivery/retry sau vẫn xử lý được bình thường.
     */
    @Transactional
    public void process(LessonCompletedEvent event) {
        // 1) Idempotency gate. ON CONFLICT DO NOTHING: nếu một transaction khác đang xử lý cùng eventId,
        //    câu lệnh này BLOCK đến khi bên kia commit/rollback rồi mới quyết định -> không có khe hở race.
        if (processedEvents.insertIfAbsent(event.eventId(), event.eventType()) == 0) {
            log.info("Duplicate event {} ignored", event.eventId());
            return;
        }

        var data = event.data();

        // 2) Ví + streak
        wallets.insertIfAbsent(data.userId());
        Wallet wallet = wallets.findById(data.userId()).orElseThrow();
        int streak = streakService.recordActivity(data.userId(),
                data.completedAt().atZone(ZoneOffset.UTC).toLocalDate());

        // 3) Tính XP (streak đã tính cả hôm nay)
        long xp = calculator.calculate(data.correctAnswers(), streak);

        // 4) Cập nhật ví + ghi sổ giao dịch
        if (xp > 0) {
            wallet.credit(xp);
            wallets.saveAndFlush(wallet);   // flush sớm: lỗi version nổi lên ngay trong transaction
            xpTransactions.save(XpTransaction.earn(data.userId(), xp, wallet.getBalance(),
                    event.eventId().toString(),
                    "Lesson " + data.lessonId() + ": " + data.correctAnswers() + "/" + data.totalQuestions()
                            + " correct, streak " + streak));
        }
        log.info("Event {} processed: user={} xp={} streak={}", event.eventId(), data.userId(), xp, streak);
    }
}
