const { randomUUID } = require('crypto');
const FileStatus = require('../value-objects/FileStatus');

/**
 * BaseFile
 * Abstract base class for file representations (VideoFile, AudioFile)
 */
class BaseFile {
    constructor({
        id = null,
        name = '',
        extension = '',
        sourceUrl = '',
        storagePath = null,
        type = null
    } = {}) {
        this.id = id || randomUUID();
        this.name = name;
        this.extension = extension;
        this.sourceUrl = sourceUrl;
        this.storagePath = storagePath;
        this.type = type;
        this.fileStatus = new FileStatus();
    }

    /**
     * Returns a plain object representation suitable for IPC transmission or storage
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            extension: this.extension,
            sourceUrl: this.sourceUrl,
            storagePath: this.storagePath,
            type: this.type,
            fileStatus: this.fileStatus.toJSON()
        };
    }
}

module.exports = BaseFile;
