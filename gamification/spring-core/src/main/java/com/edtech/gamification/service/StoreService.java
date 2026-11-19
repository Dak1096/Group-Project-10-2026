package com.edtech.gamification.service;

import com.edtech.gamification.domain.*;
import com.edtech.gamification.exception.BusinessException;
import com.edtech.gamification.repository.*;
import com.edtech.gamification.web.PurchaseResponse;
import com.edtech.gamification.web.WalletView;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class StoreService {
    private final WalletRepository wallets;
    private final ItemRepository items;
    private final UserInventoryRepository inventories;
    private final XpTransactionRepository xpTransactions;

    public StoreService(WalletRepository wallets, ItemRepository items,
                        UserInventoryRepository inventories, XpTransactionRepository xpTransactions) {
        this.wallets = wallets;
        this.items = items;
        this.inventories = inventories;
        this.xpTransactions = xpTransactions;
    }

    @Transactional
    public PurchaseResponse purchase(UUID userId, String itemCode, int quantity, String idempotencyKey) {
        Item item = items.findById(itemCode).orElseThrow(() ->
                new BusinessException(HttpStatus.NOT_FOUND, "ITEM_NOT_FOUND", "Unknown item " + itemCode));
        Wallet wallet = wallets.findById(userId).orElseThrow(() ->
                new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "INSUFFICIENT_XP", "Wallet is empty"));

        // Replay cùng Idempotency-Key -> trả lại kết quả cũ, không trừ tiền lần 2
        var previous = xpTransactions.findByUserIdAndTypeAndReferenceId(userId, TxType.SPEND, idempotencyKey);
        if (previous.isPresent()) {
            int owned = inventories.findByUserIdAndItemCode(userId, itemCode).map(UserInventory::getQuantity).orElse(0);
            return new PurchaseResponse(itemCode, quantity, previous.get().getAmount(),
                    previous.get().getBalanceAfter(), owned, true);
        }

        long cost = Math.multiplyExact(item.getPrice(), (long) quantity);
        if (wallet.getBalance() < cost) {
            throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "INSUFFICIENT_XP",
                    "Need " + cost + " XP but balance is " + wallet.getBalance());
        }

        UserInventory inventory = inventories.findByUserIdAndItemCode(userId, itemCode)
                .orElseGet(() -> new UserInventory(userId, itemCode));
        if (inventory.getQuantity() + quantity > item.getMaxPerUser()) {
            throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "INVENTORY_LIMIT",
                    "Max " + item.getMaxPerUser() + " x " + itemCode + " per user");
        }

        // Điểm then chốt: UPDATE wallets ... WHERE user_id=? AND version=?  (0 dòng -> OptimisticLockingFailureException)
        wallet.debit(cost);
        wallets.saveAndFlush(wallet);

        inventory.add(quantity);
        inventories.save(inventory);

        xpTransactions.save(XpTransaction.spend(userId, cost, wallet.getBalance(), idempotencyKey,
                "Purchase " + itemCode + " x" + quantity));

        return new PurchaseResponse(itemCode, quantity, cost, wallet.getBalance(), inventory.getQuantity(), false);
    }

    @Transactional(readOnly = true)
    public WalletView getWallet(UUID userId) {
        long balance = wallets.findById(userId).map(Wallet::getBalance).orElse(0L);
        Map<String, Integer> inv = new LinkedHashMap<>();
        inventories.findByUserId(userId).forEach(i -> inv.put(i.getItemCode(), i.getQuantity()));
        return new WalletView(balance, inv);
    }
}
