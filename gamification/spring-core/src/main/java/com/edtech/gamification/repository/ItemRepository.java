package com.edtech.gamification.repository;

import com.edtech.gamification.domain.Item;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, String> {}
