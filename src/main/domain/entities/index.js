/**
 * LinkHub Models Gateway
 * البوابة المركزية لنماذج البيانات (Classes)
 */

const BaseNode = require('./BaseNode');
const Device = require('./Device');
const HttpFile = require('./HttpFile');
const MediaNode = require('./MediaNode');
const BaseFile = require('./BaseFile');
const VideoFile = require('./VideoFile');
const AudioFile = require('./AudioFile');

module.exports = {
    BaseNode,
    Device,
    HttpFile,
    MediaNode,
    BaseFile,
    VideoFile,
    AudioFile
};
