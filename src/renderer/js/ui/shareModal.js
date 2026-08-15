/**
 */

import { escapeHtml } from '../core/utils.js';
import { getAllDevices } from '../services/deviceService.js';

let currentDownloadId = null;
let currentFileName = null;
let currentDeviceStates = new Map(); // deviceId -> { status, progress }

/**
 */
export function showShareModal(downloadId, fileName, selectedDeviceIds = []) {
    const modal = document.getElementById('share-modal');
    const modalTitle = document.getElementById('share-modal-title');
    const devicesTbody = document.getElementById('share-devices-tbody');

    currentDownloadId = downloadId;
    currentFileName = fileName;

    modalTitle.textContent = `مشاركة: ${escapeHtml(fileName)}`;

    renderDevices(devicesTbody, selectedDeviceIds);

    modal.style.display = 'flex';
}

/**
 */
export function hideShareModal() {
    const modal = document.getElementById('share-modal');
    modal.style.display = 'none';
    currentDownloadId = null;
    currentFileName = null;
    currentDeviceStates.clear();
}

/**
 */
async function renderDevices(tbody, selectedDeviceIds = []) {
    tbody.innerHTML = '';

    try {
        const devices = await getAllDevices();

        if (!devices || devices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد أجهزة متصلة</td></tr>';
            return;
        }

        devices.forEach(deviceData => {
            const device = deviceData.device;
            const runtime = deviceData.runtimeState || {};
            const deviceId = device.id;
            const displayName = device.customName || device.deviceFriendlyName || device.model || device.id;
            const isConnected = runtime.status === 'connected';

            const isSelected = selectedDeviceIds.includes(deviceId);

            const transferState = currentDeviceStates.get(deviceId) || { status: 'pending', progress: 0 };

            const row = document.createElement('tr');
            row.dataset.deviceId = deviceId;
            if (isSelected) {
                row.classList.add('device-row-selected');
            }

            const statusBadge = getStatusBadge(transferState.status, isConnected);
            const progressHtml = getProgressHtml(transferState.status, transferState.progress);

            row.innerHTML = `
                <td>${escapeHtml(displayName)}</td>
                <td>${progressHtml}</td>
                <td>${statusBadge}</td>
            `;

            if (!isSelected && isConnected) {
                row.addEventListener('click', () => {
                    console.log(`[shareModal] بدء المشاركة مع الجهاز ${deviceId}`);
                });
            }

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('[shareModal] Failed to load devices:', error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">خطأ في تحميل الأجهزة</td></tr>';
    }
}

/**
 */
function getStatusBadge(status, isConnected) {
    const statusMap = {
        'pending': { text: 'بانتظار البدء', class: 'transfer-status-pending' },
        'transferring': { text: 'جاري النقل', class: 'transfer-status-transferring' },
        'completed': { text: 'مكتمل', class: 'transfer-status-completed' },
        'failed': { text: 'فشل النقل', class: 'transfer-status-failed' },
        'waiting': { text: 'جاري انتظار انتهاء التحميل', class: 'transfer-status-waiting' }
    };

    if (!isConnected) {
        return '<span class="transfer-status-badge transfer-status-failed">غير متصل</span>';
    }

    const statusInfo = statusMap[status] || statusMap['pending'];
    return `<span class="transfer-status-badge ${statusInfo.class}">${statusInfo.text}</span>`;
}

/**
 */
function getProgressHtml(status, progress) {
    if (status === 'pending' || status === 'waiting' || status === 'failed') {
        return '<span style="color: #666; font-size: 0.7rem;">--</span>';
    }

    const percentage = Math.round(progress * 100);
    return `
        <div class="transfer-progress-wrapper">
            <div class="transfer-progress-track">
                <div class="transfer-progress-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="transfer-progress-percentage">${percentage}%</span>
        </div>
    `;
}

/**
 */
export function updateDeviceTransferStatus(deviceId, status, progress = 0) {
    currentDeviceStates.set(deviceId, { status, progress });

    const modal = document.getElementById('share-modal');
    if (modal && modal.style.display !== 'none') {
        const tbody = document.getElementById('share-devices-tbody');
        const row = tbody.querySelector(`tr[data-device-id="${deviceId}"]`);
        if (row) {
            const statusCell = row.cells[2];
            const progressCell = row.cells[1];

            statusCell.innerHTML = getStatusBadge(status, true);
            progressCell.innerHTML = getProgressHtml(status, progress);
        }
    }
}

/**
 */
export function updateAllDevicesStatus(downloadStatus) {
    if (downloadStatus === 'completed') {
        currentDeviceStates.forEach((state, deviceId) => {
            if (state.status === 'waiting') {
                updateDeviceTransferStatus(deviceId, 'pending', 0);
            }
        });
    } else if (downloadStatus === 'downloading') {
        currentDeviceStates.forEach((state, deviceId) => {
            if (state.status === 'pending') {
                updateDeviceTransferStatus(deviceId, 'waiting', 0);
            }
        });
    }
}

/**
 */
export function initShareModal() {
    const closeBtn = document.getElementById('share-modal-close');
    const closeBtnAction = document.getElementById('share-modal-close-btn');
    const overlay = document.querySelector('#share-modal .modal-overlay');

    if (closeBtn) {
        closeBtn.addEventListener('click', hideShareModal);
    }

    if (closeBtnAction) {
        closeBtnAction.addEventListener('click', hideShareModal);
    }

    if (overlay) {
        overlay.addEventListener('click', hideShareModal);
    }
}
