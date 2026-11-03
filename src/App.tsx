// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutGrid,
  Users,
  Calendar,
  Stethoscope,
  Sparkles,
  Bot,
  RefreshCw,
  UserPlus,
  CalendarPlus,
  Search,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  FileText,
  Activity,
  Send,
} from 'lucide-react';

// ============================================================================
// 1. روابط الـ MockAPI الثابتة الخاصة بك (مستقلة تماماً لمنع أي خطأ 404)
// ============================================================================
const API_ENDPOINTS = {
  SERVICES: 'https://6ae3e1d7933120ae20f941f0.mockapi.io/services',
  PATIENTS: 'https://6ae3e1d7933120ae20f941f0.mockapi.io/patients',
  APPOINTMENTS: 'https://6ae4c8f828393034b08df0d3.mockapi.io/appointments',
};

// مفاتيح التخزين المحلي (كنسخة احتياطية فورية عند انقطاع الإنترنت)
const STORAGE_KEYS = {
  PATIENTS: 'smart_dental_patients_final',
  APPOINTMENTS: 'smart_dental_appointments_final',
  SERVICES: 'smart_dental_services_final',
  VISITS: 'smart_dental_visits_final',
};

// الخدمات الـ 4 الأساسية للعيادة
const DEFAULT_SERVICES = [
  {
    id: '1',
    name: 'كشف عام',
    price: 150,
    duration: '30 دقيقة',
    category: 'عام',
    description: 'فحص شامل للأسنان واللثة مع خطة علاجية متكاملة',
  },
  {
    id: '2',
    name: 'تنظيف وتلميع الأسنان',
    price: 300,
    duration: '45 دقيقة',
    category: 'تجميلي',
    description: 'إزالة الجير والتصبغات وتلميع الأسنان بالموجات فوق الصوتية',
  },
  {
    id: '3',
    name: 'حشو عصب تجميلي',
    price: 600,
    duration: '60 دقيقة',
    category: 'علاجي',
    description: 'علاج الجذور وحشو القنوات العصبية بأحدث الأجهزة الرقمية',
  },
  {
    id: '4',
    name: 'تبييض الأسنان بالليزر',
    price: 850,
    duration: '60 دقيقة',
    category: 'تجميلي',
    description: 'تبييض فوري وآمن للأسنان بالليزر في جلسة واحدة',
  },
];

// ============================================================================
// 2. دوال ذكية لتوحيد البيانات القادمة من n8n (حتى يظهر كل مريض وكل موعد 100%)
// ============================================================================
const normalizeDigits = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
};

const normalizePatientRecord = (raw, index = 0) => {
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id || raw._id || index + 1);
  const name =
    raw.name ||
    raw.patientName ||
    raw.fullName ||
    raw.username ||
    `مريض رقم ${id}`;

  const phone =
    normalizeDigits(
      raw.phone || raw.patientPhone || raw.mobile || raw.phoneNumber || ''
    ).replace(/\s+/g, '') || 'غير مسجل';

  const extractedAge = normalizeDigits(
    raw.age || raw.patientAge || '20'
  ).replace(/[^0-9]/g, '');
  const age = extractedAge || '20';

  const rawGender = String(raw.gender || raw.sex || 'ذكر');
  const gender =
    rawGender.includes('أنثى') ||
    rawGender.includes('انثى') ||
    rawGender.toLowerCase() === 'female'
      ? 'أنثى'
      : 'ذكر';

  const notes =
    raw.notes ||
    raw.medicalHistory ||
    raw.description ||
    raw.comment ||
    'تم التسجيل عبر بوت واتساب المتصل بـ n8n';

  const isFromAI =
    raw.action === 'create_patient' ||
    String(raw.source || '')
      .toLowerCase()
      .includes('n8n') ||
    String(raw.source || '').includes('ذكاء') ||
    String(notes).toLowerCase().includes('n8n') ||
    String(notes).includes('بوت') ||
    !raw.source;

  return {
    id,
    name: String(name).trim(),
    phone: String(phone).trim(),
    age: String(age),
    gender,
    notes: String(notes).trim(),
    source: isFromAI ? 'وكيل الذكاء الاصطناعي (n8n)' : raw.source,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
};

const normalizeAppointmentRecord = (
  raw,
  index = 0,
  servicesList = DEFAULT_SERVICES
) => {
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id || raw._id || index + 1);
  const patientName =
    raw.patientName || raw.name || raw.fullName || `مريض رقم ${id}`;

  const phone =
    normalizeDigits(raw.phone || raw.patientPhone || raw.mobile || '').replace(
      /\s+/g,
      ''
    ) || 'غير مسجل';

  const serviceName =
    raw.serviceName || raw.service || raw.type || raw.treatment || 'كشف عام';

  const matchedService = servicesList.find(
    (s) =>
      String(s.name).trim().includes(String(serviceName).trim()) ||
      String(serviceName).trim().includes(String(s.name).trim())
  );

  const rawPrice = normalizeDigits(raw.price || raw.cost || raw.amount || '');
  const price =
    Number(rawPrice) || (matchedService ? matchedService.price : 150);

  const rawDate = normalizeDigits(raw.date || raw.appointmentDate || '');
  const date =
    rawDate && rawDate.length >= 8
      ? rawDate.slice(0, 10)
      : new Date().toISOString().split('T')[0];

  const rawTime = normalizeDigits(raw.time || raw.appointmentTime || '');
  const time = rawTime || '16:00';

  const rawStatus = String(raw.status || 'مؤكد').trim();
  let status = 'مؤكد';
  if (rawStatus.includes('ملغ') || rawStatus.toLowerCase().includes('cancel')) {
    status = 'ملغي';
  } else if (
    rawStatus.includes('مكتمل') ||
    rawStatus.toLowerCase().includes('complet')
  ) {
    status = 'مكتمل';
  } else if (
    rawStatus.includes('انتظار') ||
    rawStatus.includes('معلق') ||
    rawStatus.toLowerCase().includes('pend')
  ) {
    status = 'قيد الانتظار';
  } else {
    status = 'مؤكد';
  }

  const isFromAI =
    !raw.source ||
    String(raw.source).toLowerCase().includes('n8n') ||
    String(raw.source).includes('ذكاء') ||
    String(raw.bookingMethod || '').includes('n8n');

  return {
    id,
    patientName: String(patientName).trim(),
    phone: String(phone).trim(),
    serviceName: String(serviceName).trim(),
    price,
    date,
    time,
    status,
    source: isFromAI ? 'وكيل الذكاء الاصطناعي (n8n)' : raw.source,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
};

