let selectedDeviceIds = new Set();

export function getSelectedDeviceIds() {
    return new Set(selectedDeviceIds);
}

export function addSelectedDevice(deviceId) {
    selectedDeviceIds.add(deviceId);
}

export function removeSelectedDevice(deviceId) {
    selectedDeviceIds.delete(deviceId);
}

export function toggleSelectedDevice(deviceId) {
    if (selectedDeviceIds.has(deviceId)) {
        selectedDeviceIds.delete(deviceId);
        return false;
    } else {
        selectedDeviceIds.add(deviceId);
        return true;
    }
}

export function clearSelected() {
    selectedDeviceIds.clear();
}

export function updateElementSelection(element, deviceId, isSelected) {
    if (isSelected) element.classList.add('selected');
    else element.classList.remove('selected');
}
