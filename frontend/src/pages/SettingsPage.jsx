import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Field, Input, Select, Banner } from '../components/ui'

/** Campus settings + room management + scheduling rules reference. */
export default function SettingsPage({ planner, setPlanner }) {
  const [editingRoom, setEditingRoom] = useState(null)
  const [newRoom, setNewRoom] = useState({ name: '', type: 'lecture', capacity: 40 })
  const [note, setNote] = useState(null) // { tone: 'info'|'error', text }

  function flash(tone, text) {
    setNote({ tone, text })
    setTimeout(() => setNote(null), 3500)
  }

  function addRoom() {
    const name = newRoom.name.trim()
    if (!name) {
      flash('error', 'Room name is required.')
      return
    }
    if (planner.rooms.some((room) => room.name === name)) {
      flash('error', 'A room with that name already exists.')
      return
    }
    setPlanner((current) => ({
      ...current,
      rooms: [...current.rooms, { ...newRoom, name, capacity: Number(newRoom.capacity) }],
    }))
    setNewRoom({ name: '', type: 'lecture', capacity: 40 })
    flash('info', `Room "${name}" added.`)
  }

  function updateRoom(index, field, value) {
    setPlanner((current) => ({
      ...current,
      rooms: current.rooms.map((room, i) =>
        i === index ? { ...room, [field]: field === 'capacity' ? Number(value) : value } : room,
      ),
    }))
  }

  function deleteRoom(index) {
    if (planner.rooms.length === 1) {
      flash('error', 'You must have at least one room.')
      return
    }
    setPlanner((current) => ({
      ...current,
      rooms: current.rooms.filter((_, i) => i !== index),
    }))
    setEditingRoom(null)
    flash('info', 'Room deleted.')
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#2a2d3a' }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {note ? (
          <div className="mb-5">
            <Banner tone={note.tone === 'error' ? 'error' : 'info'}>{note.text}</Banner>
          </div>
        ) : null}

        <div className="rounded-[30px] p-6 glass glass-elevated">
          <div className="mb-8">
            <p className="text-sm font-medium" style={{ color: '#a0aec0' }}>System Configuration</p>
            <h2 className="font-['Space_Grotesk',sans-serif] text-2xl" style={{ color: '#e2e8f0' }}>Settings &amp; Preferences</h2>
          </div>

          <div className="space-y-8">
            {/* Campus Settings */}
            <div className="rounded-[24px] p-6 glass glass-cyan">
              <h3 className="text-lg font-semibold mb-5" style={{ color: '#e2e8f0' }}>Campus Settings</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Campus Name">
                  <Input
                    value={planner.campusName}
                    onChange={(event) => setPlanner((current) => ({ ...current, campusName: event.target.value }))}
                  />
                </Field>
                <Field label="Blocked Times (comma-separated)">
                  <Input
                    value={planner.globalRules.blockedTimes.join(', ')}
                    onChange={(event) =>
                      setPlanner((current) => ({
                        ...current,
                        globalRules: {
                          ...current.globalRules,
                          blockedTimes: event.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                        },
                      }))
                    }
                    placeholder="12:00, 16:00"
                  />
                </Field>
              </div>
            </div>

            {/* Room Management */}
            <div className="rounded-[24px] p-6 glass glass-purple">
              <h3 className="text-lg font-semibold mb-5" style={{ color: '#e2e8f0' }}>Room Management</h3>

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
                      className="w-full rounded-full px-4 py-3 text-sm font-medium text-white transition inline-flex items-center justify-center gap-1"
                      style={{ backgroundColor: '#4F46E5' }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Room
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {planner.rooms.map((room, index) => (
                  <div
                    key={room.name}
                    className="rounded-[20px] p-5 transition-all glass"
                    style={{ '--glass-color': editingRoom === index ? '#9ca3af' : '#a1a5b0' }}
                  >
                    {editingRoom === index ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-4">
                          <Field label="Room Name">
                            <Input value={room.name} onChange={(e) => updateRoom(index, 'name', e.target.value)} />
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
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold" style={{ color: '#a1a5b0' }}>{room.name}</p>
                          <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>
                            {room.type.charAt(0).toUpperCase() + room.type.slice(1)} • Capacity: {room.capacity}
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
              <h3 className="text-lg font-semibold mb-5" style={{ color: '#e2e8f0' }}>Scheduling Rules</h3>
              <div className="space-y-4">
                {[
                  ['No Back-to-Back Classes', "Same course won't be scheduled in consecutive time slots in the same room"],
                  ['Smart Teacher Substitution', 'Absent teachers are replaced by colleagues who teach similar subjects'],
                  ['Room Type Enforcement', 'Lab courses are only scheduled in lab rooms; lecture courses in any suitable room'],
                  ['Lunch Break Protection', 'The 12:00–13:00 window is always reserved as a global blocked time'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-[20px] p-4 glass glass-elevated">
                    <p className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>✓ {title}</p>
                    <p className="text-sm mt-1" style={{ color: '#a0aec0' }}>{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
