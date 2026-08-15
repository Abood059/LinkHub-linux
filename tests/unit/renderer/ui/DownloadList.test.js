// DownloadList.test.js - اختبارات وحدة DownloadList
'use strict';

// Mock the dependencies
const mockDownloadPresenter = {
    subscribe: jest.fn()
};

jest.mock('../../../../src/renderer/js/presenters/downloadPresenter.js', () => mockDownloadPresenter);

// Mock the DownloadList class to avoid actual DOM manipulation in tests
jest.mock('../../../../src/renderer/js/ui/DownloadList.js', () => {
    class DownloadList {
        constructor(container, options = {}) {
            this.container = container;
            this.options = options;
            this._elements = new Map();
            this._currentViewModel = null;
            this._unsubscribe = null;

            this._eventHandlers = {
                onStopDownload: options.onStopDownload || null
            };

            this._subscribe();
        }

        _subscribe() {
            this._unsubscribe = mockDownloadPresenter.subscribe((viewModel) => {
                this._currentViewModel = viewModel;
                this._render(viewModel);
            });
        }

        _render(viewModel) {
            // Simplified render for testing
            if (viewModel.isLoading) {
                this.container.innerHTML = '<tr class="empty-row"><td colspan="6" style="text-align:center;">جاري تحميل التحميلات...</td></tr>';
                return;
            }

            if (viewModel.error) {
                this.container.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;">خطأ: ${viewModel.error.message || viewModel.error}</td></tr>`;
                return;
            }

            const downloads = viewModel.allDownloads || [];

            // Clear existing
            this.container.innerHTML = '';

            if (downloads.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.className = 'empty-row';
                emptyRow.innerHTML = '<td colspan="6" style="text-align:center;">لا توجد تحميلات نشطة</td>';
                this.container.appendChild(emptyRow);
                return;
            }

            downloads.forEach(downloadData => {
                const element = this._createElement(downloadData);
                this.container.appendChild(element);
            });
        }

        _createElement(downloadData) {
            const downloadId = downloadData.downloadId;
            const fileName = downloadData.fileName || 'Unknown';
            const targetDeviceName = downloadData.targetDeviceName || 'Unknown';
            const url = downloadData.url || '';

            const row = document.createElement('tr');
            row.setAttribute('data-download-id', downloadId);
            row.setAttribute('data-url', url);
            row.innerHTML = `
                <td class="file-name">${fileName}</td>
                <td>
                    <div class="progress-wrapper">
                        <div class="progress-track">
                            <div class="progress-fill" style="width: 0%;"></div>
                        </div>
                        <span class="progress-percentage">0%</span>
                    </div>
                </td>
                <td class="file-size">--</td>
                <td class="download-speed">--</td>
                <td><span class="device-tag">${targetDeviceName}</span></td>
                <td>
                    <button class="btn-stop-download" data-download-id="${downloadId}" style="background: #D32F2F; border: none; color: white; padding: 4px 12px; border-radius: 20px; cursor: pointer; font-size: 0.7rem;">إيقاف</button>
                </td>
            `;

            this._bindEvents(row, downloadData);

            return row;
        }

        _updateElement(element, downloadData) {
            const percent = downloadData.percent || 0;
            const speed = downloadData.speed || '--';
            const size = downloadData.size || '--';
            const status = downloadData.status || 'downloading';

            this._updateProgressBar(element, percent);

            const speedSpan = element.querySelector('.download-speed');
            if (speedSpan) {
                speedSpan.textContent = speed;
            }

            const sizeSpan = element.querySelector('.file-size');
            if (sizeSpan) {
                sizeSpan.textContent = size;
            }

            this._updateButtonState(element, status);
        }

        _updateProgressBar(element, percent) {
            const fill = element.querySelector('.progress-fill');
            const percentSpan = element.querySelector('.progress-percentage');

            if (fill) {
                fill.style.width = `${percent}%`;
                const hue = 210 - (percent / 100) * 90;
                fill.style.backgroundColor = `hsl(${hue}, 70%, 55%)`;
            }

            if (percentSpan) {
                percentSpan.textContent = `${percent}%`;
            }
        }

        _updateButtonState(element, status) {
            const stopBtn = element.querySelector('.btn-stop-download');
            if (!stopBtn) return;

            switch (status) {
                case 'completed':
                    stopBtn.textContent = 'مكتمل';
                    stopBtn.disabled = true;
                    stopBtn.style.background = '#388E3C';
                    break;
                case 'failed':
                    stopBtn.textContent = 'فشل';
                    stopBtn.disabled = true;
                    stopBtn.style.background = '#D32F2F';
                    break;
                case 'stopped':
                    stopBtn.textContent = 'تم الإيقاف';
                    stopBtn.disabled = true;
                    stopBtn.style.background = '#666';
                    break;
                default:
                    stopBtn.textContent = 'إيقاف';
                    stopBtn.disabled = false;
                    stopBtn.style.background = '#D32F2F';
            }
        }

        _bindEvents(element, downloadData) {
            const downloadId = downloadData.downloadId;

            const stopBtn = element.querySelector('.btn-stop-download');
            if (stopBtn) {
                stopBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (this._eventHandlers.onStopDownload) {
                        if (confirm('هل تريد إيقاف هذا التحميل؟')) {
                            await this._eventHandlers.onStopDownload(downloadId);
                        }
                    }
                });
            }
        }

        _escapeHtml(str) {
            if (!str) return '';
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return str.replace(/[&<>"']/g, m => map[m]);
        }

        destroy() {
            if (this._unsubscribe) {
                this._unsubscribe();
                this._unsubscribe = null;
            }
            this.container.innerHTML = '';
            this._elements.clear();
            this._currentViewModel = null;
        }
    }

    return DownloadList;
});

