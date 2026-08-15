/**
 */

import { getAllDevices } from '../services/deviceService.js';

// transferId -> { id, fileName, deviceIds, progress, status, createdAt }
let activeTransfers = new Map();

let completedTransfers = new Map();

let isPopoverVisible = false;
let completionTimeout = null;

/**
 */
export function addTransfer(transferId, fileName, deviceIds) {
    const transfer = {
        id: transferId,
        fileName: fileName,
        deviceIds: deviceIds,
        progress: 0,
        status: 'transferring',
        createdAt: Date.now()
    };

    activeTransfers.set(transferId, transfer);
    updateProgressFab();
}

/**
 */
export function updateTransferProgress(transferId, progress) {
    const transfer = activeTransfers.get(transferId);
    if (transfer) {
        transfer.progress = progress;
        updateProgressFab();
        updatePopoverContent();
    }
}

/**
 */
export function completeTransfer(transferId) {
    const transfer = activeTransfers.get(transferId);
    if (transfer) {
        transfer.status = 'completed';
        transfer.progress = 1;

        completedTransfers.set(transferId, transfer);
        activeTransfers.delete(transferId);

        updateProgressFab();
        updatePopoverContent();

        if (activeTransfers.size === 0) {
            handleAllTransfersCompleted();
        }
    }
}

/**
 */
export function failTransfer(transferId, error) {
    const transfer = activeTransfers.get(transferId);
    if (transfer) {
        transfer.status = 'failed';
        transfer.error = error;

        completedTransfers.set(transferId, transfer);
        activeTransfers.delete(transferId);

        updateProgressFab();
        updatePopoverContent();

        if (activeTransfers.size === 0) {
            handleAllTransfersCompleted();
        }
    }
}

/**
 */
export async function cancelTransfer(transferId) {
    try {
        await window.linkhub.transfer.cancel(transferId);

        const transfer = activeTransfers.get(transferId);
        if (transfer) {
            transfer.status = 'cancelled';
            activeTransfers.delete(transferId);

            updateProgressFab();
            updatePopoverContent();

            if (activeTransfers.size === 0) {
                hideProgressFab();
            }
        }
    } catch (error) {
        console.error('[TransferProgressManager] Failed to cancel transfer:', error);
    }
}

/**
 */
function handleAllTransfersCompleted() {
    const fab = document.getElementById('transfer-progress-fab');
    if (!fab) return;

    fab.classList.add('completed');
    const icon = fab.querySelector('.progress-icon');
    if (icon) {
        icon.textContent = '✓';
    }

    if (completionTimeout) {
        clearTimeout(completionTimeout);
    }

    completionTimeout = setTimeout(() => {
        fab.classList.add('slide-down');

        setTimeout(() => {
            hideProgressFab();
            fab.classList.remove('completed', 'slide-down');
            if (icon) {
                icon.textContent = '';
            }

            completedTransfers.clear();
        }, 500);
    }, 3000);
}

/**
 */
function updateProgressFab() {
    const fab = document.getElementById('transfer-progress-fab');
    if (!fab) return;

    const totalTransfers = activeTransfers.size + completedTransfers.size;

    if (totalTransfers === 0) {
        hideProgressFab();
        return;
    }

    fab.style.display = 'flex';

    let totalProgress = 0;
    activeTransfers.forEach(transfer => {
        totalProgress += transfer.progress;
    });
    completedTransfers.forEach(transfer => {
        totalProgress += 1;
    });

    const averageProgress = totalProgress / totalTransfers;

    const circle = fab.querySelector('.progress-ring-circle');
    if (circle) {
        const circumference = 100;
        const offset = circumference - (averageProgress * circumference);
        circle.style.strokeDashoffset = offset;
    }

    const icon = fab.querySelector('.progress-icon');
    if (icon && !fab.classList.contains('completed')) {
        icon.textContent = Math.round(averageProgress * 100) + '%';
    }
}

/**
 */
function hideProgressFab() {
    const fab = document.getElementById('transfer-progress-fab');
    if (fab) {
        fab.style.display = 'none';
    }

    hidePopover();
}

/**
 */
export function showPopover() {
    const popover = document.getElementById('transfer-popover');
    if (!popover) return;

    popover.style.display = 'block';
    popover.classList.remove('hidden');
    isPopoverVisible = true;

    updatePopoverContent();
}

/**
 */
export function hidePopover() {
    const popover = document.getElementById('transfer-popover');
    if (!popover) return;

    popover.classList.add('hidden');
    isPopoverVisible = false;

    setTimeout(() => {
        if (!isPopoverVisible) {
            popover.style.display = 'none';
        }
    }, 300);
}

/**
 */
export function togglePopover() {
    if (isPopoverVisible) {
        hidePopover();
    } else {
        showPopover();
    }
}

/**
 */
async function updatePopoverContent() {
    const content = document.getElementById('transfer-popover-content');
    if (!content) return;

    const allTransfers = new Map([...activeTransfers, ...completedTransfers]);

    if (allTransfers.size === 0) {
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">لا توجد عمليات نقل</div>';
        return;
    }

    let html = '';

    for (const [transferId, transfer] of allTransfers) {
        const deviceNames = await getDeviceNames(transfer.deviceIds);
        const statusText = getStatusText(transfer.status);
        const statusClass = transfer.status === 'completed' ? 'completed' :
                           transfer.status === 'failed' ? 'failed' : '';

        html += `
            <div class="transfer-item ${statusClass}" data-transfer-id="${transferId}">
                <div class="transfer-item-header">
                    <span class="transfer-item-name">${escapeHtml(transfer.fileName)}</span>
                    ${transfer.status === 'transferring' ? `
                        <button class="transfer-item-cancel" onclick="window.transferProgressManager.cancelTransfer('${transferId}')">×</button>
                    ` : ''}
                </div>
                <div class="transfer-item-devices">${escapeHtml(deviceNames)}</div>
                <div class="transfer-progress-bar">
                    <div class="transfer-progress-fill" style="width: ${transfer.progress * 100}%"></div>
                </div>
                <div class="transfer-item-status">${statusText}</div>
            </div>
        `;
    }

    content.innerHTML = html;
}

/**
 */
async function getDeviceNames(deviceIds) {
    try {
        const devices = await getAllDevices();
        const names = deviceIds.map(id => {
            const device = devices.find(d => d.device.id === id);
            return device ? (device.device.customName || device.device.deviceFriendlyName || device.device.model || id) : id;
        });
        return names.join(', ');
    } catch (error) {
        console.error('[TransferProgressManager] Failed to get device names:', error);
        return deviceIds.join(', ');
    }
}

/**
 */
function getStatusText(status) {
    const statusMap = {
        'transferring': 'جاري النقل',
        'completed': 'مكتمل',
        'failed': 'فشل',
        'cancelled': 'ملغي'
    };
    return statusMap[status] || status;
}

/**
 */
export function initTransferProgressManager() {
    const fab = document.getElementById('transfer-progress-fab');
    const popover = document.getElementById('transfer-popover');
    const closeBtn = document.querySelector('.popover-close');

    if (fab) {
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePopover();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hidePopover();
        });
    }

    document.addEventListener('click', (e) => {
        if (isPopoverVisible &&
            !popover.contains(e.target) &&
            !fab.contains(e.target)) {
            hidePopover();
        }
    });

    window.transferProgressManager = {
        cancelTransfer
    };
}

/**
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
