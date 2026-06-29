import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  EXAM_ABS_MAX_FIELDS,
  getNormalizedOralWeekPointsArray,
  getNormalizedOralWeekGradesArray,
  defaultOralWeekColumnLabel,
  migrateStoredGradeString,
  migrateOralGradeEntry,
  normalizeCourseGradeSystem,
  parseScorePointsValue,
  normalizeProjectScoresMap,
  normalizeProjectMemberOverrides,
  buildInitialNachschreiberFieldMaxPoints,
  getNachschreiberFieldMaxPoints,
} from '../utils/calculator';
import { getOralExtendedMode } from '../utils/oralExtendedMode';
import { sortSchoolYears } from '../utils/schoolYear';
import { apiFetch } from '../utils/apiBase';
import { applyCryptoHeader } from '../utils/cryptoSession';
import { checkCryptoApiResponse } from '../utils/apiAuth';
import {
  usesTestsPerKlausurRatio,
  resolveCourseWeighting,
} from '../utils/courseWeightingOptions';
import { normalizeCourseCustomGradingKeys, parseCustomGradingKeys } from '../utils/customGradingKeys';
import { normalizeCourseArchiveFields, collectUsedCustomGradingKeyIds, buildArchivedGradingKeysSnapshot } from '../utils/courseArchive';

const ORAL_WEEK_COL_CAP = 24;

function sortSchoolRosterRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
    const secA = String(a.classSection ?? '');
    const secB = String(b.classSection ?? '');
    if (secA !== secB) return secA.localeCompare(secB, 'de', { sensitivity: 'base' });
    const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
    if (ln !== 0) return ln;
    return String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
  });
}

