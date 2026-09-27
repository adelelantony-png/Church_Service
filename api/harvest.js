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
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'طريقة الطلب غير مسموحة' });
    }

    const { code, level } = req.query;

    if (!code || !level) {
        return res.status(400).json({ success: false, message: 'بيانات غير مكتملة' });
    }

    try {
        // 1. جلب نقاط المخدوم
        const studentDoc = await db.collection('students').doc(code).get();
        const points = studentDoc.exists ? (studentDoc.data().points || 0) : 0;

        // 2. حساب عدد أيام قراءة الكتاب المقدس المنجزة
        const readingsSnapshot = await db.collection('students').doc(code).collection('reading_logs').get();
        const bibleCount = readingsSnapshot.size;

        // 3. حساب عدد الشيتات المسلمة
        const sheetsSnapshot = await db.collection('students').doc(code).collection('sheet_submissions').get();
        const submittedSheets = sheetsSnapshot.size;

        // 4. حساب إجمالي عدد الشيتات المطلوبة لهذه الفرقة
        const totalSubjectsSnapshot = await db.collection('subjects').where('level', '==', level).get();
        const totalSubjects = totalSubjectsSnapshot.size;

        // 5. حساب عدد أيام النوتة الروحية المسجلة
        const spiritualSnapshot = await db.collection('students').doc(code).collection('daily_logs').get();
        const spiritualCount = spiritualSnapshot.size;

        return res.status(200).json({
            success: true,
            data: {
                points: points,
                bibleCount: bibleCount,
                totalPlanDays: 366,
                submittedSheets: submittedSheets,
                totalSubjects: totalSubjects,
                spiritualCount: spiritualCount
            }
        });
    } catch (error) {
        console.error("Firebase Error:", error);
        return res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات الحصاد' });
    }
};