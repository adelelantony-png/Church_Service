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
        // 1. جلب جميع المواد الخاصة بفرقة الطالب
        const subjectsSnapshot = await db.collection('subjects').where('level', '==', level).get();
        let subjects = [];
        subjectsSnapshot.forEach(doc => {
            subjects.push({ id: doc.id, ...doc.data() });
        });

        // 2. جلب الشيتات التي سلمها الطالب مسبقاً
        const submittedSnapshot = await db.collection('students').doc(code).collection('sheet_submissions').get();
        let submitted = [];
        submittedSnapshot.forEach(doc => {
            submitted.push(doc.data().subject_name);
        });

        return res.status(200).json({ success: true, subjects, submitted });
    } catch (error) {
        console.error("Firebase Error:", error);
        return res.status(500).json({ success: false, message: 'حدث خطأ في الاتصال بالخادم' });
    }
};