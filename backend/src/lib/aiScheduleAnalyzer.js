const { callOllama } = require("./ollamaHelper");

async function analyzeScheduleQuality(schedule, parsed) {
  const analysisData = {
    totalAssignments: schedule.assignments?.length || 0,
    unscheduledCourses: schedule.conflicts?.length || 0,
    averageUtilization: calculateUtilization(schedule),
    peakHours: identifyPeakHours(schedule),
    teacherWorkload: calculateTeacherLoad(schedule, parsed),
    roomUsage: calculateRoomUsage(schedule),
  };

  const prompt = `Analyze this academic schedule and provide a detailed quality assessment.

Schedule Analysis:
${JSON.stringify(analysisData, null, 2)}

Provide a JSON response with:
1. overallScore (0-100)
2. strengths (array of positive aspects)
3. weaknesses (array of issues)
4. riskFactors (array of potential problems)
5. recommendations (array of specific improvements)

Analyze for: fairness of teacher load, room utilization, student convenience, cost efficiency, conflict potential.`;

  try {
    const response = await callOllama(prompt, "You are an academic scheduling quality expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch (error) {
    console.error("Error analyzing schedule:", error.message);
    return defaultAnalysis();
  }
}

async function detectConflicts(schedule, parsed) {
  const conflicts = {
    directConflicts: findDirectConflicts(schedule),
    teacherOverload: identifyTeacherOverload(schedule),
    roomConflicts: identifyRoomConflicts(schedule),
    studentConflicts: identifySectionConflicts(schedule),
  };

  const prompt = `Identify potential conflicts and problems in this academic schedule:
${JSON.stringify(conflicts, null, 2)}

Return JSON with:
1. criticalIssues (must fix)
2. warnings (should fix)
3. suggestions (nice to fix)
Each with: issue description, affected parties, severity (1-5), resolution options.`;

  try {
    const response = await callOllama(prompt, "You are a scheduling conflict detection expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch (error) {
    return { criticalIssues: [], warnings: [], suggestions: [] };
  }
}

async function suggestOptimizations(schedule, parsed) {
  const currentState = {
    scheduledHours: schedule.assignments?.reduce((sum, a) => sum + a.duration, 0) || 0,
    totalRooms: parsed.rooms?.length || 0,
    totalTeachers: [...new Set(schedule.assignments?.map(a => a.faculty))].length,
    utilizationRate: calculateUtilization(schedule),
  };

  const prompt = `Suggest specific, actionable optimizations for this academic schedule:
${JSON.stringify(currentState, null, 2)}

Conflicts: ${schedule.conflicts?.length || 0}
Assignment success rate: ${schedule.assignments?.length || 0}/${parsed.courses?.length || 1}

Return JSON with:
1. immediateOptimizations (can implement now)
2. structuralImprovements (require changes)
3. longTermStrategies (for future planning)

Each optimization with: description, expectedImprovement, difficulty, timeRequired.`;

  try {
    const response = await callOllama(prompt, "You are an academic scheduling strategist.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch (error) {
    return { immediateOptimizations: [], structuralImprovements: [], longTermStrategies: [] };
  }
}

async function costAnalysis(schedule, parsed) {
  const analysis = {
    roomUtilization: calculateRoomUsage(schedule),
    teacherEfficiency: calculateTeacherLoad(schedule, parsed),
    slotsUsed: (schedule.assignments?.reduce((sum, a) => sum + 1, 0) || 0),
    totalSlots: 30, // 6 time slots × 5 days
  };

  const prompt = `Perform a cost and resource efficiency analysis:
${JSON.stringify(analysis, null, 2)}

Provide JSON with:
1. estimatedCost (relative to baseline)
2. efficiencyMetrics (object with named metrics)
3. savingOpportunities (array)
4. investmentNeeds (array)

Consider: room rental/utilities, teacher hours, facility usage.`;

  try {
    const response = await callOllama(prompt, "You are an educational cost analyst.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch (error) {
    return { estimatedCost: "baseline", efficiencyMetrics: {}, savingOpportunities: [], investmentNeeds: [] };
  }
}

// Helper functions
function calculateUtilization(schedule) {
  const totalSlots = 30; // 6 times × 5 days
  const usedSlots = new Set(
    (schedule.assignments || []).flatMap(a => a.slotKeys || [])
  ).size;
  return Math.round((usedSlots / totalSlots) * 100);
}

function identifyPeakHours(schedule) {
  const slotCount = {};
  (schedule.assignments || []).forEach(a => {
    (a.slotKeys || []).forEach(slot => {
      slotCount[slot] = (slotCount[slot] || 0) + 1;
    });
  });
  return Object.entries(slotCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slot, count]) => ({ slot, classCount: count }));
}

function calculateTeacherLoad(schedule, parsed) {
  const load = {};
  (schedule.assignments || []).forEach(a => {
    const faculty = a.faculty;
    if (!load[faculty]) {
      load[faculty] = { hours: 0, classes: 0 };
    }
    load[faculty].hours += a.duration || 1;
    load[faculty].classes += 1;
  });
  return load;
}

function calculateRoomUsage(schedule) {
  const usage = {};
  (schedule.assignments || []).forEach(a => {
    const room = a.room;
    if (!usage[room]) {
      usage[room] = 0;
    }
    usage[room] += 1;
  });
  return usage;
}

function findDirectConflicts(schedule) {
  const conflicts = [];
  const slotMap = {};
  
  (schedule.assignments || []).forEach(a => {
    (a.slotKeys || []).forEach(slot => {
      if (!slotMap[slot]) slotMap[slot] = [];
      slotMap[slot].push(a);
    });
  });

  Object.entries(slotMap).forEach(([slot, assignments]) => {
    if (assignments.length > 1) {
      conflicts.push({ slot, count: assignments.length });
    }
  });
  
  return conflicts;
}

function identifyTeacherOverload(schedule) {
  const teacherSlots = {};
  (schedule.assignments || []).forEach(a => {
    if (!teacherSlots[a.faculty]) teacherSlots[a.faculty] = 0;
    teacherSlots[a.faculty] += a.duration || 1;
  });
  
  return Object.entries(teacherSlots)
    .filter(([_, hours]) => hours > 12)
    .map(([teacher, hours]) => ({ teacher, hours, overload: hours - 12 }));
}

function identifyRoomConflicts(schedule) {
  const roomSlots = {};
  (schedule.assignments || []).forEach(a => {
    (a.slotKeys || []).forEach(slot => {
      const key = `${a.room}-${slot}`;
      roomSlots[key] = (roomSlots[key] || 0) + 1;
    });
  });
  
  return Object.entries(roomSlots)
    .filter(([_, count]) => count > 1)
    .map(([key, count]) => ({ slot: key, conflicts: count }));
}

function identifySectionConflicts(schedule) {
  const sectionSlots = {};
  (schedule.assignments || []).forEach(a => {
    (a.sections || []).forEach(section => {
      (a.slotKeys || []).forEach(slot => {
        const key = `${section}-${slot}`;
        sectionSlots[key] = (sectionSlots[key] || 0) + 1;
      });
    });
  });
  
  return Object.entries(sectionSlots)
    .filter(([_, count]) => count > 1)
    .map(([key, count]) => ({ sectionSlot: key, conflicts: count }));
}

function defaultAnalysis() {
  return {
    overallScore: 0,
    strengths: [],
    weaknesses: ["Unable to analyze - no data"],
    riskFactors: [],
    recommendations: [],
  };
}

module.exports = {
  analyzeScheduleQuality,
  detectConflicts,
  suggestOptimizations,
  costAnalysis,
};
