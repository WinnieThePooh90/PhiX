import React, { useMemo } from 'react';
import { useData } from '../store/DataContext';
import { calculateStudentGrades, formatGrade, normalizeCourseGradeSystem, gradeToNotenpunkte, notenpunkteToGrade } from '../utils/calculator';

/** Balkenfarbe NP (Verteilung) — gleiche Logik wie Klausur-Diagramme */
function barColorForNpBucket(np) {
  const g = notenpunkteToGrade(np);
  if (g === null) return 'hsl(var(--muted))';
  if (g > 4) return 'var(--danger)';
  if (g >= 3.25 && g <= 4) return '#f59e0b';
  if (g > 3 && g < 3.25) return '#fde68a';
  return 'hsl(var(--success-hsl))';
}

function distributionBucket(finalGrade, gradeSys) {
  if (finalGrade === null || Number.isNaN(Number(finalGrade))) return null;
  if (gradeSys === 'points') {
    return gradeToNotenpunkte(finalGrade);
  }
  return Math.min(6, Math.max(1, Math.round(Number(finalGrade))));
}

/** 1 = sehr gut, 6 = ungenügend — höhere Zahl = schlechter (Filter auf berechneter Gesamtnote, klassische Skala) */
const STARK_GEFAEHRDET_MIN = 3.5;
const GEFAEHRDET_GT = 3.0;
const GEFAEHRDET_LT = 3.5;

