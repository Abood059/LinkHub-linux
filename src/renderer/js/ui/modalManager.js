import { startStream, disconnectDevice, setDeviceCustomName, setDeviceFavorite } from '../services/deviceService.js';
import { showToast } from '../core/utils.js';
import { loadDevices } from '../main.js';

let modalElement = null;
let currentDevice = null;

let modalClose, modalOverlay, modalDeviceName, modalDeviceModel, modalDeviceVersion, modalDeviceArch, modalDeviceStatus, modalDeviceAdb, modalStreamBtn, modalDisconnectBtn, modalCustomNameInput, modalSaveNameBtn, modalFavoriteStar, modalCustomNameDisplay, modalEditNameBtn;

export function initModal(modalDom, closeBtn, overlay, nameEl, modelEl, versionEl, archEl, statusEl, adbEl, streamBtn, disconnectBtn, customNameInput = null, saveNameBtn = null) {
    modalElement = modalDom;
    modalClose = closeBtn;
    modalOverlay = overlay;
    modalDeviceName = nameEl;
    modalDeviceModel = modelEl;
    modalDeviceVersion = versionEl;
    modalDeviceArch = archEl;
    modalDeviceStatus = statusEl;
    modalDeviceAdb = adbEl;
    modalStreamBtn = streamBtn;
    modalDisconnectBtn = disconnectBtn;
    modalCustomNameInput = customNameInput;
    modalSaveNameBtn = saveNameBtn;

    modalFavoriteStar = document.getElementById('modal-favorite-star');
    modalCustomNameDisplay = document.getElementById('modal-custom-name-display');
    modalEditNameBtn = document.getElementById('modal-edit-name-btn');

    modalClose.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', hideModal);
    modalStreamBtn.addEventListener('click', onStreamClick);
    modalDisconnectBtn.addEventListener('click', onDisconnectClick);

    if (modalSaveNameBtn && modalCustomNameInput) {
        modalSaveNameBtn.addEventListener('click', onSaveNameClick);
    }

    if (modalFavoriteStar) {
        modalFavoriteStar.addEventListener('click', onFavoriteClick);
    }

    if (modalEditNameBtn) {
        modalEditNameBtn.addEventListener('click', onEditNameClick);
    }

    if (modalCustomNameInput) {
        modalCustomNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') onSaveNameClick();
        });
    }
}

export function showDeviceModal(deviceData) {
    const device = deviceData.device;
    const runtime = deviceData.runtimeState || {};
    const status = runtime.status || 'offline';
    const adbTarget = runtime.adbTarget || device.id;
    const isFavorite = device.isFavorite || false;

    currentDevice = { device, runtime, deviceData };

    // Debug: Send device data to main process terminal
    if (typeof linkhub !== 'undefined' && linkhub.debug && linkhub.debug.logDeviceData) {
        linkhub.debug.logDeviceData(deviceData);
    }

    modalDeviceName.textContent = device.customName || device.deviceFriendlyName || device.model || device.id;
    modalDeviceModel.textContent = (device.model && device.model !== 'Unknown') ? device.model : 'غير معروف';
    modalDeviceVersion.textContent = (device.version && device.version !== 'Unknown') ? device.version : 'غير معروف';
    modalDeviceArch.textContent = (device.arch && device.arch !== 'Unknown') ? device.arch : 'غير معروف';
    modalDeviceAdb.textContent = adbTarget;

    if (modalCustomNameInput) {
        modalCustomNameInput.value = device.customName || '';
    }
    if (modalCustomNameDisplay) {
        modalCustomNameDisplay.textContent = device.customName || 'غير محدد';
    }

    resetCustomNameDisplay();

    if (modalFavoriteStar) {
        updateFavoriteStar(isFavorite);
    }

    let statusText = '', statusClass = '';
    if (status === 'connected') { statusText = 'متصل'; statusClass = 'connected'; }
    else if (status === 'offline') { statusText = 'غير متصل'; statusClass = 'offline'; }
    else if (status === 'discovered') { statusText = 'مكتشف'; statusClass = 'discovered'; }
    else { statusText = status; statusClass = ''; }
    modalDeviceStatus.textContent = statusText;
    modalDeviceStatus.className = `detail-value status-badge-modal ${statusClass}`;

    const isConnected = status === 'connected';
    modalStreamBtn.disabled = !isConnected;
    modalStreamBtn.style.opacity = isConnected ? '1' : '0.5';
    modalStreamBtn.style.cursor = isConnected ? 'pointer' : 'not-allowed';

    modalDisconnectBtn.disabled = !isConnected;
    modalDisconnectBtn.style.opacity = isConnected ? '1' : '0.5';
    modalDisconnectBtn.style.cursor = isConnected ? 'pointer' : 'not-allowed';

    modalElement.style.display = 'flex';
}

export function hideModal() {
    if (modalElement) modalElement.style.display = 'none';
    currentDevice = null;
}

async function onStreamClick() {
    if (!currentDevice) return;
    const deviceId = currentDevice.device.id;
    const status = currentDevice.runtime.status;
    if (status !== 'connected') {
        showToast('الجهاز غير متصل حالياً', true);
        return;
    }
    try {
        await startStream(deviceId);
        showToast(`بدأ بث الشاشة للجهاز ${currentDevice.device.deviceFriendlyName}`);
        hideModal();
    } catch (err) {
        showToast(`فشل بدء البث: ${err.message}`, true);
    }
}

