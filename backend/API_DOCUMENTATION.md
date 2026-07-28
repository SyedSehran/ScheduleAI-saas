# ScheduleAI Comprehensive API Documentation

## Base URL
`http://localhost:4000/api`

---

## OPTION B: Smart Input Suggestions

### POST `/suggest/course-requirements`
**Purpose:** Get AI suggestions for course requirements based on course name
**Request Body:**
```json
{
  "courseName": "Introduction to Python",
  "faculty": "Computer Science"  // optional
}
```
**Response:**
```json
{
  "courseName": "Introduction to Python",
  "suggestions": {
    "theoryHours": 3,
    "practicalHours": 2,
    "studentCount": 80,
    "roomType": "Lecture/Lab Combination",
    "practicalSessionLength": 2
  }
}
```

---

### POST `/suggest/room-assignment`
**Purpose:** Get AI suggestions for room assignment based on course type and capacity
**Request Body:**
```json
{
  "courseType": "Lecture",
  "studentCount": 100,
  "sessionType": "lecture"  // or "lab"
}
```
**Response:**
```json
{
  "suggestedRoom": {
    "roomType": "Large Lecture Hall",
    "minimumCapacity": 120,
    "preferredFeatures": ["Projector", "Whiteboard", "Microphone"]
  }
}
```

---

### POST `/suggest/preferred-days`
**Purpose:** Get AI suggestions for distributing course sessions across the week
**Request Body:**
```json
{
  "courseName": "Data Structures",
  "theoryHours": 3
}
```
**Response:**
```json
{
  "courseName": "Data Structures",
  "suggestedDays": {
    "sessions": ["Monday", "Wednesday", "Friday"],
    "spacing": "Even distribution",
    "rationale": "Distributes theory across week..."
  }
}
```

---

### POST `/suggest/validate-course`
**Purpose:** Validate course data and get suggestions for fixing issues
**Request Body:**
```json
{
  "courseData": {
    "courseName": "Web Development",
    "faculty": "IT Department",
    "studentCount": 50,
    "theoryHours": 2,
    "practicalHours": 2
  }
}
```
**Response:**
```json
{
  "courseData": {...},
  "validation": {
    "isValid": true,
    "issues": [],
    "suggestions": ["Consider adding more practical sessions"]
  }
}
```

---

## OPTION C: Data Parsing

### POST `/parse/text`
**Purpose:** Parse course data from natural language text
**Request Body:**
```json
{
  "text": "Chemistry lab meets Monday 10am for 2 hours with 30 students in room 205"
}
```
**Response:**
```json
{
  "source": "text",
  "courses": [
    {
      "courseName": "Chemistry Lab",
      "day": "Monday",
      "time": "10:00",
      "duration": 2,
      "studentCount": 30,
      "room": "205"
    }
  ]
}
```

---

### POST `/parse/csv`
**Purpose:** Parse course data from CSV format
**Request Body:**
```json
{
  "csvContent": "courseName,faculty,studentCount,theoryHours,practicalHours\nPython,CS,80,3,2\nJava,CS,70,3,2"
}
```
**Response:**
```json
{
  "source": "csv",
  "courses": [
    {
      "courseName": "Python",
      "faculty": "CS",
      "studentCount": 80,
      "theoryHours": 3,
      "practicalHours": 2
    },
    {
      "courseName": "Java",
      "faculty": "CS",
      "studentCount": 70,
      "theoryHours": 3,
      "practicalHours": 2
    }
  ]
}
```

---

### POST `/parse/prompt`
**Purpose:** Extract structured schedule data from user natural language prompt
**Request Body:**
```json
{
  "userPrompt": "I need to schedule 10 courses for next semester. We have 5 classrooms with capacities 50, 80, 100, 120, 150"
}
```
**Response:**
```json
{
  "source": "prompt",
  "extracted": {
    "courses": [...],
    "rooms": [...],
    "constraints": [...]
  }
}
```

---

## OPTION D: Schedule Analyzer

### POST `/analyze/quality`
**Purpose:** Analyze overall quality of a generated schedule
**Request Body:**
```json
{
  "schedule": {
    "assignments": [
      {
        "day": "Monday",
        "time": "09:00",
        "courseName": "Python",
        "faculty": "Dr. Smith",
        "duration": 1,
        "room": "L101",
        "sections": ["A"]
      }
    ]
  },
  "parsed": {"courses": []}
}
```
**Response:**
```json
{
  "quality": {
    "overallScore": 78,
    "strengths": [
      "Good room utilization",
      "Balanced teacher load"
    ],
    "weaknesses": [
      "Some time slots underutilized"
    ],
    "riskFactors": [
      "Potential conflicts on Wednesday"
    ],
    "recommendations": [
      "Consolidate afternoon sessions",
      "Better distribute Friday classes"
    ]
  }
}
```

