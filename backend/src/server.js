require("dotenv").config();

const express = require("express");
const cors = require("cors");
const icalModule = require("ical-generator");
const { connectDb } = require("./db");
const authRoutes = require("./routes/authRoutes");
const tenantResourceRoutes = require("./routes/tenantResourceRoutes");
const { requireAuth, requireRole } = require("./middleware/auth");
const { enforceTimetableLimit, recordTimetableUsage } = require("./middleware/usageLimit");
const { normalizeInputData, parsePrompt } = require("./lib/parser");
const { applySubstitution, autoSubstituteForDay, generateSchedule } = require("./lib/scheduler");
const { buildDemoData, demoPrompt } = require("./lib/demoScenario");
const { getHackathonDemoSchedule } = require("./lib/hackathonDemoSchedule");
const { callOllama, checkOllamaStatus } = require("./lib/ollamaHelper");
const { suggestCourseRequirements, suggestRoomAssignment, suggestPreferredDays, validateCourseData } = require("./lib/aiSmartInput");
const { parseCoursesFromText, parseCSVData, extractCoursesFromPrompt, validateExtractedData } = require("./lib/aiDataParser");
const { analyzeScheduleQuality, detectConflicts, suggestOptimizations, costAnalysis } = require("./lib/aiScheduleAnalyzer");
const { recordTeacherPreferences, getAdaptiveSuggestions, detectPatterns, predictScheduleSuccess, globalLearning, getTeacherStats, getAllStats, resetLearning } = require("./lib/aiLearningSystem");
const { autoGenerateSchedule, autoOptimizeSchedule } = require("./lib/aiAutoGeneration");
const { applyOptimizations, improveScheduleQuality } = require("./lib/autoOptimizer");
const { generateScheduleV2 } = require("./solver/index");
const {
  HARD_CONSTRAINTS,
  SOFT_CONSTRAINTS,
  checkHardConstraints,
  getSlotRange,
} = require("./solver/constraints");

const app = express();
const port = process.env.PORT || 4000;
const ical = icalModule.default || icalModule;

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Minimal security headers (helmet-style, dependency-free).
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use("/api/auth", authRoutes);
app.use("/api", tenantResourceRoutes);

async function resolveInput(body) {
  if (body?.inputData?.courses?.length) {
    return normalizeInputData(body.inputData);
  }

  return parsePrompt(body?.prompt || demoPrompt);
}

function nextWeekday(targetDayIndex) {
  const now = new Date();
  const result = new Date(now);
  const diff = (targetDayIndex + 7 - now.getDay()) % 7 || 7;
  result.setDate(now.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function buildCalendar(schedule, calendarName = "ScheduleAI Timetable") {
  const calendar = ical({ name: calendarName });
  const dayIndex = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
  };

  for (const item of schedule.assignments || []) {
    const eventDate = nextWeekday(dayIndex[item.day]);
    const [hours, minutes] = item.time.split(":").map(Number);
    const start = new Date(eventDate);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    calendar.createEvent({
      start,
      end,
      summary: `${item.courseName} (${item.sections.join(", ")})`,
      description: `Faculty: ${item.faculty}\nRoom: ${item.room}`,
      location: item.room,
    });
  }

  return calendar;
}

app.get("/api/health", async (_req, res) => {
  const ollamaAvailable = await checkOllamaStatus();
  res.json({
    ok: true,
    name: "ScheduleAI API",
    ollamaEnabled: ollamaAvailable,
  });
});

app.get("/api/demo", (_req, res) => {
  res.json(buildDemoData());
});

app.get("/api/demo/schedule", (_req, res) => {
  // Return pre-generated hackathon demo schedule with the demo data
  const demoData = buildDemoData();
  const demoSchedule = getHackathonDemoSchedule();
  res.json({
    ...demoData,
    ...demoSchedule,
  });
});

app.get("/api/demo/full", (_req, res) => {
  // Complete test data: courses + pre-generated schedule
  const demoData = buildDemoData();
  const demoSchedule = getHackathonDemoSchedule();
  res.json({
    parsed: demoData,
    schedule: demoSchedule.schedule,
    summary: demoSchedule.summary,
  });
});

// ============= AI AUTO-GENERATION: FULL AUTONOMY =============

app.post("/api/generate/auto", requireAuth, requireRole("owner", "admin"), enforceTimetableLimit(), async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "prompt is required. Describe your scheduling needs in natural language." });
      return;
    }

    const result = await autoGenerateSchedule(prompt);
    await recordTimetableUsage(req, { solver: "auto", source: "prompt" });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/optimize/auto", requireAuth, requireRole("owner", "admin"), async (req, res, next) => {
  try {
    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length || !parsed) {
      res.status(400).json({ error: "schedule and parsed data are required" });
      return;
    }

    const result = await autoOptimizeSchedule(schedule, parsed);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============= AUTO-APPLY OPTIMIZATIONS: Improve & Regenerate =============

