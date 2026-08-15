export async function getAllDevices() {
    return await linkhub.devices.getAll();
}

export async function startStream(deviceId) {
    return await linkhub.devices.stream.start(deviceId, { fullscreen: false });
}

export async function pairDevice(host, code) {
    return await linkhub.devices.pair(host, code);
}

export async function disconnectDevice(adbTarget) {
    if (typeof linkhub.devices.disconnect !== 'function') {
        throw new Error('وظيفة قطع الاتصال غير متوفرة بعد، يرجى إضافة IPC handlers.');
    }
    return await linkhub.devices.disconnect(adbTarget);
}

export async function setDeviceFavorite(deviceId, isFavorite) {
    return await linkhub.devices.setFavorite(deviceId, isFavorite);
}

export async function setDeviceTrusted(deviceId, isTrusted) {
    return await linkhub.devices.setTrusted(deviceId, isTrusted);
}

export async function getFavoriteDevices() {
    return await linkhub.devices.getFavorites();
}

export async function getTrustedDevices() {
    return await linkhub.devices.getTrusted();
}

export async function setDeviceCustomName(deviceId, customName) {
    return await linkhub.devices.setCustomName(deviceId, customName);
}
