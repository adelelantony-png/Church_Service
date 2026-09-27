/**
 * محرك المزامنة التلقائية لحالات عدم الاتصال (Offline Sync Engine)
 */
const SyncEngine = {
    QUEUE_KEY: 'church_offline_sync_queue',

    // حفظ الطلب داخل الطابور المحلي
    enqueue(endpoint, payload) {
        const queue = this.getQueue();
        queue.push({
            id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            endpoint: endpoint,
            payload: payload,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    },

    getQueue() {
        return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
    },

    // إرسال جميع الطلبات المتراكمة للسيرفر
    async processQueue() {
        if (!navigator.onLine) return;

        let queue = this.getQueue();
        if (queue.length === 0) return;

        const failedTasks = [];

        for (const task of queue) {
            try {
                const response = await fetch(task.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task.payload)
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    failedTasks.push(task);
                }
            } catch (err) {
                // مشكلة في الشبكة أثناء الإرسال، نحتفظ بالمهمة للمحاولة القادمة
                failedTasks.push(task);
            }
        }

        localStorage.setItem(this.QUEUE_KEY, JSON.stringify(failedTasks));

        if (failedTasks.length === 0) {
            if (typeof ErrorNotifier !== 'undefined') {
                ErrorNotifier.showToast('تمت مزامنة جميع التسجيلات المؤجلة مع السيرفر بنجاح!', 'success');
            }
        }
    }
};

// الاستماع لعودة الاتصال ومعالجة الطابور تلقائياً
window.addEventListener('online', () => {
    SyncEngine.processQueue();
});
