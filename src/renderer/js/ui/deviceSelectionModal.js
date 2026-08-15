/**
 */

import { escapeHtml } from '../core/utils.js';
import { getAllDevices } from '../services/deviceService.js';

let selectedDeviceIds = new Set();
let onConfirmCallback = null;

/**
 */
export function showDeviceSelectionModal(onConfirm) {
    const modal = document.getElementById('device-selection-modal');
    const tbody = document.getElementById('device-selection-tbody');

    onConfirmCallback = onConfirm;
    selectedDeviceIds.clear();

    renderDevices(tbody);

    modal.style.display = 'flex';
}

/**
 */
export function hideDeviceSelectionModal() {
    const modal = document.getElementById('device-selection-modal');
    modal.style.display = 'none';
    selectedDeviceIds.clear();
    onConfirmCallback = null;
}

/**
 */
async function renderDevices(tbody) {
    tbody.innerHTML = '';

    try {
        const devices = await getAllDevices();

        if (!devices || devices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No connected devices</td></tr>';
            return;
        }

        devices.forEach(deviceData => {
            const device = deviceData.device;
            const runtime = deviceData.runtimeState || {};
            const deviceId = device.id;
            const displayName = device.customName || device.deviceFriendlyName || device.model || device.id;
            const isConnected = runtime.status === 'connected';

            const row = document.createElement('tr');
            row.dataset.deviceId = deviceId;

            const statusBadge = getStatusBadge(isConnected);

            row.innerHTML = `
                <td>${escapeHtml(displayName)}</td>
                <td>${statusBadge}</td>
                <td>
                    <input type="checkbox" class="device-checkbox" data-device-id="${deviceId}" ${isConnected ? '' : 'disabled'}>
                </td>
            `;

            row.addEventListener('click', (e) => {
                if (!isConnected) return;

                if (e.target.classList.contains('device-checkbox')) return;

                const checkbox = row.querySelector('.device-checkbox');
                checkbox.checked = !checkbox.checked;

                if (checkbox.checked) {
                    selectedDeviceIds.add(deviceId);
                } else {
                    selectedDeviceIds.delete(deviceId);
                }
            });

            const checkbox = row.querySelector('.device-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedDeviceIds.add(deviceId);
                } else {
                    selectedDeviceIds.delete(deviceId);
                }
            });

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('[deviceSelectionModal] Failed to load devices:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Error loading devices</td></tr>';
    }
}

/**
 */
function getStatusBadge(isConnected) {
    if (isConnected) {
        return '<span class="transfer-status-badge transfer-status-completed">Connected</span>';
    } else {
        return '<span class="transfer-status-badge transfer-status-failed">Disconnected</span>';
    }
}

/**
 */
function getSelectedDeviceIds() {
    return Array.from(selectedDeviceIds);
}

/**
 */
export function initDeviceSelectionModal() {
    const closeBtn = document.getElementById('device-selection-modal-close');
    const cancelBtn = document.getElementById('device-selection-cancel-btn');
    const startBtn = document.getElementById('device-selection-start-btn');
    const overlay = document.querySelector('#device-selection-modal .modal-overlay');

    if (closeBtn) {
        closeBtn.addEventListener('click', hideDeviceSelectionModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideDeviceSelectionModal);
    }

    if (overlay) {
        overlay.addEventListener('click', hideDeviceSelectionModal);
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const selectedIds = getSelectedDeviceIds();

            if (selectedIds.length === 0) {
                alert('Please select at least one device');
                return;
            }

            if (onConfirmCallback) {
                onConfirmCallback(selectedIds);
            }

            hideDeviceSelectionModal();
        });
    }
}
