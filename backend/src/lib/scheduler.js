const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
// Note: 12:00-13:00 is reserved as lunch break
const TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
const BREAKS = ["12:00-13:00"]; // Lunch break (1 hour)

function slotBand(time) {
  if (time < "12:00") {
    return "morning";
  }
  if (time < "17:00") {
    return "afternoon";
  }
  return "evening";
}

function buildSessions(courses) {
  const sessions = [];

  for (const course of courses) {
    for (let index = 0; index < course.theoryHoursPerWeek; index += 1) {
      sessions.push({
        id: `${course.id}-theory-${index + 1}`,
        course,
        duration: 1,
        sessionType: "theory",
        requiredRoomType: "lecture",
      });
    }

    let remainingPractical = course.practicalHoursPerWeek;
    let practicalIndex = 0;
    while (remainingPractical > 0) {
      const duration = Math.min(course.practicalSessionLength || 2, remainingPractical);
      practicalIndex += 1;
      sessions.push({
        id: `${course.id}-practical-${practicalIndex}`,
        course,
        duration,
        sessionType: "practical",
        requiredRoomType: "lab",
      });
      remainingPractical -= duration;
    }
  }

  return sessions.sort((left, right) => {
    const leftWeight = left.course.sections.length + left.duration + (left.requiredRoomType === "lab" ? 2 : 0);
    const rightWeight = right.course.sections.length + right.duration + (right.requiredRoomType === "lab" ? 2 : 0);
    return rightWeight - leftWeight;
  });
}

function preferenceScore(course, day, time, room) {
  let score = 0;

  if (course.preferredBands.includes(slotBand(time))) {
    score += 6;
  }
  if (!course.preferredBands.length) {
    score += 2;
  }
  if (course.preferredDays.includes(day)) {
    score += 5;
  }
  if (!course.preferredDays.length) {
    score += 1;
  }
  if (course.roomPreference && course.roomPreference === room.name) {
    score += 4;
  }
  if (course.roomType === room.type) {
    score += 2;
  }

  return score;
}

function getSlotRange(time, duration) {
  const startIndex = TIMES.indexOf(time);
  if (startIndex === -1 || startIndex + duration > TIMES.length) {
    return null;
  }

  return TIMES.slice(startIndex, startIndex + duration);
}

function overlapsSlotKeys(slotKeys, otherSlotKeys) {
  return slotKeys.some((slotKey) => otherSlotKeys.includes(slotKey));
}

function cloneSchedule(schedule) {
  return JSON.parse(JSON.stringify(schedule));
}

function getTeacherPool(schedule) {
  const teachers = new Set();
  for (const item of schedule.assignments || []) {
    teachers.add(item.originalFaculty || item.faculty);
    teachers.add(item.faculty);
  }
  return [...teachers].filter(Boolean);
}

