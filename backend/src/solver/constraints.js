"use strict";

// ─── Shared Calendar Constants ────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
// 12:00 is omitted – it is permanently reserved as lunch break
const TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
const BREAKS = ["12:00-13:00"];
const PERIOD_DURATION_HOURS = 1;

// ─── Constraint Catalogue ─────────────────────────────────────────────────────

/**
 * Hard constraints – must NEVER be violated. A schedule that breaks any of
 * these is considered infeasible and must be rejected or repaired.
 */
const HARD_CONSTRAINTS = [
  {
    id: "HC-01",
    name: "No Faculty Double-Booking",
    description:
      "A teacher cannot be assigned to two different classes at the same time slot.",
    type: "hard",
    priority: 100,
  },
  {
    id: "HC-02",
    name: "No Room Double-Booking",
    description: "A room cannot host two different classes at the same time slot.",
    type: "hard",
    priority: 100,
  },
  {
    id: "HC-03",
    name: "No Section Double-Booking",
    description:
      "A class/section cannot have two different subjects scheduled in the same time slot.",
    type: "hard",
    priority: 100,
  },
  {
    id: "HC-04",
    name: "Room Type Match",
    description:
      "Practical/lab sessions must be held in a lab room. Theory sessions must not displace lab rooms unless no lecture room is available.",
    type: "hard",
    priority: 90,
  },
  {
    id: "HC-05",
    name: "Room Capacity",
    description:
      "Room capacity must be greater than or equal to the number of students attending the session.",
    type: "hard",
    priority: 85,
  },
  {
    id: "HC-06",
    name: "Weekly Hours Satisfaction",
    description:
      "Each subject must receive exactly the required number of theory hours and practical hours per week.",
    type: "hard",
    priority: 95,
  },
  {
    id: "HC-07",
    name: "Lunch Break",
    description:
      "The 12:00–13:00 slot is always reserved as lunch break. No class may be scheduled in it.",
    type: "hard",
    priority: 100,
  },
  {
    id: "HC-08",
    name: "Blocked Time Slots",
    description:
      "Admin-defined global blocked times and course-specific blocked days/times must remain empty.",
    type: "hard",
    priority: 100,
  },
  {
    id: "HC-09",
    name: "Combined Sections Synchronization",
    description:
      "When a course covers multiple sections simultaneously, all sections must share exactly the same time slot and room. The solver models this as a single session serving all sections at once.",
    type: "hard",
    priority: 95,
  },
  {
    id: "HC-10",
    name: "Locked Slot Immutability",
    description:
      "Admin-locked assignments are immutable. The solver must not override, move, or replace them during generation or optimization.",
    type: "hard",
    priority: 100,
  },
];

/**
 * Soft constraints – should be satisfied where possible. Violations incur a
 * weighted penalty; lower total penalty means a better-quality schedule.
 *
 * Penalty weights:
 *   SC-01  teacher idle gap              +5 per gap period
 *   SC-02  unwanted slot (first/last)    +3
 *   SC-03  same subject repeated on day  +2
 *   SC-04  lab split non-consecutive     +6
 *   SC-05  preferred day not matched     +4
 *   SC-06  preferred time band missed    +3
 *   SC-07  subject not spread across week +2
 *   SC-08  3+ consecutive teaching slots +3
 *   SC-09  theory session in lab room    +2
 */