app.post("/api/optimize/apply", requireAuth, requireRole("owner", "admin"), async (req, res, next) => {
  try {
    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length || !parsed) {
      res.status(400).json({ error: "schedule and parsed data are required" });
      return;
    }

    const result = await applyOptimizations(schedule, parsed);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/optimize/improve", requireAuth, requireRole("owner", "admin"), async (req, res, next) => {
  try {
    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "schedule is required" });
      return;
    }

    const result = await improveScheduleQuality(schedule, parsed);
    res.json(result);
  } catch (error) {
    next(error);
  }
});


app.post("/api/parse", requireAuth, async (req, res, next) => {
  try {
    res.json(await resolveInput(req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/schedule", requireAuth, requireRole("owner", "admin"), enforceTimetableLimit(), async (req, res, next) => {
  try {
    const parsed = await resolveInput(req.body);
    const schedule = generateSchedule(parsed);
    await recordTimetableUsage(req, { solver: "classic", source: parsed.source });

    res.json({
      parsed,
      schedule,
      summary: {
        source: parsed.source,
        headline: "Constraint-aware academic scheduler with explainable conflict intelligence",
        usage: req.usage ? { used: req.usage.used + 1, limit: req.usage.limit } : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/substitute", requireAuth, requireRole("owner", "admin"), (req, res, next) => {
  try {
    const schedule = req.body?.schedule;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule assignments are required before substitution." });
      return;
    }

    res.json(applySubstitution(schedule, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/substitute/day", requireAuth, requireRole("owner", "admin"), (req, res, next) => {
  try {
    const schedule = req.body?.schedule;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule assignments are required before substitution." });
      return;
    }

    res.json(autoSubstituteForDay(schedule, req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/export/ical", requireAuth, (req, res, next) => {
  try {
    const schedule = req.body?.schedule;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule assignments are required for iCal export." });
      return;
    }

    const calendar = buildCalendar(schedule, req.body?.calendarName);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=ScheduleAI.ics");
    res.send(calendar.toString());
  } catch (error) {
    next(error);
  }
});

app.post("/api/optimize/ai", requireAuth, async (req, res, next) => {
  try {
    const ollamaAvailable = await checkOllamaStatus();
    if (!ollamaAvailable) {
      res.json({
        suggestions: ["Start Ollama and pull a model (e.g., ollama pull neural-chat) to get AI-powered optimization suggestions."],
        analysis: "Ollama service not available at " + (process.env.OLLAMA_BASE_URL || "http://localhost:11434"),
      });
      return;
    }

    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule with assignments is required." });
      return;
    }

    // Analyze schedule for repetition patterns
    const timeSlotsByDay = {};
    const coursesByTimeSlot = {};
    
    for (const assignment of schedule.assignments || []) {
      const key = `${assignment.day}-${assignment.time}`;
      if (!timeSlotsByDay[assignment.day]) timeSlotsByDay[assignment.day] = [];
      timeSlotsByDay[assignment.day].push(assignment);
      
      if (!coursesByTimeSlot[key]) coursesByTimeSlot[key] = [];
      coursesByTimeSlot[key].push(assignment.courseName);
    }

    const summaryText = Object.entries(coursesByTimeSlot)
      .map(([slot, courses]) => `${slot}: ${courses.join(", ")}`)
      .join("\n");

    const userPrompt = `Analyze this academic schedule and provide 3-5 specific optimization suggestions to improve it. Focus on: (1) reducing repeated time slots for same courses, (2) better distribution across days, (3) maintaining 1-hour lunch break at 12:00-13:00, (4) spacing sessions with breaks.

Current Schedule by Time Slot:
${summaryText}

Provide actionable suggestions as a JSON array with "suggestion" and "reason" fields. Respond ONLY with valid JSON.`;

    const aiText = await callOllama(userPrompt, "You are an academic scheduling optimizer. Provide suggestions in JSON format only.");

    try {
      // Extract JSON from response
      const jsonMatch = aiText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiText;
      const suggestions = JSON.parse(jsonString);
      res.json({ suggestions, analysis: "Ollama-optimized recommendations generated." });
    } catch {
      res.json({
        suggestions: [{ suggestion: aiText, reason: "AI analysis generated" }],
        analysis: "Ollama analysis generated (parsed format).",
      });
    }
  } catch (error) {
    next(error);
  }
});

// ============= OPTION B: SMART INPUT SUGGESTIONS =============

app.post("/api/suggest/course-requirements", requireAuth, async (req, res, next) => {
  try {
    const { courseName, faculty } = req.body;
    if (!courseName) {
      res.status(400).json({ error: "courseName is required" });
      return;
    }

    const suggestions = await suggestCourseRequirements(courseName, faculty || "General");
    res.json({ courseName, suggestions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/suggest/room-assignment", requireAuth, async (req, res, next) => {
  try {
    const { courseType, studentCount, sessionType } = req.body;
    if (!courseType || !studentCount) {
      res.status(400).json({ error: "courseType and studentCount are required" });
      return;
    }

    const suggestions = await suggestRoomAssignment(courseType, studentCount, sessionType || "lecture");
    res.json({ suggestedRoom: suggestions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/suggest/preferred-days", requireAuth, async (req, res, next) => {
  try {
    const { courseName, theoryHours } = req.body;
    if (!courseName || !theoryHours) {
      res.status(400).json({ error: "courseName and theoryHours are required" });
      return;
    }

    const suggestions = await suggestPreferredDays(courseName, theoryHours);
    res.json({ courseName, suggestedDays: suggestions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/suggest/validate-course", requireAuth, async (req, res, next) => {
  try {
    const courseData = req.body?.courseData;
    if (!courseData) {
      res.status(400).json({ error: "courseData object is required" });
      return;
    }

    const validation = await validateCourseData(courseData);
    res.json({ courseData, validation });
  } catch (error) {
    next(error);
  }
});

// ============= OPTION C: DATA PARSING =============

app.post("/api/parse/text", requireAuth, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const parsed = await parseCoursesFromText(text);
    res.json({ source: "text", courses: parsed });
  } catch (error) {
    next(error);
  }
});

app.post("/api/parse/csv", requireAuth, async (req, res, next) => {
  try {
    const { csvContent } = req.body;
    if (!csvContent) {
      res.status(400).json({ error: "csvContent is required" });
      return;
    }

    const parsed = await parseCSVData(csvContent);
    res.json({ source: "csv", courses: parsed });
  } catch (error) {
    next(error);
  }
});

app.post("/api/parse/prompt", requireAuth, async (req, res, next) => {
  try {
    const { userPrompt } = req.body;
    if (!userPrompt) {
      res.status(400).json({ error: "userPrompt is required" });
      return;
    }

    const extracted = await extractCoursesFromPrompt(userPrompt);
    res.json({ source: "prompt", extracted });
  } catch (error) {
    next(error);
  }
});

// ============= OPTION D: SCHEDULE ANALYZER =============

app.post("/api/analyze/quality", requireAuth, async (req, res, next) => {
  try {
    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule with assignments is required" });
      return;
    }

    const analysis = await analyzeScheduleQuality(schedule, parsed);
    res.json({ quality: analysis });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze/conflicts", requireAuth, async (req, res, next) => {
  try {
    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule with assignments is required" });
      return;
    }

    const conflicts = await detectConflicts(schedule, parsed);
    res.json({ conflicts });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze/optimizations", requireAuth, async (req, res, next) => {
  try {
    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule with assignments is required" });
      return;
    }

    const optimizations = await suggestOptimizations(schedule, parsed);
    res.json({ optimizations });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze/cost", requireAuth, async (req, res, next) => {
  try {
    const { schedule, parsed } = req.body;
    if (!schedule?.assignments?.length) {
      res.status(400).json({ error: "Schedule with assignments is required" });
      return;
    }

    const cost = await costAnalysis(schedule, parsed);
    res.json({ costAnalysis: cost });
  } catch (error) {
    next(error);
  }
});

// ============= OPTION E: LEARNING SYSTEM =============

app.post("/api/learn/record-preference", requireAuth, async (req, res, next) => {
  try {
    const { faculty, scheduleGeneration } = req.body;
    if (!faculty || !scheduleGeneration) {
      res.status(400).json({ error: "faculty and scheduleGeneration are required" });
      return;
    }

    const recorded = await recordTeacherPreferences(faculty, scheduleGeneration);
    res.json({ faculty, recorded });
  } catch (error) {
    next(error);
  }
});

app.post("/api/learn/adaptive-suggestions", requireAuth, async (req, res, next) => {
  try {
    const { faculty } = req.body;
    if (!faculty) {
      res.status(400).json({ error: "faculty is required" });
      return;
    }

    const suggestions = await getAdaptiveSuggestions(faculty);
    res.json({ faculty, suggestions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/learn/detect-patterns", requireAuth, async (req, res, next) => {
  try {
    const { faculty } = req.body;
    if (!faculty) {
      res.status(400).json({ error: "faculty is required" });
      return;
    }

    const patterns = await detectPatterns(faculty);
    res.json({ faculty, patterns });
  } catch (error) {
    next(error);
  }
});

app.post("/api/learn/predict-success", requireAuth, async (req, res, next) => {
  try {
    const { faculty, proposedSchedule } = req.body;
    if (!faculty || !proposedSchedule) {
      res.status(400).json({ error: "faculty and proposedSchedule are required" });
      return;
    }

    const prediction = await predictScheduleSuccess(faculty, proposedSchedule);
    res.json({ faculty, prediction });
  } catch (error) {
    next(error);
  }
});

app.post("/api/learn/global-analysis", requireAuth, async (req, res, next) => {
  try {
    const { allSchedules } = req.body;
    if (!allSchedules || !Array.isArray(allSchedules)) {
      res.status(400).json({ error: "allSchedules array is required" });
      return;
    }

    const learnings = await globalLearning(allSchedules);
    res.json({ globalLearnings: learnings });
  } catch (error) {
    next(error);
  }
});

app.get("/api/learn/stats", requireAuth, (req, res, next) => {
  try {
    const stats = getAllStats();
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

app.get("/api/learn/teacher-stats/:faculty", requireAuth, (req, res, next) => {
  try {
    const { faculty } = req.params;
    const stats = getTeacherStats(faculty);
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

app.post("/api/learn/reset", requireAuth, requireRole("owner", "admin"), (req, res, next) => {
  try {
    const { faculty } = req.body;
    const result = resetLearning(faculty);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============= SOLVER V2: HYBRID BACKTRACKING + SIMULATED ANNEALING =============

/**
 * GET /api/constraints/spec
 * Returns the full constraint catalogue (hard + soft) with IDs, descriptions,
 * and penalty weights.  Useful for UI displays and documentation.
 */
app.get("/api/constraints/spec", (_req, res) => {
  res.json({
    hard: HARD_CONSTRAINTS,
    soft: SOFT_CONSTRAINTS,
    summary: {
      hardCount: HARD_CONSTRAINTS.length,
      softCount: SOFT_CONSTRAINTS.length,
      note: "Hard constraints must never be violated. Soft constraints are minimised via weighted penalty scoring.",
    },
  });
});

/**
 * POST /api/schedule/v2
 * Generate a timetable with the hybrid solver (backtracking + SA improver).
 * Accepts the same body as POST /api/schedule.
 *
 * Additional options in body:
 *   seed          {number}  – PRNG seed for reproducibility (default 42)
 *   timeoutMs     {number}  – total solver budget in ms (default 30000)
 *   multiStart    {number}  – number of independent solver runs (default 1)
 */
app.post("/api/schedule/v2", requireAuth, requireRole("owner", "admin"), enforceTimetableLimit(), async (req, res, next) => {
  try {
    const parsed = await resolveInput(req.body);
    const { seed, timeoutMs, multiStart } = req.body || {};

    const schedule = generateScheduleV2(parsed, {
      seed: seed != null ? Number(seed) : 42,
      timeoutMs: timeoutMs != null ? Number(timeoutMs) : 30000,
      multiStartCount: multiStart != null ? Number(multiStart) : 1,
    });
    await recordTimetableUsage(req, { solver: "v2", source: parsed.source });

    res.json({
      parsed,
      schedule,
      summary: {
        source: parsed.source,
        headline:
          "Hybrid solver: backtracking (MRV/LCV) + simulated-annealing improver with full constraint catalogue",
        totalPenalty: schedule.score?.totalPenalty ?? null,
        conflicts: schedule.conflicts?.length ?? 0,
        usage: req.usage ? { used: req.usage.used + 1, limit: req.usage.limit } : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analyze/realtime-conflicts
 * Check a single proposed assignment against an existing schedule for hard
 * constraint violations BEFORE it is saved.  This powers the UI's live
 * conflict detection during manual edits.
 *
 * Body:
 *   proposedAssignment {object} – the assignment the user wants to place:
 *     { courseId, courseName, faculty, sections, room (name string),
 *       day, time, duration, sessionType, studentCount? }
 *   currentAssignments {Array}  – already-placed assignments in the schedule
 *   parsed             {object} – optional normalised input for room lookups
 */
app.post("/api/analyze/realtime-conflicts", requireAuth, (req, res, next) => {
  try {
    const { proposedAssignment, currentAssignments, parsed } = req.body || {};

    if (!proposedAssignment) {
      res.status(400).json({ error: "proposedAssignment is required." });
      return;
    }

    const { day, time, room: roomName, duration = 1, sessionType = "theory" } =
      proposedAssignment;

    if (!day || !time || !roomName) {
      res.status(400).json({ error: "proposedAssignment must include day, time, and room." });
      return;
    }

    // Build room object for the check
    const roomsSource = parsed?.rooms || [];
    const roomObj = roomsSource.find((r) => r.name === roomName) || {
      name: roomName,
      type: sessionType === "practical" ? "lab" : "lecture",
      capacity: proposedAssignment.studentCount || 999,
    };

    // Build a minimal course shape for the constraint checker
    const course = {
      id: proposedAssignment.courseId || "unknown",
      courseName: proposedAssignment.courseName || "Unknown Course",
      faculty: proposedAssignment.faculty || "",
      sections: proposedAssignment.sections || [],
      studentCount: proposedAssignment.studentCount || 0,
      blockedDays: proposedAssignment.blockedDays || [],
      blockedTimes: proposedAssignment.blockedTimes || [],
    };

    // Build time range
    const timeRange = getSlotRange(time, Number(duration));
    if (!timeRange) {
      res.status(400).json({
        error: `Invalid time "${time}" or duration ${duration} for the configured timetable slots.`,
      });
      return;
    }
    const slotKeys = timeRange.map((t) => `${day}-${t}`);

    const session = {
      id: proposedAssignment.id || "proposed",
      course,
      duration: Number(duration),
      sessionType,
      requiredRoomType: sessionType === "practical" ? "lab" : "lecture",
    };

    const existing = Array.isArray(currentAssignments) ? currentAssignments : [];
    const rules = parsed?.globalRules || {};

    const { valid, violations } = checkHardConstraints(
      { day, time, timeRange, slotKeys, room: roomObj },
      session,
      existing,
      rules,
    );

    res.json({
      valid,
      violations,
      proposedSlot: { day, time, timeRange, room: roomName },
      message: valid
        ? "No hard constraint violations detected. Safe to save."
        : `${violations.length} hard constraint violation(s) found. Assignment cannot be saved as-is.`,
    });
  } catch (error) {
    next(error);
  }
});

// ============= ERROR HANDLING =============

// Unknown routes get a JSON 404 instead of an HTML express default page.
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Central error handler. Malformed JSON bodies become 400s; anything else is a
// 500 whose internals are only exposed outside production.
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  const isBadRequestBody = error?.type === "entity.parse.failed" || error?.type === "entity.too.large";
  const status = isBadRequestBody ? 400 : 500;

  if (status >= 500) {
    console.error("Unhandled error:", error);
  }

  res.status(status).json({
    error: isBadRequestBody
      ? "Request body must be valid JSON under 1MB."
      : "ScheduleAI hit an internal error.",
    detail: process.env.NODE_ENV === "production" && status >= 500 ? undefined : error.message,
  });
});

async function start() {
  await connectDb();
  const server = app.listen(port, () => {
    console.log(`ScheduleAI API listening on http://localhost:${port}`);
  });

  // Graceful shutdown so in-flight requests finish and Mongo closes cleanly.
  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down gracefully...`);
    server.close(async () => {
      const mongoose = require("mongoose");
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Failed to start ScheduleAI API:", error);
    process.exit(1);
  });
}

module.exports = { app, start };