/** Kurs-Schüler: Nachname, Vorname (de-DE), dann Schülernummer */
function sortCourseStudents(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ln = String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de', { sensitivity: 'base' });
    if (ln !== 0) return ln;
    const fn = String(a.firstName || '').localeCompare(String(b.firstName || ''), 'de', { sensitivity: 'base' });
    if (fn !== 0) return fn;
    const an = a.studentNumber;
    const bn = b.studentNumber;
    if (an != null && bn != null) return an - bn;
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

function mergeOralGradeWithWeekGrades(prevData, weekGradesArr) {
  const base =
    typeof prevData === 'object' && prevData !== null
      ? { ...prevData, weekGrades: [...weekGradesArr] }
      : typeof prevData === 'string' || typeof prevData === 'number'
        ? { value: String(prevData), _counted: true, weekGrades: [...weekGradesArr] }
        : { value: '', _counted: true, weekGrades: [...weekGradesArr] };
  if ('week1' in base) delete base.week1;
  return base;
}

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();

  const fetchWithActing = useCallback(
    async (url, init = {}) => {
      const headers = applyCryptoHeader(new Headers(init.headers || {}));
      if (currentUser?.username) headers.set('X-Acting-User', currentUser.username);
      const res = await apiFetch(url, { ...init, headers });
      const crypto = await checkCryptoApiResponse(res);
      return crypto.lost ? null : res;
    },
    [currentUser?.username],
  );

  const [courses, setCourses] = useState([]);
  const courseKey = currentUser?.username ? `phix_last_course_id_${currentUser.username}` : null;
  const [activeCourseId, setActiveCourseIdRaw] = useState(() => {
    try {
      const stored = courseKey && localStorage.getItem(courseKey);
      return stored ? Number(stored) : null;
    } catch { return null; }
  });
  const setActiveCourseId = useCallback((valOrFn) => {
    setActiveCourseIdRaw((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      try { if (next != null && courseKey) localStorage.setItem(courseKey, String(next)); } catch {}
      return next;
    });
  }, [courseKey]);

  // Der aktuelle 'config' entspricht dem aktiven Kurs
  const config = courses.find(c => c.id === activeCourseId) || null;
  const courseArchived = config?.archived === true;

  const [students, setStudents] = useState([]);
  const [schoolRosterYears, setSchoolRosterYears] = useState([]);
  const [activeSchoolRosterYearId, setActiveSchoolRosterYearId] = useState(null);
  const [schoolRosterStudents, setSchoolRosterStudents] = useState([]);
  const [exams, setExams] = useState({});
  const [orals, setOrals] = useState({});
  const [tests, setTests] = useState({});
  const [projects, setProjects] = useState({});
  const [gfsEntries, setGfsEntries] = useState([]);
  const [referatEntries, setReferatEntries] = useState([]);
  const [moneyLists, setMoneyLists] = useState([]);
  const [attendanceLists, setAttendanceLists] = useState([]);
  const [collectionLists, setCollectionLists] = useState([]);
  const [notesLists, setNotesLists] = useState([]);
  const [albumPhotos, setAlbumPhotos] = useState([]);
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

        const coursesResRaw = await fetchWithActing('/api/courses');
        if (!coursesResRaw?.ok) {
          setLoading(false);
          return;
        }
        const coursesRes = await coursesResRaw.json();
        const list = Array.isArray(coursesRes)
          ? coursesRes.map((c) => normalizeCourseArchiveFields(normalizeCourseCustomGradingKeys(c)))
          : [];
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
    if (!currentUser?.username) {
      setSchoolRosterYears([]);
      return [];
    }
    try {
      const res = await fetchWithActing('/api/school-roster-years');
      if (!res?.ok) return [];
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
  }, [currentUser?.username, fetchWithActing]);

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
        const res = await fetchWithActing(
          `/api/school-roster-students?schoolYearId=${encodeURIComponent(activeSchoolRosterYearId)}`,
        );
        if (!res?.ok) return;
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
  }, [activeSchoolRosterYearId, fetchWithActing]);

  // Whenever activeCourseId changes, fetch its data
  useEffect(() => {
    if (!activeCourseId || !currentUser?.username) return undefined;
    setLoading(true);
    const safeFetchJson = (url, fallback) =>
      fetchWithActing(url).then((r) => (r && r.ok ? r.json() : fallback));
    const fetchCourseData = async () => {
      try {
        const [
          studentsRes,
          examsRes,
          oralsRes,
          testsRes,
          projectsRes,
          gfsRes,
          referatRes,
          moneyListsRes,
          attendanceListsRes,
          collectionListsRes,
          notesListsRes,
          albumPhotosRes,
        ] = await Promise.all([
          safeFetchJson(`/api/students?courseId=${activeCourseId}`, []),
          safeFetchJson(`/api/exams?courseId=${activeCourseId}`, {}),
          safeFetchJson(`/api/orals?courseId=${activeCourseId}`, {}),
          safeFetchJson(`/api/tests?courseId=${activeCourseId}`, {}),
          safeFetchJson(`/api/projects?courseId=${activeCourseId}`, {}),
          safeFetchJson(`/api/gfs?courseId=${activeCourseId}`, []),
          safeFetchJson(`/api/referate?courseId=${activeCourseId}`, []),
          safeFetchJson(`/api/money-lists?courseId=${activeCourseId}`, []),
          safeFetchJson(`/api/attendance-lists?courseId=${activeCourseId}`, []),
          safeFetchJson(`/api/collection-lists?courseId=${activeCourseId}`, []),
          safeFetchJson(`/api/notes-lists?courseId=${activeCourseId}`, []),
          safeFetchJson(`/api/album-photos?courseId=${activeCourseId}`, []),
        ]);
        setStudents(Array.isArray(studentsRes) ? sortCourseStudents(studentsRes) : []);
        setExams(examsRes);
        setOrals(oralsRes);
        setTests(testsRes);
        setProjects(projectsRes);
        setGfsEntries(Array.isArray(gfsRes) ? gfsRes : []);
        setReferatEntries(Array.isArray(referatRes) ? referatRes : []);
        setMoneyLists(Array.isArray(moneyListsRes) ? moneyListsRes : []);
        setAttendanceLists(Array.isArray(attendanceListsRes) ? attendanceListsRes : []);
        setCollectionLists(Array.isArray(collectionListsRes) ? collectionListsRes : []);
        setNotesLists(Array.isArray(notesListsRes) ? notesListsRes : []);
        setAlbumPhotos(Array.isArray(albumPhotosRes) ? albumPhotosRes : []);
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
      const res = await fetchWithActing(`/api/money-lists?courseId=${activeCourseId}`);
      const data = res && res.ok ? await res.json() : [];
      setMoneyLists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to refresh money lists', err);
    }
  }, [activeCourseId, fetchWithActing]);

  const refreshAttendanceLists = useCallback(async () => {
    if (!activeCourseId) {
      setAttendanceLists([]);
      return;
    }
    try {
      const res = await fetchWithActing(`/api/attendance-lists?courseId=${activeCourseId}`);
      const data = res && res.ok ? await res.json() : [];
      setAttendanceLists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to refresh attendance lists', err);
    }
  }, [activeCourseId, fetchWithActing]);

  const refreshCollectionLists = useCallback(async () => {
    if (!activeCourseId) {
      setCollectionLists([]);
      return;
    }
    try {
      const res = await fetchWithActing(`/api/collection-lists?courseId=${activeCourseId}`);
      const data = res && res.ok ? await res.json() : [];
      setCollectionLists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to refresh collection lists', err);
    }
  }, [activeCourseId, fetchWithActing]);

  const refreshNotesLists = useCallback(async () => {
    if (!activeCourseId) {
      setNotesLists([]);
      return;
    }
    try {
      const res = await fetchWithActing(`/api/notes-lists?courseId=${activeCourseId}`);
      const data = res && res.ok ? await res.json() : [];
      setNotesLists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to refresh notes lists', err);
    }
  }, [activeCourseId, fetchWithActing]);

  const refreshKlassenlehrerLists = useCallback(async () => {
    await Promise.all([
      refreshMoneyLists(),
      refreshAttendanceLists(),
      refreshCollectionLists(),
      refreshNotesLists(),
    ]);
  }, [refreshMoneyLists, refreshAttendanceLists, refreshCollectionLists, refreshNotesLists]);

  const apiCall = useCallback(async (url, method, body) => {
    const httpMethod = method || 'GET';
    if (courseArchived && httpMethod !== 'GET') {
      const allowCourseDelete = httpMethod === 'DELETE' && /^\/api\/courses\/\d+$/.test(String(url));
      if (!allowCourseDelete) return undefined;
    }
    try {
      const res = await fetchWithActing(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res) return undefined;
      if (res.status === 204 || res.status === 205) return undefined;
      if (!res.ok) {
        console.error(`API Error: ${method} ${url}`, res.status);
        return undefined;
      }
      const text = await res.text();
      if (!text) return undefined;
      return JSON.parse(text);
    } catch (err) {
      console.error(`API Error: ${method} ${url}`, err);
    }
  }, [fetchWithActing, courseArchived]);

  // Create new course
  const createCourse = async (newConfig) => {
    const created = await apiCall('/api/courses', 'POST', newConfig);
    if (created) {
      const normalized = normalizeCourseArchiveFields(normalizeCourseCustomGradingKeys(created));
      setCourses(prev => [...prev, normalized]);
      setActiveCourseId(normalized.id);
    }
    return created ? normalizeCourseArchiveFields(normalizeCourseCustomGradingKeys(created)) : created;
  };

  // Update existing config/course
  const updateConfig = (newConfigUpdater) => {
    if (!activeCourseId || courseArchived) return;
    const currentConfig = courses.find((c) => c.id === activeCourseId);
    if (!currentConfig) return;

    const patch = typeof newConfigUpdater === 'function'
      ? newConfigUpdater(currentConfig)
      : newConfigUpdater;
    let merged = {
      ...currentConfig,
      ...(patch && typeof patch === 'object' ? patch : {}),
    };
    if ('customGradingKeys' in merged) {
      merged.customGradingKeys = parseCustomGradingKeys(merged.customGradingKeys);
    }

    if (patch && typeof patch === 'object' && 'testsWritten' in patch) {
      const wasOn = currentConfig.testsWritten !== false;
      const nowOn = merged.testsWritten !== false;
      if (wasOn !== nowOn) {
        setTests((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(next)) {
            next[id] = { ...next[id], active: nowOn };
            void apiCall(`/api/tests/${id}`, 'PUT', { ...next[id], courseId: activeCourseId });
          }
          return next;
        });
      }
    }

    if (patch && typeof patch === 'object' && 'gfsAccepted' in patch) {
      const wasOn = currentConfig.gfsAccepted !== false;
      const nowOn = merged.gfsAccepted !== false;
      if (wasOn !== nowOn) {
        if (!nowOn) {
          const stash = {};
          setGfsEntries((prev) => prev.map((entry) => {
            stash[String(entry.id)] = entry.gehalten === true;
            if (!entry.gehalten) return entry;
            const next = { ...entry, gehalten: false };
            void apiCall(`/api/gfs/${entry.id}`, 'PUT', { ...next, courseId: activeCourseId });
            return next;
          }));
          merged = { ...merged, gfsGehaltenStash: stash };
        } else {
          const stash = currentConfig.gfsGehaltenStash && typeof currentConfig.gfsGehaltenStash === 'object'
            ? currentConfig.gfsGehaltenStash
            : {};
          setGfsEntries((prev) => prev.map((entry) => {
            const restored = stash[String(entry.id)] === true;
            if (entry.gehalten === restored) return entry;
            const next = { ...entry, gehalten: restored };
            void apiCall(`/api/gfs/${entry.id}`, 'PUT', { ...next, courseId: activeCourseId });
            return next;
          }));
          merged = { ...merged, gfsGehaltenStash: null };
        }
      }
    }

    if (patch && typeof patch === 'object' && 'referateAccepted' in patch) {
      const wasOn = currentConfig.referateAccepted === true;
      const nowOn = merged.referateAccepted === true;
      if (wasOn !== nowOn) {
        if (!nowOn) {
          const stash = {};
          setReferatEntries((prev) => prev.map((entry) => {
            stash[String(entry.id)] = entry.gehalten === true;
            if (!entry.gehalten) return entry;
            const next = { ...entry, gehalten: false };
            void apiCall(`/api/referate/${entry.id}`, 'PUT', { ...next, courseId: activeCourseId });
            return next;
          }));
          merged = { ...merged, referatGehaltenStash: stash };
        } else {
          const stash = currentConfig.referatGehaltenStash && typeof currentConfig.referatGehaltenStash === 'object'
            ? currentConfig.referatGehaltenStash
            : {};
          setReferatEntries((prev) => prev.map((entry) => {
            const restored = stash[String(entry.id)] === true;
            if (entry.gehalten === restored) return entry;
            const next = { ...entry, gehalten: restored };
            void apiCall(`/api/referate/${entry.id}`, 'PUT', { ...next, courseId: activeCourseId });
            return next;
          }));
          merged = { ...merged, referatGehaltenStash: null };
        }
      }
    }

    setCourses((prev) => {
      void apiCall(`/api/courses/${activeCourseId}`, 'PUT', merged).then((saved) => {
        if (saved?.id === activeCourseId) {
          setCourses((p) => p.map((c) => (
            c.id === activeCourseId ? normalizeCourseArchiveFields(normalizeCourseCustomGradingKeys({ ...c, ...saved })) : c
          )));
        }
      });
      return prev.map((c) => (c.id === activeCourseId ? merged : c));
    });
  };

  const archiveCourse = async (courseId) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course || course.archived === true) return false;
    const usedIds = collectUsedCustomGradingKeyIds(exams, tests, projects);
    const snapshot = buildArchivedGradingKeysSnapshot(course.customGradingKeys, usedIds);
    const merged = normalizeCourseArchiveFields({
      ...course,
      archived: true,
      archivedGradingKeys: snapshot,
    });
    const saved = await fetchWithActing(`/api/courses/${courseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    }).then(async (res) => {
      if (!res?.ok) return undefined;
      const text = await res.text();
      return text ? JSON.parse(text) : undefined;
    });
    if (saved?.id === courseId) {
      const normalized = normalizeCourseArchiveFields(normalizeCourseCustomGradingKeys(saved));
      setCourses((prev) => prev.map((c) => (c.id === courseId ? normalized : c)));
      return true;
    }
    return false;
  };

  const reactivateCourse = async (courseId) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course || course.archived !== true) return false;
    const merged = normalizeCourseArchiveFields({
      ...course,
      archived: false,
      archivedGradingKeys: [],
    });
    const saved = await fetchWithActing(`/api/courses/${courseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    }).then(async (res) => {
      if (!res?.ok) return undefined;
      const text = await res.text();
      return text ? JSON.parse(text) : undefined;
    });
    if (saved?.id === courseId) {
      const normalized = normalizeCourseArchiveFields(normalizeCourseCustomGradingKeys(saved));
      setCourses((prev) => prev.map((c) => (c.id === courseId ? normalized : c)));
      return true;
    }
    return false;
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

  // Tests-Gewicht bei „x Tests = 1 Klausur“ aus Klausur-/Testanzahl ableiten und speichern.
  useEffect(() => {
    if (!activeCourseId || !config || !usesTestsPerKlausurRatio(config) || courseArchived) return;
    const resolved = resolveCourseWeighting(config.weighting, config, exams, tests);
    const nextTests = Number(resolved?.tests);
    const currTests = Number(config.weighting?.tests);
    if (!Number.isFinite(nextTests) || Math.abs(currTests - nextTests) < 0.0001) return;
    setCourses((prev) => prev.map((c) => (
      c.id === activeCourseId
        ? { ...c, weighting: { ...c.weighting, tests: nextTests } }
        : c
    )));
    apiCall(`/api/courses/${activeCourseId}`, 'PUT', {
      ...config,
      weighting: { ...config.weighting, tests: nextTests },
    });
  }, [
    activeCourseId,
    config?.testsPerKlausurEnabled,
    config?.testsPerKlausur,
    config?.weighting?.written,
    config?.advancedWeightingEnabled,
    config?.testsWritten,
    exams,
    tests,
  ]);

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

    const migrateExamLikeKeyType = async (collection, apiPrefix, setter) => {
      if (toGs === 'classic') {
        for (const id of Object.keys(collection)) {
          const item = collection[id];
          if (!item) continue;
          if (item.keyType === 'abi') {
            const next = { ...item, keyType: '1' };
            await apiCall(`${apiPrefix}/${id}`, 'PUT', { ...next, courseId: activeCourseId });
            setter((prev) => ({ ...prev, [id]: { ...prev[id], keyType: '1' } }));
          }
        }
      }
    };

    await migrateExamLikeKeyType(exams, '/api/exams', setExams);
    await migrateExamLikeKeyType(projects, '/api/projects', setProjects);
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
        setProjects({});
        setGfsEntries([]);
        setReferatEntries([]);
        setAlbumPhotos([]);
      }
    }
  };

  // Students Helpers
  const addStudent = async (student) => {
    const tempId = Date.now();
    setStudents((prev) => [...prev, { ...student, id: tempId, frontendId: tempId, studentNumber: prev.length + 1 }]);
    await apiCall('/api/students', 'POST', { ...student, frontendId: tempId, courseId: activeCourseId });
    if (!activeCourseId) return;
    const studentsRaw = await fetchWithActing(`/api/students?courseId=${activeCourseId}`);
    const studentsRes = studentsRaw && studentsRaw.ok ? await studentsRaw.json() : [];
    setStudents(Array.isArray(studentsRes) ? sortCourseStudents(studentsRes) : []);
    await refreshKlassenlehrerLists();
  };

  const removeStudent = async (id) => {
    try {
      const res = await fetchWithActing(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('Schüler löschen fehlgeschlagen:', res.status);
        return;
      }
      if (!activeCourseId) return;
      const studentsRaw = await fetchWithActing(`/api/students?courseId=${activeCourseId}`);
      const studentsRes = studentsRaw && studentsRaw.ok ? await studentsRaw.json() : [];
      setStudents(Array.isArray(studentsRes) ? sortCourseStudents(studentsRes) : []);
      await refreshKlassenlehrerLists();
    } catch (err) {
      console.error(err);
    }
  };

  const clearCourseStudents = async () => {
    if (!activeCourseId) return;
    await apiCall(`/api/students?courseId=${activeCourseId}`, 'DELETE');
    setStudents([]);
    await refreshKlassenlehrerLists();
  };
  
  const updateStudentConfig = (id, field, value) => {
    const shouldResortStudents = field === 'firstName' || field === 'lastName';
    const syncKlassenlehrerListsAfterSave =
      shouldResortStudents || field === 'studentNumber';
    setStudents((prev) => {
      const student = prev.find((s) => s.id === id);
      if (!student) return prev;
      const merged = { ...student, [field]: value };
      void apiCall(`/api/students/${id}`, 'PUT', { ...merged, courseId: merged.courseId ?? activeCourseId }).then(
        async () => {
          if (shouldResortStudents && activeCourseId) {
            const studentsRaw = await fetchWithActing(`/api/students?courseId=${activeCourseId}`);
            const studentsRes = studentsRaw && studentsRaw.ok ? await studentsRaw.json() : [];
            setStudents(Array.isArray(studentsRes) ? sortCourseStudents(studentsRes) : []);
          }
          if (syncKlassenlehrerListsAfterSave) refreshKlassenlehrerLists();
        },
      );
      return prev.map((s) => (s.id === id ? merged : s));
    });
  };

  // Exams Helpers
  const addExam = async () => {
    const examNumbers = Object.keys(exams).map(Number);
    const nextNumber = examNumbers.length > 0 ? Math.max(...examNumbers) + 1 : 1;
    const defaultKeyType = '1';

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
      courseId: activeCourseId,
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
        totalMax += parseScorePointsValue(newFieldMax[i]);
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
          const fieldCount = Math.max(
            1,
            Math.min(
              EXAM_ABS_MAX_FIELDS,
              parseInt(prevStudentScores._nachschreiberFields, 10) || cap,
            ),
          );
          const existingMax = getNachschreiberFieldMaxPoints(prevStudentScores);
          newScores = {
            ...prevStudentScores,
            _nachschreiber: true,
            _nachschreiberFields: fieldCount,
            _nachschreiberFieldMaxPoints:
              Object.keys(existingMax).length > 0
                ? existingMax
                : buildInitialNachschreiberFieldMaxPoints(exam, fieldCount),
          };
        } else {
          const { _nachschreiber, _nachschreiberFields, _nachschreiberFieldMaxPoints, ...rest } = prevStudentScores;
          newScores = rest;
        }
      } else if (active) {
        const base =
          prevStudentScores !== undefined && prevStudentScores !== null
            ? { 0: prevStudentScores, _counted: true }
            : { _counted: true };
        newScores = {
          ...base,
          _nachschreiber: true,
          _nachschreiberFields: cap,
          _nachschreiberFieldMaxPoints: buildInitialNachschreiberFieldMaxPoints(exam, cap),
        };
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

  const ensureExamStudentScoreObject = (prevStudentScores) => {
    if (typeof prevStudentScores === 'object' && prevStudentScores !== null) {
      return { ...prevStudentScores };
    }
    if (prevStudentScores !== undefined && prevStudentScores !== null) {
      return { 0: prevStudentScores, _counted: true };
    }
    return { _counted: true };
  };

  const updateExamStudentManualGrade = (examId, studentId, active, seedValue = undefined) => {
    setExams((prev) => {
      const exam = prev[examId];
      const base = ensureExamStudentScoreObject(exam.scores[studentId]);
      let newScores;
      if (active) {
        newScores = { ...base, _manualGrade: true };
        const hasStored =
          newScores._manualGradeValue !== undefined &&
          newScores._manualGradeValue !== null &&
          String(newScores._manualGradeValue).trim() !== '';
        if (!hasStored && seedValue !== undefined && seedValue !== null && String(seedValue).trim() !== '') {
          newScores._manualGradeValue = String(seedValue).trim();
        }
      } else {
        newScores = { ...base, _manualGrade: false };
      }
      const newExam = {
        ...exam,
        scores: { ...exam.scores, [studentId]: newScores },
      };
      apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
      return { ...prev, [examId]: newExam };
    });
  };

  const updateExamStudentManualGradeValue = (examId, studentId, value) => {
    setExams((prev) => {
      const exam = prev[examId];
      const base = ensureExamStudentScoreObject(exam.scores[studentId]);
      const newScores = {
        ...base,
        _manualGrade: true,
        _manualGradeValue: value,
      };
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
      const n = Math.max(1, Math.min(EXAM_ABS_MAX_FIELDS, typeof rawN === 'number' ? rawN : (parseInt(rawN, 10) || 1)));
      const prevStudentScores = exam.scores[studentId];
      const base = (typeof prevStudentScores === 'object' && prevStudentScores !== null)
        ? { ...prevStudentScores, _nachschreiber: true, _nachschreiberFields: n }
        : { 0: prevStudentScores, _counted: true, _nachschreiber: true, _nachschreiberFields: n };

      const newScores = { ...base };
      Object.keys(newScores).forEach((k) => {
        if (/^\d+$/.test(k) && parseInt(k, 10) >= n) delete newScores[k];
      });

      const prevMax = { ...getNachschreiberFieldMaxPoints(newScores) };
      for (let i = 0; i < n; i += 1) {
        const keyStr = String(i);
        if (
          !Object.prototype.hasOwnProperty.call(prevMax, i) &&
          !Object.prototype.hasOwnProperty.call(prevMax, keyStr)
        ) {
          const fromExam = exam.fieldMaxPoints?.[i] ?? exam.fieldMaxPoints?.[keyStr];
          prevMax[i] = fromExam !== undefined && fromExam !== null ? fromExam : '';
        }
      }
      Object.keys(prevMax).forEach((k) => {
        if (/^\d+$/.test(k) && parseInt(k, 10) >= n) delete prevMax[k];
      });
      newScores._nachschreiberFieldMaxPoints = prevMax;

      const newExam = {
        ...exam,
        scores: { ...exam.scores, [studentId]: newScores },
      };
      apiCall(`/api/exams/${examId}`, 'PUT', { ...newExam, courseId: activeCourseId });
      return { ...prev, [examId]: newExam };
    });
  };

  const updateExamStudentNachschreiberFieldMaxPoints = (examId, studentId, fieldIndex, points) => {
    setExams((prev) => {
      const exam = prev[examId];
      const prevStudentScores = exam.scores[studentId];
      const base =
        typeof prevStudentScores === 'object' && prevStudentScores !== null
          ? { ...prevStudentScores, _nachschreiber: true }
          : { 0: prevStudentScores, _counted: true, _nachschreiber: true };
      const prevMax = { ...getNachschreiberFieldMaxPoints(base) };
      prevMax[fieldIndex] = points;
      const newScores = {
        ...base,
        _nachschreiberFieldMaxPoints: prevMax,
      };
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
      extendedMode: 'off',
      weekCount: 0,
      weekDates: [],
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

  /** Wochenpunkte (ganze Zahl) für `weekIndex` (0-basiert), in `grades[studentId].weekPoints` */
  const updateOralWeekPoints = (oralId, studentId, weekIndex, rawValue) => {
    let n = parseInt(String(rawValue), 10);
    if (Number.isNaN(n)) n = 0;
    setOrals(prev => {
      const o = prev[oralId];
      if (!o) return prev;
      const weekCount = o.weekCount || 0;
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

  /** Wochennote für `weekIndex` (0-basiert), in `grades[studentId].weekGrades` */
  const updateOralWeekGrade = (oralId, studentId, weekIndex, rawValue) => {
    setOrals((prev) => {
      const o = prev[oralId];
      if (!o) return prev;
      const weekCount = o.weekCount || 0;
      const prevData = o.grades[studentId];
      const arr = getNormalizedOralWeekGradesArray(prevData, weekCount);
      if (weekIndex >= 0 && weekIndex < arr.length) arr[weekIndex] = rawValue == null ? '' : String(rawValue);
      const newData = mergeOralGradeWithWeekGrades(prevData, arr);
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
      const prevCount = o.weekCount || 0;
      if (prevCount >= ORAL_WEEK_COL_CAP) return prev;
      const nextCount = prevCount + 1;
      const gradesMode = getOralExtendedMode(o) === 'grades';
      const grades = { ...o.grades };
      for (const sid of Object.keys(grades)) {
        const prevData = grades[sid];
        if (gradesMode) {
          const arr = getNormalizedOralWeekGradesArray(prevData, prevCount);
          arr.push('');
          grades[sid] = mergeOralGradeWithWeekGrades(prevData, arr);
        } else {
          const arr = getNormalizedOralWeekPointsArray(prevData, prevCount);
          arr.push(0);
          grades[sid] = mergeOralGradeWithWeekPoints(prevData, arr);
        }
      }
      const weekDates = [...(o.weekDates || []), defaultOralWeekColumnLabel()];
      const newOral = { ...o, weekCount: nextCount, weekDates, grades };
      apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
      return { ...prev, [oralId]: newOral };
    });
  };

  const removeOralWeekColumn = (oralId) => {
    setOrals(prev => {
      const o = prev[oralId];
      if (!o) return prev;
      const prevCount = o.weekCount || 0;
      if (prevCount <= 0) return prev;
      const nextCount = prevCount - 1;
      const gradesMode = getOralExtendedMode(o) === 'grades';
      const grades = { ...o.grades };
      for (const sid of Object.keys(grades)) {
        const prevData = grades[sid];
        if (gradesMode) {
          const arr = getNormalizedOralWeekGradesArray(prevData, prevCount).slice(0, nextCount);
          grades[sid] = mergeOralGradeWithWeekGrades(prevData, arr);
        } else {
          const arr = getNormalizedOralWeekPointsArray(prevData, prevCount).slice(0, nextCount);
          grades[sid] = mergeOralGradeWithWeekPoints(prevData, arr);
        }
      }
      const weekDates = (o.weekDates || []).slice(0, nextCount);
      const newOral = { ...o, weekCount: nextCount, weekDates, grades };
      apiCall(`/api/orals/${oralId}`, 'PUT', { ...newOral, courseId: activeCourseId });
      return { ...prev, [oralId]: newOral };
    });
  };

  const updateOralWeekLabel = (oralId, weekIndex, label) => {
    setOrals((prev) => {
      const o = prev[oralId];
      if (!o) return prev;
      const weekCount = o.weekCount || 0;
      if (weekIndex < 0 || weekIndex >= weekCount) return prev;
      const weekDates = [...(o.weekDates || [])];
      while (weekDates.length < weekCount) weekDates.push('');
      weekDates[weekIndex] = label;
      const newOral = { ...o, weekDates };
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

  const ensureTestStudentScoreObject = (prevData) => {
    if (typeof prevData === 'object' && prevData !== null) {
      return { ...prevData };
    }
    if (prevData !== undefined && prevData !== null) {
      return { value: String(prevData), _counted: true };
    }
    return { value: '', _counted: true };
  };

  const updateTestStudentManualGrade = (testId, studentId, active, seedValue = undefined) => {
    setTests((prev) => {
      const prevTest = prev[testId];
      const map = prevTest.scores ?? prevTest.errors ?? {};
      const base = ensureTestStudentScoreObject(map[studentId]);
      let newData;
      if (active) {
        newData = { ...base, _manualGrade: true };
        const hasStored =
          newData._manualGradeValue !== undefined &&
          newData._manualGradeValue !== null &&
          String(newData._manualGradeValue).trim() !== '';
        if (!hasStored && seedValue !== undefined && seedValue !== null && String(seedValue).trim() !== '') {
          newData._manualGradeValue = String(seedValue).trim();
        }
      } else {
        newData = { ...base, _manualGrade: false };
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

  const updateTestStudentManualGradeValue = (testId, studentId, value) => {
    setTests((prev) => {
      const prevTest = prev[testId];
      const map = prevTest.scores ?? prevTest.errors ?? {};
      const base = ensureTestStudentScoreObject(map[studentId]);
      const newData = {
        ...base,
        _manualGrade: true,
        _manualGradeValue: value,
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

  // Projects Helpers
  const addProject = async ({
    name = '',
    description = '',
    weightingMode = 'written',
    weightPercent = 0,
    gradeMode = 'key',
    gradeScope = 'individual',
    groups = {},
  } = {}) => {
    if (config?.projectsAccepted !== true) return null;
    const projectNumbers = Object.keys(projects).map(Number);
    const nextNumber = projectNumbers.length > 0 ? Math.max(...projectNumbers) + 1 : 1;
    const defaultKeyType = '1';
    const mode = ['written', 'oral', 'percent'].includes(weightingMode) ? weightingMode : 'written';
    const pct = mode === 'percent'
      ? Math.max(0, Number(weightPercent) || 0)
      : Math.max(0, Math.min(100, Number(weightPercent) || 100));
    const gMode = gradeMode === 'manual' ? 'manual' : 'key';
    const scope = gradeScope === 'group' ? 'group' : 'individual';
    const groupsData = scope === 'group' && groups && typeof groups === 'object' && !Array.isArray(groups)
      ? groups
      : {};

    const newProjectData = {
      projectNumber: nextNumber,
      active: true,
      name: String(name).trim() || `Projekt ${nextNumber}`,
      description: String(description).trim(),
      weightingMode: mode,
      weightPercent: pct,
      maxPoints: 50,
      numFields: 0,
      fieldMaxPoints: {},
      fieldNames: {},
      gradeMode: gMode,
      gradeScope: scope,
      groups: groupsData,
      keyType: defaultKeyType,
      date: '',
      halbjahr: '1',
      scores: {},
      courseId: activeCourseId,
    };

    setProjects((prev) => ({ ...prev, [nextNumber]: newProjectData }));

    const created = await apiCall(`/api/projects/${nextNumber}`, 'PUT', newProjectData);
    if (created) {
      setProjects((prev) => ({ ...prev, [nextNumber]: created }));
      return nextNumber;
    }
    return nextNumber;
  };

  const updateProject = (id, field, value) => {
    setProjects((prev) => {
      const nextProjects = { ...prev, [id]: { ...prev[id], [field]: value } };
      apiCall(`/api/projects/${id}`, 'PUT', { ...nextProjects[id], courseId: activeCourseId });
      return nextProjects;
    });
  };

  /** Notenermittlung umschalten: Manuell → Schlüssel deaktiviert _manualGrade (Werte bleiben für Rückwechsel). */
  const setProjectGradeMode = (projectId, mode) => {
    const gMode = mode === 'manual' ? 'manual' : 'key';
    setProjects((prev) => {
      const project = prev[projectId];
      if (!project) return prev;
      const prevMode = project.gradeMode === 'manual' ? 'manual' : 'key';
      if (prevMode === gMode) return prev;

      let nextScores = project.scores;
      if (gMode === 'key' && prevMode === 'manual') {
        const scoreEntries = project.scores && typeof project.scores === 'object' ? project.scores : {};
        nextScores = {};
        for (const [scoreKey, raw] of Object.entries(scoreEntries)) {
          if (typeof raw === 'object' && raw !== null) {
            let next = { ...raw, _manualGrade: false };
            if (next._memberOverrides && typeof next._memberOverrides === 'object') {
              const mo = {};
              for (const [mid, ov] of Object.entries(next._memberOverrides)) {
                mo[mid] = typeof ov === 'object' && ov !== null ? { ...ov, _manualGrade: false } : ov;
              }
              next = { ...next, _memberOverrides: mo };
            }
            nextScores[scoreKey] = next;
          } else {
            nextScores[scoreKey] = raw;
          }
        }
      }

      const newProject = {
        ...project,
        gradeMode: gMode,
        ...(gMode === 'key' && prevMode === 'manual' ? { scores: nextScores } : {}),
      };
      apiCall(`/api/projects/${projectId}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [projectId]: newProject };
    });
  };

  const updateProjectFields = (id, fields) => {
    setProjects((prev) => {
      const nextProject = { ...prev[id], ...fields };
      const nextProjects = { ...prev, [id]: nextProject };
      apiCall(`/api/projects/${id}`, 'PUT', { ...nextProject, courseId: activeCourseId });
      return nextProjects;
    });
  };

  const removeProject = async (projectId) => {
    const key = String(projectId);
    setProjects((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await apiCall(`/api/projects/${projectId}?courseId=${activeCourseId}`, 'DELETE');
  };

  const updateProjectFieldNames = (projectId, fieldIndex, name) => {
    setProjects((prev) => {
      const project = prev[projectId];
      const prevNames = project.fieldNames || {};
      const newNames = { ...prevNames, [fieldIndex]: name };
      const newProject = {
        ...project,
        fieldNames: newNames,
      };
      apiCall(`/api/projects/${projectId}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [projectId]: newProject };
    });
  };

  const updateProjectFieldMaxPoints = (projectId, fieldIndex, points) => {
    setProjects((prev) => {
      const project = prev[projectId];
      const prevFieldMax = project.fieldMaxPoints || {};
      const newFieldMax = { ...prevFieldMax, [fieldIndex]: points };
      const nf = Math.max(0, Math.min(EXAM_ABS_MAX_FIELDS, Number(project.numFields) || 0));
      let totalMax = 0;
      for (let i = 0; i < nf; i += 1) {
        totalMax += parseScorePointsValue(newFieldMax[i]);
      }
      const newProject = {
        ...project,
        fieldMaxPoints: newFieldMax,
        maxPoints: totalMax > 0 ? totalMax : project.maxPoints,
      };
      apiCall(`/api/projects/${projectId}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [projectId]: newProject };
    });
  };

  const updateProjectScore = (projectId, studentId, fieldIndex, points) => {
    setProjects((prev) => {
      const prevStudentScores = prev[projectId].scores[studentId] || {};
      const newScores = typeof prevStudentScores === 'object'
        ? { ...prevStudentScores, [fieldIndex]: points }
        : { 0: prevStudentScores, [fieldIndex]: points };
      const newProject = {
        ...prev[projectId],
        scores: { ...prev[projectId].scores, [studentId]: newScores },
      };
      apiCall(`/api/projects/${projectId}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [projectId]: newProject };
    });
  };

  const updateProjectCounted = (projectId, studentId, counted) => {
    setProjects((prev) => {
      const prevStudentScores = prev[projectId].scores[studentId];
      const newScores = (typeof prevStudentScores === 'object' && prevStudentScores !== null)
        ? { ...prevStudentScores, _counted: counted }
        : { 0: prevStudentScores, _counted: counted };
      const newProject = {
        ...prev[projectId],
        scores: { ...prev[projectId].scores, [studentId]: newScores },
      };
      apiCall(`/api/projects/${projectId}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [projectId]: newProject };
    });
  };

  const ensureProjectStudentScoreObject = (prevStudentScores) => {
    if (typeof prevStudentScores === 'object' && prevStudentScores !== null) {
      return { ...prevStudentScores };
    }
    if (prevStudentScores !== undefined && prevStudentScores !== null) {
      return { 0: prevStudentScores, _counted: true };
    }
    return { _counted: true };
  };

  const updateProjectStudentManualGrade = (projectId, studentId, active, seedValue = undefined) => {
    setProjects((prev) => {
      const project = prev[projectId];
      const base = ensureProjectStudentScoreObject(project.scores[studentId]);
      let newScores;
      if (active) {
        newScores = { ...base, _manualGrade: true };
        const hasStored =
          newScores._manualGradeValue !== undefined &&
          newScores._manualGradeValue !== null &&
          String(newScores._manualGradeValue).trim() !== '';
        if (!hasStored && seedValue !== undefined && seedValue !== null && String(seedValue).trim() !== '') {
          newScores._manualGradeValue = String(seedValue).trim();
        }
      } else {
        newScores = { ...base, _manualGrade: false };
      }
      const newProject = {
        ...project,
        scores: { ...project.scores, [studentId]: newScores },
      };
      apiCall(`/api/projects/${projectId}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [projectId]: newProject };
    });
  };

  const updateProjectStudentManualGradeValue = (projectId, studentId, value) => {
    setProjects((prev) => {
      const project = prev[projectId];
      const base = ensureProjectStudentScoreObject(project.scores[studentId]);
      const newScores = {
        ...base,
        _manualGrade: true,
        _manualGradeValue: value,
      };
      const newProject = {
        ...project,
        scores: { ...project.scores, [studentId]: newScores },
      };
      apiCall(`/api/projects/${projectId}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [projectId]: newProject };
    });
  };

  const ensureProjectGroupMemberOverride = (groupScore) => {
    const base = ensureProjectStudentScoreObject(groupScore);
    const mo = normalizeProjectMemberOverrides(base._memberOverrides);
    return { base, mo };
  };

  const patchProjectGroupMemberState = (projectId, groupId, memberId, patchMember) => {
    setProjects((prev) => {
      const pid = String(projectId);
      const project = prev[pid] ?? prev[projectId];
      if (!project) return prev;

      const scores = { ...normalizeProjectScoresMap(project.scores) };
      const gid = String(groupId);
      const mid = String(memberId);
      const { base, mo } = ensureProjectGroupMemberOverride(scores[gid] ?? scores[groupId]);
      const nextMember = patchMember({ ...(mo[mid] || {}) });
      const newGroupScore = {
        ...base,
        _memberOverrides: { ...mo, [mid]: nextMember },
      };
      const newProject = {
        ...project,
        scores: { ...scores, [gid]: newGroupScore },
      };

      apiCall(`/api/projects/${pid}`, 'PUT', { ...newProject, courseId: activeCourseId });
      return { ...prev, [pid]: newProject };
    });
  };

  const updateProjectGroupMemberCounted = (projectId, groupId, memberId, counted) => {
    patchProjectGroupMemberState(projectId, groupId, memberId, (entry) => ({
      ...entry,
      _counted: counted,
    }));
  };

  const updateProjectGroupMemberManualGrade = (projectId, groupId, memberId, active, seedValue = undefined) => {
    patchProjectGroupMemberState(projectId, groupId, memberId, (entry) => {
      if (active) {
        const next = { ...entry, _manualGrade: true };
        const hasStored =
          next._manualGradeValue !== undefined &&
          next._manualGradeValue !== null &&
          String(next._manualGradeValue).trim() !== '';
        if (!hasStored && seedValue !== undefined && seedValue !== null && String(seedValue).trim() !== '') {
          next._manualGradeValue = String(seedValue).trim();
        }
        return next;
      }
      return { ...entry, _manualGrade: false };
    });
  };

  const updateProjectGroupMemberManualGradeValue = (projectId, groupId, memberId, value) => {
    patchProjectGroupMemberState(projectId, groupId, memberId, (entry) => ({
      ...entry,
      _manualGrade: true,
      _manualGradeValue: value,
    }));
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

  const addReferatEntry = async (studentId) => {
    const created = await apiCall('/api/referate', 'POST', {
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
      setReferatEntries((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const updateReferatEntry = (entryId, field, value) => {
    setReferatEntries((prev) => {
      const row = prev.find((e) => e.id === entryId);
      if (!row) return prev;
      const next = { ...row, [field]: value };
      apiCall(`/api/referate/${entryId}`, 'PUT', { ...next, courseId: activeCourseId });
      return prev.map((e) => (e.id === entryId ? next : e));
    });
  };

  const removeReferatEntry = (entryId) => {
    setReferatEntries((prev) => prev.filter((e) => e.id !== entryId));
    apiCall(`/api/referate/${entryId}`, 'DELETE');
  };

  const addAlbumPhoto = async ({ title, description, mimeType, imageData }) => {
    const created = await apiCall('/api/album-photos', 'POST', {
      courseId: activeCourseId,
      title,
      description: description ?? '',
      mimeType,
      imageData,
    });
    if (created?.id) {
      setAlbumPhotos((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const removeAlbumPhoto = (photoId) => {
    setAlbumPhotos((prev) => prev.filter((p) => p.id !== photoId));
    apiCall(`/api/album-photos/${photoId}`, 'DELETE');
  };

  const updateAlbumPhoto = async (photoId, { title, description }) => {
    const updated = await apiCall(`/api/album-photos/${photoId}`, 'PUT', {
      title,
      description: description ?? '',
    });
    if (updated?.id) {
      setAlbumPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? updated : p)).sort((a, b) => a.id - b.id),
      );
    }
    return updated;
  };

  const createMoneyList = async ({ subject, amountPerStudent, notes, dueDate, includeExternal, externalOnly }) => {
    if (!activeCourseId) return null;
    const created = await apiCall('/api/money-lists', 'POST', {
      courseId: activeCourseId,
      subject,
      amountPerStudent,
      notes: notes ?? '',
      dueDate: dueDate ?? null,
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
    });
    if (created?.id) {
      setMoneyLists((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const updateMoneyList = async (id, { subject, amountPerStudent, notes, dueDate, includeExternal, externalOnly }) => {
    const updated = await apiCall(`/api/money-lists/${id}`, 'PUT', {
      subject,
      amountPerStudent,
      notes: notes ?? '',
      dueDate: dueDate ?? null,
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
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

  const addMoneyListExternalEntry = async (listId, { firstName, lastName }) => {
    const created = await apiCall(`/api/money-lists/${listId}/external-entries`, 'POST', {
      firstName,
      lastName,
    });
    if (created?.id) {
      setMoneyLists((prev) =>
        prev.map((list) =>
          list.id === listId ? { ...list, entries: [...(list.entries || []), created] } : list,
        ),
      );
    }
    return created;
  };

  const removeMoneyListEntry = async (entryId) => {
    const res = await apiCall(`/api/money-list-entries/${entryId}`, 'DELETE');
    if (res?.error) return res;
    setMoneyLists((prev) =>
      prev.map((list) => ({
        ...list,
        entries: (list.entries || []).filter((e) => e.id !== entryId),
      })),
    );
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

  const createAttendanceList = async ({ subject, sessionDate, notes, includeExternal, externalOnly }) => {
    if (!activeCourseId) return null;
    const created = await apiCall('/api/attendance-lists', 'POST', {
      courseId: activeCourseId,
      subject,
      sessionDate: sessionDate ?? null,
      notes: notes ?? '',
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
    });
    if (created?.id) {
      setAttendanceLists((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const updateAttendanceList = async (id, { subject, sessionDate, notes, includeExternal, externalOnly }) => {
    const updated = await apiCall(`/api/attendance-lists/${id}`, 'PUT', {
      subject,
      sessionDate: sessionDate ?? null,
      notes: notes ?? '',
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
    });
    if (updated?.id) {
      setAttendanceLists((prev) =>
        prev.map((l) => (l.id === id ? updated : l)).sort((a, b) => a.id - b.id),
      );
    }
    return updated;
  };

  const deleteAttendanceList = async (id) => {
    const res = await apiCall(`/api/attendance-lists/${id}`, 'DELETE');
    if (res?.error) return res;
    setAttendanceLists((prev) => prev.filter((l) => l.id !== id));
    return { ok: true };
  };

  const addAttendanceListExternalEntry = async (listId, { firstName, lastName }) => {
    const created = await apiCall(`/api/attendance-lists/${listId}/external-entries`, 'POST', {
      firstName,
      lastName,
    });
    if (created?.id) {
      setAttendanceLists((prev) =>
        prev.map((list) =>
          list.id === listId ? { ...list, entries: [...(list.entries || []), created] } : list,
        ),
      );
    }
    return created;
  };

  const removeAttendanceListEntry = async (entryId) => {
    const res = await apiCall(`/api/attendance-list-entries/${entryId}`, 'DELETE');
    if (res?.error) return res;
    setAttendanceLists((prev) =>
      prev.map((list) => ({
        ...list,
        entries: (list.entries || []).filter((e) => e.id !== entryId),
      })),
    );
    return { ok: true };
  };

  const updateAttendanceListEntryPresent = (listId, entryId, present) => {
    setAttendanceLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        return {
          ...list,
          entries: (list.entries || []).map((e) => (e.id === entryId ? { ...e, present } : e)),
        };
      }),
    );
    apiCall(`/api/attendance-list-entries/${entryId}`, 'PUT', { present });
  };

  const createCollectionList = async ({ subject, sessionDate, notes, includeExternal, externalOnly }) => {
    if (!activeCourseId) return null;
    const created = await apiCall('/api/collection-lists', 'POST', {
      courseId: activeCourseId,
      subject,
      sessionDate: sessionDate ?? null,
      notes: notes ?? '',
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
    });
    if (created?.id) {
      setCollectionLists((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const updateCollectionList = async (id, { subject, sessionDate, notes, includeExternal, externalOnly }) => {
    const updated = await apiCall(`/api/collection-lists/${id}`, 'PUT', {
      subject,
      sessionDate: sessionDate ?? null,
      notes: notes ?? '',
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
    });
    if (updated?.id) {
      setCollectionLists((prev) =>
        prev.map((l) => (l.id === id ? updated : l)).sort((a, b) => a.id - b.id),
      );
    }
    return updated;
  };

  const deleteCollectionList = async (id) => {
    const res = await apiCall(`/api/collection-lists/${id}`, 'DELETE');
    if (res?.error) return res;
    setCollectionLists((prev) => prev.filter((l) => l.id !== id));
    return { ok: true };
  };

  const addCollectionListExternalEntry = async (listId, { firstName, lastName }) => {
    const created = await apiCall(`/api/collection-lists/${listId}/external-entries`, 'POST', {
      firstName,
      lastName,
    });
    if (created?.id) {
      setCollectionLists((prev) =>
        prev.map((list) =>
          list.id === listId ? { ...list, entries: [...(list.entries || []), created] } : list,
        ),
      );
    }
    return created;
  };

  const removeCollectionListEntry = async (entryId) => {
    const res = await apiCall(`/api/collection-list-entries/${entryId}`, 'DELETE');
    if (res?.error) return res;
    setCollectionLists((prev) =>
      prev.map((list) => ({
        ...list,
        entries: (list.entries || []).filter((e) => e.id !== entryId),
      })),
    );
    return { ok: true };
  };

  const updateCollectionListEntryCollected = (listId, entryId, collected) => {
    setCollectionLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        return {
          ...list,
          entries: (list.entries || []).map((e) => (e.id === entryId ? { ...e, collected } : e)),
        };
      }),
    );
    apiCall(`/api/collection-list-entries/${entryId}`, 'PUT', { collected });
  };

  const createNotesList = async ({ subject, sessionDate, notes, includeExternal, externalOnly }) => {
    if (!activeCourseId) return null;
    const created = await apiCall('/api/notes-lists', 'POST', {
      courseId: activeCourseId,
      subject,
      sessionDate: sessionDate ?? null,
      notes: notes ?? '',
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
    });
    if (created?.id) {
      setNotesLists((prev) => [...prev, created].sort((a, b) => a.id - b.id));
    }
    return created;
  };

  const updateNotesList = async (id, { subject, sessionDate, notes, includeExternal, externalOnly }) => {
    const updated = await apiCall(`/api/notes-lists/${id}`, 'PUT', {
      subject,
      sessionDate: sessionDate ?? null,
      notes: notes ?? '',
      includeExternal: Boolean(includeExternal),
      externalOnly: Boolean(externalOnly),
    });
    if (updated?.id) {
      setNotesLists((prev) =>
        prev.map((l) => (l.id === id ? updated : l)).sort((a, b) => a.id - b.id),
      );
    }
    return updated;
  };

  const deleteNotesList = async (id) => {
    const res = await apiCall(`/api/notes-lists/${id}`, 'DELETE');
    if (res?.error) return res;
    setNotesLists((prev) => prev.filter((l) => l.id !== id));
    return { ok: true };
  };

  const addNotesListExternalEntry = async (listId, { firstName, lastName }) => {
    const created = await apiCall(`/api/notes-lists/${listId}/external-entries`, 'POST', {
      firstName,
      lastName,
    });
    if (created?.id) {
      setNotesLists((prev) =>
        prev.map((list) =>
          list.id === listId ? { ...list, entries: [...(list.entries || []), created] } : list,
        ),
      );
    }
    return created;
  };

  const removeNotesListEntry = async (entryId) => {
    const res = await apiCall(`/api/notes-list-entries/${entryId}`, 'DELETE');
    if (res?.error) return res;
    setNotesLists((prev) =>
      prev.map((list) => ({
        ...list,
        entries: (list.entries || []).filter((e) => e.id !== entryId),
      })),
    );
    return { ok: true };
  };

  const updateNotesListEntryRemark = (listId, entryId, remark) => {
    setNotesLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list;
        return {
          ...list,
          entries: (list.entries || []).map((e) => (e.id === entryId ? { ...e, remark } : e)),
        };
      }),
    );
    apiCall(`/api/notes-list-entries/${entryId}`, 'PUT', { remark });
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

  const addSchoolRosterStudent = async ({ gradeLevel, classSection, firstName, lastName, schoolYearId }) => {
    const yearId = schoolYearId ?? activeSchoolRosterYearId;
    if (!yearId) return { error: 'Bitte zuerst ein Schuljahr anlegen oder auswählen.' };
    const created = await apiCall('/api/school-roster-students', 'POST', {
      gradeLevel,
      classSection: classSection ?? '',
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

  const updateSchoolRosterStudent = async (id, { gradeLevel, classSection, firstName, lastName, schoolYearId }) => {
    const yearId = schoolYearId ?? activeSchoolRosterYearId;
    if (!yearId) return { error: 'Schuljahr fehlt.' };
    const updated = await apiCall(`/api/school-roster-students/${id}`, 'PUT', {
      gradeLevel,
      classSection: classSection ?? '',
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

  const contextValue = {
      courses, activeCourseId, setActiveCourseId, createCourse, deleteCourse, archiveCourse, reactivateCourse, toggleCourseFavorite,
      courseArchived,
      config, setConfig: updateConfig, migrateGradingSystem,
      students, addStudent, removeStudent, clearCourseStudents, updateStudentConfig,
      exams, addExam, removeExam, updateExam, updateExamScore, updateExamFieldMaxPoints, updateExamCounted,
      updateExamStudentNachschreiber, updateExamStudentNachschreiberFields,
      updateExamStudentNachschreiberFieldMaxPoints,
      updateExamStudentManualGrade, updateExamStudentManualGradeValue,
      orals, addOral, removeOral, updateOral, updateOralGrade, updateOralCounted, updateOralWeekPoints, updateOralWeekGrade, updateOralWeekLabel, addOralWeekColumn, removeOralWeekColumn,
      tests, addTest, updateTestScore, updateTest, updateTestCounted, updateTestStudentNachschreiber, updateTestNachschreiberMaxPoints,
      updateTestStudentManualGrade, updateTestStudentManualGradeValue,
      projects, addProject, removeProject, updateProject, setProjectGradeMode, updateProjectFields, updateProjectScore, updateProjectFieldNames, updateProjectFieldMaxPoints, updateProjectCounted,
      updateProjectStudentManualGrade, updateProjectStudentManualGradeValue,
      updateProjectGroupMemberCounted, updateProjectGroupMemberManualGrade, updateProjectGroupMemberManualGradeValue,
      gfsEntries, addGfsEntry, updateGfsEntry, removeGfsEntry,
      referatEntries, addReferatEntry, updateReferatEntry, removeReferatEntry,
      albumPhotos, addAlbumPhoto, updateAlbumPhoto, removeAlbumPhoto,
      moneyLists, createMoneyList, updateMoneyList, deleteMoneyList, updateMoneyListEntryPaid,
      addMoneyListExternalEntry, removeMoneyListEntry,
      attendanceLists, createAttendanceList, updateAttendanceList, deleteAttendanceList,
      updateAttendanceListEntryPresent, addAttendanceListExternalEntry, removeAttendanceListEntry,
      collectionLists, createCollectionList, updateCollectionList, deleteCollectionList,
      updateCollectionListEntryCollected, addCollectionListExternalEntry, removeCollectionListEntry,
      notesLists, createNotesList, updateNotesList, deleteNotesList,
      updateNotesListEntryRemark, addNotesListExternalEntry, removeNotesListEntry,
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
      loading,
    };

  if (loading) {
    return (
      <DataContext.Provider value={contextValue}>
        <div
          className="data-loading-screen"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'hsl(var(--background, 0 0% 100%))',
            color: '#64748b',
          }}
          aria-busy="true"
          aria-live="polite"
        >
          Lade Daten…
        </div>
        {children}
      </DataContext.Provider>
    );
  }

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};
