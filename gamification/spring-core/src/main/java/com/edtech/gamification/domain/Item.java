package com.edtech.gamification.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "items")
public class Item {
    @Id
    private String code;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private long price;
    @Column(name = "max_per_user", nullable = false)
    private int maxPerUser;

    protected Item() {}

    public String getCode() { return code; }
    public String getName() { return name; }
    public long getPrice() { return price; }
    public int getMaxPerUser() { return maxPerUser; }
}
