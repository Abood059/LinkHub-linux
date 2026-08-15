/**
 */

import { showDeviceSelectionModal } from '../ui/deviceSelectionModal.js';
import { addTransfer } from '../managers/TransferProgressManager.js';

let currentFileTransfers = new Map(); // transferId -> { fileName, deviceId }

/**
 */
export async function handleFileShare() {
    try {
        const result = await window.linkhub.file.pickMultiple({
            properties: ['openFile', 'multiSelections'],
            filters: []
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return;
        }

        const filePaths = result.filePaths;

        showDeviceSelectionModal(async (selectedDeviceIds) => {
            await startFileTransfers(filePaths, selectedDeviceIds);
        });
    } catch (error) {
        console.error('[fileShareHandler] Error in file share:', error);
        alert('حدث خطأ أثناء اختيار الملفات: ' + error.message);
    }
}

/**
 */
async function startFileTransfers(filePaths, deviceIds) {
    const transferIds = [];
    const errors = [];

    const firstFileName = filePaths[0].split('/').pop() || filePaths[0].split('\\').pop();
    const displayFileName = filePaths.length > 1
        ? `${firstFileName} و ${filePaths.length - 1} آخرين`
        : firstFileName;

    for (const filePath of filePaths) {
        for (const deviceId of deviceIds) {
            try {
                const result = await window.linkhub.transfer.startMultiple(
                    filePath,
                    [deviceId]
                );

                if (result.success) {
                    const transferId = result.transferIds[0];
                    transferIds.push(transferId);

                    const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
                    currentFileTransfers.set(transferId, {
                        fileName,
                        deviceId
                    });

                    addTransfer(transferId, displayFileName, deviceIds);
                } else {
                    errors.push({ filePath, deviceId, message: result.message });
                }
            } catch (error) {
                errors.push({ filePath, deviceId, message: error.message });
            }
        }
    }

    if (transferIds.length > 0) {
        console.log(`[fileShareHandler] Started ${transferIds.length} transfers successfully`);
    } else if (errors.length > 0) {
        alert('فشل بدء النقل: ' + errors[0].message);
    }
}

/**
 */
export function updateFileTransferStatus(transferId, status, progress) {
    const transferInfo = currentFileTransfers.get(transferId);
    if (transferInfo) {
        console.log(`[fileShareHandler] Transfer ${transferId} (${transferInfo.fileName} -> ${transferInfo.deviceId}): ${status} ${(progress * 100).toFixed(2)}%`);
    }
}

/**
 */
export function clearFileTransfer(transferId) {
    currentFileTransfers.delete(transferId);
}
