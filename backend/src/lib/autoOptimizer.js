// Auto-optimize schedule by applying AI suggestions directly
const { callOllama } = require("./ollamaHelper");

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];

async function applyOptimizations(schedule, parsed) {
  console.log("🔧 Applying AI optimizations to schedule...");

  try {
    // Get optimization suggestions
    const suggestionPrompt = `Analyze this schedule and suggest specific, actionable changes to make it better.

Current Schedule:
${JSON.stringify(schedule.assignments?.slice(0, 10) || [], null, 2)}

Return JSON with an array of optimizations, each with:
- targetCourse (course to move)
- currentDay (current day)
- currentTime (current time)
- newDay (suggested new day)
- newTime (suggested new time)
- reason (why this change is beneficial)

Only suggest changes that reduce conflicts and improve balance.`;

    let optimizations = [];
    try {
      const response = await callOllama(suggestionPrompt, "You are a schedule optimization expert.");
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        optimizations = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("Could not get AI suggestions, using basic optimizations");
      optimizations = generateBasicOptimizations(schedule);
    }

    // Apply the optimizations
    let improvedSchedule = JSON.parse(JSON.stringify(schedule));
    let appliedCount = 0;

    for (const opt of optimizations) {
      if (!opt.targetCourse || !opt.newDay || !opt.newTime) continue;

      // Find assignments matching the course and current time
      const assignments = improvedSchedule.assignments.filter(
        a => a.courseName?.toLowerCase().includes(opt.targetCourse.toLowerCase()) &&
             (!opt.currentDay || a.day === opt.currentDay) &&
             (!opt.currentTime || a.time === opt.currentTime)
      );

      for (const assignment of assignments) {
        // Check if new time slot is available
        const conflicted = improvedSchedule.assignments.some(
          a => a.day === opt.newDay &&
               a.time === opt.newTime &&
               (a.faculty === assignment.faculty || a.room === assignment.room) &&
               a.id !== assignment.id
        );

        if (!conflicted && DAYS.includes(opt.newDay) && TIMES.includes(opt.newTime)) {
          assignment.day = opt.newDay;
          assignment.time = opt.newTime;
          appliedCount++;
          console.log(`✅ Moved ${opt.targetCourse} to ${opt.newDay} ${opt.newTime}`);
        }
      }
    }

    console.log(`✅ Applied ${appliedCount} optimizations`);

    return {
      success: true,
      originalSchedule: schedule,
      improvedSchedule: improvedSchedule,
      optimizationsApplied: appliedCount,
      changes: optimizations.filter(opt => appliedCount > 0).slice(0, 5),
      message: `Successfully applied ${appliedCount} improvements to the schedule`,
    };
  } catch (error) {
    console.error("Error applying optimizations:", error.message);
    return {
      success: false,
      error: error.message,
      originalSchedule: schedule,
    };
  }
}

function generateBasicOptimizations(schedule) {
  // Basic heuristic optimizations if AI fails
  const optimizations = [];
  
  // Find courses scheduled at same time and move one
  const timeSlots = {};
  (schedule.assignments || []).forEach(a => {
    const key = `${a.day}-${a.time}`;
    if (!timeSlots[key]) timeSlots[key] = [];
    timeSlots[key].push(a);
  });

  Object.entries(timeSlots).forEach(([slot, assignments]) => {
    if (assignments.length > 1) {
      const [first, ...rest] = assignments;
      rest.forEach(a => {
        const newDay = DAYS.find(d => !timeSlots[`${d}-${a.time}`]);
        if (newDay) {
          optimizations.push({
            targetCourse: a.courseName,
            currentDay: a.day,
            currentTime: a.time,
            newDay: newDay,
            newTime: a.time,
            reason: "Reduce scheduling conflicts by spreading courses across different days",
          });
        }
      });
    }
  });

  return optimizations;
}

