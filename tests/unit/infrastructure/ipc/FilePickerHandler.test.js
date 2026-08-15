'use strict';

const FilePickerHandler = require('../../../../src/main/infrastructure/ipc/FilePickerHandler');

jest.mock('electron', () => ({
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
  }
}));

const { dialog } = require('electron');

describe('FilePickerHandler', () => {
  let handler;
  let mockIpcMain;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIpcMain = {
      handle: jest.fn()
    };

    handler = new FilePickerHandler();
  });

  describe('Constructor', () => {
    it('should create instance without dependencies', () => {
      expect(handler).toBeInstanceOf(FilePickerHandler);
    });
  });

  describe('register', () => {
    it('should register all IPC channels', () => {
      handler.register(mockIpcMain);

      expect(mockIpcMain.handle).toHaveBeenCalledWith('file:pick', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('file:pickDirectory', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('file:pickMultiple', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('file:save', expect.any(Function));
    });

    it('should throw error when ipcMain is not valid', () => {
      expect(() => {
        handler.register(null);
      }).toThrow('Valid ipcMain instance required');
    });

    it('should throw error when ipcMain has no handle method', () => {
      expect(() => {
        handler.register({});
      }).toThrow('Valid ipcMain instance required');
    });
  });

  describe('file:pick handler', () => {
    it('should handle file pick successfully', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: []
      });
    });

    it('should merge custom options with defaults', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const customOptions = {
        filters: [{ name: 'Videos', extensions: ['mp4', 'mkv'] }],
        title: 'Select a video file'
      };

      await handlerFn(null, customOptions);

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'mkv'] }],
        title: 'Select a video file'
      });
    });

    it('should handle dialog errors', async () => {
      dialog.showOpenDialog.mockRejectedValue(new Error('Dialog error'));

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual({
        canceled: true,
        filePaths: [],
        error: 'Dialog error'
      });
    });

    it('should handle user cancellation', async () => {
      const mockResult = {
        canceled: true,
        filePaths: []
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
    });

    it('should work without options', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const result = await handlerFn(null);

      expect(result).toEqual(mockResult);
    });
  });

  describe('file:pickDirectory handler', () => {
    it('should handle directory pick successfully', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/directory']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickDirectory'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory']
      });
    });

    it('should merge custom options with defaults', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/directory']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickDirectory'
      )[1];

      const customOptions = {
        title: 'Select a directory'
      };

      await handlerFn(null, customOptions);

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory'],
        title: 'Select a directory'
      });
    });

    it('should handle dialog errors', async () => {
      dialog.showOpenDialog.mockRejectedValue(new Error('Dialog error'));

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickDirectory'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual({
        canceled: true,
        filePaths: [],
        error: 'Dialog error'
      });
    });

    it('should handle user cancellation', async () => {
      const mockResult = {
        canceled: true,
        filePaths: []
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickDirectory'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
    });
  });

  describe('file:pickMultiple handler', () => {
    it('should handle multiple files pick successfully', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file1.mp4', '/local/file2.mp4', '/local/file3.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickMultiple'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile', 'multiSelections'],
        filters: []
      });
    });

    it('should merge custom options with defaults', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file1.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickMultiple'
      )[1];

      const customOptions = {
        filters: [{ name: 'Videos', extensions: ['mp4'] }]
      };

      await handlerFn(null, customOptions);

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Videos', extensions: ['mp4'] }]
      });
    });

    it('should handle dialog errors', async () => {
      dialog.showOpenDialog.mockRejectedValue(new Error('Dialog error'));

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickMultiple'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual({
        canceled: true,
        filePaths: [],
        error: 'Dialog error'
      });
    });

    it('should handle single file selection', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickMultiple'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
    });

    it('should handle empty selection', async () => {
      const mockResult = {
        canceled: false,
        filePaths: []
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pickMultiple'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
    });
  });

  describe('file:save handler', () => {
    it('should handle save dialog successfully', async () => {
      const mockResult = {
        canceled: false,
        filePath: '/local/saved-file.mp4'
      };
      dialog.showSaveDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:save'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
      expect(dialog.showSaveDialog).toHaveBeenCalledWith({
        properties: ['saveFile'],
        filters: []
      });
    });

    it('should merge custom options with defaults', async () => {
      const mockResult = {
        canceled: false,
        filePath: '/local/saved-file.mp4'
      };
      dialog.showSaveDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:save'
      )[1];

      const customOptions = {
        filters: [{ name: 'Videos', extensions: ['mp4'] }],
        defaultPath: '/local/default.mp4'
      };

      await handlerFn(null, customOptions);

      expect(dialog.showSaveDialog).toHaveBeenCalledWith({
        properties: ['saveFile'],
        filters: [{ name: 'Videos', extensions: ['mp4'] }],
        defaultPath: '/local/default.mp4'
      });
    });

    it('should handle dialog errors', async () => {
      dialog.showSaveDialog.mockRejectedValue(new Error('Dialog error'));

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:save'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual({
        canceled: true,
        filePath: null,
        error: 'Dialog error'
      });
    });

    it('should handle user cancellation', async () => {
      const mockResult = {
        canceled: true,
        filePath: null
      };
      dialog.showSaveDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:save'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
    });

    it('should work without options', async () => {
      const mockResult = {
        canceled: false,
        filePath: '/local/saved-file.mp4'
      };
      dialog.showSaveDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:save'
      )[1];

      const result = await handlerFn(null);

      expect(result).toEqual(mockResult);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in file paths', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file with spaces & special!.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
    });

    it('should handle very long file paths', async () => {
      const longPath = '/local/' + 'a'.repeat(1000) + '.mp4';
      const mockResult = {
        canceled: false,
        filePaths: [longPath]
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual(mockResult);
    });

    it('should handle concurrent dialog calls', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const pickHandler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const promises = [
        pickHandler(null, {}),
        pickHandler(null, {}),
        pickHandler(null, {})
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(dialog.showOpenDialog).toHaveBeenCalledTimes(3);
    });

    it('should handle empty filters array', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      await handlerFn(null, { filters: [] });

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: []
      });
    });

    it('should handle complex filter structures', async () => {
      const mockResult = {
        canceled: false,
        filePaths: ['/local/file.mp4']
      };
      dialog.showOpenDialog.mockResolvedValue(mockResult);

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const complexFilters = [
        { name: 'Videos', extensions: ['mp4', 'mkv', 'avi'] },
        { name: 'Audio', extensions: ['mp3', 'wav'] },
        { name: 'All Files', extensions: ['*'] }
      ];

      await handlerFn(null, { filters: complexFilters });

      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: complexFilters
      });
    });

    it('should handle null error message', async () => {
      dialog.showOpenDialog.mockRejectedValue(new Error());

      handler.register(mockIpcMain);

      const handlerFn = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'file:pick'
      )[1];

      const result = await handlerFn(null, {});

      expect(result).toEqual({
        canceled: true,
        filePaths: [],
        error: ''
      });
    });
  });
});
