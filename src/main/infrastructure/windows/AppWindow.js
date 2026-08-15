'use strict';

/**
 * AppWindow - Lightweight wrapper around Electron BrowserWindow.
 * Provides a simplified API without any business logic.
 * This is optional; WindowManager can work directly with BrowserWindow.
 */
class AppWindow {
    constructor(name, browserWindow) {
        if (!name || typeof name !== 'string') {
            throw new Error('AppWindow requires a valid name');
        }
        if (!browserWindow || typeof browserWindow !== 'object') {
            throw new Error('AppWindow requires a BrowserWindow instance');
        }
        this._name = name;
        this._win = browserWindow;
    }
    
    get name() {
        return this._name;
    }
    
    get instance() {
        return this._win;
    }
    
    show() {
        if (!this._win.isDestroyed()) {
            this._win.show();
        }
    }
    
    hide() {
        if (!this._win.isDestroyed()) {
            this._win.hide();
        }
    }
    
    close() {
        if (!this._win.isDestroyed()) {
            this._win.close();
        }
    }
    
    focus() {
        if (!this._win.isDestroyed()) {
            this._win.focus();
        }
    }
    
    send(channel, data) {
        if (!this._win.isDestroyed()) {
            this._win.webContents.send(channel, data);
        }
    }
    
    isDestroyed() {
        return this._win.isDestroyed();
    }
}

module.exports = AppWindow;