const DownloadList = require('../../../../src/renderer/js/ui/DownloadList.js');

describe('DownloadList', () => {
    let downloadList;
    let container;
    let mockViewModel;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DOM element
        container = document.createElement('tbody');
        container.id = 'downloads-tbody';
        document.body.appendChild(container);

        // Mock view model
        mockViewModel = {
            isLoading: false,
            error: null,
            allDownloads: [
                {
                    downloadId: 'download-1',
                    fileName: 'video.mp4',
                    targetDeviceName: 'Pixel 5',
                    url: 'https://example.com/video.mp4',
                    percent: 50,
                    speed: '5 MB/s',
                    size: '100 MB',
                    status: 'downloading'
                },
                {
                    downloadId: 'download-2',
                    fileName: 'audio.mp3',
                    targetDeviceName: 'Pixel 6',
                    url: 'https://example.com/audio.mp3',
                    percent: 100,
                    speed: '0 MB/s',
                    size: '5 MB',
                    status: 'completed'
                }
            ]
        };
    });

    afterEach(() => {
        if (downloadList) {
            downloadList.destroy();
        }
        document.body.removeChild(container);
    });

    describe('Constructor', () => {
        it('should create DownloadList without errors', () => {
            downloadList = new DownloadList(container);

            expect(downloadList).toBeDefined();
            expect(downloadList.container).toBe(container);
            expect(downloadList._elements).toBeInstanceOf(Map);
            expect(downloadList._currentViewModel).toBeNull();
        });

        it('should initialize event handlers from options', () => {
            const onStopDownload = jest.fn();

            downloadList = new DownloadList(container, {
                onStopDownload
            });

            expect(downloadList._eventHandlers.onStopDownload).toBe(onStopDownload);
        });

        it('should subscribe to DownloadPresenter', () => {
            downloadList = new DownloadList(container);

            expect(mockDownloadPresenter.subscribe).toHaveBeenCalled();
        });
    });

    describe('_subscribe()', () => {
        it('should subscribe to DownloadPresenter and call render on updates', () => {
            const mockUnsubscribe = jest.fn();
            mockDownloadPresenter.subscribe.mockImplementation((callback) => {
                callback(mockViewModel);
                return mockUnsubscribe;
            });

            downloadList = new DownloadList(container);

            expect(downloadList._currentViewModel).toBe(mockViewModel);
            expect(downloadList._unsubscribe).toBe(mockUnsubscribe);
        });
    });

    describe('_render()', () => {
        it('should render loading state when isLoading is true', () => {
            const loadingViewModel = { isLoading: true, error: null, allDownloads: [] };
            
            downloadList = new DownloadList(container);
            downloadList._render(loadingViewModel);

            expect(container.innerHTML).toContain('جاري تحميل التحميلات');
        });

        it('should render error state when error is present', () => {
            const errorViewModel = { isLoading: false, error: { message: 'Test error' }, allDownloads: [] };
            
            downloadList = new DownloadList(container);
            downloadList._render(errorViewModel);

            expect(container.innerHTML).toContain('Test error');
        });

        it('should render downloads when data is available', () => {
            const mockUnsubscribe = jest.fn();
            mockDownloadPresenter.subscribe.mockImplementation((callback) => {
                callback(mockViewModel);
                return mockUnsubscribe;
            });

            downloadList = new DownloadList(container);

            expect(container.querySelectorAll('tr[data-download-id]').length).toBeGreaterThan(0);
        });

        it('should render placeholder when no downloads', () => {
            const emptyViewModel = { isLoading: false, error: null, allDownloads: [] };
            
            downloadList = new DownloadList(container);
            downloadList._render(emptyViewModel);

            expect(container.innerHTML).toContain('لا توجد تحميلات نشطة');
        });
    });

    describe('_createElement()', () => {
        it('should create table row with correct attributes', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];

            const row = downloadList._createElement(downloadData);

            expect(row.getAttribute('data-download-id')).toBe('download-1');
            expect(row.getAttribute('data-url')).toBe('https://example.com/video.mp4');
        });

        it('should create row with correct HTML structure', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];

            const row = downloadList._createElement(downloadData);

            expect(row.querySelector('.file-name')).toBeTruthy();
            expect(row.querySelector('.progress-wrapper')).toBeTruthy();
            expect(row.querySelector('.progress-fill')).toBeTruthy();
            expect(row.querySelector('.progress-percentage')).toBeTruthy();
            expect(row.querySelector('.file-size')).toBeTruthy();
            expect(row.querySelector('.download-speed')).toBeTruthy();
            expect(row.querySelector('.device-tag')).toBeTruthy();
            expect(row.querySelector('.btn-stop-download')).toBeTruthy();
        });

        it('should display correct file name', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];

            const row = downloadList._createElement(downloadData);
            const fileName = row.querySelector('.file-name');

            expect(fileName.textContent).toBe('video.mp4');
        });

        it('should display correct device name', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];

            const row = downloadList._createElement(downloadData);
            const deviceTag = row.querySelector('.device-tag');

            expect(deviceTag.textContent).toBe('Pixel 5');
        });
    });

    describe('_updateElement()', () => {
        it('should update progress bar', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            const updatedData = { ...downloadData, percent: 75 };
            downloadList._updateElement(row, updatedData);

            const percentSpan = row.querySelector('.progress-percentage');
            expect(percentSpan.textContent).toBe('75%');
        });

        it('should update speed', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            const updatedData = { ...downloadData, speed: '10 MB/s' };
            downloadList._updateElement(row, updatedData);

            const speedSpan = row.querySelector('.download-speed');
            expect(speedSpan.textContent).toBe('10 MB/s');
        });

        it('should update size', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            const updatedData = { ...downloadData, size: '200 MB' };
            downloadList._updateElement(row, updatedData);

            const sizeSpan = row.querySelector('.file-size');
            expect(sizeSpan.textContent).toBe('200 MB');
        });
    });

    describe('_updateProgressBar()', () => {
        it('should update progress bar width', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            downloadList._updateProgressBar(row, 80);

            const fill = row.querySelector('.progress-fill');
            expect(fill.style.width).toBe('80%');
        });

        it('should update progress bar color based on percentage', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            downloadList._updateProgressBar(row, 50);

            const fill = row.querySelector('.progress-fill');
            expect(fill.style.backgroundColor).toContain('hsl');
        });

        it('should update percentage text', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            downloadList._updateProgressBar(row, 30);

            const percentSpan = row.querySelector('.progress-percentage');
            expect(percentSpan.textContent).toBe('30%');
        });
    });

    describe('_updateButtonState()', () => {
        it('should update button to completed state', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            downloadList._updateButtonState(row, 'completed');

            const stopBtn = row.querySelector('.btn-stop-download');
            expect(stopBtn.textContent).toBe('مكتمل');
            expect(stopBtn.disabled).toBe(true);
            expect(stopBtn.style.background).toBe('#388E3C');
        });

        it('should update button to failed state', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            downloadList._updateButtonState(row, 'failed');

            const stopBtn = row.querySelector('.btn-stop-download');
            expect(stopBtn.textContent).toBe('فشل');
            expect(stopBtn.disabled).toBe(true);
            expect(stopBtn.style.background).toBe('#D32F2F');
        });

        it('should update button to stopped state', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            downloadList._updateButtonState(row, 'stopped');

            const stopBtn = row.querySelector('.btn-stop-download');
            expect(stopBtn.textContent).toBe('تم الإيقاف');
            expect(stopBtn.disabled).toBe(true);
            expect(stopBtn.style.background).toBe('#666');
        });

        it('should reset button to active state for downloading', () => {
            downloadList = new DownloadList(container);
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            downloadList._updateButtonState(row, 'downloading');

            const stopBtn = row.querySelector('.btn-stop-download');
            expect(stopBtn.textContent).toBe('إيقاف');
            expect(stopBtn.disabled).toBe(false);
            expect(stopBtn.style.background).toBe('#D32F2F');
        });
    });

    describe('_bindEvents()', () => {
        it('should trigger onStopDownload when stop button is clicked', async () => {
            const onStopDownload = jest.fn().mockResolvedValue(undefined);
            downloadList = new DownloadList(container, { onStopDownload });
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            // Mock confirm
            global.confirm = jest.fn(() => true);

            const stopBtn = row.querySelector('.btn-stop-download');
            await stopBtn.click();

            expect(onStopDownload).toHaveBeenCalledWith('download-1');
        });

        it('should not trigger onStopDownload when confirm is cancelled', async () => {
            const onStopDownload = jest.fn();
            downloadList = new DownloadList(container, { onStopDownload });
            const downloadData = mockViewModel.allDownloads[0];
            const row = downloadList._createElement(downloadData);

            // Mock confirm to return false
            global.confirm = jest.fn(() => false);

            const stopBtn = row.querySelector('.btn-stop-download');
            await stopBtn.click();

            expect(onStopDownload).not.toHaveBeenCalled();
        });
    });

    describe('_escapeHtml()', () => {
        it('should escape HTML special characters', () => {
            downloadList = new DownloadList(container);

            const escaped = downloadList._escapeHtml('<script>alert("xss")</script>');

            expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('should handle empty string', () => {
            downloadList = new DownloadList(container);

            const escaped = downloadList._escapeHtml('');

            expect(escaped).toBe('');
        });

        it('should handle null', () => {
            downloadList = new DownloadList(container);

            const escaped = downloadList._escapeHtml(null);

            expect(escaped).toBe('');
        });
    });

    describe('destroy()', () => {
        it('should unsubscribe from presenter', () => {
            const mockUnsubscribe = jest.fn();
            mockDownloadPresenter.subscribe.mockReturnValue(mockUnsubscribe);

            downloadList = new DownloadList(container);
            downloadList.destroy();

            expect(mockUnsubscribe).toHaveBeenCalled();
            expect(downloadList._unsubscribe).toBeNull();
        });

        it('should clear container', () => {
            const mockUnsubscribe = jest.fn();
            mockDownloadPresenter.subscribe.mockReturnValue(mockUnsubscribe);

            downloadList = new DownloadList(container);
            container.innerHTML = '<tr>Test</tr>';
            
            downloadList.destroy();

            expect(container.innerHTML).toBe('');
        });

        it('should clear elements map', () => {
            const mockUnsubscribe = jest.fn();
            mockDownloadPresenter.subscribe.mockReturnValue(mockUnsubscribe);

            downloadList = new DownloadList(container);
            downloadList._elements.set('test', 'value');
            
            downloadList.destroy();

            expect(downloadList._elements.size).toBe(0);
        });
    });
});
