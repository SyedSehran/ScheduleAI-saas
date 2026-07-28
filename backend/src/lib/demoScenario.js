const demoPrompt = `
COMPUTER SCIENCE DEPARTMENT:
Dr. Mehta teaches Data Structures for CSE-A and CSE-B, 4 hrs/week, prefers Mon-Wed mornings, needs Auditorium A.
Prof. Nair teaches Operating Systems for CSE-A, 3 hrs/week, prefers afternoon, avoids Friday, Lab work needs CS Lab 1.
Dr. Sharma teaches DBMS for CSE-B, 3 hrs/week, prefers morning, needs Classroom 205.
Prof. Iyer teaches AI/ML for CSE-A, 2 hrs/week practical Thursday afternoon, CS Lab 2, 35 students.
Dr. Khan teaches Discrete Mathematics for CSE-A and CSE-B, 3 hrs/week, Tue-Wed mornings, math room preferably.
Prof. Sen teaches Software Engineering for CSE-B, 2 hrs/week, Monday afternoon preferred.

ELECTRONICS & COMMUNICATION:
Dr. Patel teaches Circuit Analysis for ECE-A, 3 hrs/week, morning preference, needs Classroom 301.
Prof. Desai teaches Digital Electronics for ECE-B, 3 hrs/week, lab 2 hrs, ECE Lab preferred.
Dr. Verma teaches Signal Processing for ECE-A, 2 hrs/week, afternoon slots, Classroom 302.
Prof. Gupta teaches Microprocessors Lab for ECE-A, 2 hrs practical, Thursday preferred, ECE Lab 1.

MECHANICAL ENGINEERING:
Dr. Reddy teaches Thermodynamics for ME-A and ME-B, 3 hrs/week, morning class.
Prof. Kumar teaches Fluid Mechanics for ME-A, 2 hrs/week, lab 2 hrs Tuesday afternoon.
Dr. Singh teaches Machine Design for ME-B, 3 hrs/week, needs CAD Lab.

CIVIL ENGINEERING:
Dr. Gupta teaches Structural Analysis for CE-A, 3 hrs/week, morning preferred.
Prof. Joshi teaches Surveying for CE-A, 2 hrs theory plus 2 hrs field lab.

Global constraints: Lunch break 12:00-13:00 (no classes), No classes on Saturday-Sunday.
`;

