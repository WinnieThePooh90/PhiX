/**
 * Seating Plan Wish Solver
 * 
 * Berechnet eine optimale Sitzordnung, die möglichst viele Wunschnachbarn erfüllt.
 * Verwendet Simulated Annealing mit Multiple Restarts für maximale Lösungsqualität.
 */

/**
 * Bewertet den Abstand zweier Plätze im Sitzplan-Raster.
 * @param {{ r: number, c: number }} seatA
 * @param {{ r: number, c: number }} seatB
 * @returns {number} 100 für direkte Tischnachbarn (gleiche Reihe, nebeneinander),
 *                   40 für Vorder-/Hinternachbarn (Reihe davor/dahinter, selbe Spalte),
 *                   15 für Diagonalnachbarn, 0 sonst.
 */
function getProximityScore(seatA, seatB) {
  const dr = Math.abs(seatA.r - seatB.r);
  const dc = Math.abs(seatA.c - seatB.c);
  if (dr === 0 && dc === 1) return 100; // Direkte Tischnachbarn
  if (dr === 1 && dc === 0) return 40;  // Direkt davor / dahinter
  if (dr === 1 && dc === 1) return 15;  // Diagonal benachbart
  return 0;
}

/**
 * Erstellt die Liste aller Rasterplätze von links unten (R1:1) bis rechts oben.
 * @param {number} rows 
 * @param {number} cols 
 * @returns {Array<{ r: number, c: number, key: string, label: string }>}
 */
export function getAvailableSeats(rows, cols) {
  const seats = [];
  for (let r = rows - 1; r >= 0; r--) {
    const displayRow = rows - r;
    for (let c = 0; c < cols; c++) {
      seats.push({
        r,
        c,
        key: `${r}_${c}`,
        label: `R${displayRow}:${c + 1}`,
      });
    }
  }
  return seats;
}

/**
 * Löst das Sitzordnungsproblem unter Berücksichtigung der Wunschnachbarn.
 * 
 * @param {Array<{ id: number|string }>} students Liste aller Schüler
 * @param {number} rows Anzahl Zeilen im Raum
 * @param {number} cols Anzahl Spalten im Raum
 * @param {Record<string, { wish1?: number|string|null, wish2?: number|string|null }>} wishes Wünsche pro Schüler-ID
 * @returns {{
 *   assignments: Record<string, number>,
 *   totalWishes: number,
 *   fulfilledDirect: number,
 *   fulfilledAdjacent: number,
 *   fulfilledTotal: number
 * }}
 */
