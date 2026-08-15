import { DOM_IDS } from './core/constants.js';
import { showToast } from './core/utils.js';
import { getAllDevices } from './services/deviceService.js';
import { setupEventListeners } from './services/eventService.js';
import { initDownloadTable, initRecentDownloadsTable, addDownloadRow, updateDownloadProgress, markDownloadComplete, markDownloadError, markDownloadRetrying, markDownloadStopped, updateTransferStatus, markTransferComplete, markTransferError, showTransferButton, syncStopButtonState, renderDownloadHistory, stopAllDownloads, resumeAllDownloads, updateShareButtonState } from './ui/downloadManager.js';
import { renderDevices, setShowModalCallback } from './ui/deviceManager.js';
import { initModal, showDeviceModal } from './ui/modalManager.js';
import { initTabs, switchTab } from './ui/tabManager.js';
import { getSelectedDeviceIds, clearSelected } from './ui/selectionManager.js';
import { handleStartRoute, setRegisteredDevicesGetter } from './handlers/startRouteHandler.js';
import { handlePairDevice } from './handlers/pairHandler.js';
import { handleFileShare } from './handlers/fileShareHandler.js';
import { initFormatSelectionModal, resetStartButtonState } from './ui/formatSelectionModal.js';
import { initShareModal, updateDeviceTransferStatus, updateAllDevicesStatus } from './ui/shareModal.js';
import { initDeviceSelectionModal } from './ui/deviceSelectionModal.js';
import { initTransferProgressManager, addTransfer, updateTransferProgress, completeTransfer, failTransfer } from './managers/TransferProgressManager.js';
import { loadDownloadHistory } from './services/downloadService.js';
import { initNavbar } from './ui/navbarManager.js';

let registeredDevices = [];

const navItems = document.querySelectorAll(DOM_IDS.navItems);
const sections = {
    home: document.getElementById(DOM_IDS.homeSection),
    downloads: document.getElementById(DOM_IDS.downloadsSection),
    settings: document.getElementById(DOM_IDS.settingsSection)
};
const favoriteContainer = document.getElementById(DOM_IDS.favoriteContainer);
const nonFavoriteContainer = document.getElementById(DOM_IDS.nonFavoriteContainer);
const downloadsTbody = document.getElementById(DOM_IDS.downloadsTbody);
const recentDownloadsTbody = document.getElementById(DOM_IDS.recentDownloadsTbody);
const btnStart = document.getElementById(DOM_IDS.btnStart);
const urlInput = document.getElementById(DOM_IDS.mediaUrl);
const btnStartDownloads = document.getElementById(DOM_IDS.btnStartDownloads);
const urlInputDownloads = document.getElementById(DOM_IDS.mediaUrlDownloads);
const refreshBtn = document.getElementById(DOM_IDS.refreshDevices);
const pairBtn = document.getElementById(DOM_IDS.pairDevice);

// Initialize responsive navbar
initNavbar();

const modal = document.getElementById(DOM_IDS.deviceModal);
const modalClose = document.querySelector(DOM_IDS.modalClose);
const modalOverlay = document.querySelector(DOM_IDS.modalOverlay);
const modalDeviceName = document.getElementById(DOM_IDS.modalDeviceName);
const modalDeviceModel = document.getElementById(DOM_IDS.modalDeviceModel);
const modalDeviceVersion = document.getElementById(DOM_IDS.modalDeviceVersion);
const modalDeviceArch = document.getElementById(DOM_IDS.modalDeviceArch);
const modalDeviceStatus = document.getElementById(DOM_IDS.modalDeviceStatus);
const modalDeviceAdb = document.getElementById(DOM_IDS.modalDeviceAdb);
const modalStreamBtn = document.getElementById(DOM_IDS.modalStreamBtn);
const modalDisconnectBtn = document.getElementById(DOM_IDS.modalDisconnectBtn);
const modalCustomNameInput = document.getElementById('modal-device-custom-name');
const modalSaveNameBtn = document.getElementById('modal-save-name-btn');

