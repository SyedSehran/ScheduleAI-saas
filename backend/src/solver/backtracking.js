"use strict";

const {
  DAYS,
  TIMES,
  getSlotRange,
  overlapsSlotKeys,
  timeFromSlotKey,
  slotBand,
  checkSoftPenalties,
} = require("./constraints");

// ─── Seeded Pseudo-Random Number Generator ────────────────────────────────────

/**
 * Linear-congruential PRNG with a 32-bit seed.
 * Provides deterministic candidate shuffling for reproducible schedules.
 */
function createRng(seed) {
  let state = (seed == null ? 42 : seed) >>> 0;
  return function () {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ─── Session Builder ──────────────────────────────────────────────────────────

/**
 * Derive the list of sessions to schedule from the normalised courses.
 * Sessions for which a locked assignment already exists are skipped so the
 * solver does not produce duplicate placements.
 *
 * Sessions are sorted hardest-first (MRV heuristic approximation):
 *   higher priority  → scheduled earlier
 *   more sections    → scheduled earlier (combined classes are harder)
 *   longer duration  → scheduled earlier (lab blocks are harder)
 *   lab requirement  → extra difficulty weight
 *
 * @param {Array}  courses          – normalised course objects
 * @param {Array}  lockedAssignments – pre-placed locked assignments
 * @returns {Array} sorted session list
 */
function buildSessions(courses, lockedAssignments) {
  const locked = lockedAssignments || [];
  const sessions = [];

  for (const course of courses) {
    // How many theory/practical hours are already covered by locked assignments?
    const lockedTheory = locked.filter(
      (a) => a.courseId === course.id && a.sessionType === "theory",
    ).length;
    const lockedPractical = locked
      .filter((a) => a.courseId === course.id && a.sessionType === "practical")
      .reduce((sum, a) => sum + (a.duration || 1), 0);

    const theoryNeeded = Math.max(0, course.theoryHoursPerWeek - lockedTheory);
    const practicalNeeded = Math.max(0, course.practicalHoursPerWeek - lockedPractical);

    for (let i = 0; i < theoryNeeded; i++) {
      sessions.push({
        id: `${course.id}-theory-${lockedTheory + i + 1}`,
        course,
        duration: 1,
        sessionType: "theory",
        requiredRoomType: "lecture",
      });
    }

    let remaining = practicalNeeded;
    let labIdx = lockedPractical;
    while (remaining > 0) {
      const duration = Math.min(course.practicalSessionLength || 2, remaining);
      labIdx += 1;
      sessions.push({
        id: `${course.id}-practical-${labIdx}`,
        course,
        duration,
        sessionType: "practical",
        requiredRoomType: "lab",
      });
      remaining -= duration;
    }
  }

  // MRV approximation: harder sessions first
  sessions.sort((l, r) => {
    const score = (s) =>
      (s.course.priority || 0) * 10 +
      s.course.sections.length * 2 +
      s.duration +
      (s.requiredRoomType === "lab" ? 2 : 0);
    return score(r) - score(l);
  });

  return sessions;
}

// ─── Main Backtracking Solver ─────────────────────────────────────────────────

/**
 * Generate a feasible timetable using backtracking with:
 *   – MRV-approximated session ordering (hardest first)
 *   – LCV candidate selection (lowest soft-penalty first)
 *   – Deterministic seeded tie-breaking
 *   – Timeout with best-so-far return
 *   – Detailed conflict explanation when a session cannot be placed
 *
 * @param {object} parsed   – normalised input (courses, rooms, globalRules)
 * @param {object} options
 * @param {number}  [options.seed=42]         – PRNG seed for reproducibility
 * @param {number}  [options.timeoutMs=30000] – wall-clock timeout in ms
 *
 * @returns {{
 *   assignments:  Array,
 *   conflicts:    Array,
 *   explanations: Array,
 *   timedOut:     boolean,
 *   elapsedMs:    number,
 * }}
 */
function solve(parsed, options) {
  const { seed = 42, timeoutMs = 30000 } = options || {};

  const rng = createRng(seed);
  const startMs = Date.now();
  const rooms = parsed.rooms || [];
  const rules = parsed.globalRules || {};
  const globalBlockedTimes = new Set(rules.blockedTimes || []);

  // Pre-place locked assignments as immutable initial state
  const lockedAssignments = (rules.lockedSlots || []).map((ls) => ({
    ...ls,
    locked: true,
  }));

  const assignments = [...lockedAssignments];
  const sessions = buildSessions(parsed.courses || [], lockedAssignments);
  const conflicts = [];
  const explanations = [];

  // Per-course tracking: which times (HH:MM) are already used across all days
  // This soft-discourages reusing the same clock hour for the same course.
  const courseTimeUsage = new Map();
  for (const a of lockedAssignments) {
    if (!courseTimeUsage.has(a.courseId)) courseTimeUsage.set(a.courseId, new Set());
    (a.slotKeys || []).forEach((k) => courseTimeUsage.get(a.courseId).add(timeFromSlotKey(k)));
  }

  function isTimedOut() {
    return Date.now() - startMs > timeoutMs;
  }

  function backtrack(index) {
    if (isTimedOut()) return false;
    if (index >= sessions.length) return true;

    const session = sessions[index];
    const { course } = session;
    const candidates = [];
    // Collect rejected (day, time) combos for conflict explanation
    const rejectedSlots = [];

    const usedTimes = courseTimeUsage.get(course.id) || new Set();

    for (const day of DAYS) {
      if ((course.blockedDays || []).includes(day)) continue;

      for (const time of TIMES) {
        const timeRange = getSlotRange(time, session.duration);
        if (!timeRange) continue;

        const slotKeys = timeRange.map((t) => `${day}-${t}`);
        const dayTimeRejectReasons = [];

        // HC-07/HC-08: globally blocked times
        const globallyBlocked = timeRange.filter((t) => globalBlockedTimes.has(t));
        if (globallyBlocked.length > 0) {
          dayTimeRejectReasons.push({
            constraintId: "HC-07/HC-08",
            description: `Slot ${globallyBlocked.join(", ")} is globally blocked.`,
          });
          rejectedSlots.push({ day, time, room: "any", violations: dayTimeRejectReasons });
          continue;
        }

        // HC-08: course blocked times
        if (
          course.blockedTimes &&
          timeRange.some((t) => course.blockedTimes.includes(t))
        ) {
          dayTimeRejectReasons.push({
            constraintId: "HC-08",
            description: `Time blocked for ${course.faculty}.`,
          });
          rejectedSlots.push({ day, time, room: "any", violations: dayTimeRejectReasons });
          continue;
        }

        // HC-01: faculty busy
        const facultyConflict = assignments.find(
          (a) => a.faculty === course.faculty && overlapsSlotKeys(a.slotKeys, slotKeys),
        );
        if (facultyConflict) {
          dayTimeRejectReasons.push({
            constraintId: "HC-01",
            description: `${course.faculty} is teaching "${facultyConflict.courseName}".`,
          });
          rejectedSlots.push({ day, time, room: "any", violations: dayTimeRejectReasons });
          continue;
        }

        // HC-03: section busy
        const sectionConflict = assignments.find(
          (a) =>
            overlapsSlotKeys(a.slotKeys, slotKeys) &&
            a.sections.some((s) => course.sections.includes(s)),
        );
        if (sectionConflict) {
          dayTimeRejectReasons.push({
            constraintId: "HC-03",
            description: `Section(s) [${course.sections.join(", ")}] have "${sectionConflict.courseName}".`,
          });
          rejectedSlots.push({ day, time, room: "any", violations: dayTimeRejectReasons });
          continue;
        }

        // Additional soft-constraint guard: same course, same time-of-day, different day
        const timeAlreadyUsed = timeRange.some((t) => usedTimes.has(t));

        // Try every room
        for (const room of rooms) {
          // HC-04: room type
          if (session.requiredRoomType === "lab" && room.type !== "lab") continue;

          // HC-05: room capacity
          if (room.capacity < (course.studentCount || 0)) continue;

          // HC-02: room busy
          if (
            assignments.some(
              (a) => a.room === room.name && overlapsSlotKeys(a.slotKeys, slotKeys),
            )
          ) {
            continue;
          }

          // Soft penalty (LCV: prefer lower-penalty candidates)
          const { totalPenalty } = checkSoftPenalties(
            { day, time, timeRange, slotKeys, room },
            session,
            assignments,
            parsed,
          );

          // Small deterministic jitter for tie-breaking based on seed
          const jitter = rng() * 0.01;
          const penalty = totalPenalty + (timeAlreadyUsed ? 2 : 0) + jitter;

          candidates.push({ day, time, timeRange, slotKeys, room, penalty });
        }
      }
    }

    // LCV: sort by ascending penalty (best candidate first)
    candidates.sort((a, b) => a.penalty - b.penalty);

    for (const candidate of candidates) {
      if (isTimedOut()) break;

      const { timeRange } = candidate;
      const timeLabel =
        timeRange.length > 1
          ? `${timeRange[0]}-${timeRange[timeRange.length - 1]}`
          : timeRange[0];

      const assignment = {
        id: session.id,
        courseId: course.id,
        courseName: course.courseName,
        faculty: course.faculty,
        sections: course.sections,
        room: candidate.room.name,
        sessionType: session.sessionType,
        duration: session.duration,
        day: candidate.day,
        time: candidate.time,
        slotKeys: candidate.slotKeys,
        timeLabel,
        penalty: candidate.penalty,
        preferenceBandMatched: (course.preferredBands || []).includes(
          slotBand(candidate.time),
        ),
        preferredDayMatched: (course.preferredDays || []).includes(candidate.day),
      };

      assignments.push(assignment);

      // Maintain per-course time-usage tracking
      if (!courseTimeUsage.has(course.id)) courseTimeUsage.set(course.id, new Set());
      const usageSet = courseTimeUsage.get(course.id);
      timeRange.forEach((t) => usageSet.add(t));

      if (backtrack(index + 1)) return true;

      // Backtrack: undo assignment and usage tracking
      assignments.pop();
      timeRange.forEach((t) => usageSet.delete(t));
    }

    // No candidate worked (or no candidates existed) – record conflict with
    // explanation and CONTINUE to the next session (partial-schedule strategy).
    // This guarantees a maximal feasible partial schedule even when some sessions
    // are infeasible (e.g. no lab room large enough, all slots blocked).
    const topRejected = rejectedSlots.slice(0, 8).map(({ day, time, room, violations }) => ({
      slot: `${day} ${time}`,
      room,
      violations: violations.map((v) => `[${v.constraintId}] ${v.description}`),
    }));

    conflicts.push({
      sessionId: session.id,
      courseName: course.courseName,
      faculty: course.faculty,
      sections: course.sections,
      reason:
        "No clash-free slot was found under the current hard constraints. See explanations for details.",
      suggestions: [
        `Consider adding more rooms or lab space for "${course.courseName}".`,
        `Relax ${course.faculty}'s blocked days or times.`,
        `Split combined sections into independent sessions to reduce contention.`,
        `Reduce total weekly hours if the timetable window is too narrow.`,
      ],
    });

    explanations.push({
      sessionId: session.id,
      courseName: course.courseName,
      faculty: course.faculty,
      sections: course.sections,
      sampleRejectedSlots: topRejected,
    });

    // Partial-schedule strategy: skip this session and continue with the rest.
    return backtrack(index + 1);
  }

  backtrack(0);

  return {
    assignments,
    conflicts,
    explanations,
    timedOut: isTimedOut(),
    elapsedMs: Date.now() - startMs,
  };
}

module.exports = { solve, buildSessions };
