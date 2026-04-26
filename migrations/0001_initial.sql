CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  device_label TEXT NOT NULL,
  paired_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);

CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_studied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_decks_owner_updated ON decks(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_decks_owner_name ON decks(owner_id, name);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  phonetic TEXT NOT NULL DEFAULT '',
  example_text TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  scheduling_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_owner_updated ON cards(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_owner_deck ON cards(owner_id, deck_id);

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  rating INTEGER NOT NULL,
  before_json TEXT,
  after_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_logs_owner_reviewed ON review_logs(owner_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_logs_owner_deck ON review_logs(owner_id, deck_id);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  deck_scope TEXT NOT NULL DEFAULT 'all',
  selected_deck_ids_json TEXT NOT NULL DEFAULT '[]',
  queue_counts_json TEXT NOT NULL DEFAULT '{"review":0,"new":0}',
  cards_json TEXT NOT NULL DEFAULT '[]',
  current_index INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  revisit_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_owner_active ON study_sessions(owner_id, mode, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS pair_codes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  source_device_id TEXT NOT NULL,
  device_label TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pair_codes_owner_active ON pair_codes(owner_id, used_at, expires_at);

CREATE TABLE IF NOT EXISTS confusion_groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  source_card_id TEXT NOT NULL,
  source TEXT NOT NULL,
  target_card_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_confusion_groups_owner_source ON confusion_groups(owner_id, source_card_id, source);
