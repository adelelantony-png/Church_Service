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

    const { action, payload } = req.body;

    try {
        // 1. إضافة مخدوم فردي مع فحص منع تكرار الكود
        if (action === 'add_single_student') {
            const { code, name, birthdate, level } = payload;
            const cleanCode = String(code || '').trim();
            const cleanName = String(name || '').trim();

            if (!cleanCode || !cleanName) {
                return res.status(400).json({ success: false, message: 'يرجى كتابة الاسم والكود' });
            }

            const docRef = db.collection('students').doc(cleanCode);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return res.status(409).json({
                    success: false,
                    message: `تنبيه: الكود (${cleanCode}) مسجل بالفعل باسم (${docSnap.data().name})! لا يمكن تكرار الكود.`
                });
            }

            await docRef.set({
                name: cleanName,
                birthdate: birthdate ? String(birthdate).trim() : '',
                level: level || 'الفرقة الأولى',
                points: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.status(200).json({ success: true, message: `تمت إضافة المخدوم (${cleanName}) بنجاح!` });
        }

        // 2. استيراد ملف إكسيل مجمّع مع كشف الأكواد وتخطي المكرر
        if (action === 'import_students') {
            const { students, import_level } = payload;
            if (!Array.isArray(students) || students.length === 0) {
                return res.status(400).json({ success: false, message: 'لا توجد بيانات صالحة للإدخال' });
            }

            let addedCount = 0;
            let skippedDuplicates = [];

            for (const std of students) {
                const code = String(std.code || '').trim();
                const name = String(std.name || '').trim();
                const birthdate = String(std.birthdate || '').trim();

                if (!code || !name) continue;

                const docRef = db.collection('students').doc(code);
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                    skippedDuplicates.push(code);
                } else {
                    await docRef.set({
                        name: name,
                        birthdate: birthdate,
                        level: import_level || 'الفرقة الأولى',
                        points: 0,
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                    addedCount++;
                }
            }

            let msg = `تمت إضافة ${addedCount} مخدوم بنجاح.`;
            if (skippedDuplicates.length > 0) {
                msg += ` تم تخطي الأكواد التالية لتكرارها مسبقاً: (${skippedDuplicates.join(', ')})`;
            }

            return res.status(200).json({
                success: true,
                message: msg,
                addedCount,
                duplicatesCount: skippedDuplicates.length
            });
        }

        // 3. إضافة مقرر دراسي وشيت
        if (action === 'add_subject') {
            await db.collection('subjects').add({
                level: payload.level,
                title: payload.title,
                sheet_url: payload.sheet_url,
                attachment_file: payload.attachment_file || null,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(200).json({ success: true, message: 'تمت إضافة المقرر والشيت بنجاح!' });
        }

        // 4. ضبط مواعيد الخدمة
        if (action === 'save_settings') {
            await db.collection('settings').doc('service_info').set({
                service_year_name: payload.service_year_name,
                start_date: payload.start_date,
                end_date: payload.end_date,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return res.status(200).json({ success: true, message: 'تم حفظ مواعيد السنة الخدمية بنجاح!' });
        }

        // 5. جلب قائمة كل المخدومين
        if (action === 'get_all_students') {
            const snapshot = await db.collection('students').orderBy('name').get();
            const students = [];
            snapshot.forEach(doc => {
                students.push({
                    code: doc.id,
                    ...doc.data()
                });
            });
            return res.status(200).json({ success: true, students });
        }

        // 6. جلب تفاصيل وإنجاز مخدوم محدد
        if (action === 'get_student_details') {
            const { code } = payload;
            if (!code) return res.status(400).json({ success: false, message: 'الكود مطلوب' });

            const studentDoc = await db.collection('students').doc(String(code).trim()).get();
            if (!studentDoc.exists) {
                return res.status(404).json({ success: false, message: 'المخدوم غير موجود' });
            }

            const readingLogsSnap = await db.collection('students')
                .doc(String(code).trim())
                .collection('daily_reading_logs')
                .get();
            const readingLogs = [];
            readingLogsSnap.forEach(d => readingLogs.push(d.data()));

            const notesSnap = await db.collection('students')
                .doc(String(code).trim())
                .collection('daily_logs')
                .get();
            const notes = [];
            notesSnap.forEach(d => notes.push({ id: d.id, ...d.data() }));

            return res.status(200).json({
                success: true,
                student: { code: studentDoc.id, ...studentDoc.data() },
                readingCount: readingLogs.length,
                readingLogs,
                notesCount: notes.length,
                notes
            });
        }

        // 7. حساب معدل استهلاك البيانات وقاعدة البيانات الحية (Usage Stats)
        if (action === 'get_usage_stats') {
            const studentsSnap = await db.collection('students').count().get();
            const totalStudents = studentsSnap.data().count;

            const subjectsSnap = await db.collection('subjects').count().get();
            const totalSubjects = subjectsSnap.data().count;

            const readingsSnap = await db.collectionGroup('daily_reading_logs').count().get();
            const totalReadings = readingsSnap.data().count;

            const notesSnap = await db.collectionGroup('daily_logs').count().get();
            const totalNotes = notesSnap.data().count;

            const totalDocs = totalStudents + totalSubjects + totalReadings + totalNotes;
            // تقدير تقريبي للحجم التخزيني (متوسط الوثيقة 0.6 كيلوبايت)
            const estimatedStorageKB = (totalDocs * 0.6).toFixed(1);

            return res.status(200).json({
                success: true,
                stats: {
                    totalStudents,
                    totalSubjects,
                    totalReadings,
                    totalNotes,
                    totalDocs,
                    estimatedStorageKB,
                    // الحصص المجانية الثابتة
                    firestoreFreeDailyReads: 50000,
                    firestoreFreeDailyWrites: 20000,
                    firestoreFreeStorageMB: 1024, // 1 GB
                    vercelBandwidthGB: 100,
                    vercelServerlessLimit: 1000000
                }
            });
        }

        return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
    } catch (error) {
        console.error("Firebase Admin Error:", error);
        return res.status(500).json({ success: false, message: 'حدث خطأ في تنفيذ الطلب على السيرفر', error: error.message });
    }
};