function generateSchedule(parsed) {
  const assignments = [];
  const conflicts = [];
  const blockedTimes = new Set(parsed.globalRules.blockedTimes || []);
  const rooms = parsed.rooms || [];
  const sessions = buildSessions(parsed.courses || []);
  
  // Track time slots used by each course across all days to prevent repetition
  const courseTimeSlotUsage = new Map();
  for (const course of parsed.courses || []) {
    courseTimeSlotUsage.set(course.id, new Set());
  }

  function backtrack(index) {
    if (index >= sessions.length) {
      return true;
    }

    const session = sessions[index];
    const { course } = session;
    const candidates = [];

    for (const day of DAYS) {
      if (course.blockedDays.includes(day)) {
        continue;
      }

      for (const time of TIMES) {
        const timeRange = getSlotRange(time, session.duration);
        if (!timeRange || timeRange.some((slot) => blockedTimes.has(slot))) {
          continue;
        }

        const slotKeys = timeRange.map((slot) => `${day}-${slot}`);
        
        // Check if this course already uses this time slot on any other day
        const usedTimeSlots = courseTimeSlotUsage.get(course.id) || new Set();
        const timeSlotAlreadyUsed = timeRange.some((t) => usedTimeSlots.has(t));
        
        const facultyBusy = assignments.some(
          (item) => item.faculty === course.faculty && overlapsSlotKeys(item.slotKeys, slotKeys),
        );
        const roomBusy = (roomName) =>
          assignments.some((item) => item.room === roomName && overlapsSlotKeys(item.slotKeys, slotKeys));
        const sectionsBusy = assignments.some(
          (item) => overlapsSlotKeys(item.slotKeys, slotKeys) && item.sections.some((section) => course.sections.includes(section)),
        );
        const sameCourseOnDay = assignments.filter(
          (item) => item.courseId === course.id && item.day === day,
        );
        const sameCourseCount = sameCourseOnDay.reduce((total, item) => total + item.duration, 0);
        const candidateIndexes = timeRange.map((slot) => TIMES.indexOf(slot));

        const hasAdjacentForTeacher = assignments.some((item) => {
          if (item.faculty !== course.faculty || item.day !== day) {
            return false;
          }
          return item.slotKeys.some((key) => {
            const existingTime = key.split("-")[1];
            const existingIndex = TIMES.indexOf(existingTime);
            return candidateIndexes.some((candidateIndex) => Math.abs(candidateIndex - existingIndex) === 1);
          });
        });

        const sameCourseConsecutiveOrOverlap = sameCourseOnDay.some((item) => {
          return item.slotKeys.some((key) => {
            const existingTime = key.split("-")[1];
            const existingIndex = TIMES.indexOf(existingTime);
            return candidateIndexes.some((candidateIndex) => Math.abs(candidateIndex - existingIndex) <= 1);
          });
        });

        if (facultyBusy || sectionsBusy || sameCourseCount >= 2 || hasAdjacentForTeacher || sameCourseConsecutiveOrOverlap || timeSlotAlreadyUsed) {
          continue;
        }

        for (const room of rooms) {
          if (roomBusy(room.name)) {
            continue;
          }
          if (session.requiredRoomType === "lab" && room.type !== "lab") {
            continue;
          }
          if (room.capacity < course.studentCount) {
            continue;
          }
          candidates.push({
            day,
            time,
            timeRange,
            room,
            slotKeys,
            score: preferenceScore(course, day, time, room),
          });
        }
      }
    }

    candidates.sort((left, right) => right.score - left.score);

    for (const candidate of candidates) {
      assignments.push({
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
        timeLabel: candidate.timeRange.length > 1
          ? `${candidate.timeRange[0]}-${candidate.timeRange[candidate.timeRange.length - 1]}`
          : candidate.timeRange[0],
        preferenceBandMatched: course.preferredBands.includes(slotBand(candidate.time)),
        preferredDayMatched: course.preferredDays.includes(candidate.day),
      });
      
      // Track time slots used by this course to prevent repetition across days
      const usedSlots = courseTimeSlotUsage.get(course.id) || new Set();
      candidate.timeRange.forEach((time) => usedSlots.add(time));
      courseTimeSlotUsage.set(course.id, usedSlots);

      if (backtrack(index + 1)) {
        return true;
      }

      assignments.pop();
      // Backtrack: remove from tracking
      const trackedSlots = courseTimeSlotUsage.get(course.id);
      candidate.timeRange.forEach((time) => trackedSlots.delete(time));
    }

    conflicts.push({
      sessionId: session.id,
      courseName: course.courseName,
      faculty: course.faculty,
      sections: course.sections,
      reason: "No clash-free slot was available for this class under the current constraints.",
      suggestions: [
        `Relax ${course.faculty}'s time preference for ${course.courseName}.`,
        `Move ${course.courseName} to an alternate room if possible.`,
        `Split combined sections into separate sessions to reduce contention.`,
      ],
    });
    return false;
  }

  backtrack(0);

  const totalSessions = sessions.length;
  const scheduledSessions = assignments.reduce((total, item) => total + item.duration, 0);
  const totalHoursRequired = sessions.reduce((total, item) => total + item.duration, 0);
  const preferenceMatches = assignments.filter(
    (item) => item.preferenceBandMatched || item.preferredDayMatched,
  ).length;

  return {
    days: DAYS,
    times: TIMES,
    assignments,
    conflicts,
    metrics: {
      totalSessions,
      totalHoursRequired,
      scheduledSessions,
      unscheduledSessions: totalHoursRequired - scheduledSessions,
      satisfactionScore: totalSessions ? Math.round((preferenceMatches / totalSessions) * 100) : 0,
      generationTimeLabel: scheduledSessions ? "optimized" : "partial",
      substitutionCount: 0,
    },
    facultyLoad: parsed.courses.map((course) => {
      const facultyAssignments = assignments.filter((item) => item.faculty === course.faculty);
      const preferredHits = facultyAssignments.filter(
        (item) => item.preferenceBandMatched || item.preferredDayMatched,
      ).length;
      const requestedHours =
        course.requiredLecturesToCover ??
        course.theoryHoursPerWeek ??
        course.hoursPerWeek;

      return {
        faculty: course.faculty,
        courseName: course.courseName,
        scheduledHours: facultyAssignments.reduce((total, item) => total + item.duration, 0),
        requestedHours,
        matchPercent: requestedHours
          ? Math.round((preferredHits / requestedHours) * 100)
          : 0,
      };
    }),
  };
}

