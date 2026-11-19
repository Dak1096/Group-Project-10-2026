package com.edtech.gamification.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "wallets")
public class Wallet {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private long balance;

    /** Optimistic lock: mỗi lần UPDATE sẽ "WHERE version = ?" và tăng version. */
    @Version
    private Long version;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Wallet() {}

    public void credit(long amount) {
        if (amount <= 0) throw new IllegalArgumentException("amount must be > 0");
        balance += amount;
        updatedAt = Instant.now();
    }

    public void debit(long amount) {
        if (amount <= 0) throw new IllegalArgumentException("amount must be > 0");
        if (balance < amount) throw new IllegalStateException("insufficient balance");
        balance -= amount;
        updatedAt = Instant.now();
    }

    public UUID getUserId() { return userId; }
    public long getBalance() { return balance; }
    public Long getVersion() { return version; }
}