async function improveScheduleQuality(schedule, parsed) {
  console.log("✨ Improving schedule quality with AI...");

  try {
    // Get current metrics
    const metrics = analyzeScheduleMetrics(schedule);

    const prompt = `Improve this schedule to achieve better quality:

Current Metrics:
- Teacher Load: ${metrics.teacherLoadBalance}
- Room Utilization: ${metrics.roomUtilization}%
- Free Slots: ${metrics.freeSlots}
- Conflicts: ${metrics.conflicts}

Suggest specific swaps and movements to improve these metrics.
Return JSON with: swaps (array of {course1, course2, reason}), redistributeList (array of {course, newSlots})`;

    let improvements = { swaps: [], redistributeList: [] };
    try {
      const response = await callOllama(prompt, "You are a schedule improvement expert.");
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        improvements = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("AI improvement failed, applying heuristics");
    }

    // Apply improvements
    let improvedSchedule = JSON.parse(JSON.stringify(schedule));
    let changesMade = 0;

    // Apply swaps
    for (const swap of improvements.swaps || []) {
      const course1 = improvedSchedule.assignments.find(a => 
        a.courseName?.toLowerCase().includes(swap.course1?.toLowerCase())
      );
      const course2 = improvedSchedule.assignments.find(a => 
        a.courseName?.toLowerCase().includes(swap.course2?.toLowerCase())
      );

      if (course1 && course2) {
        [course1.day, course2.day] = [course2.day, course1.day];
        [course1.time, course2.time] = [course2.time, course1.time];
        changesMade++;
      }
    }

    const newMetrics = analyzeScheduleMetrics(improvedSchedule);

    return {
      success: true,
      originalMetrics: metrics,
      improvedMetrics: newMetrics,
      improvedSchedule: improvedSchedule,
      changesMade: changesMade,
      improvementSummary: {
        loadBalance: `${metrics.teacherLoadBalance} → ${newMetrics.teacherLoadBalance}`,
        utilization: `${metrics.roomUtilization}% → ${newMetrics.roomUtilization}%`,
        conflictReduction: metrics.conflicts - newMetrics.conflicts,
      },
    };
  } catch (error) {
    console.error("Error improving schedule:", error.message);
    return {
      success: false,
      error: error.message,
      originalSchedule: schedule,
    };
  }
}

function analyzeScheduleMetrics(schedule) {
  const assignments = schedule.assignments || [];

  // Teacher load balance
  const teacherHours = {};
  assignments.forEach(a => {
    teacherHours[a.faculty] = (teacherHours[a.faculty] || 0) + (a.duration || 1);
  });
  const hours = Object.values(teacherHours);
  const avgHours = hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
  const loadBalance = hours.length > 0 ? (Math.max(...hours) - Math.min(...hours)) / avgHours : 0;

  // Room utilization
  const totalSlots = 30; // 6 times × 5 days
  const usedSlots = new Set(
    assignments.flatMap(a => (a.slotKeys || []))
  ).size;
  const utilization = Math.round((usedSlots / totalSlots) * 100);

  // Count conflicts
  const conflictCount = countConflicts(assignments);

  // Free slots
  const freeSlots = totalSlots - usedSlots;

  return {
    teacherLoadBalance: loadBalance.toFixed(2),
    roomUtilization: utilization,
    conflicts: conflictCount,
    freeSlots: freeSlots,
    totalAssignments: assignments.length,
  };
}

function countConflicts(assignments) {
  let conflicts = 0;
  const slotMap = {};

  assignments.forEach(a => {
    (a.slotKeys || []).forEach(slot => {
      if (!slotMap[slot]) slotMap[slot] = [];
      slotMap[slot].push(a);
    });
  });

  Object.values(slotMap).forEach(slotAssignments => {
    if (slotAssignments.length > 1) {
      // Check for actual conflicts (same room or faculty)
      for (let i = 0; i < slotAssignments.length; i++) {
        for (let j = i + 1; j < slotAssignments.length; j++) {
          if (slotAssignments[i].room === slotAssignments[j].room ||
              slotAssignments[i].faculty === slotAssignments[j].faculty) {
            conflicts++;
          }
        }
      }
    }
  });

  return conflicts;
}

module.exports = {
  applyOptimizations,
  improveScheduleQuality,
  analyzeScheduleMetrics,
};
