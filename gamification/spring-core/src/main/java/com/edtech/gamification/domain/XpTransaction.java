package com.edtech.gamification.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "xp_transactions")
public class XpTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 16)
    private TxType type;

    @Column(nullable = false, updatable = false)
    private long amount;

    @Column(name = "balance_after", nullable = false, updatable = false)
    private long balanceAfter;

    @Column(name = "reference_id", nullable = false, updatable = false, length = 100)
    private String referenceId;

    @Column(length = 255)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected XpTransaction() {}

    private XpTransaction(UUID userId, TxType type, long amount, long balanceAfter, String referenceId, String description) {
        this.userId = userId;
        this.type = type;
        this.amount = amount;
        this.balanceAfter = balanceAfter;
        this.referenceId = referenceId;
        this.description = description;
    }

    public static XpTransaction earn(UUID userId, long amount, long balanceAfter, String referenceId, String description) {
        return new XpTransaction(userId, TxType.EARN, amount, balanceAfter, referenceId, description);
    }

    public static XpTransaction spend(UUID userId, long amount, long balanceAfter, String referenceId, String description) {
        return new XpTransaction(userId, TxType.SPEND, amount, balanceAfter, referenceId, description);
    }

    public UUID getId() { return id; }
    public long getAmount() { return amount; }
    public long getBalanceAfter() { return balanceAfter; }
}
