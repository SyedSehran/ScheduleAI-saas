const { callOllama, checkOllamaStatus } = require("./ollamaHelper");
const { buildDemoData } = require("./demoScenario");

const defaultRooms = [
  { name: "Room 101", type: "lecture", capacity: 80 },
  { name: "Room 202", type: "lecture", capacity: 60 },
  { name: "Room 303", type: "lecture", capacity: 50 },
  { name: "Lab 1", type: "lab", capacity: 40 },
  { name: "Seminar Hall", type: "lecture", capacity: 120 },
];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseSections(raw) {
  if (!raw) {
    return [];
  }

  const cleaned = raw
    .replace(/\bcombined\b/gi, "")
    .replace(/\bsection\b/gi, "")
    .replace(/\bsections\b/gi, "")
    .replace(/[.]/g, "");

  return unique(
    cleaned
      .split(/\s*(?:,|and|&)\s*/i)
      .map((part) => part.trim())
      .filter((part) => /[A-Za-z]/.test(part)),
  );
}

function parsePreferenceBands(text) {
  const lowered = text.toLowerCase();
  const bands = [];
  if (lowered.includes("morning")) {
    bands.push("morning");
  }
  if (lowered.includes("afternoon")) {
    bands.push("afternoon");
  }
  if (lowered.includes("evening")) {
    bands.push("evening");
  }
  return bands;
}

function parsePreferredDays(text) {
  const matches = [];
  for (const day of days) {
    if (new RegExp(day, "i").test(text)) {
      matches.push(day);
    }
  }
  return matches;
}

function parseBlockedDays(text) {
  const blocked = [];
  for (const day of days) {
    if (new RegExp(`(?:avoid|avoids|not|skip|except)\\s+${day}`, "i").test(text)) {
      blocked.push(day);
    }
  }
  return blocked;
}

function normalizeCourse(course, index) {
  const theoryHoursPerWeek = Math.max(0, Number(course.theoryHoursPerWeek) || 0);
  const practicalHoursPerWeek = Math.max(0, Number(course.practicalHoursPerWeek) || 0);
  const derivedHoursPerWeek = Math.max(1, theoryHoursPerWeek + practicalHoursPerWeek || Number(course.hoursPerWeek) || 2);
  const requiredLecturesToCover = Math.max(
    0,
    Number(course.requiredLecturesToCover) || Number(course.requiredLectures) || theoryHoursPerWeek || derivedHoursPerWeek,
  );

  return {
    id: course.id || `course-${index + 1}`,
    courseName: course.courseName || `Course ${index + 1}`,
    faculty: course.faculty || course.teacherName || "TBD Faculty",
    sections: unique(course.sections?.length ? course.sections : ["General"]),
    theoryHoursPerWeek,
    practicalHoursPerWeek,
    requiredLecturesToCover,
    practicalSessionLength: Math.max(1, Number(course.practicalSessionLength) || 2),
    hoursPerWeek: derivedHoursPerWeek,
    preferredBands: unique(course.preferredBands || []),
    preferredDays: unique(course.preferredDays || []),
    blockedDays: unique(course.blockedDays || []),
    // Per-teacher availability: specific time slots this faculty cannot teach
    blockedTimes: unique(course.blockedTimes || []),
    roomPreference: course.roomPreference || "",
    roomType: course.roomType || "lecture",
    studentCount: Math.max(0, Number(course.studentCount) || 0),
    // Higher priority courses are scheduled first (conflict resolution ordering).
    // 0 = normal; higher integers = higher urgency (e.g. final-year, lab-heavy).
    priority: Math.max(0, Number(course.priority) || 0),
  };
}

function normalizeLockedSlot(slot, index) {
  return {
    id: slot.id || `locked-${index + 1}`,
    courseId: slot.courseId || "",
    courseName: slot.courseName || "",
    faculty: slot.faculty || "",
    sections: unique(slot.sections || []),
    room: slot.room || "",
    day: slot.day || "",
    time: slot.time || "",
    slotKeys: slot.slotKeys || (slot.day && slot.time ? [`${slot.day}-${slot.time}`] : []),
    timeLabel: slot.timeLabel || slot.time || "",
    sessionType: slot.sessionType || "theory",
    duration: Math.max(1, Number(slot.duration) || 1),
    locked: true,
    lockedReason: slot.lockedReason || slot.reason || "Admin-locked",
  };
}

function normalizeRooms(rooms) {
  const source = Array.isArray(rooms) && rooms.length ? rooms : defaultRooms;
  return source.map((room, index) => ({
    name: room.name || `Room ${index + 1}`,
    type: room.type || "lecture",
    capacity: Math.max(1, Number(room.capacity) || 40),
  }));
}

function normalizeInputData(inputData) {
  return {
    campusName: inputData?.campusName || "ScheduleAI Campus",
    prompt: inputData?.prompt || "",
    source: inputData?.source || "structured",
    rooms: normalizeRooms(inputData?.rooms),
    globalRules: {
      blockedTimes: unique(inputData?.globalRules?.blockedTimes || []),
      notes: unique(inputData?.globalRules?.notes || []),
      // Admin-locked slots: immutable pre-placed assignments
      lockedSlots: (inputData?.globalRules?.lockedSlots || []).map(normalizeLockedSlot),
    },
    courses: (inputData?.courses || []).map(normalizeCourse),
  };
}

