"use strict";

const {
  SOFT_CONSTRAINTS,
  DAYS,
  TIMES,
  slotBand,
  timeFromSlotKey,
} = require("./constraints");

/** Penalty weight map keyed by soft-constraint ID. */
const PENALTY_WEIGHTS = Object.fromEntries(
  SOFT_CONSTRAINTS.map((c) => [c.id, c.penaltyWeight]),
);

/**
 * Compute the full soft-constraint penalty score for an existing schedule.
 *
 * Each soft constraint is evaluated over the complete set of assignments and
 * the result is expressed as:
 *   - totalPenalty  – sum of all weighted violations (lower = better)
 *   - breakdown     – penalty per constraint ID
 *   - perAssignment – per-assignment breakdown for UI display
 *
 * @param {Array}  assignments – all placed assignments
 * @param {object} parsed      – normalised input data (courses, rooms, globalRules)
 *
 * @returns {{ totalPenalty: number, breakdown: object, perAssignment: Array }}
 */
function computeScheduleScore(assignments, parsed) {
  const breakdown = Object.fromEntries(SOFT_CONSTRAINTS.map((c) => [c.id, 0]));
  const perAssignment = [];

  // ── Per-assignment pass ──────────────────────────────────────────────────
  for (const assignment of assignments) {
    const course = (parsed.courses || []).find((c) => c.id === assignment.courseId) || {};
    const others = assignments.filter((a) => a.id !== assignment.id);
    const timeIdx = TIMES.indexOf(assignment.time);
    const localPenalties = [];

    // SC-02: first or last slot
    if (timeIdx === 0 || timeIdx === TIMES.length - 1) {
      const p = PENALTY_WEIGHTS["SC-02"];
      localPenalties.push({
        id: "SC-02",
        penalty: p,
        description: "Scheduled in the first or last slot of the day.",
      });
      breakdown["SC-02"] += p;
    }

    // SC-03 is computed once per course-day group after this loop (see below).

    // SC-04: lab/practical with non-consecutive slots
    if (assignment.sessionType === "practical" && assignment.duration > 1) {
      const indices = (assignment.slotKeys || []).map((k) =>
        TIMES.indexOf(timeFromSlotKey(k)),
      );
      const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
      if (!isConsecutive) {
        const p = PENALTY_WEIGHTS["SC-04"];
        localPenalties.push({
          id: "SC-04",
          penalty: p,
          description: "Lab session spans non-consecutive time slots.",
        });
        breakdown["SC-04"] += p;
      }
    }

    // SC-05: preferred day not matched
    if (
      course.preferredDays?.length > 0 &&
      !course.preferredDays.includes(assignment.day)
    ) {
      const p = PENALTY_WEIGHTS["SC-05"];
      localPenalties.push({
        id: "SC-05",
        penalty: p,
        description: `Not scheduled on a preferred day (preferred: ${course.preferredDays.join(", ")}).`,
      });
      breakdown["SC-05"] += p;
    }

    // SC-06: preferred time band not matched
    if (
      course.preferredBands?.length > 0 &&
      !course.preferredBands.includes(slotBand(assignment.time))
    ) {
      const p = PENALTY_WEIGHTS["SC-06"];
      localPenalties.push({
        id: "SC-06",
        penalty: p,
        description: `Not scheduled in a preferred time band (preferred: ${course.preferredBands.join(", ")}).`,
      });
      breakdown["SC-06"] += p;
    }

    // SC-09: theory in lab room
    if (assignment.sessionType === "theory") {
      const room = (parsed.rooms || []).find((r) => r.name === assignment.room);
      if (room && room.type === "lab") {
        const p = PENALTY_WEIGHTS["SC-09"];
        localPenalties.push({
          id: "SC-09",
          penalty: p,
          description: `Theory session in lab room "${assignment.room}".`,
        });
        breakdown["SC-09"] += p;
      }
    }

    const assignmentPenalty = localPenalties.reduce((s, p) => s + p.penalty, 0);
    perAssignment.push({
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      courseName: assignment.courseName,
      day: assignment.day,
      time: assignment.time,
      penalty: assignmentPenalty,
      penalties: localPenalties,
    });
  }

  // ── SC-03: same subject on same day — counted once per course-day violation ──
  // Group assignments by (courseId + day). Any group with >1 assignment incurs
  // exactly one SC-03 penalty (not one per extra session), preventing double-counting.
  const courseDayGroups = new Map();
  for (const a of assignments) {
    const key = `${a.courseId}::${a.day}`;
    if (!courseDayGroups.has(key)) courseDayGroups.set(key, []);
    courseDayGroups.get(key).push(a);
  }
  for (const [, group] of courseDayGroups) {
    if (group.length > 1) {
      const p = PENALTY_WEIGHTS["SC-03"];
      breakdown["SC-03"] += p;
      // Attribute to the first assignment in the group for UI display
      const target = perAssignment.find((pa) =>
        group.some((a) => a.id === pa.assignmentId),
      );
      if (target) {
        target.penalty += p;
        target.penalties.push({
          id: "SC-03",
          penalty: p,
          description: `"${group[0].courseName}" has ${group.length} sessions on ${group[0].day}.`,
        });
      }
    }
  }

  // ── Per-day, per-faculty pass  (SC-01 gaps, SC-07 spread, SC-08 consecutive) ──
  for (const day of DAYS) {
    const dayAssignments = assignments.filter((a) => a.day === day);

    // Group by faculty
    const byFaculty = new Map();
    for (const a of dayAssignments) {
      if (!byFaculty.has(a.faculty)) byFaculty.set(a.faculty, []);
      byFaculty.get(a.faculty).push(a);
    }

    for (const [, fas] of byFaculty) {
      // Collect all slot indices occupied by this faculty today
      const occupiedIdx = new Set();
      for (const a of fas) {
        for (const k of a.slotKeys || []) {
          const idx = TIMES.indexOf(timeFromSlotKey(k));
          if (idx !== -1) occupiedIdx.add(idx);
        }
      }
      if (occupiedIdx.size < 2) continue;

      const sorted = [...occupiedIdx].sort((a, b) => a - b);
      const span = sorted[sorted.length - 1] - sorted[0] + 1;
      const gaps = span - occupiedIdx.size;

      // SC-01: idle gaps
      if (gaps > 0) {
        const p = PENALTY_WEIGHTS["SC-01"] * gaps;
        breakdown["SC-01"] += p;
        // Attribute to the first of this faculty's assignments on this day
        const target = perAssignment.find((pa) => fas.some((a) => a.id === pa.assignmentId));
        if (target) {
          target.penalty += p;
          target.penalties.push({
            id: "SC-01",
            penalty: p,
            description: `${gaps} idle gap period(s) for ${fas[0].faculty} on ${day}.`,
          });
        }
      }

      // SC-08: 3+ consecutive teaching periods
      let maxRun = 0;
      let run = 0;
      for (let i = 0; i < TIMES.length; i++) {
        if (occupiedIdx.has(i)) {
          run += 1;
          if (run > maxRun) maxRun = run;
        } else {
          run = 0;
        }
      }
      if (maxRun >= 3) {
        const p = PENALTY_WEIGHTS["SC-08"];
        breakdown["SC-08"] += p;
        const target = perAssignment.find((pa) => fas.some((a) => a.id === pa.assignmentId));
        if (target) {
          target.penalty += p;
          target.penalties.push({
            id: "SC-08",
            penalty: p,
            description: `${fas[0].faculty} has ${maxRun} consecutive teaching periods on ${day}.`,
          });
        }
      }
    }
  }

  // SC-07: subject not spread across week.
  // For each course with more than 1 session, penalise if the number of
  // distinct days used is fewer than floor(sessionCount/2) — i.e. sessions
  // are clustered rather than distributed.
  const courseSessionMap = new Map();
  for (const a of assignments) {
    if (!courseSessionMap.has(a.courseId)) {
      courseSessionMap.set(a.courseId, { courseName: a.courseName, days: new Set(), ids: [] });
    }
    const entry = courseSessionMap.get(a.courseId);
    entry.days.add(a.day);
    entry.ids.push(a.id);
  }
  for (const [courseId, { courseName, days, ids }] of courseSessionMap) {
    const sessionCount = ids.length;
    if (sessionCount <= 1) continue;
    const idealMinDays = Math.ceil(sessionCount / 2);
    if (days.size < idealMinDays) {
      const p = PENALTY_WEIGHTS["SC-07"] * (idealMinDays - days.size);
      breakdown["SC-07"] += p;
      const target = perAssignment.find((pa) => ids.includes(pa.assignmentId));
      if (target) {
        target.penalty += p;
        target.penalties.push({
          id: "SC-07",
          penalty: p,
          description: `"${courseName}" has ${sessionCount} sessions but only ${days.size} distinct day(s) — sessions are clustered.`,
        });
      }
    }
  }

  const totalPenalty = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { totalPenalty, breakdown, perAssignment };
}

module.exports = { PENALTY_WEIGHTS, computeScheduleScore };
