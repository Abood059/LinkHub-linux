const BaseFile = require('./BaseFile');

/**
 * VideoFile
 * Represents a video file format from yt-dlp
 */
class VideoFile extends BaseFile {
    constructor({
        id = null,
        name = '',
        extension = '',
        sourceUrl = '',
        storagePath = null,
        formatId = '',
        resolution = '',
        fps = null,
        codec = '',
        width = null,
        height = null,
        fileSizeApprox = null
    } = {}) {
        super({ id, name, extension, sourceUrl, storagePath, type: 'video' });
        this.formatId = formatId;
        this.resolution = resolution;
        this.fps = fps;
        this.codec = codec;
        this.width = width;
        this.height = height;
        this.fileSizeApprox = fileSizeApprox;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            formatId: this.formatId,
            resolution: this.resolution,
            fps: this.fps,
            codec: this.codec,
            width: this.width,
            height: this.height,
            fileSizeApprox: this.fileSizeApprox
        };
    }

    static fromJSON(data) {
        return new VideoFile({
            id: data.id,
            name: data.name,
            extension: data.extension,
            sourceUrl: data.sourceUrl,
            storagePath: data.storagePath,
            formatId: data.formatId,
            resolution: data.resolution,
            fps: data.fps,
            codec: data.codec,
            width: data.width,
            height: data.height,
            fileSizeApprox: data.fileSizeApprox
        });
    }
}

module.exports = VideoFile;
