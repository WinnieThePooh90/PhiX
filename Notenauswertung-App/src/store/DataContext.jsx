import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  EXAM_ABS_MAX_FIELDS,
  getNormalizedOralWeekPointsArray,
  migrateStoredGradeString,
  migrateOralGradeEntry,
  normalizeCourseGradeSystem,
} from '../utils/calculator';
import { sortSchoolYears } from '../utils/schoolYear';
import { apiFetch } from '../utils/apiBase';

const ORAL_WEEK_COL_CAP = 24;

function sortSchoolRosterRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
    const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
    if (ln !== 0) return ln;
    return String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
  });
}

/** Kurs-Schüler wie beim ersten Laden: nach Schülernummer, sonst nach id */
function sortCourseStudents(rows) {
  return [...(rows || [])].sort((a, b) => {
    const an = a.studentNumber;
    const bn = b.studentNumber;
    const anOk = an !== undefined && an !== null;
    const bnOk = bn !== undefined && bn !== null;
    if (anOk && bnOk) return an - bn;
    if (anOk && !bnOk) return -1;
    if (!anOk && bnOk) return 1;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function mergeOralGradeWithWeekPoints(prevData, weekPointsArr) {
  const base =
    typeof prevData === 'object' && prevData !== null
      ? { ...prevData, weekPoints: [...weekPointsArr] }
      : typeof prevData === 'string' || typeof prevData === 'number'
        ? { value: String(prevData), _counted: true, weekPoints: [...weekPointsArr] }
        : { value: '', _counted: true, weekPoints: [...weekPointsArr] };
  if ('week1' in base) delete base.week1;
  return base;
}

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();

  const fetchWithActing = useCallback(
    (url, init = {}) => {
      const headers = new Headers(init.headers || {});
      if (currentUser?.username) headers.set('X-Acting-User', currentUser.username);
      return apiFetch(url, { ...init, headers });
    },
    [currentUser?.username],
  );

  const [courses, setCourses] = useState([]);
  const [activeCourseId, setActiveCourseId] = useState(null);

  // Der aktuelle 'config' entspricht dem aktiven Kurs
  const config = courses.find(c => c.id === activeCourseId) || null;

  const [students, setStudents] = useState([]);
  const [schoolRosterYears, setSchoolRosterYears] = useState([]);
  const [activeSchoolRosterYearId, setActiveSchoolRosterYearId] = useState(null);
  const [schoolRosterStudents, setSchoolRosterStudents] = useState([]);
  const [exams, setExams] = useState({});
  const [orals, setOrals] = useState({});
  const [tests, setTests] = useState({});
  const [gfsEntries, setGfsEntries] = useState([]);
  const [moneyLists, setMoneyLists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial courses and migrate
  useEffect(() => {
    if (!currentUser?.username) return undefined;

    const initApp = async () => {
      try {
        // 1. Check for localStorage migration
        const localConfig = localStorage.getItem('grade_config');
        if (localConfig) {
          console.log("Migrating localStorage to Database...");
          
          const studentsLocal = JSON.parse(localStorage.getItem('grade_students') || '[]');
          const examsLocal = JSON.parse(localStorage.getItem('grade_exams') || '{}');
          const oralsLocal = JSON.parse(localStorage.getItem('grade_orals') || '{}');
          const testsLocal = JSON.parse(localStorage.getItem('grade_tests') || '{}');

          const newCourse = await fetchWithActing('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: localConfig,
          }).then((r) => r.json());
          
          for (const s of studentsLocal) {
            await fetchWithActing('/api/students', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...s, frontendId: s.id, courseId: newCourse.id }),
            });
          }

          for (const [id, exam] of Object.entries(examsLocal)) {
            await fetchWithActing(`/api/exams/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...exam, examNumber: Number(id), courseId: newCourse.id }),
            });
          }

          for (const [id, oral] of Object.entries(oralsLocal)) {
            await fetchWithActing(`/api/orals/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...oral, oralNumber: Number(id), courseId: newCourse.id }),
            });
          }

          for (const [id, test] of Object.entries(testsLocal)) {
            const { errors: legacyErr, ...testRest } = test;
            await fetchWithActing(`/api/tests/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...testRest,
                scores: test.scores ?? legacyErr ?? {},
                testNumber: Number(id),
                courseId: newCourse.id,
              }),
            });
          }

          localStorage.removeItem('grade_config');
          localStorage.removeItem('grade_students');
          localStorage.removeItem('grade_exams');
          localStorage.removeItem('grade_orals');
          localStorage.removeItem('grade_tests');
          
          console.log("Migration complete!");
        }

        const coursesRes = await fetchWithActing('/api/courses').then((r) => r.json());
        const list = Array.isArray(coursesRes) ? coursesRes : [];
        setCourses(list);
        setActiveCourseId((prev) => {
          const ids = list.map((c) => c.id);
          if (prev != null && ids.includes(prev)) return prev;
          return list[0]?.id ?? null;
        });
        if (list.length === 0) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to init app", err);
        setLoading(false);
      }
    };
    initApp();
  }, [currentUser?.username, fetchWithActing]);

  const refreshSchoolRosterYears = useCallback(async () => {
    try {
      const res = await apiFetch('/api/school-roster-years');
      const data = await res.json();
      const list = Array.isArray(data) ? sortSchoolYears(data) : [];
      setSchoolRosterYears(list);
      setActiveSchoolRosterYearId((prev) => {
        if (prev != null && list.some((y) => y.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
      return list;
    } catch (err) {
      console.error('Failed to fetch school roster years', err);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshSchoolRosterYears();
  }, [refreshSchoolRosterYears]);

  useEffect(() => {
    if (!activeSchoolRosterYearId) {
      setSchoolRosterStudents([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          `/api/school-roster-students?schoolYearId=${encodeURIComponent(activeSchoolRosterYearId)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        setSchoolRosterStudents(Array.isArray(data) ? sortSchoolRosterRows(data) : []);
      } catch (err) {
        console.error('Failed to fetch school roster', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSchoolRosterYearId]);

  // Whenever activeCourseId changes, fetch its data
  useEffect(() => {
    if (!activeCourseId || !currentUser?.username) return undefined;
    setLoading(true);
    const fetchCourseData = async () => {
      try {
        const [studentsRes, examsRes, oralsRes, testsRes, gfsRes, moneyListsRes] = await Promise.all([
          fetchWithActing(`/api/students?courseId=${activeCourseId}`).then((r) => r.json()),
          fetchWithActing(`/api/exams?courseId=${activeCourseId}`).then((r) => r.json()),
          fetchWithActing(`/api/orals?courseId=${activeCourseId}`).then((r) => r.json()),
          fetchWithActing(`/api/tests?courseId=${activeCourseId}`).then((r) => r.json()),
          fetchWithActing(`/api/gfs?courseId=${activeCourseId}`).then((r) => r.json()),
          fetchWithActing(`/api/money-lists?courseId=${activeCourseId}`).then((r) => r.json()),
        ]);
        setStudents(Array.isArray(studentsRes) ? sortCourseStudents(studentsRes) : []);
        setExams(examsRes);
        setOrals(oralsRes);
        setTests(testsRes);
        setGfsEntries(Array.isArray(gfsRes) ? gfsRes : []);
        setMoneyLists(Array.isArray(moneyListsRes) ? moneyListsRes : []);
      } catch (err) {
        console.error("Failed to fetch course data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourseData();
    return undefined;
  }, [activeCourseId, currentUser?.username, fetchWithActing]);

  const refreshMoneyLists = useCallback(async () => {
    if (!activeCourseId) {
      setMoneyLists([]);
      return;
    }
    try {
      const data = await fetchWithActing(`/api/money-lists?courseId=${activeCourseId}`).then((r) => r.json());
      setMoneyLists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to refresh money lists', err);
    }
  }, [activeCourseId, fetchWithActing]);

  const apiCall = useCallback(async (url, method, body) => {
    try {
      const res = await fetchWithActing(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.status === 204 || res.status === 205) return undefined;
      const text = await res.text();
      if (!text) return undefined;
      return JSON.parse(text);
    } catch (err) {
      console.error(`API Error: ${method} ${url}`, err);
    }
  }, [fetchWithActing]);

  // Create new course
  const createCourse = async (newConfig) => {
    const created = await apiCall('/api/courses', 'POST', newConfig);
    if (created) {
      setCourses(prev => [...prev, created]);
      setActiveCourseId(created.id);
    }
    return created;
  };

  // Update existing config/course
  const updateConfig = (newConfigUpdater) => {
    if (!activeCourseId) return;
    const currentConfig = courses.find(c => c.id === activeCourseId);
    const nextConfig = typeof newConfigUpdater === 'function' ? newConfigUpdater(currentConfig) : newConfigUpdater;
    
    setCourses(prev => prev.map(c => c.id === activeCourseId ? { ...c, ...nextConfig } : c));
    apiCall(`/api/courses/${activeCourseId}`, 'PUT', nextConfig);
  };

  const toggleCourseFavorite = (courseId) => {
    setCourses((prev) => {
      const course = prev.find((c) => c.id === courseId);
      if (!course) return prev;
      const merged = { ...course, isFavorite: !course.isFavorite };
      apiCall(`/api/courses/${courseId}`, 'PUT', merged);
      return prev.map((c) => (c.id === courseId ? merged : c));
    });
  };

  /**
   * Alle manuell gespeicherten Noten (Endnote, mündlich „Note“, GFS) zwischen Kodierungen umrechnen,
   * wenn das Kurs-Notensystem gewechselt wird.
   */
  const migrateGradingSystem = async (fromGs, toGs) => {
    if (!activeCourseId || fromGs === toGs) return;

    for (const s of students) {
      const nextNote = migrateStoredGradeString(s.summaryEndNote ?? '', fromGs, toGs);
      if (nextNote !== (s.summaryEndNote ?? '')) {
        const merged = { ...s, summaryEndNote: nextNote };
        await apiCall(`/api/students/${s.id}`, 'PUT', { ...merged, courseId: activeCourseId });
        setStudents((prev) => prev.map((p) => (p.id === s.id ? { ...p, summaryEndNote: nextNote } : p)));
      }
    }

    for (const oralId of Object.keys(orals)) {
      const o = orals[oralId];
      const grades = { ...o.grades };
      let changed = false;
      for (const sid of Object.keys(grades)) {
        const migrated = migrateOralGradeEntry(grades[sid], fromGs, toGs);
        if (JSON.stringify(migrated) !== JSON.stringify(grades[sid])) {
          grades[sid] = migrated;
          changed = true;
        }
      }
      if (changed) {
        const newOral = { ...o, grades };
        await apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
        setOrals((prev) => ({ ...prev, [oralId]: newOral }));
      }
    }

    for (const row of gfsEntries) {
      const nextNote = migrateStoredGradeString(row.note ?? '', fromGs, toGs);
      if (nextNote !== (row.note ?? '')) {
        await apiCall(`/api/gfs/${row.id}`, 'PUT', { ...row, note: nextNote, courseId: activeCourseId });
        setGfsEntries((prev) => prev.map((r) => (r.id === row.id ? { ...r, note: nextNote } : r)));
      }
    }

    if (toGs === 'points') {
      for (const examId of Object.keys(exams)) {
        const ex = exams[examId];
        if (!ex) continue;
        const kt = ex.keyType || '1';
        if (kt === '1') {
          const newExam = { ...ex, keyType: 'abi' };
          await apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
          setExams((prev) => ({ ...prev, [examId]: { ...prev[examId], keyType: 'abi' } }));
        }
      }
    }
    if (toGs === 'classic') {
      for (const examId of Object.keys(exams)) {
        const ex = exams[examId];
        if (!ex) continue;
        if (ex.keyType === 'abi') {
          const newExam = { ...ex, keyType: '1' };
          await apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
          setExams((prev) => ({ ...prev, [examId]: { ...prev[examId], keyType: '1' } }));
        }
      }
    }
  };

  const deleteCourse = async (id) => {
    await apiCall(`/api/courses/${id}`, 'DELETE');
    setCourses(prev => prev.filter(c => c.id !== id));
    
    if (activeCourseId === id) {
      const remaining = courses.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setActiveCourseId(remaining[0].id);
      } else {
        setActiveCourseId(null);
        setStudents([]);
        setExams({});
        setOrals({});
        setTests({});
        setGfsEntries([]);
      }
    }
  };

  // Students Helpers
  const addStudent = async (student) => {
    const tempId = Date.now();
    setStudents(prev => [...prev, { ...student, id: tempId, frontendId: tempId, studentNumber: (prev.reduce((m, s) => Math.max(m, s.studentNumber || 0), 0) + 1) }]);
    const created = await apiCall('/api/students', 'POST', { ...student, frontendId: tempId, courseId: activeCourseId });
    if (created) {
      setStudents(prev => prev.map(s => s.frontendId == tempId ? created : s));
      await refreshMoneyLists();
    }
  };

  const removeStudent = async (id) => {
    try {
      const res = await fetchWithActing(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('Schüler löschen fehlgeschlagen:', res.status);
        return;
      }
      if (!activeCourseId) return;
      const studentsRes = await fetchWithActing(`/api/students?courseId=${activeCourseId}`).then((r) => r.json());
      setStudents(Array.isArray(studentsRes) ? sortCourseStudents(studentsRes) : []);
      await refreshMoneyLists();
    } catch (err) {
      console.error(err);
    }
  };

  const clearCourseStudents = async () => {
    if (!activeCourseId) return;
    await apiCall(`/api/students?courseId=${activeCourseId}`, 'DELETE');
    setStudents([]);
    await refreshMoneyLists();
  };
  
  const updateStudentConfig = (id, field, value) => {
    const syncMoneyListsAfterSave =
      field === 'firstName' || field === 'lastName' || field === 'studentNumber';
    setStudents((prev) => {
      const student = prev.find((s) => s.id === id);
      if (!student) return prev;
      const merged = { ...student, [field]: value };
      void apiCall(`/api/students/${id}`, 'PUT', { ...merged, courseId: merged.courseId ?? activeCourseId }).then(
        () => {
          if (syncMoneyListsAfterSave) refreshMoneyLists();
        },
      );
      return prev.map((s) => (s.id === id ? merged : s));
    });
  };

  // Exams Helpers
  const addExam = async () => {
    const examNumbers = Object.keys(exams).map(Number);
    const nextNumber = examNumbers.length > 0 ? Math.max(...examNumbers) + 1 : 1;
    const gs = normalizeCourseGradeSystem(config?.gradeSystem);
    const defaultKeyType = gs === 'points' ? 'abi' : '1';

    const newExamData = { 
      examNumber: nextNumber, 
      active: true, 
      maxPoints: 50, 
      numFields: 1, 
      fieldMaxPoints: {}, 
      keyType: defaultKeyType, 
      date: '', 
      halbjahr: '1',
      name: `Klausur ${nextNumber}`, 
      scores: {}, 
      courseId: activeCourseId 
    };
    
    setExams(prev => ({ ...prev, [nextNumber]: newExamData }));
    
    const created = await apiCall(`/api/exams/${nextNumber}`, 'PUT', newExamData);
    if (created) {
      setExams(prev => ({ ...prev, [nextNumber]: created }));
      return nextNumber;
    }
    return nextNumber;
  };

  const updateExam = (id, field, value) => {
    setExams(prev => {
      const nextExams = { ...prev, [id]: { ...prev[id], [field]: value } };
      apiCall(`/api/exams/${id}`, 'PUT', { ...nextExams[id], courseId: activeCourseId });
      return nextExams;
    });
  };

  const removeExam = async (examId) => {
    const key = String(examId);
    setExams((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await apiCall(`/api/exams/${examId}?courseId=${activeCourseId}`, 'DELETE');
  };

  const updateExamFieldMaxPoints = (examId, fieldIndex, points) => {
    setExams(prev => {
      const exam = prev[examId];
      const prevFieldMax = exam.fieldMaxPoints || {};
      const newFieldMax = { ...prevFieldMax, [fieldIndex]: points };
      const nf = Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, exam.numFields || 1));
      let totalMax = 0;
      for (let i = 0; i < nf; i += 1) {
        totalMax += parseFloat(newFieldMax[i]) || 0;
      }

      const newExam = {
        ...exam,
        fieldMaxPoints: newFieldMax,
        maxPoints: totalMax > 0 ? totalMax : exam.maxPoints
      };

      apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
      return { ...prev, [examId]: newExam };
    });
  };

  const updateExamScore = (examId, studentId, fieldIndex, points) => {
    setExams(prev => {
      const prevStudentScores = prev[examId].scores[studentId] || {};
      const newScores = typeof prevStudentScores === 'object' 
        ? { ...prevStudentScores, [fieldIndex]: points }
        : { 0: prevStudentScores, [fieldIndex]: points };

      const newExam = {
        ...prev[examId],
        scores: { ...prev[examId].scores, [studentId]: newScores }
      };

      apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
      return { ...prev, [examId]: newExam };
    });
  };

  const updateExamCounted = (examId, studentId, counted) => {
    setExams(prev => {
      const prevStudentScores = prev[examId].scores[studentId];
      const newScores = (typeof prevStudentScores === 'object' && prevStudentScores !== null)
        ? { ...prevStudentScores, _counted: counted }
        : { 0: prevStudentScores, _counted: counted };

      const newExam = {
        ...prev[examId],
        scores: { ...prev[examId].scores, [studentId]: newScores }
      };
      apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
      return { ...prev, [examId]: newExam };
    });
  };

  const updateExamStudentNachschreiber = (examId, studentId, active) => {
    setExams(prev => {
      const exam = prev[examId];
      const cap = Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, exam.numFields || 1)); // Startwert = Klausur-Felderzahl
      const prevStudentScores = exam.scores[studentId];
      let newScores;
      if (typeof prevStudentScores === 'object' && prevStudentScores !== null) {
        if (active) {
          newScores = {
            ...prevStudentScores,
            _nachschreiber: true,
            _nachschreiberFields: cap,
          };
        } else {
          const { _nachschreiber, _nachschreiberFields, ...rest } = prevStudentScores;
          newScores = rest;
        }
      } else if (active) {
        newScores = prevStudentScores !== undefined && prevStudentScores !== null
          ? { 0: prevStudentScores, _counted: true, _nachschreiber: true, _nachschreiberFields: cap }
          : { _counted: true, _nachschreiber: true, _nachschreiberFields: cap };
      } else {
        newScores = prevStudentScores !== undefined && prevStudentScores !== null
          ? { 0: prevStudentScores }
          : {};
      }

      const newExam = {
        ...exam,
        scores: { ...exam.scores, [studentId]: newScores },
      };
      apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
      return { ...prev, [examId]: newExam };
    });
  };

  const updateExamStudentNachschreiberFields = (examId, studentId, rawN) => {
    setExams(prev => {
      const exam = prev[examId];
      const n = Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, parseInt(rawN, 10) || 1));
      const prevStudentScores = exam.scores[studentId];
      const base = (typeof prevStudentScores === 'object' && prevStudentScores !== null)
        ? { ...prevStudentScores, _nachschreiber: true, _nachschreiberFields: n }
        : { 0: prevStudentScores, _counted: true, _nachschreiber: true, _nachschreiberFields: n };

      const newScores = { ...base };
      Object.keys(newScores).forEach((k) => {
        if (/^\d+$/.test(k) && parseInt(k, 10) >= n) delete newScores[k];
      });

      const newExam = {
        ...exam,
        scores: { ...exam.scores, [studentId]: newScores },
      };
      apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
      return { ...prev, [examId]: newExam };
    });
  };

  // Orals Helpers
  const addOral = async () => {
    const oralNumbers = Object.keys(orals).map(Number);
    const nextNumber = oralNumbers.length > 0 ? Math.max(...oralNumbers) + 1 : 1;
    
    const newOralData = { 
      oralNumber: nextNumber, 
      active: true,
      name: `Mündlich ${nextNumber}`, 
      date: '',
      halbjahr: '1',
      extended: false,
      weekCount: 1,
      bestNote: 1,
      worstNote: 6,
      weekSpread: 0.5,
      grades: {}, 
      courseId: activeCourseId 
    };
    
    setOrals(prev => ({ ...prev, [nextNumber]: newOralData }));
    
    const created = await apiCall(`/api/orals/${nextNumber}`, 'PUT', newOralData);
    if (created) {
      setOrals(prev => ({ ...prev, [nextNumber]: created }));
      return nextNumber;
    }
    return nextNumber;
  };

  const removeOral = async (oralId) => {
    const key = String(oralId);
    setOrals((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await apiCall(`/api/orals/${oralId}?courseId=${activeCourseId}`, 'DELETE');
  };

  const updateOralGrade = (oralId, studentId, grade) => {
    setOrals(prev => {
      const prevData = prev[oralId].grades[studentId];
      const newData = (typeof prevData === 'object' && prevData !== null)
        ? { ...prevData, value: grade }
        : { value: grade, _counted: true };
        
      const newOral = {
        ...prev[oralId],
        grades: { ...prev[oralId].grades, [studentId]: newData }
      };
      apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
      return { ...prev, [oralId]: newOral };
    });
  };

  const updateOralCounted = (oralId, studentId, counted) => {
    setOrals(prev => {
      const prevData = prev[oralId].grades[studentId];
      const newData = (typeof prevData === 'object' && prevData !== null)
        ? { ...prevData, _counted: counted }
        : { value: prevData, _counted: counted };
        
      const newOral = {
        ...prev[oralId],
        grades: { ...prev[oralId].grades, [studentId]: newData }
      };
      apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
      return { ...prev, [oralId]: newOral };
    });
  };

  /** Wochenpunkte (-2 … +2) für `weekIndex` (0-basiert), in `grades[studentId].weekPoints` */
  const updateOralWeekPoints = (oralId, studentId, weekIndex, rawValue) => {
    let n = parseInt(String(rawValue), 10);
    if (Number.isNaN(n)) n = 0;
    n = Math.min(2, Math.max(-2, n));
    setOrals(prev => {
      const o = prev[oralId];
      if (!o) return prev;
      const weekCount = Math.max(1, o.weekCount || 1);
      const prevData = o.grades[studentId];
      const arr = getNormalizedOralWeekPointsArray(prevData, weekCount);
      if (weekIndex >= 0 && weekIndex < arr.length) arr[weekIndex] = n;
      const newData = mergeOralGradeWithWeekPoints(prevData, arr);
      const newOral = {
        ...o,
        grades: { ...o.grades, [studentId]: newData },
      };
      apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
      return { ...prev, [oralId]: newOral };
    });
  };

  const addOralWeekColumn = (oralId) => {
    setOrals(prev => {
      const o = prev[oralId];
      if (!o) return prev;
      const prevCount = Math.max(1, o.weekCount || 1);
      if (prevCount >= ORAL_WEEK_COL_CAP) return prev;
      const nextCount = prevCount + 1;
      const grades = { ...o.grades };
      for (const sid of Object.keys(grades)) {
        const prevData = grades[sid];
        const arr = getNormalizedOralWeekPointsArray(prevData, prevCount);
        arr.push(0);
        grades[sid] = mergeOralGradeWithWeekPoints(prevData, arr);
      }
      const newOral = { ...o, weekCount: nextCount, grades };
      apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
      return { ...prev, [oralId]: newOral };
    });
  };

  const removeOralWeekColumn = (oralId) => {
    setOrals(prev => {
      const o = prev[oralId];
      if (!o) return prev;
      const prevCount = Math.max(1, o.weekCount || 1);
      if (prevCount <= 1) return prev;
      const nextCount = prevCount - 1;
      const grades = { ...o.grades };
      for (const sid of Object.keys(grades)) {
        const prevData = grades[sid];
        const arr = getNormalizedOralWeekPointsArray(prevData, prevCount).slice(0, nextCount);
        grades[sid] = mergeOralGradeWithWeekPoints(prevData, arr);
      }
      const newOral = { ...o, weekCount: nextCount, grades };
      apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
      return { ...prev, [oralId]: newOral };
    });
  };

  const updateOral = (id, field, value) => {
    setOrals(prev => {
      const nextOrals = { ...prev, [id]: { ...prev[id], [field]: value } };
      apiCall(`/api/orals/${id}`, 'PUT', { ...nextOrals[id], courseId: activeCourseId });
      return nextOrals;
    });
  };

  // Tests Helpers
  const addTest = async () => {
    const testNumbers = Object.keys(tests).map(Number);
    const nextNumber = testNumbers.length > 0 ? Math.max(...testNumbers) + 1 : 1;
    
    const newTestData = { 
      testNumber: nextNumber, 
      active: true, 
      maxPoints: 10,
      keyType: '1', 
      date: '', 
      halbjahr: '1',
      name: `Test ${nextNumber}`, 
      scores: {}, 
      courseId: activeCourseId 
    };
    
    setTests(prev => ({ ...prev, [nextNumber]: newTestData }));
    
    const created = await apiCall(`/api/tests/${nextNumber}`, 'PUT', newTestData);
    if (created) {
      setTests(prev => ({ ...prev, [nextNumber]: created }));
      return nextNumber;
    }
    return nextNumber;
  };

  const updateTest = (id, field, value) => {
    setTests(prev => {
      const nextTests = { ...prev, [id]: { ...prev[id], [field]: value } };
      apiCall(`/api/tests/${id}`, 'PUT', { ...nextTests[id], courseId: activeCourseId });
      return nextTests;
    });
  };

  const updateTestScore = (testId, studentId, pointsValue) => {
    setTests((prev) => {
      const prevTest = prev[testId];
      const map = prevTest.scores ?? prevTest.errors ?? {};
      const prevData = map[studentId];
      const newData =
        typeof prevData === 'object' && prevData !== null
          ? { ...prevData, value: pointsValue }
          : { value: pointsValue, _counted: true };

      const newTest = {
        ...prevTest,
        scores: { ...map, [studentId]: newData },
      };
      delete newTest.errors;
      apiCall(`/api/tests/${testId}`, 'PUT', { ...newTest, courseId: activeCourseId });
      return { ...prev, [testId]: newTest };
    });
  };

  const updateTestCounted = (testId, studentId, counted) => {
    setTests((prev) => {
      const prevTest = prev[testId];
      const map = prevTest.scores ?? prevTest.errors ?? {};
      const prevData = map[studentId];
      const newData =
        typeof prevData === 'object' && prevData !== null
          ? { ...prevData, _counted: counted }
          : { value: prevData, _counted: counted };

      const newTest = {
        ...prevTest,
        scores: { ...map, [studentId]: newData },
      };
      delete newTest.errors;
      apiCall(`/api/tests/${testId}`, 'PUT', { ...newTest, courseId: activeCourseId });
      return { ...prev, [testId]: newTest };
    });
  };

  const updateTestStudentNachschreiber = (testId, studentId, active) => {
    setTests((prev) => {
      const prevTest = prev[testId];
      const map = prevTest.scores ?? prevTest.errors ?? {};
      const prevData = map[studentId];
      const defaultNachMax =
        Number.isFinite(parseFloat(prevTest.maxPoints)) && parseFloat(prevTest.maxPoints) > 0
          ? parseFloat(prevTest.maxPoints)
          : 10;
      let newData;
      if (typeof prevData === 'object' && prevData !== null) {
        if (active) {
          const existingNachMax = parseFloat(String(prevData._nachschreiberMaxPoints).replace(',', '.'));
          newData = {
            ...prevData,
            _nachschreiber: true,
            _nachschreiberMaxPoints:
              Number.isFinite(existingNachMax) && existingNachMax > 0 ? existingNachMax : defaultNachMax,
          };
        } else {
          const { _nachschreiber, ...rest } = prevData;
          newData = rest;
        }
      } else if (active) {
        newData =
          prevData !== undefined && prevData !== null
            ? {
                value: String(prevData),
                _counted: true,
                _nachschreiber: true,
                _nachschreiberMaxPoints: defaultNachMax,
              }
            : { value: '', _counted: true, _nachschreiber: true, _nachschreiberMaxPoints: defaultNachMax };
      } else {
        newData = prevData;
      }

      const newTest = {
        ...prevTest,
        scores: { ...map, [studentId]: newData },
      };
      delete newTest.errors;
      apiCall(`/api/tests/${testId}`, 'PUT', { ...newTest, courseId: activeCourseId });
      return { ...prev, [testId]: newTest };
    });
  };

  const updateTestNachschreiberMaxPoints = (testId, studentId, rawValue) => {
    setTests((prev) => {
      const prevTest = prev[testId];
      const map = prevTest.scores ?? prevTest.errors ?? {};
      const prevData = map[studentId];
      const v = parseFloat(String(rawValue).replace(',', '.'));
      const fallback =
        Number.isFinite(parseFloat(prevTest.maxPoints)) && parseFloat(prevTest.maxPoints) > 0
          ? parseFloat(prevTest.maxPoints)
          : 10;
      const maxVal = Number.isFinite(v) && v > 0 ? v : fallback;
      const newData =
        typeof prevData === 'object' && prevData !== null
          ? { ...prevData, _nachschreiber: true, _nachschreiberMaxPoints: maxVal }
          : {
              value: prevData !== undefined && prevData !== null ? String(prevData) : '',
              _counted: true,
              _nachschreiber: true,
              _nachschreiberMaxPoints: maxVal,
            };
      const newTest = {
        ...prevTest,
        scores: { ...map, [studentId]: newData },
      };
      delete newTest.errors;
      apiCall(`/api/tests/${testId}`, 'PUT', { ...newTest, courseId: activeCourseId });
      return { ...prev, [testId]: newTest };
    });
  };

  const addGfsEntry = async (studentId) => {
    const created = await apiCall('/api/gfs', 'POST', {
      courseId: activeCourseId,
      studentId,
      thema: '',
      art: '',
      date: '',
      gehalten: false,
      halbjahr: '1',
      note: '',
    });
    if (created && created.id) {
      setGfsEntries((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const updateGfsEntry = (entryId, field, value) => {
    setGfsEntries((prev) => {
      const row = prev.find((e) => e.id === entryId);
      if (!row) return prev;
      const next = { ...row, [field]: value };
      apiCall(`/api/gfs/${entryId}`, 'PUT', { ...next, courseId: activeCourseId });
      return prev.map((e) => (e.id === entryId ? next : e));
    });
  };

  const removeGfsEntry = (entryId) => {
    setGfsEntries((prev) => prev.filter((e) => e.id !== entryId));
    apiCall(`/api/gfs/${entryId}`, 'DELETE');
  };

  const createMoneyList = async ({ subject, amountPerStudent, notes, dueDate }) => {
    if (!activeCourseId) return null;
    const created = await apiCall('/api/money-lists', 'POST', {
      courseId: activeCourseId,
      subject,
      amountPerStudent,
      notes: notes ?? '',
      dueDate: dueDate ?? null,
    });
    if (created?.id) {
      setMoneyLists((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const updateMoneyList = async (id, { subject, amountPerStudent, notes, dueDate }) => {
    const updated = await apiCall(`/api/money-lists/${id}`, 'PUT', {
      subject,
      amountPerStudent,
      notes: notes ?? '',
      dueDate: dueDate ?? null,
    });
    if (updated?.id) {
      setMoneyLists((prev) =>
        prev.map((l) => (l.id === id ? updated : l)).sort((a, b) => a.id - b.id),
      );
    }
    return updated;
  };

  const deleteMoneyList = async (id) => {
    const res = await apiCall(`/api/money-lists/${id}`, 'DELETE');
    if (res?.error) return res;
    setMoneyLists((prev) => prev.filter((l) => l.id !== id));
    return { ok: true };
  };

  const updateMoneyListEntryPaid = (listId, entryId, paid) => {
    setMoneyLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        return {
          ...list,
          entries: (list.entries || []).map((e) => (e.id === entryId ? { ...e, paid } : e)),
        };
      }),
    );
    apiCall(`/api/money-list-entries/${entryId}`, 'PUT', { paid });
  };

  const addSchoolRosterYear = async (label) => {
    const created = await apiCall('/api/school-roster-years', 'POST', { label });
    if (created?.error) return created;
    if (created?.id != null) {
      setSchoolRosterYears((prev) => sortSchoolYears([...prev, created]));
      setActiveSchoolRosterYearId(created.id);
    }
    return created;
  };

  const removeSchoolRosterYear = async (id) => {
    await apiCall(`/api/school-roster-years/${id}`, 'DELETE');
    setSchoolRosterYears((prev) => {
      const next = prev.filter((y) => y.id !== id);
      setActiveSchoolRosterYearId((active) => {
        if (active !== id) return active;
        setSchoolRosterStudents([]);
        return next[0]?.id ?? null;
      });
      return next;
    });
  };

  const addSchoolRosterStudent = async ({ gradeLevel, firstName, lastName, schoolYearId }) => {
    const yearId = schoolYearId ?? activeSchoolRosterYearId;
    if (!yearId) return { error: 'Bitte zuerst ein Schuljahr anlegen oder auswählen.' };
    const created = await apiCall('/api/school-roster-students', 'POST', {
      gradeLevel,
      firstName,
      lastName,
      schoolYearId: yearId,
    });
    if (created && created.id != null && Number(created.schoolYearId) === Number(activeSchoolRosterYearId)) {
      setSchoolRosterStudents((prev) => sortSchoolRosterRows([...prev, created]));
    }
    if (created?.id != null) {
      setSchoolRosterYears((prev) =>
        prev.map((y) =>
          y.id === yearId ? { ...y, studentCount: (y.studentCount ?? 0) + 1 } : y,
        ),
      );
    }
    return created;
  };

  const updateSchoolRosterStudent = async (id, { gradeLevel, firstName, lastName, schoolYearId }) => {
    const yearId = schoolYearId ?? activeSchoolRosterYearId;
    if (!yearId) return { error: 'Schuljahr fehlt.' };
    const updated = await apiCall(`/api/school-roster-students/${id}`, 'PUT', {
      gradeLevel,
      firstName,
      lastName,
      schoolYearId: yearId,
    });
    if (updated?.error) return updated;
    if (updated && updated.id != null) {
      if (Number(updated.schoolYearId) === Number(activeSchoolRosterYearId)) {
        setSchoolRosterStudents((prev) =>
          sortSchoolRosterRows(prev.map((r) => (r.id === id ? { ...r, ...updated } : r))),
        );
      } else {
        setSchoolRosterStudents((prev) => prev.filter((r) => r.id !== id));
      }
    }
    return updated;
  };

  const removeSchoolRosterStudent = async (id) => {
    await apiCall(`/api/school-roster-students/${id}`, 'DELETE');
    setSchoolRosterStudents((prev) => prev.filter((r) => r.id !== id));
    if (activeSchoolRosterYearId) {
      setSchoolRosterYears((prev) =>
        prev.map((y) =>
          y.id === activeSchoolRosterYearId
            ? { ...y, studentCount: Math.max(0, (y.studentCount ?? 1) - 1) }
            : y,
        ),
      );
    }
  };

  const clearSchoolRosterStudents = async (schoolYearId) => {
    const yearId = schoolYearId ?? activeSchoolRosterYearId;
    if (!yearId) return;
    await apiFetch(`/api/school-roster-students?schoolYearId=${encodeURIComponent(yearId)}`, { method: 'DELETE' });
    if (Number(yearId) === Number(activeSchoolRosterYearId)) {
      setSchoolRosterStudents([]);
    }
    setSchoolRosterYears((prev) => prev.map((y) => (y.id === yearId ? { ...y, studentCount: 0 } : y)));
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          minHeight: 0,
          width: '100%',
          color: '#64748b',
        }}
      >
        Lade Daten…
      </div>
    );
  }

  return (
    <DataContext.Provider value={{
      courses, activeCourseId, setActiveCourseId, createCourse, deleteCourse, toggleCourseFavorite,
      config, setConfig: updateConfig, migrateGradingSystem,
      students, addStudent, removeStudent, clearCourseStudents, updateStudentConfig,
      exams, addExam, removeExam, updateExam, updateExamScore, updateExamFieldMaxPoints, updateExamCounted,
      updateExamStudentNachschreiber, updateExamStudentNachschreiberFields,
      orals, addOral, removeOral, updateOral, updateOralGrade, updateOralCounted, updateOralWeekPoints, addOralWeekColumn, removeOralWeekColumn,
      tests, addTest, updateTestScore, updateTest, updateTestCounted, updateTestStudentNachschreiber, updateTestNachschreiberMaxPoints,
      gfsEntries, addGfsEntry, updateGfsEntry, removeGfsEntry,
      moneyLists, createMoneyList, updateMoneyList, deleteMoneyList, updateMoneyListEntryPaid,
      schoolRosterYears,
      activeSchoolRosterYearId,
      setActiveSchoolRosterYearId,
      refreshSchoolRosterYears,
      addSchoolRosterYear,
      removeSchoolRosterYear,
      schoolRosterStudents,
      addSchoolRosterStudent,
      updateSchoolRosterStudent,
      removeSchoolRosterStudent,
      clearSchoolRosterStudents,
    }}>
      {children}
    </DataContext.Provider>
  );
};
