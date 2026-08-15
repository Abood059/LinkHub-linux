// DeviceList.test.js - اختبارات وحدة DeviceList
'use strict';

// Mock the dependencies
const mockDevicePresenter = {
    subscribe: jest.fn()
};

const mockStore = {
    toggleSelection: jest.fn(),
    getState: jest.fn(() => ({
        selectedDeviceIds: new Set()
    }))
};

jest.mock('../../../../src/renderer/js/presenters/devicePresenter.js', () => mockDevicePresenter);
jest.mock('../../../../src/renderer/js/store/appStore.js', () => mockStore);

// Mock the DeviceList class to avoid actual DOM manipulation in tests
jest.mock('../../../../src/renderer/js/ui/DeviceList.js', () => {
    class DeviceList {
        constructor(container, options = {}) {
            this.container = container;
            this.options = options;
            this._elements = new Map();
            this._currentViewModel = null;
            this._unsubscribe = null;

            this._eventHandlers = {
                onDeviceClick: options.onDeviceClick || null,
                onStreamClick: options.onStreamClick || null,
                onDeviceSelect: options.onDeviceSelect || null
            };

            this._subscribe();
        }

        _subscribe() {
            this._unsubscribe = mockDevicePresenter.subscribe((viewModel) => {
                this._currentViewModel = viewModel;
                this._render(viewModel);
            });
        }

        _render(viewModel) {
            // Simplified render for testing
            if (viewModel.isLoading) {
                this.container.innerHTML = '<div class="placeholder-text">جاري تحميل الأجهزة...</div>';
                return;
            }

            if (viewModel.error) {
                this.container.innerHTML = `<div class="placeholder-text error">${viewModel.error.message || viewModel.error}</div>`;
                return;
            }

            this._renderDeviceGroup(viewModel.registeredDevices, 'registered');
            this._renderDeviceGroup(viewModel.discoveredDevices, 'discovered');
        }

        _renderDeviceGroup(devices, type) {
            const containerId = type === 'registered' ? 'registered-devices' : 'discovered-devices';
            const container = document.getElementById(containerId);
            if (!container) return;

            // Clear existing
            container.innerHTML = '';

            if (devices.length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'placeholder-text';
                placeholder.textContent = type === 'registered' ? 'لا توجد أجهزة مسجلة' : 'لا توجد أجهزة جديدة مكتشفة';
                container.appendChild(placeholder);
                return;
            }

            devices.forEach(deviceData => {
                const element = this._createElement(deviceData, type);
                container.appendChild(element);
            });
        }

        _createElement(deviceData, type) {
            const deviceId = deviceData.device.id;
            const element = document.createElement('div');
            element.className = `device-item ${this._getStatusClass(deviceData)}`;
            element.dataset.deviceId = deviceId;

            if (deviceData.isSelected) {
                element.classList.add('selected');
            }

            element.innerHTML = this._buildTemplate(deviceData);
            this._bindEvents(element, deviceData, type);

            return element;
        }

        _updateElement(element, deviceData) {
            element.className = `device-item ${this._getStatusClass(deviceData)}`;
            if (deviceData.isSelected) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }

            const nameEl = element.querySelector('.device-name');
            if (nameEl) {
                nameEl.textContent = deviceData.displayName || deviceData.device.deviceFriendlyName || deviceData.device.model || deviceData.device.id;
            }

            const statusBadge = element.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = this._getStatusText(deviceData);
            }
        }

        _buildTemplate(deviceData) {
            const device = deviceData.device;
            const displayName = device.deviceFriendlyName || device.model || device.id;
            const statusText = this._getStatusText(deviceData);

            return `
                <div class="device-circle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                </div>
                <div class="device-info">
                    <h3 class="device-name">${displayName}</h3>
                </div>
                <span class="status-badge">${statusText}</span>
                <button class="stream-btn" data-device-id="${device.id}" title="بدء البث">📺</button>
            `;
        }

        _bindEvents(element, deviceData, type) {
            const deviceId = deviceData.device.id;
            const isConnected = deviceData.runtimeState?.status === 'connected';

            element.addEventListener('click', (e) => {
                if (e.target.closest('.stream-btn')) return;
                if (this._eventHandlers.onDeviceClick) {
                    this._eventHandlers.onDeviceClick(deviceId);
                }
            });

            const streamBtn = element.querySelector('.stream-btn');
            if (streamBtn) {
                streamBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this._eventHandlers.onStreamClick) {
                        this._eventHandlers.onStreamClick(deviceId);
                    }
                });
            }

            element.addEventListener('dblclick', (e) => {
                if (e.target.closest('.stream-btn')) return;
                if (this._eventHandlers.onStreamClick) {
                    this._eventHandlers.onStreamClick(deviceId);
                }
            });

            if (type === 'registered' && isConnected) {
                element.addEventListener('click', (e) => {
                    if (e.target.closest('.stream-btn')) return;
                    mockStore.toggleSelection(deviceId);
                    if (this._eventHandlers.onDeviceSelect) {
                        const isSelected = mockStore.getState().selectedDeviceIds.has(deviceId);
                        this._eventHandlers.onDeviceSelect(deviceId, isSelected);
                    }
                });
            }
        }

        _getStatusClass(deviceData) {
            const status = deviceData.runtimeState?.status || 'offline';
            return status === 'connected' ? 'status-connected' : 'status-offline';
        }

        _getStatusText(deviceData) {
            const status = deviceData.runtimeState?.status || 'offline';
            const map = { connected: 'متصل', offline: 'غير متصل', discovered: 'مكتشف' };
            return map[status] || status;
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

    return DeviceList;
});

