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
        return res.status(405).json({ success: false, message: 'طريقة الطلب غير مسموحة' });
    }

    const { code, password } = req.body;
    const cleanCode = String(code || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanCode) {
        return res.status(400).json({ success: false, message: 'يرجى إدخال الكود' });
    }

    try {
        // 1. حساب الأدمن
        if (cleanCode.toLowerCase() === 'admin') {
            if (cleanPassword === 'admin123') {
                return res.status(200).json({
                    success: true,
                    role: 'admin',
                    data: {
                        code: 'admin',
                        name: 'الخادم المسؤول',
                        level: 'الإدارة العامة'
                    }
                });
            } else {
                return res.status(401).json({ success: false, message: 'كلمة مرور الأدمن غير صحيحة' });
            }
        }

        // 2. البحث عن المخدوم بجميع الطرق المحتملة
        let studentData = null;
        let finalCode = cleanCode;

        // أ) البحث بالـ Document ID المباشر
        const directDoc = await db.collection('students').doc(cleanCode).get();
        if (directDoc.exists) {
            studentData = directDoc.data();
            finalCode = directDoc.id;
        } else {
            // ب) البحث كحقل "code" كنص
            const qStr = await db.collection('students').where('code', '==', cleanCode).limit(1).get();
            if (!qStr.empty) {
                studentData = qStr.docs[0].data();
                finalCode = qStr.docs[0].id;
            } else if (!isNaN(cleanCode)) {
                // ج) البحث كحقل "code" كرقم
                const qNum = await db.collection('students').where('code', '==', Number(cleanCode)).limit(1).get();
                if (!qNum.empty) {
                    studentData = qNum.docs[0].data();
                    finalCode = qNum.docs[0].id;
                }
            }
        }

        if (!studentData) {
            return res.status(404).json({
                success: false,
                message: `الكود (${cleanCode}) غير مسجل في قاعدة البيانات. تأكد من إضافته أولاً من لوحة تحكم الأدمن.`
            });
        }

        return res.status(200).json({
            success: true,
            role: 'student',
            data: {
                code: finalCode,
                name: studentData.name || 'مخدوم',
                level: studentData.level || 'الفرقة الأولى',
                birthdate: studentData.birthdate || '',
                points: studentData.points || 0
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ بالسيرفر: ' + error.message });
    }
};
