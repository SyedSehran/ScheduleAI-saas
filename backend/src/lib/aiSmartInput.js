const { callOllama } = require("./ollamaHelper");

// Smart suggestions for auto-complete and recommendations
async function suggestCourseRequirements(courseName, faculty) {
  const prompt = `Given a course named "${courseName}" taught by "${faculty}", suggest:
1. Typical theory hours per week (1-5)
2. Typical practical hours per week (0-4)
3. Student count estimate (30-120)
4. Recommended room type (lecture or lab)
5. Practical session length (1 or 2 hours)

Respond in JSON format with keys: theoryHours, practicalHours, studentCount, roomType, practicalSessionLength`;

  try {
    const response = await callOllama(prompt, "You are an academic planning expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return result;
  } catch (error) {
    return null;
  }
}

async function suggestRoomAssignment(courseType, studentCount, sessionType) {
  const prompt = `For a ${sessionType} session of "${courseType}" with ${studentCount} students, suggest:
1. Room type needed (lecture or lab)
2. Minimum room capacity
3. Recommended room features

Respond in JSON format with keys: roomType, minCapacity, features`;

  try {
    const response = await callOllama(prompt, "You are a room planning expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return result;
  } catch (error) {
    return null;
  }
}

async function suggestPreferredDays(courseName, theoryHours) {
  const prompt = `For a course "${courseName}" with ${theoryHours} theory hours per week, suggest:
1. Best days to distribute sessions (e.g., Monday, Wednesday, Friday)
2. Preferred time bands (morning, afternoon, evening)
3. Reasoning

Respond in JSON format with keys: preferredDays, preferredBands, reasoning`;

  try {
    const response = await callOllama(prompt, "You are a scheduling expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return result;
  } catch (error) {
    return null;
  }
}

async function validateCourseData(courseData) {
  const prompt = `Validate this course data for academic scheduling and suggest improvements:
${JSON.stringify(courseData, null, 2)}

Check for:
1. Realistic hour allocations
2. Room capacity vs student count
3. Time preference conflicts
4. Missing information

Respond in JSON format with keys: isValid, issues (array), suggestions (array)`;

  try {
    const response = await callOllama(prompt, "You are a data validation expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return result;
  } catch (error) {
    return null;
  }
}

module.exports = {
  suggestCourseRequirements,
  suggestRoomAssignment,
  suggestPreferredDays,
  validateCourseData,
};
