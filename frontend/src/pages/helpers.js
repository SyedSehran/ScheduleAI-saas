/** Pure helpers shared by the schedule pages (no React imports needed). */

export const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const defaultTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']

export function emptyCourse(index = 1) {
  return {
    id: `manual-course-${index}`,
    faculty: '',
    courseName: '',
    sections: ['CSE-A'],
    theoryHoursPerWeek: 3,
    practicalHoursPerWeek: 0,
    practicalSessionLength: 2,
    preferredBands: ['morning'],
    preferredDays: [],
    blockedDays: [],
    roomPreference: '',
    roomType: 'lecture',
    studentCount: 40,
    requiredLecturesToCover: 3,
  }
}

/** Normalise any parsed payload (API demo data, imported Excel…) to planner shape. */
export function plannerFromData(data) {
  return {
    campusName: data.campusName || 'ScheduleAI Campus',
    rooms: data.rooms || [],
    globalRules: data.globalRules || { blockedTimes: ['12:00'], notes: [] },
    courses: (data.courses || []).map((course, index) => ({
      id: course.id || `course-${index + 1}`,
      faculty: course.faculty || '',
      courseName: course.courseName || '',
      sections: course.sections || [],
      theoryHoursPerWeek: course.theoryHoursPerWeek ?? course.hoursPerWeek ?? 3,
      practicalHoursPerWeek: course.practicalHoursPerWeek ?? 0,
      practicalSessionLength: course.practicalSessionLength ?? 2,
      preferredBands: course.preferredBands?.length ? course.preferredBands : ['morning'],
      preferredDays: course.preferredDays || [],
      blockedDays: course.blockedDays || [],
      roomPreference: course.roomPreference || '',
      roomType: course.roomType || 'lecture',
      studentCount: course.studentCount || 40,
      requiredLecturesToCover: course.requiredLecturesToCover ?? course.theoryHoursPerWeek ?? 3,
    })),
  }
}

export function splitCsv(value) {
  return String(value).split(',').map((item) => item.trim()).filter(Boolean)
}

export function teacherList(parsed, schedule) {
  const teachers = new Set()
  ;(parsed?.courses || []).forEach((course) => teachers.add(course.faculty))
  ;(schedule?.assignments || []).forEach((item) => {
    teachers.add(item.faculty)
    if (item.originalFaculty) teachers.add(item.originalFaculty)
  })
  return [...teachers].filter(Boolean)
}

export function slotAssignments(schedule, day, time) {
  const slotKey = `${day}-${time}`
  return (schedule?.assignments || []).filter((item) => item.slotKeys?.includes(slotKey))
}

export function cellText(schedule, day, time) {
  const items = slotAssignments(schedule, day, time)
  if (!items.length) {
    return 'Free'
  }

  return items
    .map((item) => {
      const substitute = item.originalFaculty ? ` | for ${item.originalFaculty}` : ''
      return `${item.courseName}\n${item.faculty}${substitute}\n${item.sections.join(', ')} | ${item.room}`
    })
    .join('\n\n')
}

export function downloadBlob(content, fileName, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// Consistent per-course colour chips for timetable cells.
const courseColors = [
  { bg: '#FEE2E2', text: '#7F1D1D', border: '#FECACA' },
  { bg: '#FEF3C7', text: '#78350F', border: '#FCD34D' },
  { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' },
  { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
  { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
  { bg: '#FCE7F3', text: '#831843', border: '#FBCFE8' },
  { bg: '#FFF7ED', text: '#7C2D12', border: '#FED7AA' },
]

export function getCourseColor(courseId, courseIndex = 0) {
  const id = String(courseId || courseIndex)
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash = hash & hash // force 32-bit integer
  }
  return courseColors[Math.abs(hash) % courseColors.length]
}
