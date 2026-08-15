import { showToast } from '../core/utils.js';
import { pairDevice as pairDeviceService } from '../services/deviceService.js';

export async function handlePairDevice(loadDevicesCallback) {
    const host = prompt('أدخل عنوان الاقتران (مثال: 192.168.1.10:37000)');
    if (!host) return;
    const code = prompt('أدخل رمز الاقتران المكون من 6 أرقام');
    if (!code || !/^\d{6}$/.test(code)) {
        showToast('رمز الاقتران يجب أن يكون 6 أرقام', true);
        return;
    }
    try {
        await pairDeviceService(host, code);
        showToast('تم الاقتران بنجاح! سيظهر الجهاز قريباً.');
        if (loadDevicesCallback) loadDevicesCallback();
    } catch (err) {
        showToast(`فشل الاقتران: ${err.message}`, true);
    }
}
