package com.edtech.gamification.service;

import com.edtech.gamification.web.PurchaseResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Retry NGOÀI transaction (khác bean với StoreService để @Transactional proxy có hiệu lực):
 * mỗi lần thử là một transaction mới, đọc lại wallet với version mới nhất.
 */
@Service
public class StoreFacade {
    private static final int MAX_ATTEMPTS = 3;
    private final StoreService storeService;

    public StoreFacade(StoreService storeService) { this.storeService = storeService; }

    public PurchaseResponse purchase(UUID userId, String itemCode, int quantity, String idempotencyKey) {
        for (int attempt = 1; ; attempt++) {
            try {
                return storeService.purchase(userId, itemCode, quantity, idempotencyKey);
            } catch (OptimisticLockingFailureException | DataIntegrityViolationException e) {
                // DataIntegrityViolation: 2 request cùng Idempotency-Key đua nhau -> lần thử sau sẽ thấy bản ghi cũ và replay
                if (attempt >= MAX_ATTEMPTS) throw e;
                try {
                    Thread.sleep(ThreadLocalRandom.current().nextLong(10, 40) * attempt);   // jitter
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw e;
                }
            }
        }
    }
}
