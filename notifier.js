/**
 * نظام التنبيهات وإظهار وتوثيق الأخطاء (Error Logger & Toast)
 */
const ErrorNotifier = {
    initContainer() {
        let box = document.getElementById('globalToastContainer');
        if (!box) {
            box = document.createElement('div');
            box.id = 'globalToastContainer';
            box.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
            box.style.zIndex = '9999';
            box.style.width = '92%';
            box.style.maxWidth = '500px';
            document.body.appendChild(box);
        }
        return box;
    },

    showToast(message, type = 'danger') {
        const container = this.initContainer();
        const toast = document.createElement('div');
        
        let icon = 'fa-circle-exclamation';
        let bgClass = 'alert-danger';
        
        if (type === 'success') {
            icon = 'fa-circle-check';
            bgClass = 'alert-success';
        } else if (type === 'warning') {
            icon = 'fa-triangle-exclamation';
            bgClass = 'alert-warning';
        }

        toast.className = `alert ${bgClass} alert-dismissible fade show shadow-lg border-0 rounded-4 d-flex align-items-center mb-2`;
        toast.innerHTML = `
            <i class="fa-solid ${icon} fs-5 me-2"></i>
            <div class="flex-grow-1 fw-bold small">${message}</div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    },

    // تسجيل الخطأ التقني بالتفصيل وإظهار رسالة مبسطة للمستخدم
    logAndNotify(friendlyMessage, technicalError) {
        console.group(`[Service App Error] - ${new Date().toLocaleTimeString()}`);
        console.error('Friendly Text:', friendlyMessage);
        console.error('Technical Stack:', technicalError);
        console.groupEnd();

        let details = technicalError?.message || '';
        let fullMessage = friendlyMessage;
        if (details && !details.includes('Failed to fetch')) {
            fullMessage += ` (${details})`;
        }
        this.showToast(fullMessage, 'danger');
    }
};

// التقاط أي أخطاء غير معالجة عامة بالصفحة
window.addEventListener('unhandledrejection', (event) => {
    ErrorNotifier.logAndNotify('حدث خطأ غير متوقع في المعالجة البرمجية', event.reason);
});
