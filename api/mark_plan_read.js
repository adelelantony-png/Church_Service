const admin = require('firebase-admin');

// تهيئة Firebase Admin إذا لم يتم تهيئتها مسبقاً
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method !== 'POST') {
        return res.status(200).json({ success: false, message: 'مسموح فقط بطلبات POST' });
    }

    try {
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) { bodyData = {}; }
        }
        let payload = bodyData.payload ? bodyData.payload : bodyData;
        
        const code = String(payload.code || '').trim();
        const month = payload.month;
        const day = payload.day;

        if (!code) {
            return res.status(200).json({ success: false, message: 'كود المخدوم مفقود' });
        }

        // مرجع مستند المخدوم
        const studentRef = db.collection('students').doc(code);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            return res.status(200).json({ success: false, message: 'المخدوم غير موجود في النظام' });
        }

        const studentData = studentDoc.data();
        
        // 🛡️ [آلية منع التكرار الدقيقة]: استخدام معرف فريد لكل يوم (مثلاً: reading_9_27)
        const readingKey = `read_${month}_${day}`;
        const completedReadings = studentData.completed_readings || {};

        if (completedReadings[readingKey]) {
            return res.status(200).json({ 
                success: false, 
                message: 'لقد قمت بتسجيل إنجاز هذه القراءة مسبقاً ولا يمكن تكرار احتساب النقاط!' 
            });
        }

        // حساب النقاط الحالية بأمان
        const currentPoints = Number(studentData.points || 0);
        const addedPoints = 5; // عدد نقاط القراءة اليومية الثابتة
        const newTotalPoints = currentPoints + addedPoints;

        // تحديث قاعدة البيانات بعملية واحدة دقيقة
        completedReadings[readingKey] = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            reading: payload.reading || 'قراءة يومية'
        };

        await studentRef.update({
            points: newTotalPoints,
            completed_readings: completedReadings
        });

        return res.status(200).json({
            success: true,
            message: 'تم تسجيل الإنجاز وإضافة 5 نقاط بنجاح!',
            points: newTotalPoints
        });

    } catch (error) {
        return res.status(200).json({
            success: false,
            message: `خطأ تقني في السيرفر: ${error.message}`
        });
    }
};
