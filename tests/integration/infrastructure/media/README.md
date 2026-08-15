# Download Path Verification Tests

هذه الاختبارات مصممة للتحقق من مشكلة مسارات التحميل حيث لا تظهر الملفات المؤقتة والملفات النهائية في أي مجلد.

## المشكلة

مكتبة التحميل (yt-dlp-wrap-plus) تقوم بالتحميل لكن الملفات المؤقتة والملف النهائي لا يظهران في أي مجلد.

## الاختبارات

### Test 1: Verify finalOutputPath exists and is writable
- **الهدف**: التحقق من أن مسار الإخراج موجود وقابل للكتابة قبل بدء التحميل
- **الطريقة**: استخدام `fs.access()` مع `fs.constants.W_OK`
- **النتيجة المتوقعة**: نجاح التحقق من إمكانية الكتابة

### Test 2: Use absolute path in -o option
- **الهدف**: استخدام مسار مطلق في خيار `-o` بدلاً من المسار النسبي مع `cwd`
- **الطريقة**: 
  ```javascript
  const outputTemplate = path.join(finalOutputPath, '%(title)s.%(ext)s');
  const args = [
      '--ignore-config',
      '-f', formatId,
      '-o', outputTemplate,   // مسار مطلق
      '--newline',
      url
  ];
  const emitter = this._ytDlpWrap.exec(args, {}, controller.signal);
  ```
- **النتيجة المتوقعة**: يجب أن تظهر الملفات في المسار المحدد

### Test 3: Use --print after_move:filepath to get actual path
- **الهدف**: الحصول على المسار الفعلي للملف بعد نقله
- **الطريقة**: إضافة `--print after_move:filepath` للوسائط
- **النتيجة المتوقعة**: إذا ظهر المسار، فالمشكلة في `cwd`. إذا لم يظهر، فالمشكلة في yt-dlp نفسه

### Test 4: Check stderr for errors
- **الهدف**: التحقق من وجود أخطاء في stderr
- **الطريقة**: الاستماع لحدث `ytDlpEvent` مع `eventType = 'stderr'`
- **النتيجة المتوقعة**: التقاط أي أخطاء غير قاتلة قد تكتب في stderr حتى مع code 0

### Test 5: Combined verification test
- **الهدف**: تشغيل جميع التحققات معاً
- **الطريقة**: دمج جميع الخطوات السابقة في اختبار واحد
- **النتيجة المتوقعة**: فهم شامل للمشكلة

## تشغيل الاختبارات

```bash
# تشغيل جميع الاختبارات
npm test -- tests/integration/infrastructure/media/DownloadPathVerification.test.js

# تشغيل اختبار محدد
npm test -- tests/integration/infrastructure/media/DownloadPathVerification.test.js --testNamePattern="Test 1"
npm test -- tests/integration/infrastructure/media/DownloadPathVerification.test.js --testNamePattern="Test 2"
npm test -- tests/integration/infrastructure/media/DownloadPathVerification.test.js --testNamePattern="Test 3"
npm test -- tests/integration/infrastructure/media/DownloadPathVerification.test.js --testNamePattern="Test 4"
npm test -- tests/integration/infrastructure/media/DownloadPathVerification.test.js --testNamePattern="Test 5"
```

## التوصيات بناءً على الاختبارات

1. **استخدام مسار مطلق في `-o`**: بدلاً من الاعتماد على `cwd`، استخدم مساراً مطلقاً في خيار `-o`
2. **إضافة التحقق من المسار**: قبل بدء التحميل، تأكد من أن المسار موجود وقابل للكتابة
3. **استخدام `--print after_move:filepath`**: للحصول على المسار الفعلي للملف بعد نقله
4. **مراقبة stderr**: التحقق من stderr للأخطاء غير القاتلة

## الموقع

`tests/integration/infrastructure/media/DownloadPathVerification.test.js`
