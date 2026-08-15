-- إضافة حقل updated_at لجدول downloads
ALTER TABLE downloads ADD COLUMN updated_at TEXT;

-- تحديث الصفوف الموجودة بقيمة افتراضية
UPDATE downloads SET updated_at = datetime('now') WHERE updated_at IS NULL;
