const fs = require("fs");
const path = require("path");
const { callOllama } = require("./ollamaHelper");

const LEARNING_DB_FILE = path.join(__dirname, "../../learning_database.json");

// Initialize learning database
function initializeLearningDB() {
  if (!fs.existsSync(LEARNING_DB_FILE)) {
    const defaultDB = {
      teacherPreferences: {},
      scheduleHistory: [],
      patternDetections: [],
      successMetrics: {},
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(LEARNING_DB_FILE, JSON.stringify(defaultDB, null, 2));
    return defaultDB;
  }
  try {
    return JSON.parse(fs.readFileSync(LEARNING_DB_FILE, "utf-8"));
  } catch {
    return {
      teacherPreferences: {},
      scheduleHistory: [],
      patternDetections: [],
      successMetrics: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Save learning database
function saveLearningDB(db) {
  db.lastUpdated = new Date().toISOString();
  fs.writeFileSync(LEARNING_DB_FILE, JSON.stringify(db, null, 2));
}

async function recordTeacherPreferences(faculty, scheduleGeneration) {
  const db = initializeLearningDB();

  if (!db.teacherPreferences[faculty]) {
    db.teacherPreferences[faculty] = {
      preferredDays: {},
      preferredTimes: {},
      preferredRooms: {},
      acceptedSchedules: 0,
      rejectedSchedules: 0,
      feedbackHistory: [],
    };
  }

  const prefs = db.teacherPreferences[faculty];
  const prompt = `Analyze this teacher's schedule preferences and give feedback.

Faculty: ${faculty}
Generated Schedule: ${JSON.stringify(scheduleGeneration, null, 2)}
Acceptance Rate: ${prefs.acceptedSchedules}/${prefs.acceptedSchedules + prefs.rejectedSchedules}

Return JSON with:
1. userSatisfied (true/false)
2. preferredPatterns (array - days, times, room types)
3. avoidPatterns (array)
4. suggestions (array for future schedules)`;

  try {
    const response = await callOllama(prompt, "You are a teacher preference analyzer.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : response);

    if (analysis.userSatisfied) {
      prefs.acceptedSchedules += 1;
    } else {
      prefs.rejectedSchedules += 1;
    }

    prefs.feedbackHistory.push({
      timestamp: new Date().toISOString(),
      analysis,
      scheduleHash: JSON.stringify(scheduleGeneration).substring(0, 32),
    });

    saveLearningDB(db);
    return analysis;
  } catch (error) {
    console.error("Error recording preferences:", error.message);
    return { userSatisfied: null, preferredPatterns: [], avoidPatterns: [] };
  }
}

async function getAdaptiveSuggestions(faculty, pastSchedules = []) {
  const db = initializeLearningDB();
  const prefs = db.teacherPreferences[faculty] || {};

  const prompt = `Based on teacher preferences and history, give adaptive scheduling suggestions.

Teacher: ${faculty}
Acceptance History: ${prefs.acceptedSchedules || 0} accepted, ${prefs.rejectedSchedules || 0} rejected
Past Feedback: ${JSON.stringify(prefs.feedbackHistory?.slice(-5) || [], null, 2)}

Return JSON with:
1. recommendedDays (array ranked by preference)
2. recommendedTimes (array ranked by preference)
3. recommendedRoomTypes (array)
4. avoidDays (array to skip)
5. confidenceScore (0-100)
6. personalizationLevel (basic/moderate/advanced)`;

  try {
    const response = await callOllama(prompt, "You are a personalized scheduler.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch (error) {
    return {
      recommendedDays: ["Mon", "Tue", "Wed"],
      recommendedTimes: ["09:00-11:00", "11:00-13:00"],
      recommendedRoomTypes: ["lecture"],
      avoidDays: [],
      confidenceScore: 30,
      personalizationLevel: "basic",
    };
  }
}

async function detectPatterns(faculty) {
  const db = initializeLearningDB();
  const prefs = db.teacherPreferences[faculty];

  if (!prefs || prefs.feedbackHistory.length < 3) {
    return { patternsFound: false, reason: "Insufficient history" };
  }

  const prompt = `Analyze patterns in teacher scheduling preferences and feedback:

History: ${JSON.stringify(prefs.feedbackHistory, null, 2)}

Return JSON with:
1. patternsFound (true/false)
2. identifiedPatterns (array of patterns)
3. consistency (0-100)
4. predictability (0-100)
5. recommendations (array)`;

  try {
    const response = await callOllama(prompt, "You are a pattern recognition specialist.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const patterns = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    
    db.patternDetections.push({
      faculty,
      timestamp: new Date().toISOString(),
      patterns,
    });
    saveLearningDB(db);
    
    return patterns;
  } catch (error) {
    return { patternsFound: false, reason: "Analysis error" };
  }
}

async function predictScheduleSuccess(faculty, proposedSchedule) {
  const db = initializeLearningDB();
  const prefs = db.teacherPreferences[faculty];

  const prompt = `Predict if this proposed schedule will satisfy the teacher based on their history.

Faculty: ${faculty}
Proposed Schedule: ${JSON.stringify(proposedSchedule, null, 2)}
Teacher History: ${JSON.stringify(prefs?.feedbackHistory?.slice(-5) || [], null, 2)}

Return JSON with:
1. successProbability (0-100)
2. riskFactors (array)
3. strengthMatches (array - matches preferences)
4. suggestedTweaks (array - minor changes to improve success)
5. confidence (0-100)`;

  try {
    const response = await callOllama(prompt, "You are a prediction analyst for scheduling.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch (error) {
    return { successProbability: 50, confidence: 20, riskFactors: [], suggestedTweaks: [] };
  }
}

async function globalLearning(allSchedules) {
  const db = initializeLearningDB();
  
  db.scheduleHistory.push({
    timestamp: new Date().toISOString(),
    schedules: allSchedules,
    scheduleCount: allSchedules.length,
  });

  const prompt = `Analyze patterns across all generated schedules to identify global best practices:

Total Schedules Generated: ${db.scheduleHistory.length}
Recent Schedules: ${JSON.stringify(allSchedules, null, 2)}

Return JSON with:
1. globaBestPractices (array)
2. commonSuccessFactors (array)
3. frequentProblems (array)
4. departmentSpecificInsights (object)
5. recommendations (array for system improvement)`;

  try {
    const response = await callOllama(prompt, "You are a global scheduling advisor.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const learnings = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    
    db.successMetrics.lastAnalysis = learnings;
    saveLearningDB(db);
    
    return learnings;
  } catch (error) {
    return {
      globaBestPractices: [],
      commonSuccessFactors: [],
      frequentProblems: [],
      recommendations: [],
    };
  }
}

function getTeacherStats(faculty) {
  const db = initializeLearningDB();
  const prefs = db.teacherPreferences[faculty];

  if (!prefs) {
    return {
      faculty,
      schedulesGenerated: 0,
      acceptanceRate: 0,
      preferences: "No data",
    };
  }

  const total = prefs.acceptedSchedules + prefs.rejectedSchedules;
  return {
    faculty,
    schedulesGenerated: total,
    acceptanceRate: total > 0 ? Math.round((prefs.acceptedSchedules / total) * 100) : 0,
    acceptedCount: prefs.acceptedSchedules,
    rejectedCount: prefs.rejectedSchedules,
    feedbackRecords: prefs.feedbackHistory.length,
    lastFeedback: prefs.feedbackHistory[prefs.feedbackHistory.length - 1]?.timestamp,
  };
}

function getAllStats() {
  const db = initializeLearningDB();
  const stats = {};

  Object.keys(db.teacherPreferences).forEach(faculty => {
    stats[faculty] = getTeacherStats(faculty);
  });

  return {
    totalTeachers: Object.keys(db.teacherPreferences).length,
    totalSchedulesAnalyzed: db.scheduleHistory.length,
    lastGlobalAnalysis: db.successMetrics.lastAnalysis?.timestamp,
    teacherStats: stats,
  };
}

function resetLearning(faculty = null) {
  const db = initializeLearningDB();

  if (faculty) {
    delete db.teacherPreferences[faculty];
  } else {
    db.teacherPreferences = {};
    db.scheduleHistory = [];
    db.patternDetections = [];
  }

  saveLearningDB(db);
  return { success: true, message: faculty ? `Reset learning for ${faculty}` : "Reset all learning" };
}

module.exports = {
  recordTeacherPreferences,
  getAdaptiveSuggestions,
  detectPatterns,
  predictScheduleSuccess,
  globalLearning,
  getTeacherStats,
  getAllStats,
  resetLearning,
  initializeLearningDB,
  saveLearningDB,
};
