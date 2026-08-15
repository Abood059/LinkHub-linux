import { showToast } from '../core/utils.js';
import { inspectUrl, startDownload, resumeDownload } from '../services/downloadService.js';
import { addDownloadRow } from '../ui/downloadManager.js';
import { getAllDevices } from '../services/deviceService.js';

let registeredDevices = [];
let currentInspectionData = null;
let currentUrl = null;

/**
 */
function resetButtonState(buttonElement) {
    if (buttonElement) {
        buttonElement.textContent = 'Start Download';
        buttonElement.disabled = false;
        buttonElement.style.opacity = '1';
        buttonElement.style.cursor = 'pointer';
    }
}

export function setRegisteredDevicesGetter(getterFn) {
    registeredDevices = getterFn;
}

/**
 */
export async function handleUrlInspection(url, urlInputElement, buttonElement) {
    console.log('[startRouteHandler] === Starting URL inspection ===');
    console.log('[startRouteHandler] Input URL:', url);
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
        console.log('[startRouteHandler] Error: URL is empty');
        showToast('Please enter a media URL', true);
        return false;
    }

    if (buttonElement) {
        console.log('[startRouteHandler] Changing button state to "Inspecting URL..."');
        buttonElement.textContent = 'Inspecting URL...';
        buttonElement.disabled = true;
        buttonElement.style.opacity = '0.6';
        buttonElement.style.cursor = 'not-allowed';
    }

    let inspection;
    try {
        console.log('[startRouteHandler] Calling inspectUrl for URL:', trimmedUrl);
        inspection = await inspectUrl(trimmedUrl);
        console.log('[startRouteHandler] URL inspection result:', inspection ? 'success' : 'failed');
        if (!inspection || !inspection.formats || inspection.formats.length === 0) {
            console.log('[startRouteHandler] Error: No formats available');
            showToast('No formats available for download from this URL.', true);
            resetButtonState(buttonElement);
            return false;
        }
    } catch (err) {
        console.log('[startRouteHandler] Error inspecting URL:', err.message);
        showToast(`URL inspection failed: ${err.message}`, true);
        resetButtonState(buttonElement);
        return false;
    }

    currentInspectionData = inspection;
    currentUrl = trimmedUrl;

    let connectedDevices = [];
    try {
        const devicesList = await getAllDevices();

        if (devicesList && devicesList.length > 0) {
            devicesList.forEach(deviceData => {
                const isConnected = deviceData.runtimeState && deviceData.runtimeState.status === 'connected';
                if (isConnected) {
                    connectedDevices.push({
                        id: deviceData.device.id,
                        name: deviceData.device.deviceFriendlyName || deviceData.device.model || deviceData.device.id,
                        connected: true
                    });
                }
            });
        }
    } catch (err) {
        console.error('[startRouteHandler] Failed to get devices:', err);
    }

    const { showFormatSelectionModal, onFormatSelected } = await import('../ui/formatSelectionModal.js');
    showFormatSelectionModal(inspection, connectedDevices);

    onFormatSelected(async ({ videoFormatId, audioFormatId, deviceIds }) => {
        console.log('[startRouteHandler] === User quality selection ===');
        console.log('[startRouteHandler] videoFormatId:', videoFormatId);
        console.log('[startRouteHandler] audioFormatId:', audioFormatId);
        console.log('[startRouteHandler] deviceIds:', deviceIds);
        await handleDownloadStart(trimmedUrl, videoFormatId, audioFormatId, deviceIds, urlInputElement, buttonElement, inspection);
    });

    resetButtonState(buttonElement);

    return true;
}

/**
 */
export async function handleDownloadStart(url, videoFormatId, audioFormatId, deviceIds, urlInputElement, buttonElement, inspectionData) {
    console.log('[startRouteHandler] === Starting download ===');
    console.log('[startRouteHandler] url:', url);
    console.log('[startRouteHandler] videoFormatId:', videoFormatId);
    console.log('[startRouteHandler] audioFormatId:', audioFormatId);
    console.log('[startRouteHandler] deviceIds:', deviceIds);
    const title = inspectionData?.title || 'Unknown Video';
    console.log('[startRouteHandler] title:', title);

    let deviceName = 'Local device';
    let primaryDeviceId = null;

    if (deviceIds && deviceIds.length > 0) {
        primaryDeviceId = deviceIds[0];
        if (deviceIds.length === 1) {
            const devicesList = (typeof registeredDevices === 'function') ? registeredDevices() : registeredDevices;
            const deviceData = devicesList?.find(d => d.device.id === primaryDeviceId);
            if (deviceData) {
                deviceName = deviceData.device.deviceFriendlyName || deviceData.device.model || primaryDeviceId;
            }
        } else {
            deviceName = 'Multiple devices';
        }
    }

    try {
        let formatId;
        if (videoFormatId && audioFormatId) {
            formatId = `${videoFormatId}+${audioFormatId}`;
        } else if (videoFormatId) {
            formatId = videoFormatId;
        } else if (audioFormatId) {
            formatId = audioFormatId;
        } else {
            console.log('[startRouteHandler] Error: Must select at least one quality');
            throw new Error('Must select at least one quality');
        }
        console.log('[startRouteHandler] Final formatId:', formatId);

        if (buttonElement) {
            buttonElement.textContent = 'Starting download';
            buttonElement.disabled = true;
            buttonElement.style.opacity = '0.6';
            buttonElement.style.cursor = 'not-allowed';
        }

        console.log('[startRouteHandler] Calling startDownload IPC');
        console.log('[startRouteHandler] Data sent:', { url, formatId, deviceIds, title });
        const result = await startDownload(url, formatId, deviceIds, { title, formatsData: inspectionData });
        console.log('[startRouteHandler] startDownload result:', result);

        if (result.existing) {
            console.log('[startRouteHandler] Download already exists');
            console.log('[startRouteHandler] Existing download status:', result.status);
            if (result.status === 'stopped' || result.status === 'pending' ||
                result.status === 'cancelled' || result.status === 'failed') {
                console.log('[startRouteHandler] Auto-resuming existing download');
                console.log('[startRouteHandler] downloadId:', result.downloadId);
                resetButtonState(buttonElement);
                showToast('Download already exists, resuming...', false);
                await resumeDownload(result.downloadId, url, formatId, deviceIds, { title, formatsData: inspectionData });
                return;
            }
            else if (result.status === 'downloading' || result.status === 'in_progress') {
                console.log('[startRouteHandler] Download already in progress');
                resetButtonState(buttonElement);
                showToast('Download already in progress', false);
                return;
            }
            else if (result.status === 'completed') {
                console.log('[startRouteHandler] Download already completed');
                resetButtonState(buttonElement);
                showToast('Download already completed', false);
                return;
            }
        }

        const downloadId = result.processId;
        console.log('[startRouteHandler] downloadId:', downloadId);


        if (urlInputElement) urlInputElement.value = '';
    } catch (err) {
        showToast(`Download failed: ${err.message}`, true);
        resetButtonState(buttonElement);
    }
}

/**
 */
export async function handleStartRoute(url, urlInputElement, buttonElement) {
    return handleUrlInspection(url, urlInputElement, buttonElement);
}
