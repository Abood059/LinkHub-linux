// src/main/infrastructure/media/MetadataExtractor.js
'use strict';

/**
 * MetadataExtractor
 * مسؤول عن استخراج المعلومات من yt-dlp-wrap-plus
 */
class MetadataExtractor {
    constructor(ytDlpWrap, networkChecker, logger = null) {
        this._ytDlpWrap = ytDlpWrap;
        this._networkChecker = networkChecker;
        this._logger = logger;
    }

    /**
     * فحص التنسيقات المتاحة للفيديو
     * @param {string} url - رابط الفيديو
     * @returns {Promise<Object>} معلومات التنسيقات
     */
    async inspectFormats(url) {
        if (!url) {
            throw new Error('URL is required');
        }

        // التحقق من الاتصال بالإنترنت
        const isConnected = await this._networkChecker.checkInternetConnection();
        if (!isConnected) {
            throw new Error('No internet connection. Please check your network connection and try again.');
        }

        const info = await this._ytDlpWrap.getVideoInfo(url);
        return this._formatVideoInfo(info);
    }

    /**
     * استخراج المعلومات الأساسية للفيديو
     * @param {string} url - رابط الفيديو
     * @returns {Promise<Object>} معلومات الفيديو
     */
    async extractMetadata(url) {
        if (!url) {
            throw new Error('URL is required');
        }

        // التحقق من الاتصال بالإنترنت
        const isConnected = await this._networkChecker.checkInternetConnection();
        if (!isConnected) {
            throw new Error('No internet connection. Please check your network connection and try again.');
        }

        const info = await this._ytDlpWrap.getVideoInfo(url);
        return this._extractMetadata(info);
    }

    /**
     * تنسيق معلومات الفيديو من yt-dlp-wrap-plus
     * @param {Object} info - المعلومات الخام من yt-dlp
     * @returns {Object} معلومات منسقة
     */
    _formatVideoInfo(info) {
        const formats = (info.formats || []).map(f => ({
            formatId: f.format_id,
            ext: f.ext,
            resolution: f.resolution || null,
            fps: f.fps || null,
            acodec: f.acodec,
            vcodec: f.vcodec,
            filesize: f.filesize,
            formatNote: f.format_note
        }));

        return {
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            formats: formats
        };
    }

    /**
     * استخراج البيانات الوصفية الأساسية
     * @param {Object} info - المعلومات الخام من yt-dlp
     * @returns {Object} البيانات الوصفية
     */
    _extractMetadata(info) {
        return {
            id: info.id,
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            uploader: info.uploader,
            webpageUrl: info.webpage_url
        };
    }
}

module.exports = MetadataExtractor;
