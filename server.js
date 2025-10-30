const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'luhambo.db');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentNo TEXT UNIQUE NOT NULL,
    fullName TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    buildingName TEXT NOT NULL,
    roomNumber TEXT NOT NULL,
    floor TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Admins table
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    fullName TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Reports table
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER NOT NULL,
    studentNo TEXT NOT NULL,
    buildingName TEXT NOT NULL,
    roomNumber TEXT NOT NULL,
    floor TEXT NOT NULL,
    issueDescription TEXT NOT NULL,
    category TEXT NOT NULL,
    imagePath TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'Normal',
    adminNotes TEXT DEFAULT '',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studentId) REFERENCES users (id)
  )`);

  // Chat messages table
  db.run(`CREATE TABLE IF NOT EXISTS chatMessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reportId INTEGER NOT NULL,
    senderType TEXT NOT NULL,
    senderId INTEGER NOT NULL,
    message TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reportId) REFERENCES reports (id)
  )`);

  // Insert default admin if not exists
  db.get("SELECT COUNT(*) as count FROM admins WHERE username = 'admin'", (err, row) => {
    if (err) {
      console.error('Error checking admin:', err);
      return;
    }
    if (row.count === 0) {
      db.run(`INSERT INTO admins (username, email, password, fullName) 
              VALUES (?, ?, ?, ?)`, 
        ['admin', 'admin@luhambo.co.za', 'admin123', 'System Administrator']);
      console.log('Default admin created');
    }
  });

  // Insert sample user if not exists
  db.get("SELECT COUNT(*) as count FROM users WHERE studentNo = '2024001'", (err, row) => {
    if (err) {
      console.error('Error checking sample user:', err);
      return;
    }
    if (row.count === 0) {
      db.run(`INSERT INTO users (studentNo, fullName, email, password, buildingName, roomNumber, floor) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        ['2024001', 'Sample Student', 'student@example.com', 'student123', 'Building A', '101', 'First Floor']);
      console.log('Sample user created');
    }
  });
});

// API Routes

// User registration
app.post('/api/register', (req, res) => {
  const { fullName, studentNo, email, buildingName, roomNumber, floor, password } = req.body;
  
  db.run(`INSERT INTO users (studentNo, fullName, email, password, buildingName, roomNumber, floor) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [studentNo, fullName, email, password, buildingName, roomNumber, floor], 
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ success: false, message: 'Student number or email already exists' });
        }
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      res.json({ success: true, message: 'Registration successful', userId: this.lastID });
    });
});

// User login
app.post('/api/login/student', (req, res) => {
  const { identifier, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE (studentNo = ? OR email = ?) AND password = ?`, 
    [identifier, identifier, password], (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      // Remove password from response
      delete user.password;
      res.json({ success: true, user });
    });
});

// Admin login
app.post('/api/login/admin', (req, res) => {
  const { username, password } = req.body;
  
  db.get(`SELECT * FROM admins WHERE username = ? AND password = ?`, 
    [username, password], (err, admin) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
      }
      if (!admin) {
        return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
      }
      // Remove password from response
      delete admin.password;
      res.json({ success: true, admin });
    });
});

// Submit report
app.post('/api/reports', (req, res) => {
  const { studentId, studentNo, buildingName, roomNumber, floor, issueDescription, category, priority } = req.body;
  
  db.run(`INSERT INTO reports (studentId, studentNo, buildingName, roomNumber, floor, issueDescription, category, priority) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [studentId, studentNo, buildingName, roomNumber, floor, issueDescription, category, priority], 
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to submit report' });
      }
      res.json({ success: true, message: 'Report submitted successfully', reportId: this.lastID });
    });
});

// Get user reports
app.get('/api/reports/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  
  db.all(`SELECT * FROM reports WHERE studentId = ? ORDER BY createdAt DESC`, 
    [studentId], (err, reports) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch reports' });
      }
      res.json({ success: true, reports });
    });
});

// Get all reports (for admin)
app.get('/api/reports', (req, res) => {
  const { status, building, priority } = req.query;
  
  let query = `SELECT r.*, u.fullName as studentName FROM reports r 
               LEFT JOIN users u ON r.studentId = u.id WHERE 1=1`;
  let params = [];
  
  if (status) {
    query += ` AND r.status = ?`;
    params.push(status);
  }
  if (building) {
    query += ` AND r.buildingName = ?`;
    params.push(building);
  }
  if (priority) {
    query += ` AND r.priority = ?`;
    params.push(priority);
  }
  
  query += ` ORDER BY r.createdAt DESC`;
  
  db.all(query, params, (err, reports) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to fetch reports' });
    }
    res.json({ success: true, reports });
  });
});

// Update report (admin)
app.put('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  const { status, priority, adminNotes } = req.body;
  
  db.run(`UPDATE reports SET status = ?, priority = ?, adminNotes = ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE id = ?`, 
    [status, priority, adminNotes, id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to update report' });
      }
      res.json({ success: true, message: 'Report updated successfully' });
    });
});

// Chat messages
app.get('/api/chat/:reportId', (req, res) => {
  const { reportId } = req.params;
  
  db.all(`SELECT * FROM chatMessages WHERE reportId = ? ORDER BY createdAt ASC`, 
    [reportId], (err, messages) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
      }
      res.json({ success: true, messages });
    });
});

app.post('/api/chat/:reportId', (req, res) => {
  const { reportId } = req.params;
  const { senderType, senderId, message } = req.body;
  
  db.run(`INSERT INTO chatMessages (reportId, senderType, senderId, message) 
          VALUES (?, ?, ?, ?)`, 
    [reportId, senderType, senderId, message], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to send message' });
      }
      res.json({ success: true, message: 'Message sent', messageId: this.lastID });
    });
});

// Get users (admin)
app.get('/api/users', (req, res) => {
  const { search } = req.query;
  
  let query = `SELECT * FROM users`;
  let params = [];
  
  if (search) {
    query += ` WHERE fullName LIKE ? OR studentNo LIKE ?`;
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ` ORDER BY createdAt DESC`;
  
  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
    res.json({ success: true, users });
  });
});

// Dashboard stats
app.get('/api/stats/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  
  db.get(`SELECT 
    COUNT(*) as totalReports,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingReports,
    SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgressReports,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedReports
    FROM reports WHERE studentId = ?`, 
    [studentId], (err, stats) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
      }
      res.json({ success: true, stats });
    });
});

app.get('/api/stats/admin', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  db.get(`SELECT 
    COUNT(*) as totalReports,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingReports,
    SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgressReports,
    SUM(CASE WHEN status = 'completed' AND DATE(updatedAt) = ? THEN 1 ELSE 0 END) as completedToday,
    (SELECT COUNT(*) FROM users) as totalUsers
    FROM reports`, 
    [today], (err, stats) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
      }
      res.json({ success: true, stats });
    });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Luhambo Maintenance System running on http://localhost:${PORT}`);
  console.log(`SQLite database initialized: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});