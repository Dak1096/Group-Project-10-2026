package com.edtech.gamification.repository;

import com.edtech.gamification.domain.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.UUID;

public interface WalletRepository extends JpaRepository<Wallet, UUID> {
    /** Tạo ví nếu chưa có, an toàn khi 2 thread cùng tạo (không ném exception, không làm hỏng transaction). */
    @Modifying
    @Query(value = "INSERT INTO wallets (user_id, balance, version, updated_at) VALUES (:userId, 0, 0, now()) " +
            "ON CONFLICT (user_id) DO NOTHING", nativeQuery = true)
    int insertIfAbsent(@Param("userId") UUID userId);
}