export function solveSeatingPlanWishes(students, rows, cols, wishes = {}) {
  const studentList = [...(students || [])];
  const seats = getAvailableSeats(rows, cols);
  const totalSlots = Math.min(studentList.length, seats.length);

  if (studentList.length === 0) {
    return {
      assignments: {},
      totalWishes: 0,
      fulfilledDirect: 0,
      fulfilledAdjacent: 0,
      fulfilledTotal: 0,
    };
  }

  // Liste aller gültigen Wünsche extrahieren
  const studentIdSet = new Set(studentList.map((s) => Number(s.id)));
  const wishList = [];

  Object.entries(wishes || {}).forEach(([sIdStr, w]) => {
    const sId = Number(sIdStr);
    if (!studentIdSet.has(sId)) return;

    if (w?.wish1 != null && studentIdSet.has(Number(w.wish1)) && Number(w.wish1) !== sId) {
      wishList.push({ from: sId, to: Number(w.wish1) });
    }
    if (w?.wish2 != null && studentIdSet.has(Number(w.wish2)) && Number(w.wish2) !== sId && Number(w.wish2) !== Number(w?.wish1)) {
      wishList.push({ from: sId, to: Number(w.wish2) });
    }
  });

  const totalWishes = wishList.length;

  // Schnelle Bewertungsfunktion für ein Array von Schüler-IDs
  const evaluateArrangement = (arr) => {
    // Map studentId -> slot index
    const posMap = new Map();
    for (let i = 0; i < totalSlots; i++) {
      posMap.set(arr[i], i);
    }

    let score = 0;
    for (let i = 0; i < wishList.length; i++) {
      const { from, to } = wishList[i];
      const posFrom = posMap.get(from);
      const posTo = posMap.get(to);
      if (posFrom !== undefined && posTo !== undefined) {
        score += getProximityScore(seats[posFrom], seats[posTo]);
      }
    }
    return score;
  };

  const initialArrangement = studentList.map((s) => Number(s.id));

  // Falls keine Wünsche vorhanden sind, einfach die Schüler in Standardreihenfolge belegen
  if (totalWishes === 0) {
    const assignments = {};
    for (let i = 0; i < totalSlots; i++) {
      assignments[seats[i].key] = initialArrangement[i];
    }
    return {
      assignments,
      totalWishes: 0,
      fulfilledDirect: 0,
      fulfilledAdjacent: 0,
      fulfilledTotal: 0,
    };
  }

  // Multi-Restart Simulated Annealing Optimizer
  let globalBestArr = [...initialArrangement];
  let globalBestScore = evaluateArrangement(globalBestArr);

  const RESTARTS = 40;
  const ITERATIONS_PER_RESTART = 1500;
  const N = initialArrangement.length;

  for (let restart = 0; restart < RESTARTS; restart++) {
    // Zufällige Permutation für den Start dieses Laufs
    const currentArr = [...initialArrangement];
    for (let i = currentArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentArr[i], currentArr[j]] = [currentArr[j], currentArr[i]];
    }

    let currentScore = evaluateArrangement(currentArr);
    if (currentScore > globalBestScore) {
      globalBestScore = currentScore;
      globalBestArr = [...currentArr];
    }

    let temp = 40.0;
    const coolingRate = 0.992;

    for (let iter = 0; iter < ITERATIONS_PER_RESTART; iter++) {
      if (N < 2) break;
      const i = Math.floor(Math.random() * N);
      let j = Math.floor(Math.random() * (N - 1));
      if (j >= i) j++;

      // Swap
      [currentArr[i], currentArr[j]] = [currentArr[j], currentArr[i]];
      const nextScore = evaluateArrangement(currentArr);
      const delta = nextScore - currentScore;

      if (delta >= 0 || Math.random() < Math.exp(delta / temp)) {
        currentScore = nextScore;
        if (currentScore > globalBestScore) {
          globalBestScore = currentScore;
          globalBestArr = [...currentArr];
        }
      } else {
        // Revert Swap
        [currentArr[i], currentArr[j]] = [currentArr[j], currentArr[i]];
      }

      temp *= coolingRate;
      if (temp < 0.05) break;
    }
  }

  // Statistiken über erfüllte Wünsche ermitteln
  const posMap = new Map();
  for (let i = 0; i < totalSlots; i++) {
    posMap.set(globalBestArr[i], i);
  }

  let fulfilledDirect = 0;
  let fulfilledAdjacent = 0;

  for (let i = 0; i < wishList.length; i++) {
    const { from, to } = wishList[i];
    const posFrom = posMap.get(from);
    const posTo = posMap.get(to);
    if (posFrom !== undefined && posTo !== undefined) {
      const seatFrom = seats[posFrom];
      const seatTo = seats[posTo];
      const dr = Math.abs(seatFrom.r - seatTo.r);
      const dc = Math.abs(seatFrom.c - seatTo.c);
      if (dr === 0 && dc === 1) {
        fulfilledDirect++;
      } else if ((dr === 1 && dc === 0) || (dr === 1 && dc === 1)) {
        fulfilledAdjacent++;
      }
    }
  }

  const assignments = {};
  for (let i = 0; i < totalSlots; i++) {
    assignments[seats[i].key] = globalBestArr[i];
  }

  return {
    assignments,
    totalWishes,
    fulfilledDirect,
    fulfilledAdjacent,
    fulfilledTotal: fulfilledDirect + fulfilledAdjacent,
  };
}