---

### POST `/analyze/conflicts`
**Purpose:** Detect scheduling conflicts and problems
**Request Body:**
```json
{
  "schedule": {...},
  "parsed": {...}
}
```
**Response:**
```json
{
  "conflicts": {
    "criticalIssues": [
      {
        "issue": "Faculty double-booked",
        "affectedParties": ["Dr. Smith"],
        "severity": 5,
        "resolution": "Move one class to different time"
      }
    ],
    "warnings": [...],
    "suggestions": [...]
  }
}
```

---

### POST `/analyze/optimizations`
**Purpose:** Get optimization suggestions for improved schedule
**Request Body:**
```json
{
  "schedule": {...},
  "parsed": {...}
}
```
**Response:**
```json
{
  "optimizations": {
    "immediateOptimizations": [
      {
        "description": "Merge sections A and B for same time slot",
        "expectedImprovement": "15% room utilization increase",
        "difficulty": "Easy",
        "timeRequired": "5 minutes"
      }
    ],
    "structuralImprovements": [...],
    "longTermStrategies": [...]
  }
}
```

---

### POST `/analyze/cost`
**Purpose:** Analyze cost and resource efficiency
**Request Body:**
```json
{
  "schedule": {...},
  "parsed": {...}
}
```
**Response:**
```json
{
  "costAnalysis": {
    "estimatedCost": "baseline",
    "efficiencyMetrics": {
      "roomUtilization": "72%",
      "teacherEfficiency": "High",
      "costPerStudentHour": "$15.50"
    },
    "savingOpportunities": [
      "Consolidate low-enrollment classes"
    ],
    "investmentNeeds": [
      "Upgrade projectors in 3 rooms"
    ]
  }
}
```

---

## OPTION E: Learning System

### POST `/learn/record-preference`
**Purpose:** Record teacher feedback on generated schedule
**Request Body:**
```json
{
  "faculty": "Dr. Smith",
  "scheduleGeneration": {
    "assignments": [
      {
        "day": "Monday",
        "time": "09:00",
        "courseName": "Python Advanced"
      }
    ]
  }
}
```
**Response:**
```json
{
  "faculty": "Dr. Smith",
  "recorded": {
    "userSatisfied": true,
    "preferredPatterns": ["Morning classes", "Monday-Wednesday-Friday"],
    "avoidPatterns": ["Friday afternoons"],
    "suggestions": ["Keep classes back-to-back"]
  }
}
```

---

### POST `/learn/adaptive-suggestions`
**Purpose:** Get personalized suggestions based on teacher's history
**Request Body:**
```json
{
  "faculty": "Dr. Smith"
}
```
**Response:**
```json
{
  "faculty": "Dr. Smith",
  "suggestions": {
    "recommendedDays": ["Monday", "Wednesday", "Friday"],
    "recommendedTimes": ["09:00-11:00", "14:00-16:00"],
    "recommendedRoomTypes": ["Lecture Hall", "Computer Lab"],
    "avoidDays": ["Friday"],
    "confidenceScore": 85,
    "personalizationLevel": "advanced"
  }
}
```

---

### POST `/learn/detect-patterns`
**Purpose:** Detect scheduling patterns from teacher's history
**Request Body:**
```json
{
  "faculty": "Dr. Smith"
}
```
**Response:**
```json
{
  "faculty": "Dr. Smith",
  "patterns": {
    "patternsFound": true,
    "identifiedPatterns": [
      "Prefers morning sessions",
      "Avoids back-to-back classes",
      "Likes computer lab for practicals"
    ],
    "consistency": 87,
    "predictability": 92,
    "recommendations": [
      "Always schedule morning slots",
      "Add 30-min breaks between classes"
    ]
  }
}
```

---

### POST `/learn/predict-success`
**Purpose:** Predict if proposed schedule will satisfy teacher
**Request Body:**
```json
{
  "faculty": "Dr. Smith",
  "proposedSchedule": {
    "assignments": [...]
  }
}
```
**Response:**
```json
{
  "faculty": "Dr. Smith",
  "prediction": {
    "successProbability": 89,
    "riskFactors": ["Friday afternoon added"],
    "strengthMatches": [
      "Monday-Wednesday-Friday pattern",
      "Morning time slot"
    ],
    "suggestedTweaks": [
      "Move Friday class to Thursday"
    ],
    "confidence": 92
  }
}
```

---

