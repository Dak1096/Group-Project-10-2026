CREATE TABLE IF NOT EXISTS lesson_attempts (
  id                uuid PRIMARY KEY,
  user_id           uuid        NOT NULL,
  lesson_id         uuid        NOT NULL,
  client_request_id uuid        NOT NULL,           -- client retry -> không tạo bài làm trùng
  correct_answers   int         NOT NULL CHECK (correct_answers >= 0),
  total_questions   int         NOT NULL CHECK (total_questions > 0),
  duration_sec      int,
  completed_at      timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_attempt_client_req UNIQUE (user_id, client_request_id),
  CONSTRAINT ck_correct_le_total CHECK (correct_answers <= total_questions)
);

-- Transactional Outbox: ghi cùng transaction với lesson_attempts
CREATE TABLE IF NOT EXISTS outbox_events (
  id              uuid PRIMARY KEY,                  -- chính là eventId gửi sang consumer
  aggregate_id    uuid        NOT NULL,
  event_type      text        NOT NULL,
  routing_key     text        NOT NULL,
  payload         jsonb       NOT NULL,
  attempts        int         NOT NULL DEFAULT 0,
  last_error      text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox_events (next_attempt_at, created_at) WHERE published_at IS NULL;
