export function setupEventListeners(handlers) {
    if (!linkhub.on) return;

    linkhub.on('download:progress', (event, data) => {
        if (data && data.downloadId && data.percent !== undefined) {
            handlers.onProgress?.(data.downloadId, data.percent, data.speed, data.size, data.totalSize, data.downloadedBytes);
        }
    });
    linkhub.on('download:retrying', (event, data) => {
        if (data?.downloadId) handlers.onRetrying?.(data.downloadId, data.retryCount, data.maxRetries);
    });
    linkhub.on('download:complete', (event, data) => {
        if (data?.downloadId) handlers.onComplete?.(data.downloadId);
    });
    linkhub.on('download:error', (event, data) => {
        if (data?.downloadId) handlers.onError?.(data.downloadId, data.error);
    });
    linkhub.on('download:stopped', (event, data) => {
        if (data?.downloadId) handlers.onStopped?.(data.downloadId, data);
    });
    linkhub.on('download:resumed', (event, data) => {
        if (data?.downloadId) handlers.onResumed?.(data.downloadId);
    });
    linkhub.on('download:started', (event, data) => {
        if (data?.downloadId) handlers.onDownloadStarted?.(data.downloadId, data.url, data.title, data.formatId, data.deviceIds);
    });
    linkhub.on('download:state:update', (event, data) => {
        if (data?.downloads && Array.isArray(data.downloads)) {
            data.downloads.forEach(download => {
                if (download.downloadId && download.percent !== undefined) {
                    handlers.onProgress?.(download.downloadId, download.percent, download.speed, download.size, download.totalSize, download.downloadedBytes);
                }
            });
        }
    });
    linkhub.on('device:stateChanged', () => handlers.onDeviceStateChanged?.());
    linkhub.on('device:paired', () => handlers.onDevicePaired?.());
    linkhub.on('device:removed', () => handlers.onDeviceRemoved?.());
    linkhub.on('device:added', () => handlers.onDeviceStateChanged?.());
    linkhub.on('device:state:update', () => handlers.onDeviceStateChanged?.());
    linkhub.on('transfer:complete', (event, data) => {
        if (data?.downloadId) handlers.onTransferComplete?.(data.downloadId, data.message);
    });
    linkhub.on('transfer:error', (event, data) => {
        if (data?.downloadId) handlers.onTransferError?.(data.downloadId, data.error);
    });
}
