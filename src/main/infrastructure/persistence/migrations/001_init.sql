-- جدول الأجهزة
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    device_friendly_name TEXT NOT NULL,
    model TEXT DEFAULT 'Unknown',
    version TEXT DEFAULT 'Unknown',
    arch TEXT DEFAULT 'Unknown',
    video_transferred INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    is_trusted INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- جدول التحميلات
CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    url TEXT NOT NULL,
    title TEXT,
    format_id TEXT NOT NULL,
    output_path TEXT,
    final_output_path TEXT,
    status TEXT DEFAULT 'pending',
    total_size INTEGER DEFAULT 0,
    downloaded_bytes INTEGER,
    percent REAL DEFAULT 0,
    speed REAL DEFAULT 0,
    eta INTEGER,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    exit_code INTEGER,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

-- جدول الإعدادات (غير مدمج حالياً)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_devices_favorite ON devices(is_favorite);
CREATE INDEX IF NOT EXISTS idx_devices_trusted ON devices(is_trusted);
CREATE INDEX IF NOT EXISTS idx_downloads_device ON downloads(device_id);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC);
