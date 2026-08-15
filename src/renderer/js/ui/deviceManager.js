import { escapeHtml } from '../core/utils.js';
import { showToast } from '../core/utils.js';
import { startStream } from '../services/deviceService.js';
import { getSelectedDeviceIds, toggleSelectedDevice, updateElementSelection } from './selectionManager.js';

let currentShowModalCallback = null;
let currentFilter = 'all'; // 'all', 'favorites', 'trusted'

export function setShowModalCallback(callback) {
    currentShowModalCallback = callback;
}

export function setFilter(filter) {
    currentFilter = filter;
}

export function getFilter() {
    return currentFilter;
}

export function createDeviceElement(deviceData, isRegistered) {
    const device = deviceData.device;
    const runtime = deviceData.runtimeState || {};
    const status = runtime.status || 'offline';
    const deviceId = device.id;
    const displayName = device.customName || device.deviceFriendlyName || device.model || device.id;
    const model = (device.model && device.model !== 'Unknown') ? device.model : '';
    const version = (device.version && device.version !== 'Unknown') ? device.version : '';
    const detailsText = model && version ? `${model} (${version})` : (model || version || '');
    const isFavorite = device.isFavorite || false;
    const isTrusted = device.isTrusted || false;

    const div = document.createElement('div');
    div.className = `device-item ${status === 'connected' ? 'status-connected' : 'status-offline'}`;
    div.setAttribute('data-device-id', deviceId);
    div.setAttribute('data-device-name', displayName);
    if (detailsText) div.setAttribute('title', detailsText);

    const selectedSet = getSelectedDeviceIds();
    if (isRegistered && selectedSet.has(deviceId)) {
        div.classList.add('selected');
    }

    div.innerHTML = `
        <div class="device-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
        </div>
        <div class="device-info">
            <h3 class="device-name">${escapeHtml(displayName)}</h3>
            ${detailsText ? `<div class="device-detail">${escapeHtml(detailsText)}</div>` : ''}
        </div>
        <span class="status-badge">${status === 'connected' ? 'Connected' : (status === 'offline' ? 'Offline' : status)}</span>
    `;

    div.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentShowModalCallback) currentShowModalCallback(deviceData);
    });

    div.addEventListener('dblclick', async (e) => {
        e.stopPropagation();
        if (status !== 'connected') {
            showToast('Device is not currently connected, cannot start streaming.', true);
            return;
        }
        try {
            await startStream(deviceId);
            showToast(`Screen streaming started for device ${displayName}`);
        } catch (err) {
            showToast(`Failed to start streaming: ${err.message}`, true);
        }
    });

    if (isRegistered && status === 'connected') {
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowSelected = toggleSelectedDevice(deviceId);
            updateElementSelection(div, deviceId, nowSelected);
        });
    }

    return div;
}

export function renderDevices(registeredDevices, favoriteContainer, nonFavoriteContainer) {
    const allDevices = registeredDevices || [];
    const favoriteDevices = allDevices.filter(d => d.device.isFavorite === true);
    const nonFavoriteDevices = allDevices.filter(d => d.device.isFavorite === false);

    // Apply filter to favorite container
    let filteredFavorites = favoriteDevices;
    if (currentFilter === 'trusted') {
        filteredFavorites = favoriteDevices.filter(d => d.device.isTrusted === true);
    }

    // Render favorite devices
    if (favoriteContainer) {
        if (!filteredFavorites || filteredFavorites.length === 0) {
            favoriteContainer.innerHTML = '<div class="placeholder-text">No favorite devices</div>';
        } else {
            favoriteContainer.innerHTML = '';
            filteredFavorites.forEach(deviceData => {
                const el = createDeviceElement(deviceData, true);
                favoriteContainer.appendChild(el);
            });
        }
    }

    // Render non-favorite devices
    if (nonFavoriteContainer) {
        if (nonFavoriteDevices.length === 0) {
            nonFavoriteContainer.innerHTML = '<div class="placeholder-text">No devices</div>';
        } else {
            nonFavoriteContainer.innerHTML = '';
            nonFavoriteDevices.forEach(deviceData => {
                const el = createDeviceElement(deviceData, false);
                nonFavoriteContainer.appendChild(el);
            });
        }
    }
}
