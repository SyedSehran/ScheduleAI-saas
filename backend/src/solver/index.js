"use strict";

const { DAYS, TIMES, HARD_CONSTRAINTS, SOFT_CONSTRAINTS, slotBand } = require("./constraints");
const { solve } = require("./backtracking");
const { improve } = require("./improver");
const { computeScheduleScore } = require("./scoring");

/**
 * Generate an optimised timetable using the hybrid solver:
 *   1. Backtracking with MRV/LCV heuristics produces a feasible schedule.
 *   2. Simulated-annealing improver reduces soft-constraint penalties.
 *   3. Multi-start: repeat with different seeds and return the best result.
 *
 * The returned object is a superset of the legacy `generateSchedule` output
 * so existing consumers remain unaffected.
 *
 * @param {object} parsed   – normalised input (courses, rooms, globalRules)
 * @param {object} options
 * @param {number}  [options.seed=42]           – base PRNG seed
 * @param {number}  [options.timeoutMs=30000]   – total wall-clock budget (ms)
 * @param {number}  [options.improveTimeoutMs=8000] – budget for SA improver per run
 * @param {number}  [options.multiStartCount=1] – number of independent solver runs
 *
 * @returns {{
 *   days:              string[],
 *   times:             string[],
 *   assignments:       Array,
 *   conflicts:         Array,
 *   explanations:      Array,
 *   score:             object,
 *   metrics:           object,
 *   facultyLoad:       Array,
 *   constraintCatalog: { hard: Array, soft: Array },
 * }}
 */
function generateScheduleV2(parsed, options) {
  const {
    seed = 42,
    timeoutMs = 30000,
    improveTimeoutMs = 8000,
    multiStartCount = 1,
  } = options || {};

  const runs = Math.max(1, multiStartCount);
  const perRunBudget = Math.floor(timeoutMs / runs);

  let bestAssignments = null;
  let bestConflicts = [];
  let bestExplanations = [];
  let bestScore = { totalPenalty: Infinity, breakdown: {}, perAssignment: [] };

  for (let run = 0; run < runs; run++) {
    const runSeed = seed + run;
    const solveTimeout = Math.max(1000, perRunBudget - improveTimeoutMs);

    // Phase 1: feasibility via backtracking
    const solveResult = solve(parsed, { seed: runSeed, timeoutMs: solveTimeout });

    if (!solveResult.assignments.length) continue;

    // Phase 2: quality improvement via simulated annealing
    const improveResult = improve(solveResult.assignments, parsed, {
      seed: runSeed,
      timeoutMs: improveTimeoutMs,
    });

    const finalAssignments = improveResult.improved
      ? improveResult.assignments
      : solveResult.assignments;

    const scoreResult = computeScheduleScore(finalAssignments, parsed);

    if (scoreResult.totalPenalty < bestScore.totalPenalty) {
      bestAssignments = finalAssignments;
      bestConflicts = solveResult.conflicts;
      bestExplanations = solveResult.explanations;
      bestScore = scoreResult;
    }
  }

  // Fallback: if every run found zero assignments, return the plain backtracking result
  if (!bestAssignments) {
    const fallback = solve(parsed, { seed, timeoutMs });
    bestAssignments = fallback.assignments;
    bestConflicts = fallback.conflicts;
    bestExplanations = fallback.explanations;
    bestScore = computeScheduleScore(bestAssignments, parsed);
  }

  // ── Metrics ──────────────────────────────────────────────────────────────
  const totalSessionsExpected = (parsed.courses || []).reduce(
    (sum, c) =>
      sum +
      (c.theoryHoursPerWeek || 0) +
      Math.ceil((c.practicalHoursPerWeek || 0) / Math.max(1, c.practicalSessionLength || 2)),
    0,
  );
  const scheduledSessionCount = bestAssignments.length;
  const preferenceMatches = bestAssignments.filter(
    (a) => a.preferenceBandMatched || a.preferredDayMatched,
  ).length;

  const metrics = {
    totalSessions: totalSessionsExpected,
    totalHoursRequired: (parsed.courses || []).reduce(
      (sum, c) =>
        sum + (c.theoryHoursPerWeek || 0) + (c.practicalHoursPerWeek || 0),
      0,
    ),
    scheduledSessions: scheduledSessionCount,
    unscheduledSessions: Math.max(0, totalSessionsExpected - scheduledSessionCount),
    satisfactionScore: totalSessionsExpected
      ? Math.round((preferenceMatches / totalSessionsExpected) * 100)
      : 0,
    totalPenalty: bestScore.totalPenalty,
    penaltyBreakdown: bestScore.breakdown,
    generationTimeLabel: "optimized-v2",
    substitutionCount: 0,
  };

  // ── Faculty load summary ──────────────────────────────────────────────────
  const facultyLoad = (parsed.courses || []).map((course) => {
    const fa = bestAssignments.filter((a) => a.faculty === course.faculty);
    const preferredHits = fa.filter(
      (a) => a.preferenceBandMatched || a.preferredDayMatched,
    ).length;
    const requestedHours =
      (course.theoryHoursPerWeek || 0) + (course.practicalHoursPerWeek || 0);
    return {
      faculty: course.faculty,
      courseName: course.courseName,
      scheduledHours: fa.reduce((sum, a) => sum + (a.duration || 1), 0),
      requestedHours,
      matchPercent: requestedHours
        ? Math.round((preferredHits / requestedHours) * 100)
        : 0,
    };
  });

  return {
    days: DAYS,
    times: TIMES,
    assignments: bestAssignments,
    conflicts: bestConflicts,
    explanations: bestExplanations,
    score: bestScore,
    metrics,
    facultyLoad,
    constraintCatalog: {
      hard: HARD_CONSTRAINTS,
      soft: SOFT_CONSTRAINTS,
    },
  };
}

module.exports = { generateScheduleV2 };