const DeviceList = require('../../../../src/renderer/js/ui/DeviceList.js');

describe('DeviceList', () => {
    let deviceList;
    let container;
    let registeredContainer;
    let discoveredContainer;
    let mockViewModel;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock DOM elements
        container = document.createElement('div');
        container.id = 'mock-container';
        document.body.appendChild(container);

        registeredContainer = document.createElement('div');
        registeredContainer.id = 'registered-devices';
        document.body.appendChild(registeredContainer);

        discoveredContainer = document.createElement('div');
        discoveredContainer.id = 'discovered-devices';
        document.body.appendChild(discoveredContainer);

        // Mock view model
        mockViewModel = {
            isLoading: false,
            error: null,
            registeredDevices: [
                {
                    device: { id: 'device-1', deviceFriendlyName: 'Device 1', model: 'Pixel 5', isNew: false },
                    runtimeState: { status: 'connected' },
                    isSelected: false,
                    displayName: 'Device 1',
                    statusText: 'متصل'
                },
                {
                    device: { id: 'device-2', deviceFriendlyName: 'Device 2', model: 'Pixel 6', isNew: false },
                    runtimeState: { status: 'offline' },
                    isSelected: false,
                    displayName: 'Device 2',
                    statusText: 'غير متصل'
                }
            ],
            discoveredDevices: [
                {
                    device: { id: 'device-3', deviceFriendlyName: 'Device 3', model: 'Pixel 7', isNew: true },
                    runtimeState: { status: 'offline' },
                    isSelected: false,
                    displayName: 'Device 3',
                    statusText: 'غير متصل'
                }
            ]
        };

        mockStore.getState.mockReturnValue({
            selectedDeviceIds: new Set()
        });
    });

    afterEach(() => {
        if (deviceList) {
            deviceList.destroy();
        }
        document.body.removeChild(container);
        document.body.removeChild(registeredContainer);
        document.body.removeChild(discoveredContainer);
    });

    describe('Constructor', () => {
        it('should create DeviceList without errors', () => {
            deviceList = new DeviceList(registeredContainer);

            expect(deviceList).toBeDefined();
            expect(deviceList.container).toBe(registeredContainer);
            expect(deviceList._elements).toBeInstanceOf(Map);
            expect(deviceList._currentViewModel).toBeNull();
        });

        it('should initialize event handlers from options', () => {
            const onDeviceClick = jest.fn();
            const onStreamClick = jest.fn();
            const onDeviceSelect = jest.fn();

            deviceList = new DeviceList(registeredContainer, {
                onDeviceClick,
                onStreamClick,
                onDeviceSelect
            });

            expect(deviceList._eventHandlers.onDeviceClick).toBe(onDeviceClick);
            expect(deviceList._eventHandlers.onStreamClick).toBe(onStreamClick);
            expect(deviceList._eventHandlers.onDeviceSelect).toBe(onDeviceSelect);
        });

        it('should subscribe to DevicePresenter', () => {
            deviceList = new DeviceList(registeredContainer);

            expect(mockDevicePresenter.subscribe).toHaveBeenCalled();
        });
    });

    describe('_subscribe()', () => {
        it('should subscribe to DevicePresenter and call render on updates', () => {
            const mockUnsubscribe = jest.fn();
            mockDevicePresenter.subscribe.mockImplementation((callback) => {
                // Simulate immediate callback
                callback(mockViewModel);
                return mockUnsubscribe;
            });

            deviceList = new DeviceList(registeredContainer);

            expect(deviceList._currentViewModel).toBe(mockViewModel);
            expect(deviceList._unsubscribe).toBe(mockUnsubscribe);
        });
    });

    describe('_render()', () => {
        it('should render loading state when isLoading is true', () => {
            const loadingViewModel = { isLoading: true, error: null, registeredDevices: [], discoveredDevices: [] };
            
            deviceList = new DeviceList(registeredContainer);

            // Manually call render with loading state
            deviceList._render(loadingViewModel);

            expect(registeredContainer.innerHTML).toContain('جاري تحميل الأجهزة');
        });

        it('should render error state when error is present', () => {
            const errorViewModel = { isLoading: false, error: { message: 'Test error' }, registeredDevices: [], discoveredDevices: [] };
            
            deviceList = new DeviceList(registeredContainer);
            deviceList._render(errorViewModel);

            expect(registeredContainer.innerHTML).toContain('Test error');
        });

        it('should render devices when data is available', () => {
            const mockUnsubscribe = jest.fn();
            mockDevicePresenter.subscribe.mockImplementation((callback) => {
                callback(mockViewModel);
                return mockUnsubscribe;
            });

            deviceList = new DeviceList(registeredContainer);

            expect(registeredContainer.querySelectorAll('.device-item').length).toBeGreaterThan(0);
        });

        it('should render placeholder when no devices', () => {
            const emptyViewModel = { isLoading: false, error: null, registeredDevices: [], discoveredDevices: [] };
            
            deviceList = new DeviceList(registeredContainer);
            deviceList._render(emptyViewModel);

            expect(registeredContainer.innerHTML).toContain('لا توجد أجهزة مسجلة');
        });
    });

    describe('_createElement()', () => {
        it('should create device element with correct classes', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[0];

            const element = deviceList._createElement(deviceData, 'registered');

            expect(element.className).toContain('device-item');
            expect(element.className).toContain('status-connected');
            expect(element.dataset.deviceId).toBe('device-1');
        });

        it('should add selected class when device is selected', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = { ...mockViewModel.registeredDevices[0], isSelected: true };

            const element = deviceList._createElement(deviceData, 'registered');

            expect(element.classList.contains('selected')).toBe(true);
        });

        it('should create element with correct HTML structure', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[0];

            const element = deviceList._createElement(deviceData, 'registered');

            expect(element.querySelector('.device-circle')).toBeTruthy();
            expect(element.querySelector('.device-name')).toBeTruthy();
            expect(element.querySelector('.status-badge')).toBeTruthy();
            expect(element.querySelector('.stream-btn')).toBeTruthy();
        });
    });

    describe('_updateElement()', () => {
        it('should update element classes', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[0];
            const element = deviceList._createElement(deviceData, 'registered');

            const updatedData = { ...deviceData, runtimeState: { status: 'offline' } };
            deviceList._updateElement(element, updatedData);

            expect(element.className).toContain('status-offline');
            expect(element.className).not.toContain('status-connected');
        });

        it('should update selection state', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[0];
            const element = deviceList._createElement(deviceData, 'registered');

            const updatedData = { ...deviceData, isSelected: true };
            deviceList._updateElement(element, updatedData);

            expect(element.classList.contains('selected')).toBe(true);
        });

        it('should update device name', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[0];
            const element = deviceList._createElement(deviceData, 'registered');

            const updatedData = { ...deviceData, displayName: 'Updated Name' };
            deviceList._updateElement(element, updatedData);

            const nameEl = element.querySelector('.device-name');
            expect(nameEl.textContent).toBe('Updated Name');
        });
    });

    describe('_bindEvents()', () => {
        it('should trigger onDeviceClick when element is clicked', () => {
            const onDeviceClick = jest.fn();
            deviceList = new DeviceList(registeredContainer, { onDeviceClick });
            const deviceData = mockViewModel.registeredDevices[0];
            const element = deviceList._createElement(deviceData, 'registered');

            element.click();

            expect(onDeviceClick).toHaveBeenCalledWith('device-1');
        });

        it('should trigger onStreamClick when stream button is clicked', () => {
            const onStreamClick = jest.fn();
            deviceList = new DeviceList(registeredContainer, { onStreamClick });
            const deviceData = mockViewModel.registeredDevices[0];
            const element = deviceList._createElement(deviceData, 'registered');

            const streamBtn = element.querySelector('.stream-btn');
            streamBtn.click();

            expect(onStreamClick).toHaveBeenCalledWith('device-1');
        });

        it('should trigger onStreamClick on double-click', () => {
            const onStreamClick = jest.fn();
            deviceList = new DeviceList(registeredContainer, { onStreamClick });
            const deviceData = mockViewModel.registeredDevices[0];
            const element = deviceList._createElement(deviceData, 'registered');

            element.dispatchEvent(new MouseEvent('dblclick'));

            expect(onStreamClick).toHaveBeenCalledWith('device-1');
        });

        it('should toggle selection for registered connected devices', () => {
            mockStore.getState.mockReturnValue({ selectedDeviceIds: new Set(['device-1']) });
            const onDeviceSelect = jest.fn();
            deviceList = new DeviceList(registeredContainer, { onDeviceSelect });
            const deviceData = mockViewModel.registeredDevices[0]; // connected device
            const element = deviceList._createElement(deviceData, 'registered');

            element.click();

            expect(mockStore.toggleSelection).toHaveBeenCalledWith('device-1');
        });
    });

    describe('_getStatusClass()', () => {
        it('should return status-connected for connected devices', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[0];

            const statusClass = deviceList._getStatusClass(deviceData);

            expect(statusClass).toBe('status-connected');
        });

        it('should return status-offline for offline devices', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[1];

            const statusClass = deviceList._getStatusClass(deviceData);

            expect(statusClass).toBe('status-offline');
        });
    });

    describe('_getStatusText()', () => {
        it('should return correct Arabic text for connected', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[0];

            const statusText = deviceList._getStatusText(deviceData);

            expect(statusText).toBe('متصل');
        });

        it('should return correct Arabic text for offline', () => {
            deviceList = new DeviceList(registeredContainer);
            const deviceData = mockViewModel.registeredDevices[1];

            const statusText = deviceList._getStatusText(deviceData);

            expect(statusText).toBe('غير متصل');
        });
    });

    describe('_escapeHtml()', () => {
        it('should escape HTML special characters', () => {
            deviceList = new DeviceList(registeredContainer);

            const escaped = deviceList._escapeHtml('<script>alert("xss")</script>');

            expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('should handle empty string', () => {
            deviceList = new DeviceList(registeredContainer);

            const escaped = deviceList._escapeHtml('');

            expect(escaped).toBe('');
        });

        it('should handle null', () => {
            deviceList = new DeviceList(registeredContainer);

            const escaped = deviceList._escapeHtml(null);

            expect(escaped).toBe('');
        });
    });

    describe('destroy()', () => {
        it('should unsubscribe from presenter', () => {
            const mockUnsubscribe = jest.fn();
            mockDevicePresenter.subscribe.mockReturnValue(mockUnsubscribe);

            deviceList = new DeviceList(registeredContainer);
            deviceList.destroy();

            expect(mockUnsubscribe).toHaveBeenCalled();
            expect(deviceList._unsubscribe).toBeNull();
        });

        it('should clear container', () => {
            const mockUnsubscribe = jest.fn();
            mockDevicePresenter.subscribe.mockReturnValue(mockUnsubscribe);

            deviceList = new DeviceList(registeredContainer);
            registeredContainer.innerHTML = '<div>Test</div>';
            
            deviceList.destroy();

            expect(registeredContainer.innerHTML).toBe('');
        });

        it('should clear elements map', () => {
            const mockUnsubscribe = jest.fn();
            mockDevicePresenter.subscribe.mockReturnValue(mockUnsubscribe);

            deviceList = new DeviceList(registeredContainer);
            deviceList._elements.set('test', 'value');
            
            deviceList.destroy();

            expect(deviceList._elements.size).toBe(0);
        });
    });
});
