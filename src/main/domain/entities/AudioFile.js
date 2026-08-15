const BaseFile = require('./BaseFile');

/**
 * AudioFile
 * Represents an audio file format from yt-dlp
 */
class AudioFile extends BaseFile {
    constructor({
        id = null,
        name = '',
        extension = '',
        sourceUrl = '',
        storagePath = null,
        formatId = '',
        abr = null,
        codec = '',
        fileSizeApprox = null
    } = {}) {
        super({ id, name, extension, sourceUrl, storagePath, type: 'audio' });
        this.formatId = formatId;
        this.abr = abr;
        this.codec = codec;
        this.fileSizeApprox = fileSizeApprox;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            formatId: this.formatId,
            abr: this.abr,
            codec: this.codec,
            fileSizeApprox: this.fileSizeApprox
        };
    }

    static fromJSON(data) {
        return new AudioFile({
            id: data.id,
            name: data.name,
            extension: data.extension,
            sourceUrl: data.sourceUrl,
            storagePath: data.storagePath,
            formatId: data.formatId,
            abr: data.abr,
            codec: data.codec,
            fileSizeApprox: data.fileSizeApprox
        });
    }
}

module.exports = AudioFile;