const SOFT_CONSTRAINTS = [
  {
    id: "SC-01",
    name: "Minimize Teacher Idle Gaps",
    description:
      "Avoid idle periods between a teacher's sessions on the same day. Each gap period incurs a penalty.",
    type: "soft",
    penaltyWeight: 5,
  },
  {
    id: "SC-02",
    name: "Avoid Unwanted Slots",
    description:
      "Avoid scheduling sessions in the first or last available slot of the day, or in time bands that the faculty prefers to avoid.",
    type: "soft",
    penaltyWeight: 3,
  },
  {
    id: "SC-03",
    name: "No Subject Repeated Same Day",
    description:
      "The same subject should not appear more than once on any given day.",
    type: "soft",
    penaltyWeight: 2,
  },
  {
    id: "SC-04",
    name: "Lab Consecutive Slots",
    description:
      "Practical/lab sessions with duration > 1 should occupy strictly consecutive time slots to avoid interruption.",
    type: "soft",
    penaltyWeight: 6,
  },
  {
    id: "SC-05",
    name: "Preferred Day Match",
    description:
      "Schedule sessions on the faculty member's explicitly stated preferred teaching days.",
    type: "soft",
    penaltyWeight: 4,
  },
  {
    id: "SC-06",
    name: "Preferred Time Band Match",
    description:
      "Schedule sessions in the faculty member's preferred time band (morning/afternoon/evening).",
    type: "soft",
    penaltyWeight: 3,
  },
  {
    id: "SC-07",
    name: "Spread Subjects Across Week",
    description:
      "Distribute a subject's multiple sessions across different days rather than concentrating them on a single day.",
    type: "soft",
    penaltyWeight: 2,
  },
  {
    id: "SC-08",
    name: "Avoid Excessive Consecutive Teaching",
    description:
      "Avoid scheduling three or more back-to-back teaching periods for the same faculty member on the same day.",
    type: "soft",
    penaltyWeight: 3,
  },
  {
    id: "SC-09",
    name: "Prefer Lecture Rooms for Theory",
    description:
      "Theory sessions should be held in lecture rooms, not in lab rooms, unless no lecture room is available.",
    type: "soft",
    penaltyWeight: 2,
  },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

/** Map a time string to its broad band label. */
function slotBand(time) {
  if (time < "12:00") return "morning";
  if (time < "17:00") return "afternoon";
  return "evening";
}

/**
 * Return the slice of TIMES starting at startTime with the given duration.
 * Returns null if the range would overflow the end of the TIMES array.
 */
function getSlotRange(startTime, duration) {
  const startIndex = TIMES.indexOf(startTime);
  if (startIndex === -1 || startIndex + duration > TIMES.length) return null;
  return TIMES.slice(startIndex, startIndex + duration);
}

/** Return true if any key appears in both arrays. */
function overlapsSlotKeys(keysA, keysB) {
  return keysA.some((k) => keysB.includes(k));
}

/**
 * Extract the time portion from a slotKey formatted as "${day}-${time}".
 * e.g. "Monday-09:00" → "09:00"
 */
function timeFromSlotKey(slotKey) {
  const idx = slotKey.indexOf("-");
  return slotKey.slice(idx + 1);
}

// ─── Hard Constraint Checker ──────────────────────────────────────────────────

/**
 * Evaluate all hard constraints for a proposed candidate slot/room against
 * the existing schedule.
 *
 * @param {{ day: string, time: string, timeRange: string[], slotKeys: string[], room: object }} candidate
 * @param {{ id: string, course: object, duration: number, sessionType: string, requiredRoomType: string }} session
 * @param {Array} existingAssignments  – already-placed assignments (including locked ones)
 * @param {{ blockedTimes?: string[], lockedSlots?: object[] }} rules  – global rules
 *
 * @returns {{ valid: boolean, violations: Array<{constraintId, description, conflictsWith}> }}
 */
function checkHardConstraints(candidate, session, existingAssignments, rules) {
  const violations = [];
  const { day, timeRange, slotKeys, room } = candidate;
  const { course, sessionType, requiredRoomType } = session;
  const blockedTimes = new Set(rules?.blockedTimes || []);

  // HC-07 / HC-08: globally blocked times (includes lunch break slot "12:00")
  for (const slot of timeRange) {
    if (blockedTimes.has(slot)) {
      violations.push({
        constraintId: "HC-07/HC-08",
        description: `Time slot ${slot} is blocked (lunch break or admin rule).`,
        conflictsWith: null,
      });
    }
  }

  // HC-08: course-specific blocked days
  if (course.blockedDays && course.blockedDays.includes(day)) {
    violations.push({
      constraintId: "HC-08",
      description: `${day} is a blocked day for ${course.courseName} (faculty: ${course.faculty}).`,
      conflictsWith: null,
    });
  }

  // HC-08: course-specific blocked times (per-teacher availability window)
  if (course.blockedTimes && course.blockedTimes.length > 0) {
    const hitBlocked = timeRange.filter((t) => course.blockedTimes.includes(t));
    if (hitBlocked.length > 0) {
      violations.push({
        constraintId: "HC-08",
        description: `Time slot(s) ${hitBlocked.join(", ")} are blocked for faculty ${course.faculty}.`,
        conflictsWith: null,
      });
    }
  }

  // HC-01: faculty double-booking
  const facultyConflict = existingAssignments.find(
    (a) => a.faculty === course.faculty && overlapsSlotKeys(a.slotKeys, slotKeys),
  );
  if (facultyConflict) {
    violations.push({
      constraintId: "HC-01",
      description: `Faculty ${course.faculty} is already teaching "${facultyConflict.courseName}" in this slot.`,
      conflictsWith: facultyConflict.id,
    });
  }

  // HC-02: room double-booking
  const roomConflict = existingAssignments.find(
    (a) => a.room === room.name && overlapsSlotKeys(a.slotKeys, slotKeys),
  );
  if (roomConflict) {
    violations.push({
      constraintId: "HC-02",
      description: `Room "${room.name}" is already occupied by "${roomConflict.courseName}" in this slot.`,
      conflictsWith: roomConflict.id,
    });
  }

  // HC-03: section double-booking
  const sectionConflict = existingAssignments.find(
    (a) =>
      overlapsSlotKeys(a.slotKeys, slotKeys) &&
      a.sections.some((s) => course.sections.includes(s)),
  );
  if (sectionConflict) {
    violations.push({
      constraintId: "HC-03",
      description: `Section(s) [${course.sections.join(", ")}] already have "${sectionConflict.courseName}" in this slot.`,
      conflictsWith: sectionConflict.id,
    });
  }

  // HC-04: room type match (practical must be in lab)
  if (requiredRoomType === "lab" && room.type !== "lab") {
    violations.push({
      constraintId: "HC-04",
      description: `Practical session requires a lab room but "${room.name}" is type "${room.type}".`,
      conflictsWith: null,
    });
  }

  // HC-05: room capacity
  if (room.capacity < (course.studentCount || 0)) {
    violations.push({
      constraintId: "HC-05",
      description: `Room "${room.name}" capacity (${room.capacity}) is below the student count (${course.studentCount}).`,
      conflictsWith: null,
    });
  }

  return { valid: violations.length === 0, violations };
}

// ─── Soft Constraint Penalty Calculator ──────────────────────────────────────

/**
 * Compute soft constraint penalties for a proposed candidate slot/room
 * in the context of the existing schedule.
 *
 * @param {{ day: string, time: string, timeRange: string[], slotKeys: string[], room: object }} candidate
 * @param {{ id: string, course: object, duration: number, sessionType: string }} session
 * @param {Array} existingAssignments
 * @param {object} parsed  – full normalised input (for course lookups)
 *
 * @returns {{ penalties: Array<{constraintId, penalty, description}>, totalPenalty: number }}
 */
function checkSoftPenalties(candidate, session, existingAssignments, parsed) {
  const penalties = [];
  const { day, time, timeRange, slotKeys, room } = candidate;
  const { course, sessionType } = session;
  const w = Object.fromEntries(SOFT_CONSTRAINTS.map((c) => [c.id, c.penaltyWeight]));

  // SC-02: first or last slot of the day
  const timeIdx = TIMES.indexOf(time);
  if (timeIdx === 0 || timeIdx === TIMES.length - 1) {
    penalties.push({
      constraintId: "SC-02",
      penalty: w["SC-02"],
      description: "Session placed in the first or last slot of the day.",
    });
  }

  // SC-03: same subject already on this day
  if (existingAssignments.some((a) => a.courseId === course.id && a.day === day)) {
    penalties.push({
      constraintId: "SC-03",
      penalty: w["SC-03"],
      description: `"${course.courseName}" already has a session on ${day}.`,
    });
  }

  // SC-04: lab session with duration > 1 in non-consecutive slots
  if (sessionType === "practical" && session.duration > 1) {
    const indices = timeRange.map((t) => TIMES.indexOf(t));
    const isConsecutive = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
    if (!isConsecutive) {
      penalties.push({
        constraintId: "SC-04",
        penalty: w["SC-04"],
        description: "Lab session spans non-consecutive time slots.",
      });
    }
  }

  // SC-05: preferred day not matched
  if (course.preferredDays.length > 0 && !course.preferredDays.includes(day)) {
    penalties.push({
      constraintId: "SC-05",
      penalty: w["SC-05"],
      description: `${day} is not among ${course.faculty}'s preferred days.`,
    });
  }

  // SC-06: preferred time band not matched
  if (course.preferredBands.length > 0 && !course.preferredBands.includes(slotBand(time))) {
    penalties.push({
      constraintId: "SC-06",
      penalty: w["SC-06"],
      description: `Time band "${slotBand(time)}" is not preferred by ${course.faculty}.`,
    });
  }

  // SC-01: would this placement create idle gaps for this teacher today?
  const teacherToday = existingAssignments.filter(
    (a) => a.faculty === course.faculty && a.day === day,
  );
  if (teacherToday.length > 0) {
    const occupiedSet = new Set();
    for (const a of teacherToday) {
      for (const k of a.slotKeys) {
        const t = timeFromSlotKey(k);
        const idx = TIMES.indexOf(t);
        if (idx !== -1) occupiedSet.add(idx);
      }
    }
    const newIndices = slotKeys
      .map((k) => TIMES.indexOf(timeFromSlotKey(k)))
      .filter((i) => i !== -1);
    const combined = [...new Set([...occupiedSet, ...newIndices])].sort((a, b) => a - b);
    if (combined.length > 1) {
      const span = combined[combined.length - 1] - combined[0] + 1;
      const gaps = span - combined.length;
      if (gaps > 0) {
        penalties.push({
          constraintId: "SC-01",
          penalty: w["SC-01"] * gaps,
          description: `Creates ${gaps} idle gap period(s) for ${course.faculty} on ${day}.`,
        });
      }
    }
  }

  // SC-08: 3+ consecutive teaching periods for this teacher today
  {
    const teacherOnDay = existingAssignments.filter(
      (a) => a.faculty === course.faculty && a.day === day,
    );
    const allIdx = new Set();
    for (const a of teacherOnDay) {
      for (const k of a.slotKeys) {
        const idx = TIMES.indexOf(timeFromSlotKey(k));
        if (idx !== -1) allIdx.add(idx);
      }
    }
    for (const k of slotKeys) {
      const idx = TIMES.indexOf(timeFromSlotKey(k));
      if (idx !== -1) allIdx.add(idx);
    }
    let maxRun = 0;
    let run = 0;
    for (let i = 0; i < TIMES.length; i++) {
      if (allIdx.has(i)) {
        run += 1;
        if (run > maxRun) maxRun = run;
      } else {
        run = 0;
      }
    }
    if (maxRun >= 3) {
      penalties.push({
        constraintId: "SC-08",
        penalty: w["SC-08"],
        description: `${course.faculty} would have ${maxRun} consecutive teaching periods on ${day}.`,
      });
    }
  }

  // SC-09: theory session placed in a lab room
  if (sessionType === "theory" && room.type === "lab") {
    penalties.push({
      constraintId: "SC-09",
      penalty: w["SC-09"],
      description: `Theory session placed in lab room "${room.name}" (wastes lab capacity).`,
    });
  }

  const totalPenalty = penalties.reduce((sum, p) => sum + p.penalty, 0);
  return { penalties, totalPenalty };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  DAYS,
  TIMES,
  BREAKS,
  PERIOD_DURATION_HOURS,
  HARD_CONSTRAINTS,
  SOFT_CONSTRAINTS,
  slotBand,
  getSlotRange,
  overlapsSlotKeys,
  timeFromSlotKey,
  checkHardConstraints,
  checkSoftPenalties,
};
