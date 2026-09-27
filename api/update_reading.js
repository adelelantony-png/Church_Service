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

    const { code, book, chapter, status } = req.body;

    if (!code || !book || !chapter) {
        return res.status(400).json({ success: false, message: 'بيانات غير مكتملة' });
    }

    try {
        // المرجع لمكان حفظ القراءة: students/{code}/reading_logs/{book_chapter}
        const logRef = db.collection('students').doc(code).collection('reading_logs').doc(`${book}_${chapter}`);

        if (status === 1) {
            // تسجيل القراءة
            await logRef.set({
                book_name: book,
                chapter_num: parseInt(chapter),
                is_read: 1,
                read_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } else {
            // إلغاء القراءة
            await logRef.delete();
        }

        return res.status(200).json({ success: true, is_read: status });
    } catch (error) {
        console.error("Firebase Error:", error);
        return res.status(500).json({ success: false, message: 'فشل الحفظ في السيرفر' });
    }
};