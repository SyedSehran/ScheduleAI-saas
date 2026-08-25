import { useState } from 'react'
import { Field, Input, Select } from '../components/ui'
import { teacherList } from './helpers'

/**
 * Syllabus-coverage tracker: compare required lectures vs scheduled hours per
 * course, with inline editing of coverage targets.
 */
export default function TeachingLoadPage({ planner, setPlanner, data, setData, notify, fail }) {
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [editingCourse, setEditingCourse] = useState(null)
  const [tempRequired, setTempRequired] = useState(0)

  const filteredCourses = (planner.courses || [])
    .map((course, index) => ({ ...course, _index: index }))
    .filter((course) => !selectedTeacher || course.faculty === selectedTeacher)

  const totalHoursRequired = filteredCourses.reduce((sum, course) => sum + (Number(course.requiredLecturesToCover) || 0), 0)
  const totalHoursScheduled = filteredCourses.reduce(
    (sum, course) => sum + (course.theoryHoursPerWeek + course.practicalHoursPerWeek),
    0,
  )

  function startEditCourse(course) {
    setEditingCourse(course.id)
    setTempRequired(course.requiredLecturesToCover || course.theoryHoursPerWeek)
  }

  function saveEditCourse(courseId, courseIndex) {
    const requiredValue = Number(tempRequired)
    if (!Number.isFinite(requiredValue) || requiredValue <= 0) {
      fail('Required lectures must be a positive number.')
      return
    }

    setPlanner((current) => ({
      ...current,
      courses: current.courses.map((course, index) =>
        index === courseIndex ? { ...course, requiredLecturesToCover: requiredValue } : course,
      ),
    }))

    setData((current) => {
      if (!current?.parsed?.courses) return current
      return {
        ...current,
        parsed: {
          ...current.parsed,
          courses: current.parsed.courses.map((course) =>
            course.id === courseId ? { ...course, requiredLecturesToCover: requiredValue } : course,
          ),
        },
      }
    })
    notify('Syllabus requirement updated successfully.')
    setEditingCourse(null)
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[30px] p-6 glass glass-elevated">
          <div className="mb-6">
            <div className="mb-4">
              <p className="text-sm font-medium" style={{ color: '#a0aec0' }}>Teaching Load &amp; Syllabus Coverage</p>
              <h3 className="font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Monitor and Edit Course Requirements</h3>
            </div>
            <div className="max-w-xs">
              <Select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>
                <option value="">All teachers</option>
                {teacherList(data?.parsed, data?.schedule).map((teacher) => (
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
              const requiredLectures = Number(course.requiredLecturesToCover || course.theoryHoursPerWeek || 0)
              const coveragePercent =
                requiredLectures > 0 ? Math.round((course.theoryHoursPerWeek / requiredLectures) * 100) : 0
              const isCoverageSufficient = course.theoryHoursPerWeek >= requiredLectures
              const isEditing = editingCourse === course.id

              return (
                <div
                  key={course.id}
                  className="group rounded-[20px] px-5 py-4 transition-all glass"
                  style={{ '--glass-color': isEditing ? '#9ca3af' : '#a1a5b0' }}
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
                          <Input type="number" value={course.theoryHoursPerWeek} disabled style={{ cursor: 'not-allowed', opacity: 0.7 }} />
                        </Field>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEditCourse(course.id, course._index)}
                          className="rounded-full px-4 py-2 text-sm text-white transition"
                          style={{ backgroundColor: '#4F46E5' }}
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

                      <div className="w-full rounded-full h-2" style={{ backgroundColor: 'rgba(148,163,184,0.25)' }}>
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(coveragePercent, 100)}%`,
                            backgroundColor: isCoverageSufficient ? '#10B981' : '#F97316',
                          }}
                        />
                      </div>

                      <p className="text-xs mt-2" style={{ color: '#a0aec0' }}>
                        {isCoverageSufficient
                          ? '✓ Syllabus coverage sufficient'
                          : `⚠ Need ${requiredLectures - course.theoryHoursPerWeek} more hours`}
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
