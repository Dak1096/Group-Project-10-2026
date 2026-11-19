package com.edtech.gamification.web;

import com.edtech.gamification.service.StoreFacade;
import com.edtech.gamification.service.StoreService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

/** X-User-Id do API Gateway gắn sau khi verify JWT (đừng bao giờ tin header này nếu service public ra ngoài). */
@RestController
@RequestMapping("/api/v1")
@Validated
public class StoreController {
    private final StoreFacade storeFacade;
    private final StoreService storeService;

    public StoreController(StoreFacade storeFacade, StoreService storeService) {
        this.storeFacade = storeFacade;
        this.storeService = storeService;
    }

    @PostMapping("/store/purchase")
    public PurchaseResponse purchase(@RequestHeader("X-User-Id") UUID userId,
                                     @RequestHeader("Idempotency-Key") @NotBlank @Size(max = 100) String idempotencyKey,
                                     @Valid @RequestBody PurchaseRequest request) {
        return storeFacade.purchase(userId, request.itemCode(), request.quantity(), idempotencyKey);
    }

    @GetMapping("/wallet")
    public WalletView wallet(@RequestHeader("X-User-Id") UUID userId) {
        return storeService.getWallet(userId);
    }
}