function applySubstitution(schedule, payload) {
  const absentTeacher = payload.absentTeacher;
  const substituteTeacher = payload.substituteTeacher;
  const targetDay = payload.day;
  const targetTime = payload.time;

  if (!absentTeacher || !substituteTeacher || !targetDay || !targetTime) {
    throw new Error("Absent teacher, substitute teacher, day, and time are required.");
  }

  if (absentTeacher === substituteTeacher) {
    throw new Error("Substitute teacher must be different from the absent teacher.");
  }

  const updated = cloneSchedule(schedule);
  const targetSlotKey = `${targetDay}-${targetTime}`;
  const assignment = updated.assignments.find((item) => {
    const owningTeacher = item.originalFaculty || item.faculty;
    return owningTeacher === absentTeacher && item.slotKeys.includes(targetSlotKey);
  });

  if (!assignment) {
    throw new Error("No class was found for the absent teacher in that slot.");
  }

  const substituteBusy = updated.assignments.some(
    (item) => item.id !== assignment.id && item.faculty === substituteTeacher && overlapsSlotKeys(item.slotKeys, assignment.slotKeys),
  );

  if (substituteBusy) {
    throw new Error("The substitute teacher already has a class in that period.");
  }

  assignment.originalFaculty = assignment.originalFaculty || absentTeacher;
  assignment.faculty = substituteTeacher;
  assignment.substitution = {
    absentTeacher,
    substituteTeacher,
    status: "approved",
    slot: targetSlotKey,
  };

  updated.metrics.substitutionCount = (updated.metrics.substitutionCount || 0) + 1;

  return {
    schedule: updated,
    substitution: assignment.substitution,
    message: `${substituteTeacher} is free and has been assigned to cover ${assignment.courseName}.`,
  };
}

function autoSubstituteForDay(schedule, payload) {
  const absentTeacher = payload.absentTeacher;
  const targetDay = payload.day;

  if (!absentTeacher || !targetDay) {
    throw new Error("Absent teacher and day are required.");
  }

  const updated = cloneSchedule(schedule);
  const teacherPool = getTeacherPool(updated);
  const dayAssignments = updated.assignments
    .filter((item) => (item.originalFaculty || item.faculty) === absentTeacher && item.day === targetDay)
    .sort((left, right) => left.time.localeCompare(right.time));

  if (!dayAssignments.length) {
    throw new Error("That teacher has no scheduled classes on the selected day.");
  }

  // Get all courses taught in the system to score subject similarity
  const coursesByTeacher = {};
  updated.assignments.forEach((item) => {
    const teacher = item.faculty;
    if (!coursesByTeacher[teacher]) coursesByTeacher[teacher] = new Set();
    coursesByTeacher[teacher].add(item.courseName);
  });

  const applied = [];
  const unresolved = [];

  for (const assignment of dayAssignments) {
    // Score each potential substitute teacher
    const substituteCandidates = teacherPool
      .filter((teacher) => teacher !== absentTeacher)
      .map((teacher) => {
        // Check if substitute is free at that time
        const isFree = !updated.assignments.some(
          (item) => item.id !== assignment.id && item.faculty === teacher && overlapsSlotKeys(item.slotKeys, assignment.slotKeys),
        );

        if (!isFree) return null;

        // Score based on similar courses they teach (subject expertise)
        const absenceTeacherCourses = coursesByTeacher[absentTeacher] || new Set();
        const substituteTeacherCourses = coursesByTeacher[teacher] || new Set();
        const commonCourses = [...absenceTeacherCourses].filter((c) => substituteTeacherCourses.has(c)).length;
        const similarityScore = commonCourses;

        return { teacher, isFree, similarityScore };
      })
      .filter(Boolean)
      .sort((a, b) => b.similarityScore - a.similarityScore);

    const substituteTeacher = substituteCandidates[0]?.teacher;

    if (!substituteTeacher) {
      unresolved.push({
        courseName: assignment.courseName,
        timeLabel: assignment.timeLabel,
        reason: "No free substitute teacher was available for this period.",
      });
      continue;
    }

    assignment.originalFaculty = assignment.originalFaculty || absentTeacher;
    assignment.faculty = substituteTeacher;
    assignment.substitution = {
      absentTeacher,
      substituteTeacher,
      courseName: assignment.courseName,
      status: "approved",
      slot: assignment.slotKeys[0],
    };

    applied.push({
      courseName: assignment.courseName,
      timeLabel: assignment.timeLabel,
      substituteTeacher,
    });
  }

  updated.metrics.substitutionCount = (updated.metrics.substitutionCount || 0) + applied.length;

  return {
    schedule: updated,
    applied,
    unresolved,
    message: `${applied.length} period(s) covered. ${unresolved.length} period(s) could not be covered.`,
  };
}

module.exports = {
  DAYS,
  TIMES,
  autoSubstituteForDay,
  applySubstitution,
  generateSchedule,
};
