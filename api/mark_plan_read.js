const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        })
    });
}

const db = admin.firestore();

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'طريقة غير مسموحة' });
    }

    const { code, month, day, reading } = req.body;
    const cleanCode = String(code || '').trim();

    if (!cleanCode) {
        return res.status(400).json({ success: false, message: 'كود المخدوم مفقود' });
    }

    try {
        let studentRef = db.collection('students').doc(cleanCode);
        let studentDoc = await studentRef.get();

        // دعم حساب الأدمن تلقائياً للتجربة إذا لم يكن موجوداً
        if (!studentDoc.exists && cleanCode.toLowerCase() === 'admin') {
            await studentRef.set({
                name: 'الخادم المسؤول',
                level: 'الإدارة العامة',
                points: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            studentDoc = await studentRef.get();
        }

        // البحث بالحقل الداخلي code في حال لم يكن الـ ID مطابقاً
        if (!studentDoc.exists) {
            let qSnap = await db.collection('students').where('code', '==', cleanCode).limit(1).get();
            if (qSnap.empty && !isNaN(cleanCode)) {
                qSnap = await db.collection('students').where('code', '==', Number(cleanCode)).limit(1).get();
            }
            if (!qSnap.empty) {
                studentDoc = qSnap.docs[0];
                studentRef = studentDoc.ref;
            }
        }

        if (!studentDoc.exists) {
            return res.status(404).json({
                success: false,
                message: `الكود (${cleanCode}) غير مسجل في قاعدة البيانات.`
            });
        }

        const m = parseInt(month) || (new Date().getMonth() + 1);
        const d = parseInt(day) || new Date().getDate();
        const logId = `${m}-${d}`;

        // 1. تسجيل قراءة اليوم
        await studentRef.collection('daily_reading_logs').doc(logId).set({
            plan_month: m,
            plan_day: d,
            reading_text: reading || 'قراءة اليوم',
            is_completed: 1,
            read_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. تحديث النقاط وحسابها بأمان
        const currentData = studentDoc.data() || {};
        let currentPoints = 0;
        if (typeof currentData.points === 'number') {
            currentPoints = currentData.points;
        } else if (currentData.points && !isNaN(currentData.points)) {
            currentPoints = parseInt(currentData.points);
        }

        const newPoints = currentPoints + 5;

        await studentRef.set({
            points: newPoints,
            last_activity: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.status(200).json({
            success: true,
            message: 'تم تسجيل قراءة اليوم وإضافة 5 نقاط بنجاح!',
            points: newPoints
        });

    } catch (error) {
        console.error("Firebase Error in mark_plan_read:", error);
        return res.status(500).json({
            success: false,
            message: 'خطأ أثناء الحفظ في قاعدة البيانات: ' + error.message
        });
    }
};
