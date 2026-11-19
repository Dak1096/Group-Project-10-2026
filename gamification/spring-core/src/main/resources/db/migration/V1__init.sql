CREATE TABLE wallets (
  user_id    uuid PRIMARY KEY,
  balance    bigint      NOT NULL DEFAULT 0 CHECK (balance >= 0),   -- lưới an toàn cuối cùng ở tầng DB
  version    bigint      NOT NULL DEFAULT 0,                        -- optimistic lock
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE xp_transactions (
  id            uuid PRIMARY KEY,
  user_id       uuid         NOT NULL,
  type          varchar(16)  NOT NULL,                  -- EARN | SPEND
  amount        bigint       NOT NULL CHECK (amount > 0),
  balance_after bigint       NOT NULL,
  reference_id  varchar(100) NOT NULL,                  -- EARN: eventId | SPEND: Idempotency-Key
  description   varchar(255),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_xp_tx_ref UNIQUE (user_id, type, reference_id)   -- chốt chặn idempotency lớp 2
);
CREATE INDEX idx_xp_tx_user_created ON xp_transactions (user_id, created_at DESC);

CREATE TABLE processed_events (
  event_id     uuid PRIMARY KEY,                        -- chốt chặn idempotency lớp 1
  event_type   varchar(100) NOT NULL,
  processed_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE user_streaks (
  user_id            uuid PRIMARY KEY,
  current_streak     int    NOT NULL DEFAULT 0,
  last_activity_date date,
  version            bigint NOT NULL DEFAULT 0
);

CREATE TABLE items (
  code         varchar(50) PRIMARY KEY,
  name         varchar(100) NOT NULL,
  price        bigint NOT NULL CHECK (price > 0),
  max_per_user int    NOT NULL CHECK (max_per_user > 0)
);
INSERT INTO items (code, name, price, max_per_user) VALUES ('STREAK_FREEZE', 'Streak Freeze', 200, 2);

CREATE TABLE user_inventory (
  id        uuid PRIMARY KEY,
  user_id   uuid        NOT NULL,
  item_code varchar(50) NOT NULL REFERENCES items (code),
  quantity  int         NOT NULL CHECK (quantity >= 0),
  version   bigint      NOT NULL DEFAULT 0,
  CONSTRAINT uq_inventory_user_item UNIQUE (user_id, item_code)
);
