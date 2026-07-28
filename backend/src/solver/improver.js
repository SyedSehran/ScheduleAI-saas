"use strict";

const {
  DAYS,
  TIMES,
  getSlotRange,
  overlapsSlotKeys,
  timeFromSlotKey,
  slotBand,
} = require("./constraints");
const { computeScheduleScore } = require("./scoring");

// ─── Seeded PRNG (same LCG as backtracking.js) ───────────────────────────────

function createRng(seed) {
  let state = (seed == null ? 42 : seed) >>> 0;
  return function () {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ─── Hard-Constraint Guard (used inside move evaluation) ─────────────────────

/**
 * Quick hard-constraint validity check for a proposed relocation of an
 * assignment to a new (day, time, room).  Returns false if any hard
 * constraint would be violated.
 *
 * @param {object} assignment  – the assignment being moved (original object)
 * @param {string} newDay
 * @param {string} newTime
 * @param {object} newRoom     – room object with {name, type, capacity}
 * @param {Array}  others      – all assignments EXCEPT the one being moved
 * @param {object} course      – course object for the assignment
 * @param {object} parsed      – full normalised input
 */
function isValidRelocation(assignment, newDay, newTime, newRoom, others, course, parsed) {
  const timeRange = getSlotRange(newTime, assignment.duration);
  if (!timeRange) return false;

  const globalBlockedTimes = new Set((parsed.globalRules?.blockedTimes) || []);
  if (timeRange.some((t) => globalBlockedTimes.has(t))) return false;
  if ((course.blockedDays || []).includes(newDay)) return false;
  if (course.blockedTimes && timeRange.some((t) => course.blockedTimes.includes(t))) return false;

  // Room type: practical must stay in a lab
  if (assignment.sessionType === "practical" && newRoom.type !== "lab") return false;

  // Room capacity
  if (newRoom.capacity < (course.studentCount || 0)) return false;

  const slotKeys = timeRange.map((t) => `${newDay}-${t}`);

  // Faculty conflict
  if (others.some((a) => a.faculty === assignment.faculty && overlapsSlotKeys(a.slotKeys, slotKeys))) {
    return false;
  }

  // Room conflict
  if (others.some((a) => a.room === newRoom.name && overlapsSlotKeys(a.slotKeys, slotKeys))) {
    return false;
  }

  // Section conflict
  if (
    others.some(
      (a) =>
        overlapsSlotKeys(a.slotKeys, slotKeys) &&
        a.sections.some((s) => (assignment.sections || []).includes(s)),
    )
  ) {
    return false;
  }

  return true;
}

// ─── Move: relocate one assignment to a new (day, time, room) ────────────────

function applyRelocation(assignment, newDay, newTime, newRoom, course) {
  const timeRange = getSlotRange(newTime, assignment.duration);
  if (!timeRange) return null;
  const slotKeys = timeRange.map((t) => `${newDay}-${t}`);
  const timeLabel =
    timeRange.length > 1
      ? `${timeRange[0]}-${timeRange[timeRange.length - 1]}`
      : timeRange[0];
  return {
    ...assignment,
    day: newDay,
    time: newTime,
    slotKeys,
    room: newRoom.name,
    timeLabel,
    preferenceBandMatched: (course.preferredBands || []).includes(slotBand(newTime)),
    preferredDayMatched: (course.preferredDays || []).includes(newDay),
  };
}

// ─── Main Improver: Simulated Annealing ──────────────────────────────────────

/**
 * Attempt to improve a feasible schedule by applying random relocations with
 * simulated annealing (SA) acceptance.  Only hard-constraint-preserving moves
 * are ever applied.
 *
 * SA parameters (tunable via options):
 *   initialTemp   – starting temperature  (default 80)
 *   coolingRate   – multiplicative cooling per outer iteration (default 0.96)
 *   innerIter     – relocations attempted per temperature step (default 40)
 *   minTemp       – stop when temperature falls below this (default 1)
 *
 * @param {Array}  assignments – feasible schedule (will not be mutated)
 * @param {object} parsed      – normalised input data
 * @param {object} options
 * @param {number}  [options.seed=42]
 * @param {number}  [options.timeoutMs=10000]
 * @param {number}  [options.initialTemp=80]
 * @param {number}  [options.coolingRate=0.96]
 * @param {number}  [options.innerIter=40]
 * @param {number}  [options.minTemp=1]
 *
 * @returns {{
 *   assignments: Array,
 *   score:       object,   // computeScheduleScore result
 *   iterations:  number,
 *   improved:    boolean,
 *   elapsedMs:   number,
 * }}
 */
function improve(assignments, parsed, options) {
  const {
    seed = 42,
    timeoutMs = 10000,
    initialTemp = 80,
    coolingRate = 0.96,
    innerIter = 40,
    minTemp = 1,
  } = options || {};

  const rng = createRng(seed);
  const startMs = Date.now();
  const rooms = parsed.rooms || [];

  // Only move non-locked assignments
  let current = assignments.map((a) => ({ ...a }));
  let currentScore = computeScheduleScore(current, parsed);
  let bestAssignments = current.map((a) => ({ ...a }));
  let bestScore = currentScore;

  let temperature = initialTemp;
  let iterations = 0;

  while (temperature > minTemp && Date.now() - startMs < timeoutMs) {
    for (let inner = 0; inner < innerIter; inner++) {
      if (Date.now() - startMs >= timeoutMs) break;

      // Pick a random non-locked assignment to relocate
      const movable = current.filter((a) => !a.locked);
      if (!movable.length) break;

      const target = movable[Math.floor(rng() * movable.length)];
      const course =
        (parsed.courses || []).find((c) => c.id === target.courseId) || {};

      // Pick a random (day, time, room) destination
      const newDay = DAYS[Math.floor(rng() * DAYS.length)];
      const newTime = TIMES[Math.floor(rng() * TIMES.length)];

      // For lab sessions stay in lab rooms; for theory prefer lecture rooms
      const eligibleRooms =
        target.sessionType === "practical"
          ? rooms.filter((r) => r.type === "lab")
          : rooms;
      if (!eligibleRooms.length) continue;
      const newRoom = eligibleRooms[Math.floor(rng() * eligibleRooms.length)];

      // Exclude the target from conflict checks
      const others = current.filter((a) => a.id !== target.id);

      if (!isValidRelocation(target, newDay, newTime, newRoom, others, course, parsed)) {
        continue;
      }

      const moved = applyRelocation(target, newDay, newTime, newRoom, course);
      if (!moved) continue;

      const candidate = current.map((a) => (a.id === target.id ? moved : a));
      const candidateScore = computeScheduleScore(candidate, parsed);

      const delta = candidateScore.totalPenalty - currentScore.totalPenalty;

      // Accept improving moves always; accept worsening moves with SA probability
      const accept =
        delta < 0 || Math.exp(-delta / temperature) > rng();

      if (accept) {
        current = candidate;
        currentScore = candidateScore;

        if (currentScore.totalPenalty < bestScore.totalPenalty) {
          bestAssignments = current.map((a) => ({ ...a }));
          bestScore = currentScore;
        }
      }

      iterations += 1;
    }

    temperature *= coolingRate;
  }

  return {
    assignments: bestAssignments,
    score: bestScore,
    iterations,
    improved: bestScore.totalPenalty < computeScheduleScore(assignments, parsed).totalPenalty,
    elapsedMs: Date.now() - startMs,
  };
}

module.exports = { improve };
