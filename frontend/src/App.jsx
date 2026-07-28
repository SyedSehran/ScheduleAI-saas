import { useEffect, useState, useTransition } from 'react'
import axios from 'axios'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import {
  CalendarDays,
  Download,
  FileUp,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  UserMinus,
  Home,
  Book,
  Users,
  Settings,
  LayoutGrid,
  LogOut,
  User,
} from 'lucide-react'
import StudentLogin from './StudentLogin'
import studentsData from './studentsData'

const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const defaultTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']

function emptyCourse(index = 1) {
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
    requiredLecturesToCover: 3, // New field: lectures needed to complete syllabus
  }
}

function plannerFromData(data) {
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

function splitCsv(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function teacherList(parsed, schedule) {
  const teachers = new Set()
  ;(parsed?.courses || []).forEach((course) => teachers.add(course.faculty))
  ;(schedule?.assignments || []).forEach((item) => {
    teachers.add(item.faculty)
    if (item.originalFaculty) teachers.add(item.originalFaculty)
  })
  return [...teachers].filter(Boolean)
}

function slotAssignments(schedule, day, time) {
  const slotKey = `${day}-${time}`
  return (schedule?.assignments || []).filter((item) => item.slotKeys.includes(slotKey))
}

function cellText(schedule, day, time) {
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

function downloadBlob(content, fileName, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// Color palette for courses - consistent vibrant colors
const courseColors = [
  { bg: '#FEE2E2', text: '#7F1D1D', border: '#FECACA' }, // Red
  { bg: '#FEF3C7', text: '#78350F', border: '#FCD34D' }, // Amber
  { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' }, // Green
  { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' }, // Cyan
  { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' }, // Indigo
  { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' }, // Purple
  { bg: '#FCE7F3', text: '#831843', border: '#FBCFE8' }, // Pink
  { bg: '#FFF7ED', text: '#7C2D12', border: '#FED7AA' }, // Orange
]

function getCourseColor(courseId, courseIndex = 0) {
  // Create a consistent hash from course ID
  // Fallback to courseIndex if courseId is not provided, and ensure it's a string
  const id = String(courseId || courseIndex)
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  const colorIndex = Math.abs(hash) % courseColors.length
  return courseColors[colorIndex]
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium" style={{ color: '#475569' }}>{label}</span>
      {children}
    </label>
  )
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
      style={{
        borderColor: '#E5E7EB',
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
      }}
      onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
    />
  )
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
      style={{
        borderColor: '#E5E7EB',
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
      }}
      onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
    />
  )
}

function App() {
  // Login State
  const [loggedInStudent, setLoggedInStudent] = useState(null)

  const [planner, setPlanner] = useState({
    campusName: 'ScheduleAI Campus',
    rooms: [],
    globalRules: { blockedTimes: ['12:00'], notes: [] },
    courses: [emptyCourse()],
  })
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [apiStatus, setApiStatus] = useState('Connecting...')
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [autoSubSummary, setAutoSubSummary] = useState(null)
  const [absence, setAbsence] = useState({ absentTeacher: '', day: 'Monday', startDate: null })
  const [isPending, startTransition] = useTransition()
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [expandedCourse, setExpandedCourse] = useState('')
  const [markedAbsences, setMarkedAbsences] = useState({}) // Track teacher absences across dates
  const [showRequiredLectures, setShowRequiredLectures] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isApplyingOptimizations, setIsApplyingOptimizations] = useState(false)

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const [{ data: health }, { data: demo }, { data: demoSchedule }] = await Promise.all([
          axios.get('/api/health'),
          axios.get('/api/demo'),
          axios.get('/api/demo/full').catch(() => ({ data: null })), // Fallback if endpoint doesn't exist
        ])
        if (!active) return
        setApiStatus(health.ollamaEnabled ? 'Ollama AI ready' : 'Planner ready')
        setPlanner(plannerFromData(demo))
        
        // Pre-load with complete hackathon demo data if available
        if (demoSchedule?.parsed && demoSchedule?.schedule) {
          setData({ parsed: demoSchedule.parsed, schedule: demoSchedule.schedule })
          setMessage('✨ Loaded TechVision Institute demo schedule (41 courses, 1273 students, 4 departments)')
        } else {
          setData({ parsed: demo, schedule: null })
        }
      } catch {
        if (!active) return
        setApiStatus('Backend offline')
        setError('Start the backend at http://localhost:4000 to use ScheduleAI.')
      }
    }
    bootstrap()
    return () => {
      active = false
    }
  }, [])

  const parsed = data?.parsed
  const schedule = data?.schedule
  const teachers = teacherList(parsed, schedule)
  const days = schedule?.days || defaultDays
  const times = schedule?.times || defaultTimes
  const metrics = schedule?.metrics || {}

  function setCourse(index, field, value) {
    setPlanner((current) => ({
      ...current,
      courses: current.courses.map((course, courseIndex) => (courseIndex === index ? { ...course, [field]: value } : course)),
    }))
  }

  function addCourse() {
    setPlanner((current) => ({ ...current, courses: [...current.courses, emptyCourse(current.courses.length + 1)] }))
  }

  function deleteCourse(index) {
    if (planner.courses.length === 1) {
      setError('You must have at least one course.')
      return
    }
    setPlanner((current) => ({
      ...current,
      courses: current.courses.filter((_, i) => i !== index),
    }))
    setExpandedCourse('')
    setMessage('Course deleted successfully.')
  }

  function generateSchedule() {
    setError('')
    setMessage('')
    setAutoSubSummary(null)
    startTransition(async () => {
      try {
        const response = await axios.post('/api/schedule', { inputData: planner })
        setData(response.data)
        const firstTeacher = response.data.parsed.courses[0]?.faculty || ''
        setAbsence({ absentTeacher: firstTeacher, day: 'Monday' })
        setMessage('Timetable generated successfully.')
      } catch (requestError) {
        setError(requestError.response?.data?.detail || 'Unable to generate the timetable right now.')
      }
    })
  }

  function downloadExcelTemplate() {
    try {
      const templateData = [
        {
          'Teacher': 'Dr. Smith',
          'Course': 'Data Structures',
          'Sections': 'CSE-A, CSE-B',
          'Theory Hours': 3,
          'Practical Hours': 1,
          'Required Lectures': 42,
          'Preferred Days': 'Monday, Wednesday',
          'Blocked Days': 'Friday',
          'Preferred Band': 'morning',
          'Room Type': 'lecture',
          'Student Count': 60,
        },
        {
          'Teacher': 'Prof. Johnson',
          'Course': 'Web Development',
          'Sections': 'CSE-A',
          'Theory Hours': 2,
          'Practical Hours': 2,
          'Required Lectures': 28,
          'Preferred Days': 'Tuesday, Thursday',
          'Blocked Days': '',
          'Preferred Band': 'afternoon',
          'Room Type': 'lab',
          'Student Count': 40,
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Courses')
      XLSX.writeFile(wb, 'ScheduleAI_CourseTemplate.xlsx')
      setMessage('✓ Excel template downloaded. Fill it with your courses and import it back.')
      setError('')
    } catch (err) {
      setError(`Failed to generate template: ${err.message}`)
    }
  }
  
  function getScheduleStats() {
    const stats = {
      totalTeachers: teachers.length,
      totalCourses: planner.courses.length,
      scheduledHours: planner.courses.reduce((sum, c) => sum + c.theoryHoursPerWeek + c.practicalHoursPerWeek, 0),
      requiredHours: planner.courses.reduce((sum, c) => sum + (c.requiredLecturesToCover || c.theoryHoursPerWeek), 0),
    }
    return stats
  }
  
  async function autoSubstitute() {
    if (!schedule) return
    
    // Check if teacher is absent (recurring or single date)
    const isMarkedAbsent = markedAbsences[`${absence.absentTeacher}-${absence.day}`]
    
    if (!absence.absentTeacher) {
      setError('Please select a teacher to mark as absent.')
      return
    }
    
    setError('')
    setMessage('')
    try {
      const response = await axios.post('/api/substitute/day', {
        schedule,
        absentTeacher: absence.absentTeacher,
        day: absence.day,
      })
      setData((current) => ({ ...current, schedule: response.data.schedule }))
      setAutoSubSummary(response.data)
      setMessage(`${absence.absentTeacher} marked absent on ${absence.day}. ${response.data.applied?.length || 0} periods automatically covered.`)
      
      // Mark this absence in the tracking system
      setMarkedAbsences((current) => ({
        ...current,
        [`${absence.absentTeacher}-${absence.day}`]: new Date(),
      }))
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to create substitutions for that day.')
    }
  }
  
  function markRecurringAbsence(teacher) {
    // Mark teacher as absent for the current week
    setAbsence({ absentTeacher: teacher, day: 'Monday' })
    // Could extend to mark multiple days - for now, shows the intention
    setMessage(`Marking ${teacher} for weekly leave review. Use the day selector and click "Auto-cover" for each day.`)
  }
  
  function getMarkedAbsencesForTeacher(teacher) {
    return Object.entries(markedAbsences)
      .filter(([key]) => key.startsWith(`${teacher}-`))
      .map(([key]) => key.split('-').slice(1).join('-'))
  }

  async function exportIcal() {
    if (!schedule) return
    const response = await axios.post(
      '/api/export/ical',
      { schedule, calendarName: `${planner.campusName} Timetable` },
      { responseType: 'text' },
    )
    downloadBlob(response.data, 'ScheduleAI.ics', 'text/calendar;charset=utf-8')
    setMessage('Calendar exported successfully.')
    setError('')
  }

  async function optimizeScheduleAI() {
    if (!schedule || !data?.parsed) return
    setIsOptimizing(true)
    try {
      const response = await axios.post('/api/optimize/ai', { schedule, parsed: data.parsed })
      setAiSuggestions(response.data.suggestions)
      setMessage('AI optimization suggestions generated.')
      setError('')
    } catch (err) {
      setError('Failed to get AI suggestions. Please check your API key configuration.')
    } finally {
      setIsOptimizing(false)
    }
  }

  async function applyOptimizationsToSchedule() {
    if (!schedule || !data?.parsed) return
    setIsApplyingOptimizations(true)
    try {
      const response = await axios.post('/api/optimize/apply', { schedule, parsed: data.parsed })
      if (response.data.improvedSchedule) {
        setData({
          ...data,
          schedule: response.data.improvedSchedule,
        })
        setMessage(`✅ Applied ${response.data.optimizationsApplied} improvements to the schedule.`)
        setAiSuggestions(null) // Clear old suggestions
        setError('')
      } else {
        setError('Failed to apply optimizations.')
      }
    } catch (err) {
      setError('Error applying optimizations: ' + err.message)
    } finally {
      setIsApplyingOptimizations(false)
    }
  }

  async function exportPdf() {
    if (!schedule) return
    setIsExportingPdf(true)
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 24
      const headerHeight = 56
      const timeColWidth = 70
      const gridWidth = pageWidth - margin * 2
      const colWidth = (gridWidth - timeColWidth) / days.length
      const rowHeight = Math.max(76, Math.floor((pageHeight - margin * 2 - headerHeight) / (times.length + 1)))

      pdf.setFillColor(10, 18, 34)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.text(`${planner.campusName} Weekly Timetable`, margin, 34)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(190, 200, 220)
      pdf.text(`Generated by ScheduleAI`, margin, 50)

      const gridTop = margin + headerHeight
      pdf.setDrawColor(190, 200, 220)
      pdf.setFillColor(240, 245, 252)

      pdf.roundedRect(margin, gridTop, timeColWidth, rowHeight, 8, 8, 'FD')
      pdf.setTextColor(70, 85, 110)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Time', margin + 20, gridTop + 22)

      days.forEach((day, index) => {
        const left = margin + timeColWidth + index * colWidth
        pdf.roundedRect(left, gridTop, colWidth - 6, rowHeight, 8, 8, 'FD')
        pdf.text(day, left + 12, gridTop + 22)
      })

      times.forEach((time, rowIndex) => {
        const rowTop = gridTop + rowHeight + rowIndex * rowHeight
        pdf.setFillColor(255, 255, 255)
        pdf.roundedRect(margin, rowTop, timeColWidth, rowHeight - 6, 8, 8, 'FD')
        pdf.setTextColor(70, 85, 110)
        pdf.setFontSize(10)
        pdf.text(time, margin + 16, rowTop + 20)

        days.forEach((day, colIndex) => {
          const left = margin + timeColWidth + colIndex * colWidth
          pdf.setFillColor(255, 255, 255)
          pdf.roundedRect(left, rowTop, colWidth - 6, rowHeight - 6, 8, 8, 'FD')
          pdf.setTextColor(30, 41, 59)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          const text = cellText(schedule, day, time)
          pdf.text(text, left + 10, rowTop + 16, { maxWidth: colWidth - 22, lineHeightFactor: 1.15 })
        })
      })

      pdf.save('ScheduleAI-timetable.pdf')
      setMessage('PDF exported successfully.')
      setError('')
    } catch {
      setError('PDF export failed. Generate the timetable again and retry.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  async function importExcel(event) {
    const file = event.target.files?.[0]
    if (!file) return
    
    setIsImporting(true)
    setError('')
    setMessage('')
    
    try {
      // Use FileReader for better browser compatibility
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          
          if (!sheetName) {
            setError('Excel file has no sheets.')
            setIsImporting(false)
            return
          }
          
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          
          if (!jsonData || jsonData.length === 0) {
            setError('Excel sheet is empty. Make sure your file has data.')
            setIsImporting(false)
            return
          }
          
          // Enhanced parsing with multiple header variations and default values
          const importedCourses = jsonData.map((row, index) => {
            const theoryHours = parseFloat(row['Theory Hours'] || row['theoryHoursPerWeek'] || row['hours'] || 3)
            const practicalHours = parseFloat(row['Practical Hours'] || row['practicalHoursPerWeek'] || 0)
            const requiredLectures = parseFloat(row['Required Lectures'] || row['requiredLectures'] || theoryHours)
            
            return {
              id: `imported-course-${Date.now()}-${index}`,
              faculty: String(row['Teacher'] || row['Faculty'] || row['faculty'] || row['Name'] || '').trim(),
              courseName: String(row['Course'] || row['Course Name'] || row['courseName'] || row['Subject'] || '').trim(),
              sections: (String(row['Sections'] || row['sections'] || 'A').split(',').map(s => s.trim()).filter(Boolean)) || ['A'],
              theoryHoursPerWeek: isNaN(theoryHours) ? 3 : theoryHours,
              practicalHoursPerWeek: isNaN(practicalHours) ? 0 : practicalHours,
              practicalSessionLength: parseFloat(row['Practical Length'] || row['practicalSessionLength'] || 2) || 2,
              preferredBands: (String(row['Preferred Band'] || row['preferredBands'] || 'morning').split(',').map(b => b.trim().toLowerCase()).filter(Boolean)) || ['morning'],
              preferredDays: (String(row['Preferred Days'] || row['preferredDays'] || '').split(',').map(d => d.trim()).filter(Boolean)) || [],
              blockedDays: (String(row['Blocked Days'] || row['blockedDays'] || '').split(',').map(d => d.trim()).filter(Boolean)) || [],
              roomPreference: String(row['Room Preference'] || row['roomPreference'] || '').trim(),
              roomType: (String(row['Room Type'] || row['roomType'] || 'lecture').toLowerCase()),
              studentCount: parseFloat(row['Student Count'] || row['studentCount'] || 40) || 40,
              requiredLecturesToCover: isNaN(requiredLectures) ? theoryHours : requiredLectures,
            }
          })
          
          setPlanner((current) => ({
            ...current,
            courses: [...current.courses.filter(c => c.id !== 'manual-course-1' || current.courses.length > 1), ...importedCourses],
          }))
          
          setMessage(`✓ Successfully imported ${importedCourses.length} courses. ${importedCourses.length} new courses added to planner.`)
          event.target.value = ''
        } catch (parseErr) {
          setError(`Failed to parse Excel file: ${parseErr.message}. Please ensure your file is a valid .xlsx or .csv file.`)
          setIsImporting(false)
        } finally {
          setIsImporting(false)
        }
      }
      reader.onerror = () => {
        setError('Failed to read the file. Please try again.')
        setIsImporting(false)
      }
      reader.readAsBinaryString(file)
    } catch (err) {
      setError(`Error starting import: ${err.message}`)
      setIsImporting(false)
    }
  }

  const statCards = [
    ['generationTimeLabel', 'Generation'],
    ['scheduledSessions', 'Hours Scheduled'],
    ['unscheduledSessions', 'Hours Pending'],
    ['substitutionCount', 'Substitutions'],
  ]

  // Page Components
  const DashboardPage = () => (
    <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="glass-elevated overflow-hidden animate-fade-in-up">
          <div className="p-8">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium glass-cyan">
                  <Sparkles className="h-4 w-4" style={{ color: '#a1a5b0' }} />
                  ScheduleAI
                </span>
                <h1 className="max-w-3xl font-['Space_Grotesk',sans-serif] text-4xl font-semibold leading-tight md:text-5xl" style={{ color: '#e2e8f0' }}>
                  Academic scheduling with a polished control room for timetable generation and full-day teacher substitutions.
                </h1>
                <p className="max-w-2xl text-base leading-7" style={{ color: '#cbd5e1' }}>
                  Plan syllabus coverage, generate a multi-section timetable, and when a faculty member is absent, choose only the teacher and day. The system assigns substitutes period-by-period on its own.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="glass-cyan p-4 animate-scale-in">
                    <p className="text-xs uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>Status</p>
                    <p className="mt-2 text-sm" style={{ color: '#a1a5b0' }}>{apiStatus}</p>
                  </div>
                  <div className="glass-green p-4 animate-scale-in">
                    <p className="text-xs uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>Rooms</p>
                    <p className="mt-2 text-sm" style={{ color: '#d1d5db' }}>{planner.rooms.length} available</p>
                  </div>
                  <div className="glass-purple p-4 animate-scale-in">
                    <p className="text-xs uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>Substitution</p>
                    <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>Auto-cover full day</p>
                  </div>
                </div>
              </div>

              <div className="glass-elevated p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Campus">
                    <Input value={planner.campusName} onChange={(event) => setPlanner((current) => ({ ...current, campusName: event.target.value }))} />
                  </Field>
                  <Field label="Blocked times">
                    <Input value={planner.globalRules.blockedTimes.join(', ')} onChange={(event) => setPlanner((current) => ({ ...current, globalRules: { ...current.globalRules, blockedTimes: splitCsv(event.target.value) } }))} />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {planner.rooms.map((room) => (
                    <span key={room.name} className="glass-purple px-3 py-2 text-xs animate-float" style={{ color: '#9ca3af' }}>
                      {[room.name, room.type, `cap ${room.capacity}`].join(' | ')}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentPage('courses')}
                    className="skeu-button-glossy inline-flex items-center gap-2"
                  >
                    <Book className="h-4 w-4" />
                    Manage Courses
                  </button>
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="skeu-button-premium inline-flex items-center gap-2"
                  >
                    <FileUp className="h-4 w-4" />
                    Download Template
                  </button>
                  <button
                    type="button"
                    onClick={() => parsed && setPlanner(plannerFromData(parsed))}
                    className="glass-button inline-flex items-center gap-2"
                  >
                    Load demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {message ? <div className="mt-5 glass-green px-4 py-3 text-sm animate-fade-in-down" style={{ color: '#d1d5db' }}>{message}</div> : null}
        {error ? <div className="mt-5 glass-pink px-4 py-3 text-sm animate-fade-in-down" style={{ color: '#9ca3af' }}>{error}</div> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(([key, label], idx) => {
            const glassColors = ['glass-cyan', 'glass-green', 'glass-orange', 'glass-purple'];
            return (
              <article key={key} className={`${glassColors[idx % 4]} p-5 animate-scale-in`}>
                <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>{label}</p>
                <p className="mt-3 font-['Space_Grotesk',sans-serif] text-3xl" style={{ color: '#d1d5db' }}>{metrics[key] ?? '--'}</p>
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )

  const CoursesPage = () => (
    <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="glass-cyan p-6 animate-fade-in-up">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Course planner</p>
                <h2 className="mt-1 font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Teacher requests</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addCourse}
                  className="skeu-button-glossy inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add course
                </button>
                <label className="glass-button inline-flex items-center gap-2 cursor-pointer">
                  <FileUp className="h-4 w-4" />
                  {isImporting ? 'Importing...' : 'Excel'}
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} disabled={isImporting} className="hidden" />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              {planner.courses.map((course, index) => {
                const isExpanded = expandedCourse === course.id
                return (
                  <article
                    key={course.id}
                    className="glass-purple overflow-hidden transition-all animate-scale-in"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCourse(isExpanded ? '' : course.id)}
                      className="w-full px-5 py-4 flex items-center justify-between transition text-left glass-button"
                      style={{ backgroundColor: isExpanded ? 'rgba(156, 163, 175, 0.16)' : 'transparent' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: '#9ca3af' }}>{course.faculty || 'Teacher name'}</p>
                        <p className="text-sm truncate mt-1" style={{ color: '#cbd5e1' }}>{course.courseName || 'Course name'}</p>
                      </div>
                      <div className="ml-4 flex items-center gap-3">
                        <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap glass-cyan" style={{ color: '#a1a5b0' }}>
                          {course.theoryHoursPerWeek + course.practicalHoursPerWeek}h/week
                        </span>
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          style={{ color: '#9ca3af' }}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t px-5 py-4 space-y-4" style={{ backgroundColor: 'rgba(156, 163, 175, 0.05)', borderColor: 'rgba(156, 163, 175, 0.12)' }}>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Teacher">
                            <Input
                              value={course.faculty}
                              onChange={(event) => setCourse(index, 'faculty', event.target.value)}
                            />
                          </Field>
                          <Field label="Course">
                            <Input
                              value={course.courseName}
                              onChange={(event) => setCourse(index, 'courseName', event.target.value)}
                            />
                          </Field>
                          <Field label="Sections">
                            <Input
                              value={course.sections.join(', ')}
                              onChange={(event) => setCourse(index, 'sections', splitCsv(event.target.value))}
                              placeholder="CSE-A, CSE-B"
                            />
                          </Field>
                          <Field label="Students">
                            <Input
                              type="number"
                              value={course.studentCount}
                              onChange={(event) => setCourse(index, 'studentCount', Number(event.target.value))}
                            />
                          </Field>
                          <Field label="Theory hours">
                            <Input
                              type="number"
                              value={course.theoryHoursPerWeek}
                              onChange={(event) => setCourse(index, 'theoryHoursPerWeek', Number(event.target.value))}
                            />
                          </Field>
                          <Field label="Practical hours">
                            <Input
                              type="number"
                              value={course.practicalHoursPerWeek}
                              onChange={(event) => setCourse(index, 'practicalHoursPerWeek', Number(event.target.value))}
                            />
                          </Field>
                          <Field label="Preferred days">
                            <Input
                              value={course.preferredDays.join(', ')}
                              onChange={(event) => setCourse(index, 'preferredDays', splitCsv(event.target.value))}
                              placeholder="Tuesday, Wednesday"
                            />
                          </Field>
                          <Field label="Blocked days">
                            <Input
                              value={course.blockedDays.join(', ')}
                              onChange={(event) => setCourse(index, 'blockedDays', splitCsv(event.target.value))}
                              placeholder="Friday"
                            />
                          </Field>
                          <Field label="Preferred band">
                            <Select
                              value={course.preferredBands[0] || ''}
                              onChange={(event) => setCourse(index, 'preferredBands', event.target.value ? [event.target.value] : [])}
                            >
                              <option value="">Any</option>
                              <option value="morning">Morning</option>
                              <option value="afternoon">Afternoon</option>
                            </Select>
                          </Field>
                          <Field label="Room type">
                            <Select
                              value={course.roomType}
                              onChange={(event) => setCourse(index, 'roomType', event.target.value)}
                            >
                              <option value="lecture">Lecture</option>
                              <option value="lab">Lab</option>
                            </Select>
                          </Field>
                          <Field label="Required lectures to cover syllabus">
                            <Input
                              type="number"
                              value={course.requiredLecturesToCover}
                              onChange={(event) => setCourse(index, 'requiredLecturesToCover', Number(event.target.value))}
                              placeholder="How many lectures needed to complete the syllabus?"
                            />
                          </Field>
                        </div>
                        
                        <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'rgba(156, 163, 175, 0.12)' }}>
                          <button
                            type="button"
                            onClick={() => deleteCourse(index)}
                            className="skeu-button-leather inline-flex items-center gap-2"
                          >
                            Remove Course
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </div>

          <div className="glass-elevated p-6 animate-slide-in-right">
            <div className="mb-5 flex items-center gap-3">
                  <div className="liquid-glass-icon pink">
                    <UserMinus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Teacher Leave Management</p>
                    <h2 className="font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Mark absence & auto-cover</h2>
                  </div>
                </div>

                <p className="text-sm mb-4" style={{ color: '#cbd5e1' }}>When a teacher is absent, the system automatically substitutes their scheduled lectures.</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Select teacher on leave">
                    <Select value={absence.absentTeacher} onChange={(event) => setAbsence((current) => ({ ...current, absentTeacher: event.target.value }))}>
                      <option value="">Choose teacher...</option>
                      {teachers.map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
                    </Select>
                  </Field>
                  <Field label="Select day">
                    <Select value={absence.day} onChange={(event) => setAbsence((current) => ({ ...current, day: event.target.value }))}>
                      {days.map((day) => <option key={day} value={day}>{day}</option>)}
                    </Select>
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={autoSubstitute}
                  disabled={!schedule || !absence.absentTeacher}
                  className="mt-5 skeu-button-premium inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <CalendarDays className="h-4 w-4" />
                  Mark Absent & Auto-Cover Periods
                </button>

                {absence.absentTeacher && getMarkedAbsencesForTeacher(absence.absentTeacher).length > 0 && (
                  <div className="mt-5 glass-pink p-4 animate-fade-in-up">
                    <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>✓ Marked Absences for {absence.absentTeacher}:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getMarkedAbsencesForTeacher(absence.absentTeacher).map((day) => (
                        <span key={day} className="text-xs px-3 py-2 rounded-full glass-pink" style={{ color: '#9ca3af' }}>
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

            {autoSubSummary ? (
              <div className="mt-5 space-y-3 rounded-[24px] p-4" style={{ backgroundColor: '#EEF2F7', border: '1px solid #E5E7EB' }}>
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Substitution summary</p>
                {(autoSubSummary.applied || []).map((item) => (
                  <div key={`${item.courseName}-${item.timeLabel}`} className="text-sm" style={{ color: '#475569' }}>
                    {item.timeLabel}: {item.courseName} covered by {item.substituteTeacher}
                  </div>
                ))}
                {(autoSubSummary.unresolved || []).map((item) => (
                  <div key={`${item.courseName}-${item.timeLabel}-unresolved`} className="text-sm" style={{ color: '#EF4444' }}>
                    {item.timeLabel}: {item.courseName} could not be reassigned
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )

  const SchedulePage = () => {
    // Get student-specific schedule (only enrolled courses)
    const studentSchedule = getStudentSchedule()
    
    return <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Student Info Header */}
        <div className="mb-6 glass-elevated p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <User size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{loggedInStudent.name}</h3>
                <p className="text-sm text-slate-400">{loggedInStudent.enrollmentNo} • {loggedInStudent.section}</p>
                <p className="text-xs text-slate-500 mt-1">{loggedInStudent.department}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Enrolled in</p>
              <p className="text-2xl font-bold text-blue-400">{loggedInStudent.enrolledCourses.length} courses</p>
            </div>
          </div>
        </div>

        <div className="glass-elevated p-6 animate-fade-in-up">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Your Timetable</p>
              <h2 className="font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Weekly schedule</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateSchedule}
                disabled={isPending}
                className="skeu-button-glossy inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Generate timetable
              </button>
              <button
                type="button"
                onClick={exportPdf}
                disabled={!studentSchedule || isExportingPdf}
                className="glass-button inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {isExportingPdf ? 'Exporting...' : 'PDF'}
              </button>
              <button
                type="button"
                onClick={exportIcal}
                disabled={!studentSchedule}
                className="skeu-button-glossy inline-flex items-center gap-2 disabled:opacity-50"
              >
                <CalendarDays className="h-4 w-4" />
                iCal
              </button>
            </div>
          </div>

          <div className="glass-cyan overflow-hidden p-4">
            {studentSchedule ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-2 text-left">
                  <thead>
                    <tr>
                      <th className="glass-purple p-3 text-sm font-medium rounded-lg" style={{ color: '#9ca3af' }}>Time</th>
                      {days.map((day) => (
                        <th key={day} className="glass-cyan p-3 text-sm font-medium rounded-lg" style={{ color: '#a1a5b0' }}>
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {times.map((time) => {
                      // Add lunch break row
                      if (time === "13:00") {
                        return (
                          <tr key="lunch-break">
                            <td colSpan={days.length + 1} className="rounded-lg px-4 py-4 text-center text-sm font-semibold animate-glow-pulse" style={{ backgroundColor: 'rgba(209, 213, 219, 0.2)', color: '#d1d5db', border: '2px solid rgba(209, 213, 219, 0.4)' }}>
                              🍽️ LUNCH BREAK (12:00-13:00)
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={time}>
                          <td className="glass-purple p-4 text-sm font-medium rounded-lg" style={{ color: '#9ca3af' }}>{time}</td>
                          {days.map((day) => {
                            const items = slotAssignments(studentSchedule, day, time)
                            return (
                              <td key={`${day}-${time}`} className="align-top">
                                <div className="min-h-28 space-y-2 rounded-lg p-3 glass-green">
                                  {items.length ? items.map((item, index) => {
                                    const colors = getCourseColor(item.id, index)
                                    return (
                                      <div key={item.id} className="rounded-lg px-3 py-2 text-xs shadow-sm animate-scale-in" style={{ backgroundColor: colors.bg, border: `2px solid ${colors.border}`, color: colors.text }}>
                                        <p className="font-bold text-sm">{item.courseName}</p>
                                        <p className="mt-1 font-semibold">📍 {item.room}</p>
                                        <p className="mt-1 text-xs">{item.faculty}</p>
                                      </div>
                                    )
                                  }) : null}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center text-sm" style={{ color: '#475569' }}>Generate a timetable to view your weekly schedule.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  }

  const TeachingLoadPage = () => {
    const [editingCourse, setEditingCourse] = useState(null)
    const [tempRequired, setTempRequired] = useState(0)
    
    const filteredCourses = (planner.courses || [])
      .map((course, index) => ({ ...course, _index: index }))
      .filter((course) => !selectedTeacher || course.faculty === selectedTeacher)
    
    const totalHoursRequired = filteredCourses.reduce((sum, course) => sum + (course.requiredLecturesToCover || 0), 0)
    const totalHoursScheduled = filteredCourses.reduce((sum, course) => sum + (course.theoryHoursPerWeek + course.practicalHoursPerWeek), 0)
    
    function startEditCourse(course) {
      setEditingCourse(course.id)
      setTempRequired(course.requiredLecturesToCover || course.theoryHoursPerWeek)
    }

    function saveEditCourse(courseId, courseIndex) {
      const requiredValue = Number(tempRequired)
      if (!Number.isFinite(requiredValue) || requiredValue <= 0) {
        setError('Required lectures must be a positive number.')
        return
      }

      // Update planner data
      setCourse(courseIndex, 'requiredLecturesToCover', requiredValue)
      
      // Also update the schedule data if it exists
      setData((current) => {
        if (!current?.parsed?.courses) return current
        return {
          ...current,
          parsed: {
            ...current.parsed,
            courses: current.parsed.courses.map((course) => (
              course.id === courseId
                ? { ...course, requiredLecturesToCover: requiredValue }
                : course
            )),
          },
        }
      })
      setMessage('Syllabus requirement updated successfully.')
      setError('')
      setTimeout(() => setMessage(''), 2000)
      setEditingCourse(null)
    }
    
    return (
      <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {message ? <div className="mb-5 rounded-2xl px-4 py-3 text-sm glass glass-green">{message}</div> : null}
          
          <div className="rounded-[30px] p-6 glass glass-elevated">
            <div className="mb-6">
              <div className="mb-4">
                <p className="text-sm font-medium" style={{ color: '#a0aec0' }}>Teaching Load & Syllabus Coverage</p>
                <h3 className="font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Monitor and Edit Course Requirements</h3>
              </div>
              <div>
                <Select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>
                  <option value="">All teachers</option>
                  {teacherList(parsed, schedule).map((teacher) => (
                    <option key={teacher} value={teacher}>{teacher}</option>
                  ))}
                </Select>
              </div>
            </div>

            {selectedTeacher && (
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] p-5 glass glass-green">
                  <p className="text-sm font-medium" style={{ color: '#a0aec0' }}>Total Required Lectures</p>
                  <p className="mt-2 font-['Space_Grotesk',sans-serif] text-3xl" style={{ color: '#e2e8f0' }}>{totalHoursRequired}</p>
                  <p className="mt-1 text-xs" style={{ color: '#a0aec0' }}>lectures to complete all courses</p>
                </div>
                <div className="rounded-[24px] p-5 glass glass-cyan">
                  <p className="text-sm font-medium" style={{ color: '#a0aec0' }}>Total Scheduled</p>
                  <p className="mt-2 font-['Space_Grotesk',sans-serif] text-3xl" style={{ color: '#e2e8f0' }}>{totalHoursScheduled}</p>
                  <p className="mt-1 text-xs" style={{ color: '#a0aec0' }}>hours per week currently allocated</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {filteredCourses.map((course) => {
                const courseIndex = course._index
                const requiredLectures = Number(course.requiredLecturesToCover || course.theoryHoursPerWeek || 0)
                const coveragePercent = requiredLectures > 0 ? Math.round((course.theoryHoursPerWeek / requiredLectures) * 100) : 0
                const isCoverageSufficient = course.theoryHoursPerWeek >= requiredLectures
                const isEditing = editingCourse === course.id
                
                return (
                  <div
                    key={course.id}
                    className="group rounded-[20px] px-5 py-4 transition-all glass" style={{ "--glass-color": isEditing ? '#9ca3af' : '#a1a5b0' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold" style={{ color: '#e2e8f0' }}>{course.courseName}</p>
                        <p className="mt-1 text-sm" style={{ color: '#a0aec0' }}>{course.sections.join(', ')} • {course.faculty}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs" style={{ color: '#a0aec0', fontWeight: 500 }}>Coverage</p>
                        <p className={`text-lg font-bold ${isCoverageSufficient ? 'text-green-400' : 'text-orange-400'}`}>
                          {coveragePercent}%
                        </p>
                      </div>
                    </div>
                    
                    {isEditing ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="Required Lectures to Cover Syllabus">
                            <Input
                              type="number"
                              value={tempRequired}
                              onChange={(e) => setTempRequired(Number(e.target.value))}
                              min="1"
                            />
                          </Field>
                          <Field label="Currently Scheduled Lectures">
                            <Input
                              type="number"
                              value={course.theoryHoursPerWeek}
                              disabled
                              style={{ backgroundColor: '#E5E7EB', cursor: 'not-allowed' }}
                            />
                          </Field>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditCourse(course.id, courseIndex)}
                            className="rounded-full px-4 py-2 text-sm text-white transition"
                            style={{ backgroundColor: '#4F46E5' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#4338CA'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#4F46E5'}
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCourse(null)}
                            className="rounded-full px-4 py-2 text-sm transition glass glass-light"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span style={{ color: '#a0aec0' }}>
                            {course.theoryHoursPerWeek}h scheduled / {requiredLectures}h required
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditCourse(course)}
                            className="text-xs rounded px-2 py-1 transition glass glass-purple"
                          >
                            Edit Target
                          </button>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2" style={{ backgroundColor: '#E5E7EB' }}>
                          <div 
                            className="h-2 rounded-full transition-all" 
                            style={{ 
                              width: `${Math.min(coveragePercent, 100)}%`,
                              backgroundColor: isCoverageSufficient ? '#10B981' : '#F97316'
                            }}
                          />
                        </div>
                        
                        <p className="text-xs mt-2" style={{ color: '#a0aec0' }}>
                          {isCoverageSufficient ? '✓ Syllabus coverage sufficient' : `⚠ Need ${requiredLectures - course.theoryHoursPerWeek} more hours`}
                        </p>
                      </>
                    )}
                    
                    {course.practicalHoursPerWeek > 0 && (
                      <p className="mt-2 text-xs" style={{ color: '#a0aec0' }}>
                        + {course.practicalHoursPerWeek}h practical sessions
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {selectedTeacher && filteredCourses.length === 0 ? (
              <div className="grid place-items-center py-8">
                <p className="text-sm" style={{ color: '#a0aec0' }}>No courses for this teacher</p>
              </div>
            ) : null}

            {!selectedTeacher && (planner.courses || []).length === 0 ? (
              <div className="grid place-items-center py-8">
                <p className="text-sm" style={{ color: '#a0aec0' }}>Add teachers and courses to get started</p>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    )
  }

  const SettingsPage = () => {
    const [editingRoom, setEditingRoom] = useState(null)
    const [newRoom, setNewRoom] = useState({ name: '', type: 'lecture', capacity: 40 })

    function addRoom() {
      if (!newRoom.name.trim()) {
        setError('Room name is required.')
        return
      }
      if (planner.rooms.some(r => r.name === newRoom.name)) {
        setError('Room already exists.')
        return
      }
      setPlanner((current) => ({
        ...current,
        rooms: [...current.rooms, { ...newRoom, capacity: Number(newRoom.capacity) }],
      }))
      setNewRoom({ name: '', type: 'lecture', capacity: 40 })
      setMessage('Room added successfully.')
      setTimeout(() => setMessage(''), 3000)
    }

    function updateRoom(index, field, value) {
      setPlanner((current) => ({
        ...current,
        rooms: current.rooms.map((room, i) => i === index ? { ...room, [field]: field === 'capacity' ? Number(value) : value } : room),
      }))
    }

    function deleteRoom(index) {
      if (planner.rooms.length === 1) {
        setError('You must have at least one room.')
        return
      }
      setPlanner((current) => ({
        ...current,
        rooms: current.rooms.filter((_, i) => i !== index),
      }))
      setEditingRoom(null)
      setMessage('Room deleted.')
      setTimeout(() => setMessage(''), 3000)
    }

    return (
      <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {message ? <div className="mb-5 rounded-2xl px-4 py-3 text-sm glass glass-green">{message}</div> : null}
          {error && message !== error ? <div className="mb-5 rounded-2xl px-4 py-3 text-sm glass glass-pink">{error}</div> : null}

          <div className="rounded-[30px] p-6 glass glass-elevated">
            <div className="mb-8">
              <p className="text-sm font-medium" style={{ color: '#a0aec0' }}>System Configuration</p>
              <h2 className="font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Settings & Preferences</h2>
            </div>

            <div className="space-y-8">
              {/* Campus Settings */}
              <div className="rounded-[24px] p-6 glass glass-cyan">
                <h3 className="text-lg font-semibold mb-5" style={{ color: '#e2e8f0' }}>📍 Campus Settings</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Campus Name">
                    <Input value={planner.campusName} onChange={(event) => setPlanner((current) => ({ ...current, campusName: event.target.value }))} />
                  </Field>
                  <Field label="Blocked Times (comma-separated)">
                    <Input 
                      value={planner.globalRules.blockedTimes.join(', ')} 
                      onChange={(event) => setPlanner((current) => ({ ...current, globalRules: { ...current.globalRules, blockedTimes: splitCsv(event.target.value) } }))} 
                      placeholder="12:00, 16:00"
                    />
                  </Field>
                </div>
              </div>

              {/* Room Management */}
              <div className="rounded-[24px] p-6 glass glass-purple">
                <h3 className="text-lg font-semibold mb-5" style={{ color: '#e2e8f0' }}>🏛️ Room Management</h3>
                
                {/* Add New Room */}
                <div className="mb-6 rounded-[20px] p-5 glass glass-elevated">
                  <p className="text-sm font-medium mb-4" style={{ color: '#e2e8f0' }}>Add New Room</p>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Field label="Room Name">
                      <Input 
                        value={newRoom.name} 
                        onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                        placeholder="Classroom A1"
                      />
                    </Field>
                    <Field label="Type">
                      <Select value={newRoom.type} onChange={(e) => setNewRoom({ ...newRoom, type: e.target.value })}>
                        <option value="lecture">Lecture Hall</option>
                        <option value="lab">Lab</option>
                        <option value="seminar">Seminar</option>
                      </Select>
                    </Field>
                    <Field label="Capacity">
                      <Input 
                        type="number" 
                        value={newRoom.capacity} 
                        onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
                        min="10"
                      />
                    </Field>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={addRoom}
                        className="w-full rounded-full px-4 py-3 text-sm font-medium text-white transition"
                        style={{ backgroundColor: '#4F46E5' }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#4338CA'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#4F46E5'}
                      >
                        <Plus className="h-4 w-4 inline mr-1" />
                        Add Room
                      </button>
                    </div>
                  </div>
                </div>

                {/* Existing Rooms */}
                <div className="space-y-3">
                  {planner.rooms.map((room, index) => (
                    <div 
                      key={room.name}
                      className="rounded-[20px] p-5 transition-all glass"
                      style={{ "--glass-color": editingRoom === index ? '#9ca3af' : '#a1a5b0' }}
                    >
                      {editingRoom === index ? (
                        // Edit Mode
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-4">
                            <Field label="Room Name">
                              <Input 
                                value={room.name} 
                                onChange={(e) => updateRoom(index, 'name', e.target.value)}
                              />
                            </Field>
                            <Field label="Type">
                              <Select value={room.type} onChange={(e) => updateRoom(index, 'type', e.target.value)}>
                                <option value="lecture">Lecture Hall</option>
                                <option value="lab">Lab</option>
                                <option value="seminar">Seminar</option>
                              </Select>
                            </Field>
                            <Field label="Capacity">
                              <Input 
                                type="number" 
                                value={room.capacity} 
                                onChange={(e) => updateRoom(index, 'capacity', e.target.value)}
                                min="10"
                              />
                            </Field>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingRoom(null)}
                              className="rounded-full px-4 py-2 text-sm text-white transition"
                              style={{ backgroundColor: '#4F46E5' }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#4338CA'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = '#4F46E5'}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRoom(index)}
                              className="rounded-full px-4 py-2 text-sm transition glass glass-pink"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold" style={{ color: '#a1a5b0' }}>{room.name}</p>
                            <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>
                              {room.type === 'lecture' ? '🎓' : room.type === 'lab' ? '🔬' : '📋'} {room.type.charAt(0).toUpperCase() + room.type.slice(1)} • Capacity: {room.capacity}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingRoom(index)}
                            className="rounded-full px-4 py-2 text-sm transition glass glass-purple"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Scheduling Constraints */}
              <div className="rounded-[24px] p-6 glass glass-orange">
                <h3 className="text-lg font-semibold mb-5" style={{ color: '#e2e8f0' }}>⚙️ Scheduling Rules</h3>
                <div className="space-y-4">
                  <div className="rounded-[20px] p-4 glass glass-elevated">
                    <p className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>✓ No Back-to-Back Classes</p>
                    <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>Same course won't be scheduled in consecutive time slots in the same room</p>
                  </div>
                  <div className="rounded-[20px] p-4 glass glass-elevated">
                    <p className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>✓ Smart Teacher Substitution</p>
                    <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>Absent teachers are replaced by colleagues who teach similar subjects</p>
                  </div>
                  <div className="rounded-[20px] p-4 glass glass-elevated">
                    <p className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>✓ Room Type Enforcement</p>
                    <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>Lab courses are only scheduled in lab rooms; lecture courses in any suitable room</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Navigation Sidebar
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'courses', label: 'Courses', icon: Book },
    { id: 'schedule', label: 'Schedule', icon: LayoutGrid },
    { id: 'teaching', label: 'Teaching Load', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  // Filter schedule to show only logged-in student's enrolled courses
  const getStudentSchedule = () => {
    if (!loggedInStudent || !schedule) return schedule
    
    const enrolledCourseIds = loggedInStudent.enrolledCourses
    return {
      ...schedule,
      assignments: (schedule.assignments || []).filter(assignment => 
        enrolledCourseIds.includes(assignment.courseId)
      )
    }
  }

  // If not logged in, show login page
  if (!loggedInStudent) {
    return <StudentLogin onLoginSuccess={setLoggedInStudent} students={studentsData} />
  }

  // Main render with sidebar and page router
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center gap-8 py-6 glass-elevated" style={{ borderRight: '1px solid rgba(161, 165, 176, 0.12)' }}>
        <div className="liquid-glass-icon cyan animate-scale-in">
          <Sparkles className="h-6 w-6" />
        </div>
        
        <nav className="flex flex-col gap-6">
          {navigationItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentPage(id)}
              className="relative w-12 h-12 glass-button transition-all flex items-center justify-center group"
              style={{
                backgroundColor: currentPage === id ? 'rgba(161, 165, 176, 0.2)' : 'transparent',
                color: currentPage === id ? '#a1a5b0' : '#94a3b8',
              }}
              title={label}
            >
              <Icon className="h-6 w-6" />
              {currentPage === id && (
                <span className="absolute -right-32 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium glass-elevated animate-fade-in-down" style={{ color: '#e2e8f0' }}>
                  {label}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="mt-auto flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <p className="text-xs text-center text-slate-400 truncate" title={loggedInStudent.name}>
              {loggedInStudent.name.split(' ')[0]}
            </p>
          </div>
          <button
            onClick={() => setLoggedInStudent(null)}
            className="w-12 h-12 glass-button transition-all flex items-center justify-center hover:bg-red-500/20"
            title="Logout"
          >
            <LogOut className="h-5 w-5 text-red-400" />
          </button>
        </div>
      </aside>

      {/* Page Content */}
      <main className="flex-1 ml-20">
        {currentPage === 'dashboard' && <DashboardPage />}
        {currentPage === 'courses' && <CoursesPage />}
        {currentPage === 'schedule' && <SchedulePage />}
        {currentPage === 'teaching' && <TeachingLoadPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

export default App
