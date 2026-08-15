'use strict';

class ProcessLogFormatter {
    static format(logs) {
  if (!Array.isArray(logs)) return null;
  return logs
    .filter(entry => entry != null && typeof entry === 'object') // تجاهل null/undefined
    .map(entry => entry.type === 'stderr' ? `[ERR] ${entry.text ?? ''}` : (entry.text ?? ''))
    .join('\n');
}
}

module.exports =
    ProcessLogFormatter;