async function onDisconnectClick() {
    if (!currentDevice) return;
    const adbTarget = currentDevice.runtime.adbTarget || currentDevice.device.id;
    try {
        await disconnectDevice(adbTarget);
        showToast(`تم قطع الاتصال عن الجهاز`);

        modalStreamBtn.disabled = true;
        modalDisconnectBtn.disabled = true;
        modalDeviceStatus.textContent = 'غير متصل';
        modalDeviceStatus.className = 'detail-value status-badge-modal offline';

        hideModal();
        setTimeout(() => {
            if (typeof loadDevices === 'function') loadDevices();
        }, 1000);
    } catch (err) {
        showToast(`فشل قطع الاتصال: ${err.message}`, true);
    }
}

async function onSaveNameClick() {
    if (!currentDevice || !modalCustomNameInput) return;
    const deviceId = currentDevice.device.id;
    const customName = modalCustomNameInput.value.trim();
    const isFavorite = currentDevice.device.isFavorite || false;

    if (customName && !isFavorite) {
        showToast('يمكن تعيين اسم مخصص للأجهزة المفضلة فقط', true);
        return;
    }

    try {
        await setDeviceCustomName(deviceId, customName);
        showToast(customName ? 'تم حفظ الاسم المخصص' : 'تم إزالة الاسم المخصص');

        if (modalCustomNameDisplay) {
            modalCustomNameDisplay.textContent = customName || 'غير محدد';
        }

        if (customName) {
            modalDeviceName.textContent = customName;
        } else {
            modalDeviceName.textContent = currentDevice.device.deviceFriendlyName || currentDevice.device.model || currentDevice.device.id;
        }

        resetCustomNameDisplay();

        setTimeout(() => {
            if (typeof loadDevices === 'function') loadDevices();
        }, 500);
    } catch (err) {
        showToast(`فشل حفظ الاسم المخصص: ${err.message}`, true);
    }
}

function resetCustomNameDisplay() {
    if (modalCustomNameDisplay) {
        modalCustomNameDisplay.style.display = 'inline';
    }
    if (modalEditNameBtn) {
        modalEditNameBtn.style.display = 'inline-flex';
    }
    if (modalCustomNameInput) {
        modalCustomNameInput.style.display = 'none';
    }
    if (modalSaveNameBtn) {
        modalSaveNameBtn.style.display = 'none';
    }
}

function onEditNameClick() {
    if (!currentDevice) return;
    const isFavorite = currentDevice.device.isFavorite || false;

    if (!isFavorite) {
        showToast('يمكن تعيين اسم مخصص للأجهزة المفضلة فقط', true);
        return;
    }

    if (modalCustomNameDisplay) {
        modalCustomNameDisplay.style.display = 'none';
    }
    if (modalEditNameBtn) {
        modalEditNameBtn.style.display = 'none';
    }
    if (modalCustomNameInput) {
        modalCustomNameInput.style.display = 'inline-block';
        modalCustomNameInput.value = currentDevice.device.customName || '';
        modalCustomNameInput.focus();
    }
    if (modalSaveNameBtn) {
        modalSaveNameBtn.style.display = 'inline-flex';
    }
}

function enableCustomNameInput() {
    if (modalCustomNameDisplay) {
        modalCustomNameDisplay.style.display = 'none';
    }
    if (modalEditNameBtn) {
        modalEditNameBtn.style.display = 'none';
    }
    if (modalCustomNameInput) {
        modalCustomNameInput.style.display = 'inline-block';
        modalCustomNameInput.value = currentDevice.device.customName || '';
        modalCustomNameInput.focus();
    }
    if (modalSaveNameBtn) {
        modalSaveNameBtn.style.display = 'inline-flex';
    }
}

function updateFavoriteStar(isFavorite) {
    if (!modalFavoriteStar) return;
    if (isFavorite) {
        modalFavoriteStar.classList.add('active');
        modalFavoriteStar.title = 'إزالة من المفضلة';
    } else {
        modalFavoriteStar.classList.remove('active');
        modalFavoriteStar.title = 'إضافة للمفضلة';
    }
}

async function onFavoriteClick() {
    if (!currentDevice || !modalFavoriteStar) return;
    const deviceId = currentDevice.device.id;
    const isFavorite = currentDevice.device.isFavorite || false;
    const newFavoriteState = !isFavorite;

    try {
        await setDeviceFavorite(deviceId, newFavoriteState);
        updateFavoriteStar(newFavoriteState);

        currentDevice.device.isFavorite = newFavoriteState;

        showToast(newFavoriteState ? 'تمت إضافة الجهاز للمفضلة' : 'تمت إزالة الجهاز من المفضلة');

        if (newFavoriteState) {
            enableCustomNameInput();
        } else {
            if (currentDevice.device.customName) {
                try {
                    await setDeviceCustomName(deviceId, '');
                    if (modalCustomNameDisplay) {
                        modalCustomNameDisplay.textContent = 'غير محدد';
                    }
                    if (modalCustomNameInput) {
                        modalCustomNameInput.value = '';
                    }
                    modalDeviceName.textContent = currentDevice.device.deviceFriendlyName || currentDevice.device.model || currentDevice.device.id;
                    currentDevice.device.customName = '';
                    showToast('تم مسح الاسم المخصص');
                } catch (err) {
                    showToast(`فشل مسح الاسم المخصص: ${err.message}`, true);
                }
            }
            resetCustomNameDisplay();
        }

        setTimeout(() => {
            if (typeof loadDevices === 'function') loadDevices();
        }, 500);
    } catch (err) {
        showToast(`فشل تحديث المفضلة: ${err.message}`, true);
    }
}
