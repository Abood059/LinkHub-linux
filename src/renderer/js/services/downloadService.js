export async function inspectUrl(url) {
    const result = await linkhub.downloads.inspect(url);
    return result;
}

export async function startDownload(url, formatId, deviceIds, options = {}) {
    const result = await linkhub.downloads.start(url, formatId, deviceIds, options);
    return result;
}

export async function stopDownload(processId) {
    const result = await linkhub.downloads.stop(processId);
    return result;
}

export async function resumeDownload(processId, url, formatId, deviceIds, options = {}) {
    const result = await linkhub.downloads.resume(processId, url, formatId, deviceIds, options);
    return result;
}

export async function deleteDownload(downloadId) {
    return await linkhub.downloads.delete(downloadId);
}

export async function deleteAllDownloads() {
    return await linkhub.downloads.deleteAll();
}

export async function deleteDownloadsBeforeDate(date) {
    return await linkhub.downloads.deleteBeforeDate(date);
}

export async function getDownloadHistory() {
    return await linkhub.downloads.getHistory();
}

export async function loadDownloadHistory() {
    try {
        const history = await getDownloadHistory();
        return history;
    } catch (error) {
        console.error('[downloadService] Failed to load download history:', error);
        throw error;
    }
}

export async function deleteDownloadFromMemory(processId) {
    return await linkhub.downloads.deleteFromMemory(processId);
}