initModal(modal, modalClose, modalOverlay, modalDeviceName, modalDeviceModel, modalDeviceVersion, modalDeviceArch, modalDeviceStatus, modalDeviceAdb, modalStreamBtn, modalDisconnectBtn, modalCustomNameInput, modalSaveNameBtn);
setShowModalCallback(showDeviceModal);

initDownloadTable(downloadsTbody);

if (recentDownloadsTbody) {
    initRecentDownloadsTable(recentDownloadsTbody);
}

initFormatSelectionModal();

initShareModal();

initDeviceSelectionModal();

initTransferProgressManager();

setRegisteredDevicesGetter(() => registeredDevices);

export async function loadDevices() {
    try {
        const devices = await getAllDevices();
        registeredDevices = devices;
        renderDevices(registeredDevices, favoriteContainer, nonFavoriteContainer);
    } catch (err) {
        if (favoriteContainer) favoriteContainer.innerHTML = '<div class="placeholder-text">خطأ في تحميل الأجهزة</div>';
    }
}

export async function loadDownloads() {
    try {
        const history = await loadDownloadHistory();
        await renderDownloadHistory(history);
    } catch (err) {
        console.error('[main] Failed to load download history:', err);
        if (downloadsTbody) {
            downloadsTbody.innerHTML = '<tr class="empty-row"><td colspan="7" style="text-align:center;">خطأ في تحميل سجل التحميلات</td></tr>';
        }
    }
}

setupEventListeners({
    onProgress: (downloadId, percent, speed, size, totalSize, downloadedBytes) => updateDownloadProgress(downloadId, percent, speed, size, totalSize, downloadedBytes),
    onRetrying: (downloadId, retryCount, maxRetries) => markDownloadRetrying(downloadId, retryCount, maxRetries),
    onComplete: (downloadId) => markDownloadComplete(downloadId),
    onError: (downloadId, error) => markDownloadError(downloadId, error),
    onStopped: (downloadId, data) => {
        markDownloadStopped(downloadId, data);
        if (data && downloadsTbody) {
            const row = downloadsTbody.querySelector(`tr[data-download-id="${downloadId}"]`);
            if (row && data.formatId) {
                row.setAttribute('data-format-id', data.formatId);
            }
            if (row && data.deviceId) {
                row.setAttribute('data-device-id', data.deviceId);
            }
            if (row && data.title) {
                row.setAttribute('data-title', data.title);
            }
            if (row && data.deviceIds) {
                row.setAttribute('data-device-ids', JSON.stringify(data.deviceIds));
            }
        }
        showToast('تم إيقاف التحميل');
    },
    onResumed: (downloadId) => {
        syncStopButtonState(downloadId, 'إيقاف', 'active', '#D32F2F', false);
    },
    onDownloadStarted: async (downloadId, url, title, formatId, deviceIds) => {
        if (downloadsTbody) {
            const existingRow = downloadsTbody.querySelector(`tr[data-download-id="${downloadId}"]`);
            if (existingRow) {
                return;
            }
        }

        const fileName = title || (() => {
            try {
                const urlObj = new URL(url);
                return urlObj.pathname.split('/').pop() || 'media_' + downloadId;
            } catch (e) {
                return 'media_' + downloadId;
            }
        })();

        let deviceName = 'الجهاز المحلي';
        let primaryDeviceId = null;

        if (deviceIds && deviceIds.length > 0) {
            primaryDeviceId = deviceIds[0];
            if (deviceIds.length === 1) {
                try {
                    const devices = await getAllDevices();
                    const device = devices.find(d => d.device.id === primaryDeviceId);
                    if (device) {
                        deviceName = device.device.deviceFriendlyName || device.device.model || primaryDeviceId;
                    }
                } catch (e) {
                    console.error('[main] Failed to get device name:', e);
                }
            } else {
                deviceName = 'عدة أجهزة';
            }
        }

        addDownloadRow(downloadId, fileName, deviceName, url, formatId, primaryDeviceId, title, deviceIds);

        syncStopButtonState(downloadId, 'إيقاف', 'active', '#D32F2F', false);

        if (btnStart) {
            btnStart.textContent = 'بدأ التحميل';
            btnStart.disabled = false;
            btnStart.style.opacity = '1';
            btnStart.style.cursor = 'pointer';
        }
        if (btnStartDownloads) {
            btnStartDownloads.textContent = 'بدأ التحميل';
            btnStartDownloads.disabled = false;
            btnStartDownloads.style.opacity = '1';
            btnStartDownloads.style.cursor = 'pointer';
        }
        resetStartButtonState();
    },
    onDeviceStateChanged: () => loadDevices(),
    onDevicePaired: () => loadDevices(),
    onDeviceRemoved: () => loadDevices(),
    onTransferProgress: (downloadId, percent) => updateTransferStatus(downloadId, `جاري النقل ${percent}%`),
    onTransferComplete: (downloadId, message) => markTransferComplete(downloadId, message),
    onTransferError: (downloadId, error) => markTransferError(downloadId, error),
    onDeviceTransferProgress: (downloadId, deviceId, percent) => updateDeviceTransferStatus(deviceId, 'transferring', percent),
    onDeviceTransferComplete: (downloadId, deviceId) => updateDeviceTransferStatus(deviceId, 'completed', 1),
    onDeviceTransferError: (downloadId, deviceId) => updateDeviceTransferStatus(deviceId, 'failed', 0),
    onDownloadStatusChanged: (downloadId, status) => updateAllDevicesStatus(status)
});

