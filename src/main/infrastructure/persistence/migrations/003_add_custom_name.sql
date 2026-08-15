-- إضافة حقل الاسم المخصص للأجهزة
ALTER TABLE devices ADD COLUMN custom_name TEXT DEFAULT NULL;

-- تحديث الفهرس
CREATE INDEX IF NOT EXISTS idx_devices_custom_name ON devices(custom_name);