### POST `/learn/global-analysis`
**Purpose:** Analyze patterns across all generated schedules
**Request Body:**
```json
{
  "allSchedules": [
    {...},
    {...}
  ]
}
```
**Response:**
```json
{
  "globalLearnings": {
    "globaBestPractices": [
      "Distribute courses across all 5 days",
      "Maintain 1-hour lunch break",
      "Avoid back-to-back classes for same faculty"
    ],
    "commonSuccessFactors": [...],
    "frequentProblems": [...],
    "departmentSpecificInsights": {...},
    "recommendations": [...]
  }
}
```

---

### GET `/learn/stats`
**Purpose:** Get overall learning system statistics
**Response:**
```json
{
  "stats": {
    "totalTeachers": 15,
    "totalSchedulesAnalyzed": 47,
    "lastGlobalAnalysis": "2024-01-15T10:30:00Z",
    "teacherStats": {
      "Dr. Smith": {
        "faculty": "Dr. Smith",
        "schedulesGenerated": 8,
        "acceptanceRate": 87,
        "acceptedCount": 7,
        "rejectedCount": 1,
        "feedbackRecords": 8,
        "lastFeedback": "2024-01-15T09:45:00Z"
      }
    }
  }
}
```

---

### GET `/learn/teacher-stats/:faculty`
**Purpose:** Get specific teacher's learning statistics
**Route Parameter:** `faculty` - Teacher name/ID
**Response:**
```json
{
  "stats": {
    "faculty": "Dr. Smith",
    "schedulesGenerated": 8,
    "acceptanceRate": 87,
    "acceptedCount": 7,
    "rejectedCount": 1,
    "feedbackRecords": 8,
    "lastFeedback": "2024-01-15T09:45:00Z"
  }
}
```

---

### POST `/learn/reset`
**Purpose:** Reset learning data for a teacher or all teachers
**Request Body:**
```json
{
  "faculty": "Dr. Smith"  // optional - if omitted, resets all
}
```
**Response:**
```json
{
  "success": true,
  "message": "Reset learning for Dr. Smith"
}
```

---

## Existing Endpoints (Unchanged)

### GET `/health`
Returns system health and Ollama status
```json
{"ok":true,"name":"ScheduleAI API","ollamaEnabled":true}
```

### POST `/generate`
Generates timetable from input

### POST `/substitute`
Applies course substitutions to schedule

### POST `/substitute/day`
Applies automatic substitution for a specific day

### POST `/export/ical`
Exports schedule as iCal file

### POST `/optimize/ai`
Gets AI-powered optimization suggestions

---

## Error Responses

All endpoints return error responses in this format:
```json
{
  "error": "Description of what went wrong",
  "detail": "Additional error details if available"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (missing/invalid parameters)
- `500` - Server error

---

## Testing Examples

### Test Option B (Smart Input)
```bash
curl -X POST http://localhost:4000/api/suggest/course-requirements \
  -H "Content-Type: application/json" \
  -d '{"courseName":"Python","faculty":"CS"}'
```

### Test Option C (Data Parsing)
```bash
curl -X POST http://localhost:4000/api/parse/text \
  -H "Content-Type: application/json" \
  -d '{"text":"Chemistry lab Monday 10am 2 hours 30 students room 205"}'
```

### Test Option D (Schedule Analysis)
```bash
curl -X POST http://localhost:4000/api/analyze/quality \
  -H "Content-Type: application/json" \
  -d '{"schedule":{"assignments":[]},"parsed":{}}'
```

### Test Option E (Learning)
```bash
curl -X POST http://localhost:4000/api/learn/record-preference \
  -H "Content-Type: application/json" \
  -d '{"faculty":"Dr. Smith","scheduleGeneration":{"assignments":[]}}'

curl -X GET http://localhost:4000/api/learn/stats
```

---

## Data Persistence

- **Smart Input**: Suggestions generated on-demand via Ollama
- **Data Parser**: Parsing done on-demand via Ollama
- **Schedule Analyzer**: Analysis generated on-demand via Ollama
- **Learning System**: Preferences and patterns stored in `backend/learning_database.json`

---

## Frontend Integration Notes

The frontend (`frontend/src/App.jsx`) should:
1. Call `/api/suggest/*` endpoints when users are entering course data
2. Call `/api/parse/*` endpoints when uploading or pasting data
3. Call `/api/analyze/*` endpoints after generating a schedule to show analysis
4. Call `/api/learn/*` endpoints to record feedback and get personalized suggestions

Suggested UI workflow:
1. **Data Input Phase**: Use suggested days/rooms/requirements (Options B/C)
2. **Schedule Generation**: Generate timetable
3. **Analysis Phase**: Show quality/conflicts/optimizations (Option D)
4. **Feedback Phase**: Record teacher preferences (Option E)
5. **Future Generations**: Use adaptive suggestions for next schedule (Option E)

---

**Last Updated:** January 2024
**Ollama Status:** Required (for all AI functions)
**Backend Status:** Running on http://localhost:4000
