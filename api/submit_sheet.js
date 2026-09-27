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
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'طريقة الطلب غير مسموحة' });
    }

    const { code, subject, q1, q2 } = req.body;

    if (!code || !subject || !q1 || !q2) {
        return res.status(400).json({ success: false, message: 'تأكد من كتابة جميع الإجابات' });
    }

    try {
        // حفظ الإجابات في مجموعة فرعية (sheet_submissions) داخل وثيقة الطالب
        const submissionRef = db.collection('students').doc(code).collection('sheet_submissions').doc(subject);

        await submissionRef.set({
            subject_name: subject,
            q1_answer: q1,
            q2_answer: q2,
            submitted_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.status(200).json({ success: true, message: 'تم تسليم إجابات الشيت بنجاح ورصدها في درجاتك!' });
    } catch (error) {
        console.error("Firebase Error:", error);
        return res.status(500).json({ success: false, message: 'حدث خطأ أثناء حفظ الإجابات' });
    }
};