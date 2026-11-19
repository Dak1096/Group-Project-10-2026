package com.edtech.gamification.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record PurchaseRequest(@NotBlank String itemCode, @Min(1) @Max(5) int quantity) {}
