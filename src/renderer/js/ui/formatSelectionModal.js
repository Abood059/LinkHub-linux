/**
 */

let formatSelectedCallback = null;
let selectedVideoFormatId = null;
let selectedAudioFormatId = null;
let selectedDeviceIds = new Set();
let startButtonElement = null;

/**
 */
export function showFormatSelectionModal(inspectionData, devices) {
    const modal = document.getElementById('format-selection-modal');
    const videoFormatsTbody = document.getElementById('video-formats-tbody');
    const audioFormatsTbody = document.getElementById('audio-formats-tbody');
    const devicesTbody = document.getElementById('devices-tbody');

    selectedVideoFormatId = null;
    selectedAudioFormatId = null;
    selectedDeviceIds.clear();

    videoFormatsTbody.innerHTML = '';
    if (inspectionData.formats && inspectionData.formats.length > 0) {
        const videoFormats = inspectionData.formats.filter(format => format.vcodec && format.vcodec !== 'none');

        if (videoFormats.length > 0) {
            videoFormats.forEach((format, index) => {
                const row = document.createElement('tr');
                row.dataset.formatId = format.formatId || index;

                const resolution = format.resolution || format.formatNote || '-';
                const bitrate = format.bitrate ? `${Math.round(format.bitrate / 1000)} kbps` : '-';
                const filesize = format.filesize ? formatBytes(format.filesize) : '-';
                const formatId = format.formatId || index;

                row.innerHTML = `
                    <td><input type="radio" name="video-format" class="video-format-radio" value="${formatId}"></td>
                    <td>${resolution}</td>
                    <td>${filesize}</td>
                    <td>${formatId}</td>
                `;

                row.addEventListener('click', (e) => {
                    if (e.target.type !== 'radio') {
                        const radio = row.querySelector('.video-format-radio');
                        radio.checked = true;
                    }
                    selectVideoFormat(formatId);
                });

                videoFormatsTbody.appendChild(row);
            });
        } else {
            videoFormatsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد جودات فيديو متاحة</td></tr>';
        }
    } else {
        videoFormatsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد جودات متاحة</td></tr>';
    }

    audioFormatsTbody.innerHTML = '';
    if (inspectionData.formats && inspectionData.formats.length > 0) {
        const audioFormats = inspectionData.formats.filter(format => format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none'));

        if (audioFormats.length > 0) {
            audioFormats.forEach((format, index) => {
                const row = document.createElement('tr');
                row.dataset.formatId = format.formatId || index;

                const bitrate = format.bitrate ? `${Math.round(format.bitrate / 1000)} kbps` : '-';
                const filesize = format.filesize ? formatBytes(format.filesize) : '-';
                const formatId = format.formatId || index;
                const abr = format.abr ? `${format.abr} kbps` : bitrate;

                row.innerHTML = `
                    <td><input type="radio" name="audio-format" class="audio-format-radio" value="${formatId}"></td>
                    <td>${filesize}</td>
                    <td>${formatId}</td>
                `;

                row.addEventListener('click', (e) => {
                    if (e.target.type !== 'radio') {
                        const radio = row.querySelector('.audio-format-radio');
                        radio.checked = true;
                    }
                    selectAudioFormat(formatId);
                });

                audioFormatsTbody.appendChild(row);
            });
        } else {
            audioFormatsTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد جودات صوت متاحة</td></tr>';
        }
    } else {
        audioFormatsTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد جودات متاحة</td></tr>';
    }

    devicesTbody.innerHTML = '';
    if (devices && devices.length > 0) {
        devices.forEach(device => {
            const row = document.createElement('tr');
            row.dataset.deviceId = device.id;

            const statusBadge = device.connected
                ? '<span class="status-badge-modal connected">متصل</span>'
                : '<span class="status-badge-modal offline">غير متصل</span>';

            row.innerHTML = `
                <td>${device.name}</td>
                <td>${statusBadge}</td>
                <td><input type="checkbox" name="device" class="device-checkbox" value="${device.id}" ${!device.connected ? 'disabled' : ''}></td>
            `;

            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox' && device.connected) {
                    const checkbox = row.querySelector('.device-checkbox');
                    checkbox.checked = !checkbox.checked;
                    toggleDevice(device.id);
                }
            });

            const checkbox = row.querySelector('.device-checkbox');
            checkbox.addEventListener('change', (e) => {
                toggleDevice(device.id);
            });

            devicesTbody.appendChild(row);
        });
    } else {
        devicesTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد أجهزة متصلة</td></tr>';
    }

    modal.style.display = 'flex';
}

/**
 */
export function hideFormatSelectionModal() {
    const modal = document.getElementById('format-selection-modal');
    modal.style.display = 'none';
    formatSelectedCallback = null;
}

/**
 */
export function onFormatSelected(callback) {
    formatSelectedCallback = callback;
}

/**
 */
function selectVideoFormat(formatId) {
    selectedVideoFormatId = formatId;

    document.querySelectorAll('#video-formats-tbody tr').forEach(row => {
        row.classList.remove('selected');
        if (row.dataset.formatId === String(formatId)) {
            row.classList.add('selected');
        }
    });
}

/**
 */
function selectAudioFormat(formatId) {
    selectedAudioFormatId = formatId;

    document.querySelectorAll('#audio-formats-tbody tr').forEach(row => {
        row.classList.remove('selected');
        if (row.dataset.formatId === String(formatId)) {
            row.classList.add('selected');
        }
    });
}

/**
 */
function toggleDevice(deviceId) {
    if (selectedDeviceIds.has(deviceId)) {
        selectedDeviceIds.delete(deviceId);
    } else {
        selectedDeviceIds.add(deviceId);
    }
}

/**
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 */
export function initFormatSelectionModal() {
    const closeBtn = document.getElementById('format-modal-close');
    const cancelBtn = document.getElementById('format-cancel-btn');
    const startBtn = document.getElementById('format-start-btn');

    startButtonElement = startBtn;

    closeBtn.addEventListener('click', hideFormatSelectionModal);
    cancelBtn.addEventListener('click', hideFormatSelectionModal);

    startBtn.addEventListener('click', () => {
        if (!selectedVideoFormatId && !selectedAudioFormatId) {
            alert('يرجى اختيار جودة التحميل (فيديو أو صوت)');
            return;
        }

        if (formatSelectedCallback) {
            formatSelectedCallback({
                videoFormatId: selectedVideoFormatId || null,
                audioFormatId: selectedAudioFormatId || null,
                deviceIds: Array.from(selectedDeviceIds)
            });
        }
        hideFormatSelectionModal();
    });

    const overlay = document.querySelector('#format-selection-modal .modal-overlay');
    overlay.addEventListener('click', hideFormatSelectionModal);
}

/**
 */
export function resetStartButtonState() {
    if (startButtonElement) {
        startButtonElement.textContent = 'بدء التحميل';
        startButtonElement.disabled = false;
        startButtonElement.style.opacity = '1';
        startButtonElement.style.cursor = 'pointer';
    }
}
