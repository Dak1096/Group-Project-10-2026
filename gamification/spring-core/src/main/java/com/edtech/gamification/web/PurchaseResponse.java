package com.edtech.gamification.web;

public record PurchaseResponse(String itemCode, int quantity, long spentXp, long balanceAfter,
                               int ownedAfter, boolean replayed) {}
