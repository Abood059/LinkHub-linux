-- إضافة حقل failed_at لجدول downloads
ALTER TABLE downloads ADD COLUMN failed_at TEXT;

-- تحديث الصفوف الموجودة بقيمة افتراضية (NULL)
-- لا نحتاج لتحديث الصفوف الموجودة لأن failed_at يجب أن يكون NULL للتحميلات الناجحة
