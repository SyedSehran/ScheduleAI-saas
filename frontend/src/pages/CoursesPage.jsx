import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Plus, FileUp, UserMinus, CalendarDays } from 'lucide-react'
import api, { apiErrorMessage } from '../api'
import { Field, Input, Select } from '../components/ui'
import { emptyCourse, splitCsv } from './helpers'

/**
 * Course planner + teacher-leave management.
 *
 * Owns its own local UI state (expanded card, absence form, import spinner) —
 * safe now that pages are stable top-level components instead of functions
 * re-created inside App on every render.
 */
export default function CoursesPage({ planner, setPlanner, data, setData, teachers, days, notify, fail }) {
  const [expandedCourse, setExpandedCourse] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [absence, setAbsence] = useState({ absentTeacher: '', day: days[0] || 'Monday' })
  const [markedAbsences, setMarkedAbsences] = useState({})
  const [autoSubSummary, setAutoSubSummary] = useState(null)

  function setCourse(index, field, value) {
    setPlanner((current) => ({
      ...current,
      courses: current.courses.map((course, courseIndex) =>
        courseIndex === index ? { ...course, [field]: value } : course,
      ),
    }))
  }

  function addCourse() {
    setPlanner((current) => ({
      ...current,
      courses: [...current.courses, emptyCourse(current.courses.length + 1)],
    }))
  }

  function deleteCourse(index) {
    if (planner.courses.length === 1) {
      fail('You must have at least one course.')
      return
    }
    setPlanner((current) => ({
      ...current,
      courses: current.courses.filter((_, i) => i !== index),
    }))
    setExpandedCourse('')
    notify('Course deleted successfully.')
  }

  async function autoSubstitute() {
    const schedule = data?.schedule
    if (!schedule) return

    if (!absence.absentTeacher) {
      fail('Please select a teacher to mark as absent.')
      return
    }

    try {
      const response = await api.post('/substitute/day', {
        schedule,
        absentTeacher: absence.absentTeacher,
        day: absence.day,
      })
      setData((current) => ({ ...current, schedule: response.data.schedule }))
      setAutoSubSummary(response.data)
      notify(
        `${absence.absentTeacher} marked absent on ${absence.day}. ${response.data.applied?.length || 0} periods automatically covered.`,
      )
      setMarkedAbsences((current) => ({
        ...current,
        [`${absence.absentTeacher}-${absence.day}`]: new Date(),
      }))
    } catch (requestError) {
      fail(apiErrorMessage(requestError, 'Unable to create substitutions for that day.'))
    }
  }

  function getMarkedAbsencesForTeacher(teacher) {
    return Object.entries(markedAbsences)
      .filter(([key]) => key.startsWith(`${teacher}-`))
      .map(([key]) => key.split('-').slice(1).join('-'))
  }

  async function importExcel(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]

      if (!sheetName) {
        fail('Excel file has no sheets.')
        return
      }

      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
      if (!jsonData.length) {
        fail('Excel sheet is empty. Make sure your file has data.')
        return
      }

      // Accept several common header spellings and fill sane defaults.
      const firstValue = (row, keys, fallback = '') => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key]
        }
        return fallback
      }

      const importedCourses = jsonData.map((row, index) => {
        const theoryHours = parseFloat(firstValue(row, ['Theory Hours', 'theoryHoursPerWeek', 'hours'], 3))
        const practicalHours = parseFloat(firstValue(row, ['Practical Hours', 'practicalHoursPerWeek'], 0))
        const requiredLectures = parseFloat(firstValue(row, ['Required Lectures', 'requiredLectures'], theoryHours))
        const bands = splitCsv(String(firstValue(row, ['Preferred Band', 'preferredBands'], 'morning'))).map((b) => b.toLowerCase())

        return {
          id: `imported-course-${Date.now()}-${index}`,
          faculty: String(firstValue(row, ['Teacher', 'Faculty', 'faculty', 'Name'])).trim(),
          courseName: String(firstValue(row, ['Course', 'Course Name', 'courseName', 'Subject'])).trim(),
          sections: splitCsv(String(firstValue(row, ['Sections', 'sections'], 'A'))).length
            ? splitCsv(String(firstValue(row, ['Sections', 'sections'], 'A')))
            : ['A'],
          theoryHoursPerWeek: Number.isNaN(theoryHours) ? 3 : theoryHours,
          practicalHoursPerWeek: Number.isNaN(practicalHours) ? 0 : practicalHours,
          practicalSessionLength: parseFloat(firstValue(row, ['Practical Length', 'practicalSessionLength'], 2)) || 2,
          preferredBands: bands.length ? bands : ['morning'],
          preferredDays: splitCsv(String(firstValue(row, ['Preferred Days', 'preferredDays'], ''))),
          blockedDays: splitCsv(String(firstValue(row, ['Blocked Days', 'blockedDays'], ''))),
          roomPreference: String(firstValue(row, ['Room Preference', 'roomPreference'])).trim(),
          roomType: String(firstValue(row, ['Room Type', 'roomType'], 'lecture')).toLowerCase(),
          studentCount: parseFloat(firstValue(row, ['Student Count', 'studentCount'], 40)) || 40,
          requiredLecturesToCover: Number.isNaN(requiredLectures) ? theoryHours : requiredLectures,
        }
      })

      setPlanner((current) => ({
        ...current,
        courses: [...current.courses.filter((c) => c.id !== 'manual-course-1' || current.courses.length > 1), ...importedCourses],
      }))

      notify(`Successfully imported ${importedCourses.length} courses into the planner.`)
      event.target.value = ''
    } catch (parseError) {
      fail(`Failed to parse Excel file: ${parseError.message}. Please ensure it is a valid .xlsx or .csv file.`)
    } finally {
      setIsImporting(false)
    }
  }

  return (
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
                <button type="button" onClick={addCourse} className="skeu-button-glossy inline-flex items-center gap-2">
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
                  <article key={course.id} className="glass-purple overflow-hidden transition-all animate-scale-in">
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
                      <div
                        className="border-t px-5 py-4 space-y-4"
                        style={{ backgroundColor: 'rgba(156, 163, 175, 0.05)', borderColor: 'rgba(156, 163, 175, 0.12)' }}
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Teacher">
                            <Input value={course.faculty} onChange={(event) => setCourse(index, 'faculty', event.target.value)} />
                          </Field>
                          <Field label="Course">
                            <Input value={course.courseName} onChange={(event) => setCourse(index, 'courseName', event.target.value)} />
                          </Field>
                          <Field label="Sections">
                            <Input
                              value={course.sections.join(', ')}
                              onChange={(event) => setCourse(index, 'sections', splitCsv(event.target.value))}
                              placeholder="CSE-A, CSE-B"
                            />
                          </Field>
                          <Field label="Students">
                            <Input type="number" value={course.studentCount} onChange={(event) => setCourse(index, 'studentCount', Number(event.target.value))} />
                          </Field>
                          <Field label="Theory hours">
                            <Input type="number" value={course.theoryHoursPerWeek} onChange={(event) => setCourse(index, 'theoryHoursPerWeek', Number(event.target.value))} />
                          </Field>
                          <Field label="Practical hours">
                            <Input type="number" value={course.practicalHoursPerWeek} onChange={(event) => setCourse(index, 'practicalHoursPerWeek', Number(event.target.value))} />
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
                            <Select value={course.roomType} onChange={(event) => setCourse(index, 'roomType', event.target.value)}>
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
                          <button type="button" onClick={() => deleteCourse(index)} className="skeu-button-leather inline-flex items-center gap-2">
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
                <h2 className="font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Mark absence &amp; auto-cover</h2>
              </div>
            </div>

            <p className="text-sm mb-4" style={{ color: '#cbd5e1' }}>
              When a teacher is absent, the system automatically substitutes their scheduled lectures.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Select teacher on leave">
                <Select
                  value={absence.absentTeacher}
                  onChange={(event) => setAbsence((current) => ({ ...current, absentTeacher: event.target.value }))}
                >
                  <option value="">Choose teacher...</option>
                  {teachers.map((teacher) => (
                    <option key={teacher} value={teacher}>{teacher}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Select day">
                <Select value={absence.day} onChange={(event) => setAbsence((current) => ({ ...current, day: event.target.value }))}>
                  {days.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <button
              type="button"
              onClick={autoSubstitute}
              disabled={!data?.schedule || !absence.absentTeacher}
              className="mt-5 skeu-button-premium inline-flex items-center gap-2 disabled:opacity-50"
            >
              <CalendarDays className="h-4 w-4" />
              Mark Absent &amp; Auto-Cover Periods
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
}
