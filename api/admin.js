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

    // --- جلب البيانات (GET) ---
    if (req.method === 'GET') {
        try {
            const type = req.query.type; // لمعرفة هل نجلب المخدومين أم الشيتات
            
            if (type === 'sheets') {
                const snapshot = await db.collection('sheets').orderBy('created_at', 'desc').get();
                const sheets = [];
                snapshot.forEach(doc => sheets.push({ id: doc.id, ...doc.data() }));
                return res.status(200).json({ success: true, data: sheets });
            } else {
                const snapshot = await db.collection('students').orderBy('level').get();
                const students = [];
                snapshot.forEach(doc => students.push(doc.data()));
                return res.status(200).json({ success: true, data: students });
            }
        } catch (error) {
            return res.status(200).json({ success: false, message: error.message });
        }
    }

    if (req.method !== 'POST') return res.status(200).json({ success: false, message: 'مسموح فقط بـ POST و GET' });

    // --- معالجة العمليات (POST) ---
    try {
        let bodyData = req.body;
        if (typeof bodyData === 'string') { try { bodyData = JSON.parse(bodyData); } catch (e) { bodyData = {}; } }
        let payload = bodyData.payload ? bodyData.payload : bodyData;
        const action = payload.action;

        // 1. إضافة مخدوم يدوي
        if (action === 'add_student') {
            const code = String(payload.code || '').trim();
            const name = String(payload.name || '').trim();
            if (!code || !name) return res.status(200).json({ success: false, message: `الكود والاسم مطلوبان` });

            const docRef = db.collection('students').doc(code);
            if ((await docRef.get()).exists) return res.status(200).json({ success: false, message: `الكود مستخدم مسبقاً!` });

            await docRef.set({
                code: code,
                name: name,
                level: payload.level || 'الفرقة الأولى',
                password: payload.password || code, // كلمة المرور الافتراضية هي الكود
                must_change_password: true,         // إجباره على التغيير في أول دخول
                points: Number(payload.points || 0),
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(200).json({ success: true, message: `تم إضافة (${name}) بنجاح!` });
        }

        // 2. استيراد من إكسيل (دفعة كاملة)
        if (action === 'import_excel') {
            const batch = db.batch();
            let count = 0;
            for (const student of payload.students) {
                const code = String(student.code || '').trim();
                if (!code) continue;
                const docRef = db.collection('students').doc(code);
                batch.set(docRef, {
                    code: code,
                    name: String(student.name || '').trim(),
                    level: String(student.level || 'الفرقة الأولى').trim(),
                    password: String(student.password || code), 
                    must_change_password: true,
                    points: Number(student.points || 0),
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                count++;
            }
            await batch.commit();
            return res.status(200).json({ success: true, message: `تم حفظ ${count} مخدوم بنجاح!` });
        }

        // 3. حذف مخدوم
        if (action === 'delete_student') {
            const code = String(payload.code || '').trim();
            await db.collection('students').doc(code).delete();
            return res.status(200).json({ success: true, message: `تم حذف المخدوم بنجاح` });
        }

        // 4. ترحيل دفعة من مرحلة لمرحلة
        if (action === 'promote_students') {
            const fromLevel = payload.fromLevel;
            const toLevel = payload.toLevel;
            
            const snapshot = await db.collection('students').where('level', '==', fromLevel).get();
            if (snapshot.empty) return res.status(200).json({ success: false, message: `لا يوجد مخدومين في ${fromLevel}` });

            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { level: toLevel });
            });
            await batch.commit();
            return res.status(200).json({ success: true, message: `تم ترحيل ${snapshot.size} مخدوم إلى ${toLevel} بنجاح!` });
        }

        // 5. إضافة شيت جديد
        if (action === 'add_sheet') {
            await db.collection('sheets').add({
                title: payload.title,
                link: payload.link,
                level: payload.level,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(200).json({ success: true, message: `تم إضافة الشيت بنجاح!` });
        }

        return res.status(200).json({ success: false, message: `إجراء غير معروف` });

    } catch (error) {
        return res.status(200).json({ success: false, message: `خطأ: ${error.message}` });
    }
};
