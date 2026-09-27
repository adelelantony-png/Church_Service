const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            })
        });
    } catch (e) { console.error("Firebase Init Error:", e); }
}
const db = admin.firestore();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    // دعم جلب قائمة المخدومين للجدول
    if (req.method === 'GET') {
        try {
            const snapshot = await db.collection('students').orderBy('points', 'desc').get();
            const students = [];
            snapshot.forEach(doc => students.push(doc.data()));
            return res.status(200).json({ success: true, data: students });
        } catch (error) { return res.status(200).json({ success: false, message: error.message }); }
    }

    if (req.method !== 'POST') return res.status(200).json({ success: false, message: 'مسموح فقط بـ POST و GET' });

    try {
        let bodyData = req.body;
        if (typeof bodyData === 'string') { try { bodyData = JSON.parse(bodyData); } catch (e) { bodyData = {}; } }
        if (!bodyData) bodyData = {};
        
        // استخراج البيانات سواء كانت في payload أو لا
        let data = bodyData.payload ? bodyData.payload : bodyData;

        // إضافة يدوية
        const code = String(data.code || '').trim();
        const name = String(data.name || '').trim();

        if (!code || !name) return res.status(200).json({ success: false, message: `تأكد من إدخال الكود والاسم` });

        const docRef = db.collection('students').doc(code);
        const docSnap = await docRef.get();
        if (docSnap.exists) return res.status(200).json({ success: false, message: `الكود (${code}) مسجل مسبقاً!` });

        await docRef.set({
            code: code, name: name,
            level: String(data.level || 'الفرقة الأولى').trim(),
            points: Number(data.points || 0),
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ success: true, message: `تم إضافة (${name}) بنجاح!` });
    } catch (error) {
        return res.status(200).json({ success: false, message: `خطأ: ${error.message}` });
    }
};
