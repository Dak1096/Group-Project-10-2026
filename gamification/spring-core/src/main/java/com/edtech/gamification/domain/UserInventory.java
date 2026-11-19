package com.edtech.gamification.domain;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "user_inventory")
public class UserInventory {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "item_code", nullable = false, updatable = false)
    private String itemCode;

    @Column(nullable = false)
    private int quantity;

    @Version
    private Long version;

    protected UserInventory() {}

    public UserInventory(UUID userId, String itemCode) {
        this.userId = userId;
        this.itemCode = itemCode;
        this.quantity = 0;
    }

    public void add(int n) { this.quantity += n; }

    public String getItemCode() { return itemCode; }
    public int getQuantity() { return quantity; }
}
