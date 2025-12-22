-- Migration number: 0001 	 2025-12-22T16:30:12.029Z



-- Normalization cache
CREATE TABLE IF NOT EXISTS merchant_norm_cache (
  raw_merchant TEXT PRIMARY KEY,
  normalized_merchant TEXT NOT NULL

);

-- Category cache
CREATE TABLE IF NOT EXISTS merchant_category_cache (
  merchant TEXT PRIMARY KEY,
  category TEXT NOT NULL

);

--store past runs (nice for “memory/state” demo)
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  input_text TEXT NOT NULL,
  summary_json TEXT NOT NULL
);