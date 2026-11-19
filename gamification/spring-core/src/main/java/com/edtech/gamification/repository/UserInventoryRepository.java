package com.edtech.gamification.repository;

import com.edtech.gamification.domain.UserInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserInventoryRepository extends JpaRepository<UserInventory, UUID> {
    Optional<UserInventory> findByUserIdAndItemCode(UUID userId, String itemCode);
    List<UserInventory> findByUserId(UUID userId);
}
