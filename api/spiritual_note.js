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
    // التأكد من أن الطلب من نوع POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'طريقة الطلب غير مسموحة' });
    }

    const { code, date, baker, ghoroub, noam, fasting, mass } = req.body;

    if (!code || !date) {
        return res.status(400).json({ success: false, message: 'تأكد من إدخال الكود والتاريخ' });
    }

    try {
        // المرجع لمكان حفظ النوتة: students/{code}/daily_logs/{date}
        const dailyLogRef = db.collection('students').doc(code).collection('daily_logs').doc(date);

        // حفظ أو تحديث بيانات اليوم
        await dailyLogRef.set({
            prayed_baker: baker ? 1 : 0,
            prayed_ghoroub: ghoroub ? 1 : 0,
            prayed_noam: noam ? 1 : 0,
            fasting: fasting ? 1 : 0,
            attended_mass: mass ? 1 : 0,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.status(200).json({ success: true, message: 'تم تسجيل وسائط النعمة بنجاح!' });
    } catch (error) {
        console.error("Firebase Error:", error);
        return res.status(500).json({ success: false, message: 'حدث خطأ أثناء الحفظ في الخادم' });
    }
};