package com.edtech.gamification.repository;

import com.edtech.gamification.domain.TxType;
import com.edtech.gamification.domain.XpTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface XpTransactionRepository extends JpaRepository<XpTransaction, UUID> {
    Optional<XpTransaction> findByUserIdAndTypeAndReferenceId(UUID userId, TxType type, String referenceId);
}