function RiskStudentsTable({ rows, gradeColor, gradeSystem }) {
  const npMode = gradeSystem === 'points';
  return (
    <div className="table-container" style={{ margin: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Vorname</th>
            <th className="text-right">{npMode ? 'Gesamt (NP)' : 'Gesamtnote (Ø)'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student: s, finalGrade }) => (
            <tr key={s.id}>
              <td>{s.lastName}</td>
              <td>{s.firstName}</td>
              <td className="text-right" style={{ fontWeight: 600, color: gradeColor }}>
                {formatGrade(finalGrade, gradeSystem)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalysisView() {
  const { students, exams, orals, tests, gfsEntries, config } = useData();
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);

  const { starkGefaehrdet, gefaehrdet } = useMemo(() => {
    if (!config?.weighting) return { starkGefaehrdet: [], gefaehrdet: [] };
    const withGrade = students
      .map((s) => {
        const { finalGrade } = calculateStudentGrades(
          s.id,
          exams,
          orals,
          tests,
          config.weighting,
          null,
          gfsEntries,
          Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [],
          gradeSys,
          config.testsWritten !== false,
        );
        return { student: s, finalGrade };
      })
      .filter(({ finalGrade }) => finalGrade !== null && !Number.isNaN(Number(finalGrade)));

    const sortWorstFirst = (a, b) => (b.finalGrade ?? 0) - (a.finalGrade ?? 0);

    const stark = withGrade
      .filter(({ finalGrade }) => Number(finalGrade) >= STARK_GEFAEHRDET_MIN)
      .sort(sortWorstFirst);

    const gef = withGrade
      .filter(({ finalGrade }) => {
        const g = Number(finalGrade);
        return g > GEFAEHRDET_GT && g < GEFAEHRDET_LT;
      })
      .sort(sortWorstFirst);

    return { starkGefaehrdet: stark, gefaehrdet: gef };
  }, [students, exams, orals, tests, gfsEntries, config, gradeSys]);

  const { gradeCounts, maxCount, classAverage, studentsWithGrade, distributionKeys } = useMemo(() => {
    const isPoints = gradeSys === 'points';
    const emptyCounts = () => (isPoints ? Array(16).fill(0) : [0, 0, 0, 0, 0, 0]);
    if (!config?.weighting) {
      return {
        gradeCounts: emptyCounts(),
        maxCount: 1,
        classAverage: null,
        studentsWithGrade: 0,
        distributionKeys: isPoints ? Array.from({ length: 16 }, (_, i) => i) : [1, 2, 3, 4, 5, 6],
      };
    }
    const counts = emptyCounts();
    const rawGrades = [];
    students.forEach((s) => {
      const { finalGrade } = calculateStudentGrades(
        s.id,
        exams,
        orals,
        tests,
        config.weighting,
        null,
        gfsEntries,
        Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [],
        gradeSys,
        config.testsWritten !== false,
      );
      if (finalGrade === null || Number.isNaN(finalGrade)) return;
      rawGrades.push(finalGrade);
      const b = distributionBucket(finalGrade, gradeSys);
      if (b === null) return;
      if (isPoints) counts[b] += 1;
      else counts[b - 1] += 1;
    });
    const maxC = Math.max(1, ...counts);
    const classAvg =
      rawGrades.length > 0 ? rawGrades.reduce((a, g) => a + g, 0) / rawGrades.length : null;
    return {
      gradeCounts: counts,
      maxCount: maxC,
      classAverage: classAvg,
      studentsWithGrade: rawGrades.length,
      distributionKeys: isPoints ? Array.from({ length: 16 }, (_, i) => i) : [1, 2, 3, 4, 5, 6],
    };
  }, [students, exams, orals, tests, gfsEntries, config, gradeSys]);

  return (
    <div className="view-generic-scroll" style={{ padding: '0 0 2rem' }}>
      <h2 style={{ marginBottom: '0.35rem' }}>Analyse</h2>
      <p className="text-muted" style={{ margin: '0 0 1.5rem', maxWidth: '100%' }}>
        Auswertung der Klasse auf Basis der erfassten Klausuren, mündlichen Noten und Tests (gewichtet wie in den Einstellungen).
      </p>

      <div
        className="analysis-page-stack"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          width: '100%',
          maxWidth: '100%',
          alignItems: 'stretch',
        }}
      >
      <div className="glass-panel" style={{ borderTop: '4px solid hsl(var(--danger-hsl))', minWidth: 0, width: '100%' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Gefährdete Schüler</h3>
        <p className="text-muted" style={{ margin: '0 0 1.25rem', fontSize: '0.875rem' }}>
          {gradeSys === 'points' ? (
            <>
              Gewichteter Gesamtdurchschnitt je Schüler (Anzeige als Notenpunkte). Einstufung intern weiter über die Schulnote:{' '}
              <strong>Stark gefährdet</strong> (Note ≥ 3,5, entspricht NP ≤ 4) und <strong>Gefährdet</strong> (Note zwischen 3,0 und 3,5, entspricht etwa NP 5).
            </>
          ) : (
            <>
              Gewichteter Gesamtdurchschnitt je Schüler. Zwei Stufen: <strong>Stark gefährdet</strong> (Ø schlechter oder gleich 3,5) und{' '}
              <strong>Gefährdet</strong> (Ø schlechter als 3,0, aber besser als 3,5).
            </>
          )}
        </p>

        {students.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>Noch keine Schüler angelegt.</p>
        ) : (
          <>
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 700 }}>Stark gefährdet</h4>
            <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>
              {gradeSys === 'points' ? (
                <>Berechnete Gesamtnote mindestens <strong>3,5</strong> (Schulnotenskala) — in der Tabelle als NP angezeigt.</>
              ) : (
                <>Durchschnitt <strong>≥ 3,5</strong> (numerisch schlechter oder gleich 3,5).</>
              )}
            </p>
            {starkGefaehrdet.length === 0 && gefaehrdet.length === 0 ? null : starkGefaehrdet.length > 0 ? (
              <RiskStudentsTable rows={starkGefaehrdet} gradeColor="var(--danger)" gradeSystem={gradeSys} />
            ) : (
              <p className="text-muted" style={{ margin: '0 0 1.25rem', fontSize: '0.875rem' }}>Keine Schüler in dieser Kategorie.</p>
            )}

            <h4 style={{ margin: '1.25rem 0 0.35rem', fontSize: '0.95rem', fontWeight: 700 }}>Gefährdet</h4>
            <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem' }}>
              {gradeSys === 'points' ? (
                <>Note <strong>&gt; 3,0</strong> und <strong>&lt; 3,5</strong> — Anzeige der Gesamtleistung als NP.</>
              ) : (
                <>
                  Durchschnitt <strong>&gt; 3,0</strong> und <strong>&lt; 3,5</strong>.
                </>
              )}
            </p>
            {starkGefaehrdet.length === 0 && gefaehrdet.length === 0 ? null : gefaehrdet.length > 0 ? (
              <RiskStudentsTable rows={gefaehrdet} gradeColor="hsl(28 78% 32%)" gradeSystem={gradeSys} />
            ) : (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>Keine Schüler in dieser Kategorie.</p>
            )}

            {starkGefaehrdet.length === 0 && gefaehrdet.length === 0 && (
              <p style={{ margin: '1rem 0 0', color: 'hsl(var(--success-hsl))', fontWeight: 500 }}>
                In beiden Kategorien ist aktuell niemand erfasst — nach diesen Kriterien kein besonderer Hinweis auf Förderbedarf.
              </p>
            )}
          </>
        )}
      </div>

      <div className="glass-panel analysis-grade-panel" style={{ borderTop: '4px solid var(--primary)', minWidth: 0, width: '100%' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Klassendurchschnitt</h3>
        <p className="text-muted" style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
          Gewichteter Mittelwert aller Schüler mit auswertbarer Gesamtnote ({studentsWithGrade} von {students.length}).
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '2rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            color: 'var(--foreground)',
          }}
          aria-live="polite"
        >
          {classAverage === null ? '—' : formatGrade(classAverage, gradeSys)}
        </p>

        <h3 style={{ margin: '1.5rem 0 0.35rem', fontSize: '1.05rem' }}>Notenverteilung</h3>
        <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
          {gradeSys === 'points' ? (
            <>Je Schüler: Notenpunkte (0–15) aus der berechneten Gesamtnote; horizontale Achse = NP, vertikale Achse = Anzahl.</>
          ) : (
            <>Gerundete Gesamtnote pro Schüler (Noten 1–6 auf der horizontalen Achse, Anzahl auf der vertikalen Achse).</>
          )}
        </p>

        {studentsWithGrade === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>Noch keine auswertbaren Gesamtnoten — Noten für Klausuren, Mündlich und Tests erfassen.</p>
        ) : (
          <div className="analysis-grade-chart" style={{ marginTop: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: gradeSys === 'points' ? '0.12rem' : '0.5rem',
                height: 'min(300px, min(42dvh, 360px))',
                padding: '0.35rem 0.25rem 0',
                marginTop: '0.25rem',
                overflowX: gradeSys === 'points' ? 'auto' : undefined,
                overflowY: 'visible',
              }}
              role="img"
              aria-label={
                gradeSys === 'points'
                  ? `Notenpunkte-Verteilung: ${distributionKeys.map((k) => `NP ${k}: ${gradeCounts[k]}`).join(', ')}`
                  : `Notenverteilung: Note 1 ${gradeCounts[0]} Schüler, Note 2 ${gradeCounts[1]}, Note 3 ${gradeCounts[2]}, Note 4 ${gradeCounts[3]}, Note 5 ${gradeCounts[4]}, Note 6 ${gradeCounts[5]}`
              }
            >
              {distributionKeys.map((bucketKey) => {
                const counts =
                  gradeSys === 'points' ? gradeCounts[bucketKey] : gradeCounts[bucketKey - 1];
                const heightPercent = counts > 0 ? (counts / maxCount) * 94 : 0;
                const barColor =
                  gradeSys === 'points'
                    ? barColorForNpBucket(bucketKey)
                    : bucketKey >= 4
                      ? 'var(--danger)'
                      : 'hsl(var(--success-hsl))';
                return (
                  <div
                    key={bucketKey}
                    style={{
                      flex: gradeSys === 'points' ? '0 0 auto' : 1,
                      minWidth: gradeSys === 'points' ? '1rem' : 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        width: '100%',
                        minHeight: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingTop: '1.1rem',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          width: gradeSys === 'points' ? '72%' : '78%',
                          height: counts > 0 ? `${heightPercent}%` : '4px',
                          minHeight: counts > 0 ? '6px' : undefined,
                          background: counts > 0 ? barColor : 'hsl(var(--muted))',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.25s ease',
                          position: 'relative',
                        }}
                      >
                        {counts > 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '-1.35rem',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {counts}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: '0.65rem',
                        fontWeight: 600,
                        fontSize: gradeSys === 'points' ? '0.62rem' : '0.8rem',
                        borderTop: '2px solid var(--border)',
                        width: '100%',
                        textAlign: 'center',
                        paddingTop: '0.45rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {bucketKey}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.35rem',
                paddingLeft: '0.15rem',
                paddingRight: '0.15rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>{gradeSys === 'points' ? 'Notenpunkte (0–15)' : 'Note (1–6)'}</span>
              <span>Anzahl Schüler (max. {maxCount})</span>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