function heuristicParse(prompt) {
  const demo = buildDemoData();
  const trimmed = (prompt || "").trim();
  if (!trimmed) {
    return demo;
  }

  const statements = trimmed
    .split(/\n+|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  const courses = [];
  const roomMentions = [...defaultRooms];
  const globalRules = {
    blockedTimes: [],
    notes: [],
  };

  for (const statement of statements) {
    const hoursMatch = statement.match(/(\d+)\s*(?:hrs?|hours?)\s*\/?\s*week/i);
    const roomMatch = statement.match(/(?:needs|prefers|in)\s+(Lab\s*\d+|Room\s*\d+|Seminar Hall)/i);
    const facultyMatch = statement.match(/((?:Dr|Prof)\.?\s+[A-Z][A-Za-z.\s]+?)\s+teaches\s+(.+?)\s+for\s+(.+?)(?:,|$)/i);

    if (facultyMatch) {
      const [, faculty, courseName, sectionText] = facultyMatch;
      const roomPreference = roomMatch ? roomMatch[1].trim() : "";
      const roomType = /lab/i.test(roomPreference) || /lab/i.test(statement) ? "lab" : "lecture";

      courses.push(
        normalizeCourse(
          {
            courseName: courseName.trim(),
            faculty: faculty.trim(),
            sections: parseSections(sectionText),
            hoursPerWeek: hoursMatch ? Number(hoursMatch[1]) : 2,
            preferredBands: parsePreferenceBands(statement),
            preferredDays: parsePreferredDays(statement),
            blockedDays: parseBlockedDays(statement),
            roomPreference,
            roomType,
          },
          courses.length,
        ),
      );

      if (roomPreference && !roomMentions.some((room) => room.name === roomPreference)) {
        roomMentions.push({
          name: roomPreference,
          type: roomType,
          capacity: roomType === "lab" ? 40 : 60,
        });
      }
      continue;
    }

    if (/lunch break/i.test(statement) || /12:00/i.test(statement)) {
      globalRules.blockedTimes.push("12:00");
      globalRules.notes.push(statement);
      continue;
    }

    if (/avoid/i.test(statement) || /block/i.test(statement)) {
      globalRules.notes.push(statement);
    }
  }

  if (!courses.length) {
    return {
      ...demo,
      prompt: trimmed,
      source: "demo-fallback",
      globalRules: {
        ...demo.globalRules,
        notes: [...demo.globalRules.notes, "Prompt could not be fully parsed, so the demo dataset was loaded."],
      },
    };
  }

  return {
    prompt: trimmed,
    source: "heuristic",
    rooms: roomMentions,
    globalRules: {
      blockedTimes: unique(globalRules.blockedTimes),
      notes: unique(globalRules.notes),
    },
    courses,
  };
}

async function ollmaParse(prompt) {
  const ollamaAvailable = await checkOllamaStatus();
  if (!ollamaAvailable) {
    return null;
  }

  const systemPrompt = `You are a JSON parser for academic scheduling. Always respond with valid JSON only.`;
  
  const userPrompt = `Parse this academic scheduling prompt into strict JSON with keys: rooms, globalRules, and courses. 
        
IMPORTANT SCHEDULING HINTS:
- Available time slots: 09:00, 10:00, 11:00, 13:00, 14:00, 15:00 (12:00-13:00 is lunch break)
- Spread each course's sessions across DIFFERENT days and DIFFERENT time slots to avoid repetition
- Set preferredDays to distribute courses evenly (e.g., Mon/Wed/Fri for 3-session course)
- Set practicalSessionLength to 2 hours for efficient lab scheduling
- Include notes about distribution strategy to help optimize scheduling

Prompt:
${prompt}

Respond ONLY with valid JSON, no other text.`;

  const text = await callOllama(userPrompt, systemPrompt);
  
  // Extract JSON from response (Ollama might include extra text)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[0] : text;
  const parsed = JSON.parse(jsonString);

  return {
    prompt,
    source: "ollama",
    rooms: (parsed.rooms?.length ? parsed.rooms : defaultRooms).map((room) => ({
      name: room.name,
      type: room.type || "lecture",
      capacity: Number(room.capacity) || 60,
    })),
    globalRules: {
      blockedTimes: unique(parsed.globalRules?.blockedTimes || []),
      notes: unique(parsed.globalRules?.notes || []),
    },
    courses: (parsed.courses || []).map(normalizeCourse),
  };
}

async function parsePrompt(prompt) {
  const heuristic = heuristicParse(prompt);

  try {
    const viaOllama = await ollmaParse(prompt);
    if (viaOllama?.courses?.length) {
      return viaOllama;
    }
  } catch (error) {
    return {
      ...heuristic,
      source: "heuristic-with-ollama-fallback",
      globalRules: {
        ...heuristic.globalRules,
        notes: [...heuristic.globalRules.notes, `Ollama parsing failed: ${error.message}`],
      },
    };
  }

  return heuristic;
}

module.exports = {
  parsePrompt,
  normalizeInputData,
};