const safeReadStorage = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  // التبويب النشط
  const [activeTab, setActiveTab] = useState('dashboard');

  // البيانات الأساسية (تقرأ مبدئياً من localStorage ثم تتزامن فوراً مع MockAPI كمرجع أساسي)
  const [patients, setPatients] = useState(() =>
    safeReadStorage(STORAGE_KEYS.PATIENTS, [])
  );
  const [appointments, setAppointments] = useState(() =>
    safeReadStorage(STORAGE_KEYS.APPOINTMENTS, [])
  );
  const [services, setServices] = useState(() =>
    safeReadStorage(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES)
  );
  const [visits, setVisits] = useState(() =>
    safeReadStorage(STORAGE_KEYS.VISITS, [])
  );

  // حالات التحميل والاتصال
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushingServices, setIsPushingServices] = useState(false);
  const [apiStatus, setApiStatus] = useState({
    patientsOk: true,
    appointmentsOk: true,
    servicesOk: true,
  });
  const [toast, setToast] = useState(null);
  const [copiedText, setCopiedText] = useState('');

  // البحث والفلترة
  const [patientSearch, setPatientSearch] = useState('');
  const [appointmentFilter, setAppointmentFilter] = useState('الكل');

  // النوافذ المنبثقة (Modals)
  const [patientModal, setPatientModal] = useState({
    open: false,
    editing: null,
  });
  const [appointmentModal, setAppointmentModal] = useState({
    open: false,
    editing: null,
    prefill: null,
  });
  const [serviceModal, setServiceModal] = useState({
    open: false,
    editing: null,
  });
  const [visitModal, setVisitModal] = useState({ open: false, editing: null });

  // دالة إظهار الإشعارات
  const showNotification = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  // حفظ تلقائي في localStorage كلما تغيرت الحالة
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    } catch {}
  }, [patients]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.APPOINTMENTS,
        JSON.stringify(appointments)
      );
    } catch {}
  }, [appointments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
    } catch {}
  }, [services]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(visits));
    } catch {}
  }, [visits]);

  // ============================================================================
  // 3. المزامنة الحقيقية مع MockAPI (إذا كان الـ API = 0 يصبح 0، وإذا فيه 3 يظهر 3)
  // ============================================================================
  const syncAllFromAPI = useCallback(
    async (showMsg = true) => {
      if (showMsg) setIsSyncing(true);

      let currentServices = services;

      // أ) جلب الخدمات من الرابط المستقل فقط
      try {
        const resSrv = await fetch(API_ENDPOINTS.SERVICES, {
          cache: 'no-store',
        });
        if (resSrv.ok) {
          const srvData = await resSrv.json();
          if (Array.isArray(srvData)) {
            setApiStatus((prev) => ({ ...prev, servicesOk: true }));
            if (srvData.length > 0) {
              const normalizedSrv = srvData.map((s, idx) => ({
                id: String(s.id || idx + 1),
                name: s.name || s.serviceName || 'خدمة طبية',
                price: Number(normalizeDigits(s.price || 150)) || 150,
                duration: s.duration || '30 دقيقة',
                category: s.category || 'عام',
                description:
                  s.description || 'خدمة طبية متكاملة بعيادة الأسنان',
              }));
              currentServices = normalizedSrv;
              setServices(normalizedSrv);
            }
          }
        } else if (resSrv.status === 404) {
          setApiStatus((prev) => ({ ...prev, servicesOk: false }));
        }
      } catch {
        // في حال انقطاع الإنترنت نحتفظ بما في الذاكرة
      }

      // ب) جلب المرضى من الرابط المستقل (بدون /services/1/patients نهائياً)
      try {
        const resPat = await fetch(API_ENDPOINTS.PATIENTS, {
          cache: 'no-store',
        });
        if (resPat.ok) {
          const patData = await resPat.json();
          if (Array.isArray(patData)) {
            setApiStatus((prev) => ({ ...prev, patientsOk: true }));
            // هنا الـ API هو المصدر الحقيقي: لو 0 يعرض 0، ولو 3 يعرض الـ 3 كاملين!
            const normalizedPat = patData
              .map((item, idx) => normalizePatientRecord(item, idx))
              .filter(Boolean);
            setPatients(normalizedPat);
            localStorage.setItem(
              STORAGE_KEYS.PATIENTS,
              JSON.stringify(normalizedPat)
            );
          }
        } else if (resPat.status === 404) {
          setApiStatus((prev) => ({ ...prev, patientsOk: false }));
        }
      } catch {
        // في حال خطأ الشبكة نحتفظ بالنسخة المحلية
      }

      // ج) جلب المواعيد من الرابط المستقل
      try {
        const resApp = await fetch(API_ENDPOINTS.APPOINTMENTS, {
          cache: 'no-store',
        });
        if (resApp.ok) {
          const appData = await resApp.json();
          if (Array.isArray(appData)) {
            setApiStatus((prev) => ({ ...prev, appointmentsOk: true }));
            const normalizedApp = appData
              .map((item, idx) =>
                normalizeAppointmentRecord(item, idx, currentServices)
              )
              .filter(Boolean);
            setAppointments(normalizedApp);
            localStorage.setItem(
              STORAGE_KEYS.APPOINTMENTS,
              JSON.stringify(normalizedApp)
            );

            // تحديث الزيارات تلقائياً لأي موعد حالته "مكتمل"
            const completedApps = normalizedApp.filter(
              (a) => a.status === 'مكتمل'
            );
            if (completedApps.length > 0) {
              setVisits((prevVisits) => {
                const visitMap = new Map(
                  prevVisits.map((v) => [String(v.id), v])
                );
                completedApps.forEach((ca) => {
                  const vId = `app_${ca.id}`;
                  if (!visitMap.has(vId)) {
                    visitMap.set(vId, {
                      id: vId,
                      patientName: ca.patientName,
                      phone: ca.phone,
                      serviceName: ca.serviceName,
                      date: ca.date,
                      paidAmount: ca.price || 150,
                      notes: 'زيارة مكتملة مسجلة من جدول المواعيد',
                    });
                  }
                });
                return Array.from(visitMap.values());
              });
            } else if (normalizedApp.length === 0) {
              // إذا تم تصفير المواعيد في الـ API، نصفر الزيارات المرتبطة بها
              setVisits((prevVisits) =>
                prevVisits.filter((v) => !String(v.id).startsWith('app_'))
              );
            }
          }
        } else if (resApp.status === 404) {
          setApiStatus((prev) => ({ ...prev, appointmentsOk: false }));
        }
      } catch {
        // في حال خطأ الشبكة نحتفظ بالنسخة المحلية
      }

      if (showMsg) {
        setIsSyncing(false);
        showNotification('تمت المزامنة الكاملة مع MockAPI بنجاح!');
      }
    },
    [services, showNotification]
  );

  // جلب البيانات تلقائياً عند فتح الصفحة (Reload) وكل 12 ثانية لالتقاط أي حجز جديد من بوت n8n
  useEffect(() => {
    syncAllFromAPI(false);
    const timer = setInterval(() => {
      syncAllFromAPI(false);
    }, 12000);
    return () => clearInterval(timer);
  }, [syncAllFromAPI]);

  // ============================================================================
  // 4. إرسال الخدمات الـ 4 إلى MockAPI بنقرة زر
  // ============================================================================
  const handlePushServicesToAPI = async () => {
    setIsPushingServices(true);
    try {
      const checkRes = await fetch(API_ENDPOINTS.SERVICES, {
        cache: 'no-store',
      });
      if (checkRes.status === 404) {
        showNotification(
          'تنبيه: جدول services غير موجود في MockAPI، تأكد من إنشائه باسم services',
          'error'
        );
        setIsPushingServices(false);
        return;
      }

      const existing = checkRes.ok ? await checkRes.json() : [];
      if (Array.isArray(existing) && existing.length === 0) {
        const uploaded = [];
        for (const srv of services) {
          const postRes = await fetch(API_ENDPOINTS.SERVICES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: srv.name,
              price: Number(srv.price),
              duration: srv.duration,
              category: srv.category,
              description: srv.description,
            }),
          });
          if (postRes.ok) {
            const created = await postRes.json();
            uploaded.push(created);
          }
        }
        if (uploaded.length > 0) {
          setServices(uploaded);
        }
        showNotification(
          `تم إرسال ${services.length} خدمات إلى MockAPI بنجاح!`
        );
      } else {
        showNotification(
          `الخدمات موجودة ومرفوعة بالفعل في MockAPI (${existing.length} خدمات)!`
        );
      }
    } catch {
      showNotification(
        'تعذر الاتصال بـ MockAPI حالياً، الخدمات محفوظة محلياً.',
        'error'
      );
    } finally {
      setIsPushingServices(false);
    }
  };

  // ============================================================================
  // 5. إدارة المرضى (إضافة / تعديل / حذف مباشر في MockAPI + الذاكرة معاً)
  // ============================================================================
  const handleSavePatient = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    const payload = {
      name: form.get('name').trim(),
      phone: normalizeDigits(form.get('phone').trim()),
      age: normalizeDigits(form.get('age').trim()),
      gender: form.get('gender'),
      notes: form.get('notes').trim() || 'تم التسجيل من الاستقبال',
      source: form.get('source') || 'يدوي - الاستقبال',
      createdAt: new Date().toISOString(),
    };

    if (patientModal.editing) {
      const targetId = String(patientModal.editing.id);
      const optimisticPatient = {
        ...patientModal.editing,
        ...payload,
        id: targetId,
      };

      setPatients((prev) =>
        prev.map((p) => (String(p.id) === targetId ? optimisticPatient : p))
      );
      setPatientModal({ open: false, editing: null });

      try {
        const res = await fetch(`${API_ENDPOINTS.PATIENTS}/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(optimisticPatient),
        });
        if (res.ok) {
          const saved = await res.json();
          const norm = normalizePatientRecord(saved);
          setPatients((prev) =>
            prev.map((p) => (String(p.id) === targetId ? norm : p))
          );
        }
        showNotification('تم تعديل بيانات المريض وحفظها في الـ API بنجاح!');
      } catch {
        showNotification('تم حفظ التعديل محلياً.', 'info');
      }
    } else {
      setPatientModal({ open: false, editing: null });
      try {
        const res = await fetch(API_ENDPOINTS.PATIENTS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          const norm = normalizePatientRecord(created);
          setPatients((prev) => [...prev, norm]);
          showNotification('تم تسجيل المريض الجديد في الـ API بنجاح!');
        } else {
          const fallbackPat = normalizePatientRecord({
            ...payload,
            id: String(Date.now()),
          });
          setPatients((prev) => [...prev, fallbackPat]);
          showNotification(
            'تمت إضافة المريض محلياً (تحقق من جدول patients في MockAPI).',
            'info'
          );
        }
      } catch {
        const fallbackPat = normalizePatientRecord({
          ...payload,
          id: String(Date.now()),
        });
        setPatients((prev) => [...prev, fallbackPat]);
        showNotification('تمت إضافة المريض محلياً.', 'info');
      }
    }
  };

  const handleDeletePatient = async (id) => {
    const strId = String(id);
    setPatients((prev) => prev.filter((p) => String(p.id) !== strId));
    try {
      await fetch(`${API_ENDPOINTS.PATIENTS}/${strId}`, { method: 'DELETE' });
      showNotification('تم حذف ملف المريض نهائياً من التطبيق ومن MockAPI!');
    } catch {
      showNotification('تم حذف المريض.', 'info');
    }
  };

  // ============================================================================
  // 6. إدارة المواعيد (إضافة / تعديل / تغيير حالة / حذف مباشر في MockAPI)
  // ============================================================================
  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const srvName = form.get('serviceName');
    const foundService = services.find((s) => s.name === srvName);

    const payload = {
      patientName: form.get('patientName').trim(),
      phone: normalizeDigits(form.get('phone').trim()),
      serviceName: srvName,
      price: foundService
        ? foundService.price
        : Number(normalizeDigits(form.get('price') || 150)),
      date: normalizeDigits(form.get('date')),
      time: normalizeDigits(form.get('time')),
      status: form.get('status') || 'مؤكد',
      source: form.get('source') || 'يدوي - الاستقبال',
      createdAt: new Date().toISOString(),
    };

    if (appointmentModal.editing) {
      const targetId = String(appointmentModal.editing.id);
      const updatedObj = {
        ...appointmentModal.editing,
        ...payload,
        id: targetId,
      };

      setAppointments((prev) =>
        prev.map((a) => (String(a.id) === targetId ? updatedObj : a))
      );
      setAppointmentModal({ open: false, editing: null, prefill: null });

      try {
        const res = await fetch(`${API_ENDPOINTS.APPOINTMENTS}/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedObj),
        });
        if (res.ok) {
          const saved = await res.json();
          const norm = normalizeAppointmentRecord(saved, 0, services);
          setAppointments((prev) =>
            prev.map((a) => (String(a.id) === targetId ? norm : a))
          );
        }
        showNotification('تم تعديل الموعد وحفظه في الـ API بنجاح!');
      } catch {
        showNotification('تم تعديل الموعد.', 'info');
      }
    } else {
      setAppointmentModal({ open: false, editing: null, prefill: null });
      try {
        const res = await fetch(API_ENDPOINTS.APPOINTMENTS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          const norm = normalizeAppointmentRecord(created, 0, services);
          setAppointments((prev) => [...prev, norm]);
          showNotification('تم حجز الموعد وحفظه في MockAPI بنجاح!');
        } else {
          const fallbackApp = normalizeAppointmentRecord(
            { ...payload, id: String(Date.now()) },
            0,
            services
          );
          setAppointments((prev) => [...prev, fallbackApp]);
          showNotification('تم حجز الموعد محلياً.', 'info');
        }
      } catch {
        const fallbackApp = normalizeAppointmentRecord(
          { ...payload, id: String(Date.now()) },
          0,
          services
        );
        setAppointments((prev) => [...prev, fallbackApp]);
        showNotification('تم حجز الموعد محلياً.', 'info');
      }
    }
  };

  const handleStatusUpdate = async (app, newStatus) => {
    const targetId = String(app.id);
    const updatedApp = { ...app, status: newStatus };

    setAppointments((prev) =>
      prev.map((a) => (String(a.id) === targetId ? updatedApp : a))
    );

    if (newStatus === 'مكتمل') {
      const visitId = `app_${targetId}`;
      setVisits((prev) => {
        const exists = prev.some((v) => String(v.id) === visitId);
        if (exists) return prev;
        return [
          {
            id: visitId,
            patientName: app.patientName,
            phone: app.phone,
            serviceName: app.serviceName,
            date: app.date,
            paidAmount: app.price || 150,
            notes: 'تم إكمال الموعد وتحويله تلقائياً لقسم الزيارات والمتابعة',
          },
          ...prev,
        ];
      });
    }

    try {
      await fetch(`${API_ENDPOINTS.APPOINTMENTS}/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedApp),
      });
      showNotification(`تم تحديث حالة الحجز إلى "${newStatus}" في MockAPI!`);
    } catch {
      showNotification(`تم تغيير الحالة إلى "${newStatus}".`);
    }
  };

  const handleDeleteAppointment = async (id) => {
    const strId = String(id);
    setAppointments((prev) => prev.filter((a) => String(a.id) !== strId));
    setVisits((prev) => prev.filter((v) => String(v.id) !== `app_${strId}`));

    try {
      await fetch(`${API_ENDPOINTS.APPOINTMENTS}/${strId}`, {
        method: 'DELETE',
      });
      showNotification('تم حذف الموعد نهائياً من التطبيق ومن MockAPI!');
    } catch {
      showNotification('تم حذف الموعد.', 'info');
    }
  };

  // ============================================================================
  // 7. إدارة الزيارات والخدمات
  // ============================================================================
  const handleSaveVisit = (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {
      patientName: form.get('patientName').trim(),
      phone: normalizeDigits(form.get('phone').trim()),
      serviceName: form.get('serviceName'),
      date: normalizeDigits(form.get('date')),
      paidAmount: Number(normalizeDigits(form.get('paidAmount'))) || 150,
      notes: form.get('notes').trim() || 'زيارة علاجية مكتملة',
    };

    if (visitModal.editing) {
      const targetId = String(visitModal.editing.id);
      setVisits((prev) =>
        prev.map((v) => (String(v.id) === targetId ? { ...v, ...payload } : v))
      );
      showNotification('تم تعديل سجل الزيارة بنجاح!');
    } else {
      setVisits((prev) => [{ id: String(Date.now()), ...payload }, ...prev]);
      showNotification('تمت إضافة الزيارة الطبية بنجاح!');
    }
    setVisitModal({ open: false, editing: null });
  };

  const handleDeleteVisit = (id) => {
    setVisits((prev) => prev.filter((v) => String(v.id) !== String(id)));
    showNotification('تم حذف سجل الزيارة.');
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = {
      name: form.get('name').trim(),
      price: Number(normalizeDigits(form.get('price'))) || 150,
      duration: form.get('duration').trim() || '30 دقيقة',
      category: form.get('category') || 'عام',
      description: form.get('description').trim() || 'خدمة طبية متميزة',
    };

    if (serviceModal.editing) {
      const targetId = String(serviceModal.editing.id);
      const updated = { ...serviceModal.editing, ...payload, id: targetId };
      setServices((prev) =>
        prev.map((s) => (String(s.id) === targetId ? updated : s))
      );
      setServiceModal({ open: false, editing: null });
      try {
        await fetch(`${API_ENDPOINTS.SERVICES}/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch {}
      showNotification('تم تحديث الخدمة في النظام و MockAPI!');
    } else {
      setServiceModal({ open: false, editing: null });
      try {
        const res = await fetch(API_ENDPOINTS.SERVICES, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setServices((prev) => [
            ...prev,
            { ...payload, id: String(created.id) },
          ]);
        } else {
          setServices((prev) => [
            ...prev,
            { ...payload, id: String(Date.now()) },
          ]);
        }
      } catch {
        setServices((prev) => [
          ...prev,
          { ...payload, id: String(Date.now()) },
        ]);
      }
      showNotification('تمت إضافة الخدمة الجديدة بنجاح!');
    }
  };

  const handleDeleteService = async (id) => {
    const strId = String(id);
    setServices((prev) => prev.filter((s) => String(s.id) !== strId));
    try {
      await fetch(`${API_ENDPOINTS.SERVICES}/${strId}`, { method: 'DELETE' });
    } catch {}
    showNotification('تم حذف الخدمة بنجاح.');
  };

  // نسخ الروابط
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showNotification('تم نسخ الرابط بنجاح!');
    setTimeout(() => setCopiedText(''), 2000);
  };

  // ============================================================================
  // 8. الإحصائيات والفلاتر الذكية
  // ============================================================================
  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        String(p.name).toLowerCase().includes(q) ||
        String(p.phone).toLowerCase().includes(q) ||
        String(p.notes).toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  const filteredAppointments = useMemo(() => {
    if (appointmentFilter === 'الكل') return appointments;
    return appointments.filter((a) => a.status === appointmentFilter);
  }, [appointments, appointmentFilter]);

  const dashboardStats = useMemo(() => {
    const confirmed = appointments.filter((a) => a.status === 'مؤكد').length;
    const pending = appointments.filter(
      (a) => a.status === 'قيد الانتظار'
    ).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = appointments.filter((a) => a.date === todayStr).length;

    const aiPatients = patients.filter(
      (p) =>
        String(p.source).includes('n8n') || String(p.source).includes('ذكاء')
    ).length;
    const aiAppointments = appointments.filter(
      (a) =>
        String(a.source).includes('n8n') || String(a.source).includes('ذكاء')
    ).length;

    const totalRevenue = visits.reduce(
      (sum, v) => sum + (Number(v.paidAmount) || 0),
      0
    );

    return {
      confirmed,
      pending,
      todayCount,
      aiTotal: aiPatients + aiAppointments,
      aiAppointments,
      totalRevenue,
    };
  }, [patients, appointments, visits]);

  // تحديد عنوان الرابط المعروض في البانر العلوي حسب التبويب
  const currentBannerInfo = useMemo(() => {
    if (activeTab === 'patients') {
      return {
        title: 'ملفات المرضى',
        badge: `متصل بـ MockAPI (${patients.length} ملفات مرضى)`,
        url: API_ENDPOINTS.PATIENTS,
        syncBtnText: 'تحديث المرضى من الـ API الآن',
      };
    }
    if (activeTab === 'appointments') {
      return {
        title: 'حجز المواعيد',
        badge: 'متصل بـ MockAPI (جلب وحجز المواعيد لـ n8n)',
        url: API_ENDPOINTS.APPOINTMENTS,
        syncBtnText: 'تحديث المواعيد من الـ API الآن',
      };
    }
    if (activeTab === 'visits') {
      return {
        title: 'الزيارات والمتابعة',
        badge: `متصل بـ MockAPI (${visits.length} زيارات مسجلة)`,
        url: API_ENDPOINTS.APPOINTMENTS,
        syncBtnText: 'تحديث الزيارات من الـ API الآن',
      };
    }
    if (activeTab === 'services') {
      return {
        title: 'الخدمات والأسعار',
        badge: `متصل بـ MockAPI (${services.length} خدمات جاهزة لـ n8n)`,
        url: API_ENDPOINTS.SERVICES,
        syncBtnText: 'تحديث الخدمات من الـ API الآن',
      };
    }
    if (activeTab === 'n8n') {
      return {
        title: 'الربط الذكي (n8n & AI)',
        badge: 'متصل بـ MockAPI و Webhook نشط',
        url: API_ENDPOINTS.PATIENTS,
        syncBtnText: 'تحديث البيانات من الـ API الآن',
      };
    }
    return {
      title: 'لوحة التحكم',
      badge: `متصل بـ MockAPI (${services.length} خدمات جاهزة لـ n8n)`,
      url: API_ENDPOINTS.SERVICES,
      syncBtnText: 'تحديث المرضى من الـ API الآن',
    };
  }, [activeTab, patients.length, visits.length, services.length]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f3f5f1] text-slate-800 flex flex-col md:flex-row font-sans"
    >
      {/* إشعار عائم في أسفل الشاشة */}
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border bg-white border-emerald-200 text-slate-800">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              toast.type === 'error' ? 'bg-rose-500' : 'bg-[#14805e]'
            }`}
          />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* ====================================================================
          القائمة الجانبية اليمنى (مطابقة للصورة 100%)
      ==================================================================== */}
      <aside className="w-full md:w-72 bg-[#fafbf9] border-l border-slate-200/80 flex flex-col justify-between p-5 shrink-0">
        <div>
          {/* رأس القائمة والشعار */}
          <div className="flex items-center justify-between pb-6 mb-5 border-b border-slate-200/70">
            <div>
              <h1 className="font-extrabold text-lg text-slate-800">
                عيادة الأسنان الذكية
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-500 font-medium">
                  متصل بالقاعدة السحابية
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#147a60] flex items-center justify-center text-white shadow-sm">
              <Stethoscope className="w-6 h-6" />
            </div>
          </div>

          <div className="text-xs font-bold text-slate-400 px-2 mb-3">
            القائمة الرئيسية
          </div>

          {/* عناصر التنقل */}
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#147a60] text-white shadow-md shadow-teal-900/10'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span>لوحة التحكم</span>
              <LayoutGrid className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('patients')}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === 'patients'
                  ? 'bg-[#147a60] text-white shadow-md shadow-teal-900/10'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span
                className={`px-2.5 py-0.5 text-xs rounded-full font-extrabold ${
                  activeTab === 'patients'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {patients.length}
              </span>
              <div className="flex items-center gap-3">
                <span>ملفات المرضى</span>
                <Users className="w-5 h-5" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('appointments')}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === 'appointments'
                  ? 'bg-[#147a60] text-white shadow-md shadow-teal-900/10'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span
                className={`px-2.5 py-0.5 text-xs rounded-full font-extrabold ${
                  activeTab === 'appointments'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {appointments.length}
              </span>
              <div className="flex items-center gap-3">
                <span>حجز المواعيد</span>
                <Calendar className="w-5 h-5" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('visits')}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === 'visits'
                  ? 'bg-[#147a60] text-white shadow-md shadow-teal-900/10'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span
                className={`px-2.5 py-0.5 text-xs rounded-full font-extrabold ${
                  activeTab === 'visits'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {visits.length}
              </span>
              <div className="flex items-center gap-3">
                <span>الزيارات والمتابعة</span>
                <Stethoscope className="w-5 h-5" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                activeTab === 'services'
                  ? 'bg-[#147a60] text-white shadow-md shadow-teal-900/10'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <span
                className={`px-2.5 py-0.5 text-xs rounded-full font-extrabold ${
                  activeTab === 'services'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200/80 text-slate-700'
                }`}
              >
                {services.length}
              </span>
              <div className="flex items-center gap-3">
                <span>الخدمات والأسعار</span>
                <Sparkles className="w-5 h-5" />
              </div>
            </button>

            <button
              onClick={() => setActiveTab('n8n')}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all border ${
                activeTab === 'n8n'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'bg-[#eef1f6] text-slate-800 border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <span className="px-2.5 py-0.5 text-[11px] rounded-full bg-blue-700 text-white font-bold">
                Webhook
              </span>
              <div className="flex items-center gap-2.5">
                <div className="text-right leading-tight">
                  <div>الربط الذكي (n8n &</div>
                  <div className="text-xs">(AI</div>
                </div>
                <Bot
                  className={`w-5 h-5 ${
                    activeTab === 'n8n' ? 'text-white' : 'text-blue-700'
                  }`}
                />
              </div>
            </button>
          </nav>
        </div>

        {/* الكارت السفلي الداكن في القائمة الجانبية */}
        <div className="mt-6 bg-[#0d2420] text-white p-4 rounded-2xl shadow-lg border border-teal-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
              نشط
            </span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span>وكيل الذكاء الاصطناعي n8n</span>
              <Bot className="w-4 h-4" />
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed text-right">
            يمكن للوكيل الذكي تسجيل المرضى، حجز المواعيد، وتأكيدها تلقائياً عبر
            Webhook.
          </p>
        </div>
      </aside>

      {/* ====================================================================
          منطقة المحتوى الرئيسي
      ==================================================================== */}
      <main className="flex-1 p-4 md:p-7 overflow-y-auto space-y-6">
        {/* البانر العلوي الموحد (مطابق للصور 100%) */}
        <div className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          {/* العمود الأيمن: عنوان القسم والرابط الفعلي */}
          <div className="flex-1 text-right">
            <div className="flex flex-wrap items-center justify-start gap-3 mb-2">
              <h2 className="text-2xl font-black text-slate-800">
                {currentBannerInfo.title}
              </h2>
              <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#147a60] border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{currentBannerInfo.badge}</span>
              </span>
            </div>

            <div className="text-xs text-slate-500 font-medium mb-1.5">
              مربوط فعلياً عبر HTTP Request بالرابط:
            </div>
            <div
              onClick={() => handleCopy(currentBannerInfo.url)}
              title="اضغط لنسخ الرابط"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 cursor-pointer px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-mono text-xs transition-all"
            >
              <span dir="ltr">{currentBannerInfo.url}</span>
              {copiedText === currentBannerInfo.url ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </div>

          {/* العمود الأيسر: الأزرار الأربعة مرتبة كما في الصورة تماماً */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-52 shrink-0">
            <button
              onClick={() => syncAllFromAPI(true)}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#168a5c] hover:bg-[#12704a] text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-60"
            >
              <span>{currentBannerInfo.syncBtnText}</span>
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
              />
            </button>

            <button
              onClick={handlePushServicesToAPI}
              disabled={isPushingServices}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#2557d6] hover:bg-[#1d46b0] text-white text-xs font-extrabold shadow-sm transition-all disabled:opacity-60"
            >
              <span>إرسال الخدمات للـ API الآن</span>
              <RefreshCw
                className={`w-4 h-4 ${isPushingServices ? 'animate-spin' : ''}`}
              />
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPatientModal({ open: true, editing: null })}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#eef1ee] hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
              >
                <span>مريض جديد</span>
                <UserPlus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() =>
                  setAppointmentModal({
                    open: true,
                    editing: null,
                    prefill: null,
                  })
                }
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#147a60] hover:bg-[#0f604b] text-white text-xs font-bold shadow-sm transition-all"
              >
                <span>حجز موعد</span>
                <Calendar className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================================
            التبويب 1: لوحة التحكم (Dashboard)
        ==================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* الكروت الإحصائية الأربعة (نفس الترتيب والألوان في الصورة) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. إجمالي ملفات المرضى */}
              <div className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center text-center justify-between">
                <span className="text-xs font-bold text-slate-500 mb-3">
                  إجمالي ملفات المرضى
                </span>
                <div className="flex items-center gap-4 my-1">
                  <span className="text-4xl font-black text-slate-800">
                    {patients.length}
                  </span>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#147a60] flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <span className="text-xs text-slate-500 mt-3">
                  مسجلين في قاعدة البيانات
                </span>
              </div>

              {/* 2. المواعيد المؤكدة / الانتظار */}
              <div className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center text-center justify-between">
                <span className="text-xs font-bold text-slate-500 mb-2">
                  المواعيد المؤكدة / الانتظار
                </span>
                <div className="flex items-center gap-3 my-1">
                  <div className="text-3xl font-black text-slate-800">
                    {dashboardStats.confirmed}{' '}
                    <span className="text-base font-bold text-amber-600">
                      / {dashboardStats.pending}
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-sm font-bold text-amber-600">انتظار</div>
                <span className="text-xs text-slate-500 mt-1">
                  مواعيد اليوم: {dashboardStats.todayCount}
                </span>
              </div>

              {/* 3. الزيارات والمتابعات الطبية */}
              <div className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col items-center text-center justify-between">
                <span className="text-xs font-bold text-slate-500 mb-3">
                  الزيارات والمتابعات الطبية
                </span>
                <div className="flex items-center gap-4 my-1">
                  <span className="text-4xl font-black text-slate-800">
                    {visits.length}
                  </span>
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-[#147a60] flex items-center justify-center">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                </div>
                <span className="text-xs text-slate-500 mt-3">
                  إجمالي التحصيل: {dashboardStats.totalRevenue} ر.س
                </span>
              </div>

              {/* 4. عمليات وكيل الذكاء الاصطناعي (الكارت الأزرق) */}
              <div className="bg-gradient-to-b from-[#1d56d8] to-[#1542ad] text-white rounded-3xl p-6 shadow-md flex flex-col items-center text-center justify-between">
                <span className="text-xs font-bold text-blue-100 mb-3">
                  عمليات وكيل الذكاء الاصطناعي
                </span>
                <div className="flex items-center gap-4 my-1">
                  <span className="text-4xl font-black">
                    {dashboardStats.aiTotal}
                  </span>
                  <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                </div>
                <span className="text-xs text-blue-100 mt-3">
                  حجوزات الذكاء: {dashboardStats.aiAppointments}
                </span>
              </div>
            </div>

            {/* أحدث حجوزات المواعيد */}
            <div className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#147a60]" />
                  <span>أحدث حجوزات المواعيد</span>
                </h3>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="text-xs font-bold text-slate-500 hover:text-[#147a60]"
                >
                  &lt; عرض الكل
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm font-medium">
                  لا توجد مواعيد مسجلة حالياً (العدد في الـ API: 0)
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.slice(0, 5).map((app) => (
                    <div
                      key={app.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200/70 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#147a60] font-black flex items-center justify-center">
                          {String(app.patientName).charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">
                            {app.patientName}
                          </div>
                          <div className="text-xs text-slate-500" dir="ltr">
                            {app.phone} • {app.serviceName} ({app.price} ر.س)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-left text-xs">
                          <div className="font-bold text-slate-700">
                            {app.date}
                          </div>
                          <div className="text-slate-400">{app.time}</div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            app.status === 'مؤكد'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : app.status === 'مكتمل'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : app.status === 'ملغي'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            التبويب 2: ملفات المرضى (Patients - مطابق للصورة رقم 5)
        ==================================================================== */}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            {/* شريط البحث وزر إضافة ملف مريض جديد */}
            <div className="bg-[#f8f9f7] rounded-3xl p-4 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="ابحث باسم المريض أو رقم الجوال..."
                  className="w-full pr-12 pl-4 py-3.5 rounded-2xl bg-[#eff1ee] border border-slate-200/80 text-sm focus:outline-none focus:border-[#147a60]"
                />
              </div>

              <button
                onClick={() => setPatientModal({ open: true, editing: null })}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#147a60] hover:bg-[#0f604b] text-white text-sm font-extrabold shadow-sm transition-all shrink-0"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة ملف مريض جديد</span>
              </button>
            </div>

            {/* شبكة كروت المرضى */}
            {filteredPatients.length === 0 ? (
              <div className="bg-[#f8f9f7] rounded-3xl p-12 text-center border border-slate-200/80">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-bold text-slate-700 mb-1">
                  لا توجد ملفات مرضى حالياً (العدد: 0)
                </h4>
                <p className="text-xs text-slate-400">
                  يمكنك إضافة مريض جديد أو إرسال مريض عبر بوت n8n ثم الضغط على
                  "تحديث المرضى من الـ API الآن"
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-5">
                      {/* بيانات المريض والحرف الأول */}
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-[#d8ede4] text-[#147a60] font-black text-lg flex items-center justify-center shrink-0">
                          {String(p.name).trim().charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-lg text-slate-800">
                            {p.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                            <span
                              className="flex items-center gap-1 font-medium"
                              dir="ltr"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#147a60]" />
                              {p.phone}
                            </span>
                            <span>•</span>
                            <span>
                              {p.age} سنة ({p.gender})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* بادج وكيل الذكاء الاصطناعي كما في الصورة */}
                      <span className="px-3 py-2 rounded-2xl text-[11px] font-bold bg-[#eaedf8] text-indigo-800 border border-indigo-200/80 text-center leading-snug max-w-[110px]">
                        {p.source}
                      </span>
                    </div>

                    {/* صندوق التاريخ الطبي والملاحظات */}
                    <div className="bg-[#eff1ee] rounded-2xl p-4 border border-slate-200/60 mb-4 text-center">
                      <div className="text-xs font-bold text-slate-500 mb-1">
                        التاريخ الطبي والملاحظات:
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {p.notes}
                      </p>
                    </div>

                    {/* أزرار التحكم (حجز موعد / تعديل / حذف) */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/70">
                      <button
                        onClick={() =>
                          setAppointmentModal({
                            open: true,
                            editing: null,
                            prefill: { patientName: p.name, phone: p.phone },
                          })
                        }
                        className="text-xs font-extrabold text-[#147a60] hover:underline flex items-center gap-1.5"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        <span>حجز موعد لهذا المريض</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setPatientModal({ open: true, editing: p })
                          }
                          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={() => handleDeletePatient(p.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            التبويب 3: حجز المواعيد (Appointments - مطابق للصورة رقم 7 و 23)
        ==================================================================== */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            {/* شريط فلاتر الحالة وزر حجز موعد جديد */}
            <div className="bg-[#f8f9f7] rounded-3xl p-4 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {['الكل', 'قيد الانتظار', 'مؤكد', 'مكتمل', 'ملغي'].map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setAppointmentFilter(tab)}
                      className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all ${
                        appointmentFilter === tab
                          ? 'bg-[#147a60] text-white shadow-sm'
                          : 'bg-[#eff1ee] text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() =>
                  setAppointmentModal({
                    open: true,
                    editing: null,
                    prefill: null,
                  })
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#147a60] hover:bg-[#0f604b] text-white text-xs font-extrabold shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>حجز موعد جديد</span>
              </button>
            </div>

            {/* جدول المواعيد (نفس أعمدة وتصميم صورتك بالضبط) */}
            <div className="bg-[#f8f9f7] rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-slate-600 text-xs font-extrabold bg-[#eff1ee]/60">
                      <th className="py-4 px-5">المريض</th>
                      <th className="py-4 px-5">الخدمة المطلوبة</th>
                      <th className="py-4 px-5">التاريخ والوقت</th>
                      <th className="py-4 px-5">طريقة الحجز</th>
                      <th className="py-4 px-5">الحالة</th>
                      <th className="py-4 px-5">تأكيد / تغيير الحالة</th>
                      <th className="py-4 px-5">إدارة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 text-sm">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="py-12 text-center text-slate-400 font-medium"
                        >
                          لا توجد مواعيد حالياً في هذا القسم
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((app) => (
                        <tr
                          key={app.id}
                          className="hover:bg-white/60 transition-all"
                        >
                          {/* المريض */}
                          <td className="py-4 px-5">
                            <div className="font-extrabold text-slate-800">
                              {app.patientName}
                            </div>
                            <div
                              className="text-xs text-slate-500 mt-0.5"
                              dir="ltr"
                            >
                              {app.phone}
                            </div>
                          </td>

                          {/* الخدمة المطلوبة */}
                          <td className="py-4 px-5">
                            <div className="font-bold text-slate-800">
                              {app.serviceName}
                            </div>
                            <div className="text-xs font-extrabold text-[#147a60] mt-0.5">
                              {app.price} ر.س
                            </div>
                          </td>

                          {/* التاريخ والوقت */}
                          <td className="py-4 px-5">
                            <div className="font-extrabold text-slate-800">
                              {app.date}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{app.time}</span>
                            </div>
                          </td>

                          {/* طريقة الحجز */}
                          <td className="py-4 px-5">
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold bg-[#eaedf8] text-indigo-800 border border-indigo-200/80">
                              <Bot className="w-3.5 h-3.5" />
                              <span>{app.source}</span>
                            </span>
                          </td>

                          {/* الحالة */}
                          <td className="py-4 px-5">
                            <span
                              className={`px-3.5 py-1 rounded-full text-xs font-extrabold ${
                                app.status === 'مؤكد'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : app.status === 'مكتمل'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : app.status === 'ملغي'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {app.status}
                            </span>
                          </td>

                          {/* تأكيد / تغيير الحالة */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2">
                              {app.status !== 'مؤكد' && (
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(app, 'مؤكد')
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold transition-all"
                                >
                                  تأكيد
                                </button>
                              )}
                              {app.status !== 'مكتمل' && (
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(app, 'مكتمل')
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-[#e3f2ed] hover:bg-teal-100 text-[#147a60] text-xs font-extrabold transition-all"
                                >
                                  مكتمل
                                </button>
                              )}
                              {app.status !== 'ملغي' && (
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(app, 'ملغي')
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-extrabold transition-all"
                                >
                                  إلغاء
                                </button>
                              )}
                            </div>
                          </td>

                          {/* إدارة (تعديل وحذف) */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() =>
                                  setAppointmentModal({
                                    open: true,
                                    editing: app,
                                    prefill: null,
                                  })
                                }
                                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 transition-all"
                                title="تعديل"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteAppointment(app.id)}
                                className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-all"
                                title="حذف نهائي"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            التبويب 4: الزيارات والمتابعة (Visits)
        ==================================================================== */}
        {activeTab === 'visits' && (
          <div className="space-y-6">
            <div className="bg-[#f8f9f7] rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-800">
                  سجل الزيارات المكتملة والتحصيل المالي
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  أي موعد تضغط أمامه على زر "مكتمل" ينتقل تلقائياً إلى هنا
                  ويُحسب ضمن إجمالي تحصيل العيادة.
                </p>
              </div>
              <button
                onClick={() => setVisitModal({ open: true, editing: null })}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#147a60] hover:bg-[#0f604b] text-white text-xs font-extrabold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>تسجيل زيارة جديدة</span>
              </button>
            </div>

            {visits.length === 0 ? (
              <div className="bg-[#f8f9f7] rounded-3xl p-12 text-center border border-slate-200/80">
                <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-bold text-slate-700 mb-1">
                  لا توجد زيارات مكتملة حالياً (0)
                </h4>
                <p className="text-xs text-slate-400">
                  اضغط على "مكتمل" أمام أي حجز في قسم حجز المواعيد أو أضف زيارة
                  جديدة يدوياً.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {visits.map((v) => (
                  <div
                    key={v.id}
                    className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-extrabold text-base text-slate-800">
                            {v.patientName}
                          </h4>
                          <span className="text-xs text-slate-500" dir="ltr">
                            {v.phone} • {v.date}
                          </span>
                        </div>
                        <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-[#147a60] border border-emerald-200">
                          تم تحصيل: {v.paidAmount} ر.س
                        </span>
                      </div>

                      <div className="bg-[#eff1ee] rounded-2xl p-4 border border-slate-200/60 text-xs space-y-1.5">
                        <div>
                          <span className="font-bold text-slate-500">
                            الخدمة الطبية:{' '}
                          </span>
                          <span className="font-extrabold text-slate-800">
                            {v.serviceName}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500">
                            ملاحظات الطبيب:{' '}
                          </span>
                          <span className="text-slate-700">{v.notes}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200/60">
                      <button
                        onClick={() =>
                          setVisitModal({ open: true, editing: v })
                        }
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => handleDeleteVisit(v.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            التبويب 5: الخدمات والأسعار (Services)
        ==================================================================== */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="bg-[#f8f9f7] rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-800">
                  قائمة خدمات العيادة والأسعار المعتمدة
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  يمكنك تعديل الأسعار أو إضافة خدمة جديدة ثم الضغط على "إرسال
                  الخدمات للـ API الآن" ليقرأها بوت n8n.
                </p>
              </div>
              <button
                onClick={() => setServiceModal({ open: true, editing: null })}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#147a60] hover:bg-[#0f604b] text-white text-xs font-extrabold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة خدمة جديدة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#147a60] border border-emerald-200">
                          {srv.category}
                        </span>
                        <h4 className="font-extrabold text-lg text-slate-800 mt-2">
                          {srv.name}
                        </h4>
                      </div>
                      <div className="text-left">
                        <div className="text-xl font-black text-[#147a60]">
                          {srv.price} ر.س
                        </div>
                        <div className="text-xs text-slate-400">
                          {srv.duration}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {srv.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200/60">
                    <button
                      onClick={() =>
                        setServiceModal({ open: true, editing: srv })
                      }
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => handleDeleteService(srv.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            التبويب 6: الربط الذكي (n8n & AI)
        ==================================================================== */}
        {activeTab === 'n8n' && (
          <div className="space-y-6">
            <div className="bg-[#f8f9f7] rounded-3xl p-6 shadow-sm border border-slate-200/80">
              <h3 className="font-extrabold text-lg text-slate-800 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#147a60]" />
                <span>روابط الـ API الثلاثة الثابتة الخاصة بك في n8n</span>
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                جميع الروابط التالية تتصل مباشرة بالجداول المستقلة بدون أي أخطاء
                404، وأي تغيير في MockAPI ينعكس فوراً في التطبيق.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: '1. رابط الخدمات (Services)',
                    url: API_ENDPOINTS.SERVICES,
                    ok: apiStatus.servicesOk,
                  },
                  {
                    title: '2. رابط المرضى (Patients)',
                    url: API_ENDPOINTS.PATIENTS,
                    ok: apiStatus.patientsOk,
                  },
                  {
                    title: '3. رابط المواعيد (Appointments)',
                    url: API_ENDPOINTS.APPOINTMENTS,
                    ok: apiStatus.appointmentsOk,
                  },
                ].map((item) => (
                  <div
                    key={item.url}
                    className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-800">
                        {item.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.ok
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {item.ok ? 'متصل 200 OK' : 'تحقق من الجدول'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <code
                        className="text-[11px] font-mono text-slate-700 truncate"
                        dir="ltr"
                      >
                        {item.url}
                      </code>
                      <button
                        onClick={() => handleCopy(item.url)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 text-slate-600 shrink-0"
                      >
                        {copiedText === item.url ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ====================================================================
          النافذة المنبثقة: إضافة / تعديل مريض
      ==================================================================== */}
      {patientModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-extrabold text-lg text-slate-800 mb-4">
              {patientModal.editing
                ? 'تعديل بيانات المريض'
                : 'إضافة ملف مريض جديد'}
            </h3>
            <form onSubmit={handleSavePatient} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  اسم المريض بالكامل
                </label>
                <input
                  name="name"
                  required
                  defaultValue={patientModal.editing?.name || ''}
                  placeholder="مثال: يسي حلمي جاد"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#147a60]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    رقم الجوال
                  </label>
                  <input
                    name="phone"
                    required
                    defaultValue={patientModal.editing?.phone || ''}
                    placeholder="01278479297"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#147a60]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    العمر
                  </label>
                  <input
                    name="age"
                    required
                    defaultValue={patientModal.editing?.age || '19'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#147a60]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    النوع
                  </label>
                  <select
                    name="gender"
                    defaultValue={patientModal.editing?.gender || 'ذكر'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    طريقة التسجيل
                  </label>
                  <select
                    name="source"
                    defaultValue={
                      patientModal.editing?.source ||
                      'وكيل الذكاء الاصطناعي (n8n)'
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="وكيل الذكاء الاصطناعي (n8n)">
                      وكيل الذكاء الاصطناعي (n8n)
                    </option>
                    <option value="يدوي - الاستقبال">يدوي - الاستقبال</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  التاريخ الطبي والملاحظات
                </label>
                <textarea
                  name="notes"
                  rows="3"
                  defaultValue={
                    patientModal.editing?.notes || 'تم التسجيل عبر بوت'
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() =>
                    setPatientModal({ open: false, editing: null })
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#147a60] text-white font-extrabold"
                >
                  حفظ في التطبيق والـ API
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          النافذة المنبثقة: حجز / تعديل موعد
      ==================================================================== */}
      {appointmentModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-extrabold text-lg text-slate-800 mb-4">
              {appointmentModal.editing
                ? 'تعديل بيانات الموعد'
                : 'حجز موعد جديد'}
            </h3>
            <form
              onSubmit={handleSaveAppointment}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  اسم المريض
                </label>
                <input
                  name="patientName"
                  required
                  defaultValue={
                    appointmentModal.editing?.patientName ||
                    appointmentModal.prefill?.patientName ||
                    ''
                  }
                  placeholder="مثال: يسي حلمي جاد"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  رقم الجوال
                </label>
                <input
                  name="phone"
                  required
                  defaultValue={
                    appointmentModal.editing?.phone ||
                    appointmentModal.prefill?.phone ||
                    ''
                  }
                  placeholder="01278479297"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  الخدمة المطلوبة
                </label>
                <select
                  name="serviceName"
                  defaultValue={
                    appointmentModal.editing?.serviceName || 'كشف عام'
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.price} ر.س)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={
                      appointmentModal.editing?.date ||
                      new Date().toISOString().split('T')[0]
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    الوقت
                  </label>
                  <input
                    type="time"
                    name="time"
                    required
                    defaultValue={appointmentModal.editing?.time || '16:00'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    الحالة
                  </label>
                  <select
                    name="status"
                    defaultValue={appointmentModal.editing?.status || 'مؤكد'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="مؤكد">مؤكد</option>
                    <option value="قيد الانتظار">قيد الانتظار</option>
                    <option value="مكتمل">مكتمل</option>
                    <option value="ملغي">ملغي</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    طريقة الحجز
                  </label>
                  <select
                    name="source"
                    defaultValue={
                      appointmentModal.editing?.source ||
                      'وكيل الذكاء الاصطناعي (n8n)'
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <option value="وكيل الذكاء الاصطناعي (n8n)">
                      وكيل الذكاء الاصطناعي (n8n)
                    </option>
                    <option value="يدوي - الاستقبال">يدوي - الاستقبال</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() =>
                    setAppointmentModal({
                      open: false,
                      editing: null,
                      prefill: null,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#147a60] text-white font-extrabold"
                >
                  حفظ في التطبيق والـ API
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          النافذة المنبثقة: إضافة / تعديل زيارة
      ==================================================================== */}
      {visitModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-extrabold text-lg text-slate-800 mb-4">
              {visitModal.editing
                ? 'تعديل سجل الزيارة'
                : 'تسجيل زيارة طبية جديدة'}
            </h3>
            <form onSubmit={handleSaveVisit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  اسم المريض
                </label>
                <input
                  name="patientName"
                  required
                  defaultValue={visitModal.editing?.patientName || ''}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    رقم الهاتف
                  </label>
                  <input
                    name="phone"
                    required
                    defaultValue={visitModal.editing?.phone || ''}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    المبلغ المحصل (ر.س)
                  </label>
                  <input
                    type="number"
                    name="paidAmount"
                    required
                    defaultValue={visitModal.editing?.paidAmount || 150}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    الخدمة المنفذة
                  </label>
                  <input
                    name="serviceName"
                    required
                    defaultValue={visitModal.editing?.serviceName || 'كشف عام'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={
                      visitModal.editing?.date ||
                      new Date().toISOString().split('T')[0]
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  التشخيص والملاحظات
                </label>
                <textarea
                  name="notes"
                  rows="2"
                  defaultValue={visitModal.editing?.notes || ''}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVisitModal({ open: false, editing: null })}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#147a60] text-white font-extrabold"
                >
                  حفظ الزيارة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          النافذة المنبثقة: إضافة / تعديل خدمة
      ==================================================================== */}
      {serviceModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-extrabold text-lg text-slate-800 mb-4">
              {serviceModal.editing ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
            </h3>
            <form onSubmit={handleSaveService} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  اسم الخدمة
                </label>
                <input
                  name="name"
                  required
                  defaultValue={serviceModal.editing?.name || ''}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    السعر (ر.س)
                  </label>
                  <input
                    type="number"
                    name="price"
                    required
                    defaultValue={serviceModal.editing?.price || 150}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1.5">
                    المدة
                  </label>
                  <input
                    name="duration"
                    defaultValue={serviceModal.editing?.duration || '30 دقيقة'}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  التصنيف
                </label>
                <select
                  name="category"
                  defaultValue={serviceModal.editing?.category || 'عام'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <option value="عام">عام</option>
                  <option value="تجميلي">تجميلي</option>
                  <option value="علاجي">علاجي</option>
                  <option value="جراحة">جراحة</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1.5">
                  وصف الخدمة
                </label>
                <textarea
                  name="description"
                  rows="2"
                  defaultValue={serviceModal.editing?.description || ''}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setServiceModal({ open: false, editing: null })
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#147a60] text-white font-extrabold"
                >
                  حفظ الخدمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