window.linkhub.on('transfer:started', (event, data) => {
    addTransfer(data.transferId, data.fileName, data.deviceIds);
});

window.linkhub.on('transfer:progress', (event, data) => {
    updateTransferProgress(data.transferId, data.progress);
});

window.linkhub.on('transfer:completed', (event, data) => {
    completeTransfer(data.transferId);
});

window.linkhub.on('transfer:failed', (event, data) => {
    failTransfer(data.transferId, data.error);
});

initTabs(navItems, sections);
switchTab('home', navItems, sections);

btnStart.addEventListener('click', async () => {
    const url = urlInput.value;
    const success = await handleStartRoute(url, urlInput, btnStart);
    if (success) urlInput.focus();
});

if (btnStartDownloads && urlInputDownloads) {
    btnStartDownloads.addEventListener('click', async () => {
        const url = urlInputDownloads.value;
        const success = await handleStartRoute(url, urlInputDownloads, btnStartDownloads);
        if (success) urlInputDownloads.focus();
    });
}

if (refreshBtn) refreshBtn.addEventListener('click', () => loadDevices());
if (pairBtn) pairBtn.addEventListener('click', () => handlePairDevice(loadDevices));

const btnStopAll = document.getElementById('btn-stop-all-downloads');
const btnResumeAll = document.getElementById('btn-resume-all-downloads');
const btnStopAllHome = document.getElementById('btn-stop-all-downloads-home');
const btnResumeAllHome = document.getElementById('btn-resume-all-downloads-home');

if (btnStopAll) {
    btnStopAll.addEventListener('click', async () => {
        if (confirm('هل تريد إيقاف جميع التحميلات النشطة؟')) {
            await stopAllDownloads();
        }
    });
}

if (btnResumeAll) {
    btnResumeAll.addEventListener('click', async () => {
        if (confirm('هل تريد استئناف جميع التحميلات المتوقفة/الفاشلة؟')) {
            await resumeAllDownloads();
        }
    });
}

if (btnStopAllHome) {
    btnStopAllHome.addEventListener('click', async () => {
        if (confirm('هل تريد إيقاف جميع التحميلات النشطة؟')) {
            await stopAllDownloads();
        }
    });
}

if (btnResumeAllHome) {
    btnResumeAllHome.addEventListener('click', async () => {
        if (confirm('هل تريد استئناف جميع التحميلات المتوقفة/الفاشلة؟')) {
            await resumeAllDownloads();
        }
    });
}

const fabShareFiles = document.getElementById('fab-share-files');
if (fabShareFiles) {
    fabShareFiles.addEventListener('click', handleFileShare);
}

loadDevices();
loadDownloads();
