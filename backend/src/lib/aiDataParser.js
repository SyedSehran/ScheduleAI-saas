const { callOllama } = require("./ollamaHelper");

// Parse course data from text, CSV format, or natural language
async function parseCoursesFromText(text) {
  const prompt = `Parse this text and extract course information. Return a JSON array with courses.
Each course should have: faculty, courseName, sections, theoryHoursPerWeek, practicalHoursPerWeek, studentCount, preferredDays, blockedDays.

Text to parse:
${text}

Respond ONLY with valid JSON array of courses, no other text.`;

  try {
    const response = await callOllama(prompt, "You are a data extraction expert for academic scheduling.");
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const courses = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return Array.isArray(courses) ? courses : [];
  } catch (error) {
    console.error("Error parsing courses:", error.message);
    return [];
  }
}

async function parseCSVData(csvContent) {
  const prompt = `Parse this CSV data and extract course information for academic scheduling.
Return a JSON array where each row becomes a course object.
Map CSV headers to course fields: faculty, courseName, sections, theoryHoursPerWeek, practicalHoursPerWeek, studentCount.

CSV Data:
${csvContent}

Respond ONLY with valid JSON array, no other text.`;

  try {
    const response = await callOllama(prompt, "You are a CSV parsing expert.");
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const courses = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return Array.isArray(courses) ? courses : [];
  } catch (error) {
    console.error("Error parsing CSV:", error.message);
    return [];
  }
}

async function extractCoursesFromPrompt(userPrompt) {
  const prompt = `A user has provided scheduling requirements in natural language. Extract all courses and their details.
Return a JSON object with:
- courses: array of course objects
- campusName: if mentioned
- rooms: if mentioned
- globalRules: any mentioned constraints

User input:
${userPrompt}

Respond ONLY with valid JSON, no other text.`;

  try {
    const response = await callOllama(prompt, "You are an academic scheduling data extraction expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    return {
      courses: data.courses || [],
      campusName: data.campusName || "Campus",
      rooms: data.rooms || [],
      globalRules: data.globalRules || { blockedTimes: [], notes: [] },
    };
  } catch (error) {
    console.error("Error extracting from prompt:", error.message);
    return { courses: [], campusName: "Campus", rooms: [], globalRules: { blockedTimes: [], notes: [] } };
  }
}

// Validate and clean extracted data
async function validateExtractedData(data) {
  const prompt = `Validate and clean this extracted course data. Ensure all required fields are present and valid.
${JSON.stringify(data, null, 2)}

Fix or fill in missing data using reasonable defaults for academic scheduling.
Return the cleaned JSON.`;

  try {
    const response = await callOllama(prompt, "You are a data cleaning and validation expert.");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : response);
  } catch (error) {
    return data;
  }
}

module.exports = {
  parseCoursesFromText,
  parseCSVData,
  extractCoursesFromPrompt,
  validateExtractedData,
};
