package com.edtech.gamification.web;

import java.util.Map;

public record WalletView(long balance, Map<String, Integer> inventory) {}
