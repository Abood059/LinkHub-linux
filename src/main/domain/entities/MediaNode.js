const BaseNode = require('./BaseNode');

/**
 * كلاس يمثل عقدة الوسائط (Media Node)
 * تركز فقط على تتبع المهام التي تنفذها أدوات مثل yt-dlp أو axios.
 */
class MediaNode extends BaseNode {
    constructor({ id, deviceFriendlyName }) {
        // استدعاء الأب وتحديد النوع
        super({ id, deviceFriendlyName, type: 'MEDIA_NODE' });

        // قائمة المهام النشطة (روابط تحميل، تحويل صيغ، إلخ)
        this.activeTasks = []; 
    }

    /**
     * إضافة مهمة تحميل (مثلاً كائن يحتوي على الرابط والنسبة المئوية)
     */
    addTask(task) {
        this.activeTasks.push(task);
    }

   

    toJSON() {
        return {
            ...super.toJSON()
            // لا توجد خصائص إضافية للحفظ حالياً، نكتفي ببيانات الأب
        };
    }

    static fromJSON(data) {
        return new MediaNode(data);
    }
}

module.exports = MediaNode;