function buildDemoData() {
  const students = [
    // CSE-A Students
    { id: 'student-001', name: 'Raj Kumar', enrollmentNo: 'CSE-2024-001', department: 'Computer Science', section: 'CSE-A', enrolledCourses: ['cse-ds', 'cse-os', 'cse-aiml', 'cse-dm'] },
    { id: 'student-002', name: 'Priya Singh', enrollmentNo: 'CSE-2024-002', department: 'Computer Science', section: 'CSE-A', enrolledCourses: ['cse-ds', 'cse-os', 'cse-aiml', 'cse-dm'] },
    { id: 'student-003', name: 'Ankush Verma', enrollmentNo: 'CSE-2024-003', department: 'Computer Science', section: 'CSE-A', enrolledCourses: ['cse-ds', 'cse-os', 'cse-aiml', 'cse-dm'] },
    { id: 'student-004', name: 'Neha Gupta', enrollmentNo: 'CSE-2024-004', department: 'Computer Science', section: 'CSE-A', enrolledCourses: ['cse-ds', 'cse-os', 'cse-aiml', 'cse-dm'] },
    // CSE-B Students
    { id: 'student-005', name: 'Akash Sharma', enrollmentNo: 'CSE-2024-005', department: 'Computer Science', section: 'CSE-B', enrolledCourses: ['cse-ds', 'cse-dbms', 'cse-se', 'cse-dm'] },
    { id: 'student-006', name: 'Divya Patel', enrollmentNo: 'CSE-2024-006', department: 'Computer Science', section: 'CSE-B', enrolledCourses: ['cse-ds', 'cse-dbms', 'cse-se', 'cse-dm'] },
    { id: 'student-007', name: 'Rohan Desai', enrollmentNo: 'CSE-2024-007', department: 'Computer Science', section: 'CSE-B', enrolledCourses: ['cse-ds', 'cse-dbms', 'cse-se', 'cse-dm'] },
    // ECE-A Students
    { id: 'student-008', name: 'Arjun Patel', enrollmentNo: 'ECE-2024-001', department: 'Electronics & Communication', section: 'ECE-A', enrolledCourses: ['ece-ca', 'ece-sp', 'ece-mp'] },
    { id: 'student-009', name: 'Anjali Kumar', enrollmentNo: 'ECE-2024-002', department: 'Electronics & Communication', section: 'ECE-A', enrolledCourses: ['ece-ca', 'ece-sp', 'ece-mp'] },
    { id: 'student-010', name: 'Harsh Singh', enrollmentNo: 'ECE-2024-003', department: 'Electronics & Communication', section: 'ECE-A', enrolledCourses: ['ece-ca', 'ece-sp', 'ece-mp'] },
    // ECE-B Students
    { id: 'student-011', name: 'Sneha Reddy', enrollmentNo: 'ECE-2024-004', department: 'Electronics & Communication', section: 'ECE-B', enrolledCourses: ['ece-de'] },
    { id: 'student-012', name: 'Vivek Nair', enrollmentNo: 'ECE-2024-005', department: 'Electronics & Communication', section: 'ECE-B', enrolledCourses: ['ece-de'] },
    // ME-A Students
    { id: 'student-013', name: 'Ravi Menon', enrollmentNo: 'ME-2024-001', department: 'Mechanical Engineering', section: 'ME-A', enrolledCourses: ['me-thermo', 'me-fm'] },
    { id: 'student-014', name: 'Swati Malhotra', enrollmentNo: 'ME-2024-002', department: 'Mechanical Engineering', section: 'ME-A', enrolledCourses: ['me-thermo', 'me-fm'] },
    // ME-B Students
    { id: 'student-015', name: 'Nikhil Chopra', enrollmentNo: 'ME-2024-003', department: 'Mechanical Engineering', section: 'ME-B', enrolledCourses: ['me-thermo', 'me-md'] },
    // CE-A Students
    { id: 'student-016', name: 'Pradeep Kumar', enrollmentNo: 'CE-2024-001', department: 'Civil Engineering', section: 'CE-A', enrolledCourses: ['ce-sa', 'ce-survey'] },
    { id: 'student-017', name: 'Meera Sinha', enrollmentNo: 'CE-2024-002', department: 'Civil Engineering', section: 'CE-A', enrolledCourses: ['ce-sa', 'ce-survey'] }
  ];

  return {
    prompt: demoPrompt,
    campusName: "TechVision Institute of Technology",
    source: "demo",
    students,
    rooms: [
      // Lecture Halls
      { name: "Auditorium A", type: "lecture", capacity: 200 },
      { name: "Auditorium B", type: "lecture", capacity: 150 },
      { name: "Classroom 205", type: "lecture", capacity: 80 },
      { name: "Classroom 301", type: "lecture", capacity: 70 },
      { name: "Classroom 302", type: "lecture", capacity: 65 },
      { name: "Classroom 303", type: "lecture", capacity: 60 },
      { name: "Seminar Hall", type: "lecture", capacity: 120 },
      // Labs
      { name: "CS Lab 1", type: "lab", capacity: 40 },
      { name: "CS Lab 2", type: "lab", capacity: 35 },
      { name: "ECE Lab 1", type: "lab", capacity: 35 },
      { name: "ECE Lab 2", type: "lab", capacity: 40 },
      { name: "ME Lab", type: "lab", capacity: 30 },
      { name: "CE Lab", type: "lab", capacity: 25 },
      { name: "CAD Lab", type: "lab", capacity: 30 },
    ],
    globalRules: {
      blockedTimes: ["12:00"],
      notes: [
        "Lunch break 12:00-13:00 strictly reserved across all departments.",
        "No classes on Saturday-Sunday.",
        "Lab sessions require 2-hour continuous slots.",
        "All departments working with 35-40 hour/week teaching load.",
      ],
    },
    courses: [
      // ===== COMPUTER SCIENCE DEPARTMENT =====
      {
        id: "cse-ds",
        courseName: "Data Structures",
        faculty: "Dr. Mehta",
        sections: ["CSE-A", "CSE-B"],
        theoryHoursPerWeek: 4,
        practicalHoursPerWeek: 0,
        preferredBands: ["morning"],
        preferredDays: ["Monday", "Tuesday", "Wednesday"],
        blockedDays: [],
        roomPreference: "Auditorium A",
        roomType: "lecture",
        studentCount: 85,
      },
      {
        id: "cse-os",
        courseName: "Operating Systems",
        faculty: "Prof. Nair",
        sections: ["CSE-A"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 2,
        practicalSessionLength: 2,
        preferredBands: ["afternoon"],
        preferredDays: [],
        blockedDays: ["Friday"],
        roomPreference: "CS Lab 1",
        roomType: "lab",
        studentCount: 42,
      },
      {
        id: "cse-dbms",
        courseName: "DBMS",
        faculty: "Dr. Sharma",
        sections: ["CSE-B"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 1,
        preferredBands: ["morning"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "Classroom 205",
        roomType: "lecture",
        studentCount: 48,
      },
      {
        id: "cse-aiml",
        courseName: "AI/Machine Learning",
        faculty: "Prof. Iyer",
        sections: ["CSE-A"],
        theoryHoursPerWeek: 2,
        practicalHoursPerWeek: 2,
        practicalSessionLength: 2,
        preferredBands: ["afternoon"],
        preferredDays: ["Thursday"],
        blockedDays: [],
        roomPreference: "CS Lab 2",
        roomType: "lab",
        studentCount: 35,
      },
      {
        id: "cse-dm",
        courseName: "Discrete Mathematics",
        faculty: "Dr. Khan",
        sections: ["CSE-A", "CSE-B"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 0,
        preferredBands: ["morning"],
        preferredDays: ["Tuesday", "Wednesday"],
        blockedDays: [],
        roomPreference: "Seminar Hall",
        roomType: "lecture",
        studentCount: 82,
      },
      {
        id: "cse-swe",
        courseName: "Software Engineering",
        faculty: "Prof. Sen",
        sections: ["CSE-B"],
        theoryHoursPerWeek: 2,
        practicalHoursPerWeek: 1,
        preferredBands: ["afternoon"],
        preferredDays: ["Monday"],
        blockedDays: [],
        roomPreference: "Classroom 205",
        roomType: "lecture",
        studentCount: 48,
      },
      // ===== ELECTRONICS & COMMUNICATION DEPARTMENT =====
      {
        id: "ece-ca",
        courseName: "Circuit Analysis",
        faculty: "Dr. Patel",
        sections: ["ECE-A"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 1,
        preferredBands: ["morning"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "Classroom 301",
        roomType: "lecture",
        studentCount: 38,
      },
      {
        id: "ece-de",
        courseName: "Digital Electronics",
        faculty: "Prof. Desai",
        sections: ["ECE-B"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 2,
        practicalSessionLength: 2,
        preferredBands: ["afternoon"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "ECE Lab",
        roomType: "lab",
        studentCount: 40,
      },
      {
        id: "ece-sp",
        courseName: "Signal Processing",
        faculty: "Dr. Verma",
        sections: ["ECE-A"],
        theoryHoursPerWeek: 2,
        practicalHoursPerWeek: 0,
        preferredBands: ["afternoon"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "Classroom 302",
        roomType: "lecture",
        studentCount: 38,
      },
      {
        id: "ece-mp",
        courseName: "Microprocessors Lab",
        faculty: "Prof. Gupta",
        sections: ["ECE-A"],
        theoryHoursPerWeek: 0,
        practicalHoursPerWeek: 2,
        practicalSessionLength: 2,
        preferredBands: ["afternoon"],
        preferredDays: ["Thursday"],
        blockedDays: [],
        roomPreference: "ECE Lab 1",
        roomType: "lab",
        studentCount: 35,
      },
      // ===== MECHANICAL ENGINEERING DEPARTMENT =====
      {
        id: "me-thermo",
        courseName: "Thermodynamics",
        faculty: "Dr. Reddy",
        sections: ["ME-A", "ME-B"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 0,
        preferredBands: ["morning"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "Auditorium B",
        roomType: "lecture",
        studentCount: 75,
      },
      {
        id: "me-fm",
        courseName: "Fluid Mechanics",
        faculty: "Prof. Kumar",
        sections: ["ME-A"],
        theoryHoursPerWeek: 2,
        practicalHoursPerWeek: 2,
        practicalSessionLength: 2,
        preferredBands: ["afternoon"],
        preferredDays: ["Tuesday"],
        blockedDays: [],
        roomPreference: "ME Lab",
        roomType: "lab",
        studentCount: 38,
      },
      {
        id: "me-md",
        courseName: "Machine Design",
        faculty: "Dr. Singh",
        sections: ["ME-B"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 1,
        preferredBands: ["morning"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "CAD Lab",
        roomType: "lab",
        studentCount: 40,
      },
      // ===== CIVIL ENGINEERING DEPARTMENT =====
      {
        id: "ce-sa",
        courseName: "Structural Analysis",
        faculty: "Dr. Gupta",
        sections: ["CE-A"],
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 1,
        preferredBands: ["morning"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "Classroom 303",
        roomType: "lecture",
        studentCount: 35,
      },
      {
        id: "ce-survey",
        courseName: "Surveying & GIS",
        faculty: "Prof. Joshi",
        sections: ["CE-A"],
        theoryHoursPerWeek: 2,
        practicalHoursPerWeek: 2,
        practicalSessionLength: 2,
        preferredBands: ["afternoon"],
        preferredDays: [],
        blockedDays: [],
        roomPreference: "CE Lab",
        roomType: "lab",
        studentCount: 32,
      },
    ],
  };
}

module.exports = {
  demoPrompt,
  buildDemoData,
};
