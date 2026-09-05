const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'society-management-secret-key-2024';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(express.static('uploads'));

// Serve the main HTML file at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public-index.html'));
});

// Create uploads directory
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('uploads/bills')) {
  fs.mkdirSync('uploads/bills');
}
if (!fs.existsSync('uploads/photos')) {
  fs.mkdirSync('uploads/photos');
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.fileType || 'bills';
    cb(null, `uploads/${type}`);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Database initialization
const db = new sqlite3.Database('society.db');

const initializeDatabase = () => {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      mobile TEXT,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      society_id INTEGER,
      flat_number TEXT,
      family_members INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Societies table
    db.run(`CREATE TABLE IF NOT EXISTS societies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      logo TEXT,
      contact TEXT,
      total_flats INTEGER,
      organizer_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizer_id) REFERENCES users(id)
    )`);

    // Flats table
    db.run(`CREATE TABLE IF NOT EXISTS flats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id INTEGER NOT NULL,
      flat_number TEXT NOT NULL,
      owner_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )`);

    // Events table
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      date TEXT,
      time TEXT,
      location TEXT,
      type TEXT,
      description TEXT,
      status TEXT DEFAULT 'published',
      organizer_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id),
      FOREIGN KEY (organizer_id) REFERENCES users(id)
    )`);

    // Income table
    db.run(`CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id INTEGER NOT NULL,
      event_id INTEGER,
      category TEXT,
      description TEXT,
      amount REAL,
      payment_method TEXT,
      received_from TEXT,
      reference_number TEXT,
      notes TEXT,
      bill_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )`);

    // Expenses table
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id INTEGER NOT NULL,
      event_id INTEGER,
      category TEXT,
      vendor TEXT,
      description TEXT,
      amount REAL,
      payment_method TEXT,
      bill_number TEXT,
      notes TEXT,
      bill_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )`);

    // Bills table
    db.run(`CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id INTEGER NOT NULL,
      event_id INTEGER,
      type TEXT,
      file_path TEXT,
      amount REAL,
      vendor TEXT,
      category TEXT,
      date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )`);

    // Announcements table
    db.run(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      attachment TEXT,
      status TEXT DEFAULT 'published',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id)
    )`);

    // Photos table
    db.run(`CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      society_id INTEGER NOT NULL,
      event_id INTEGER,
      file_path TEXT,
      caption TEXT,
      album_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (society_id) REFERENCES societies(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )`);

    // Audit logs table
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      module TEXT,
      record_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  });
};

// Initialize DB
initializeDatabase();

// Seed sample data
const seedData = () => {
  db.get("SELECT COUNT(*) as count FROM societies", (err, row) => {
    if (row.count === 0) {
      // Add sample organizer
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run(
        `INSERT INTO users (email, mobile, password, name, role, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin@society.com', '9876543210', hashedPassword, 'Admin Organizer', 'organizer', 'active'],
        function (err) {
          if (!err) {
            const organizerId = this.lastID;
            
            // Add sample society
            db.run(
              `INSERT INTO societies (name, address, city, state, pincode, contact, total_flats, organizer_id) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              ['Saranga Flat & Pramukhpark Society', 'MG Road', 'Ahmedabad', 'Gujarat', '380001', '9876543210', 5, organizerId],
              function (err) {
                if (!err) {
                  const societyId = this.lastID;
                  
                  // Add sample flats
                  const flats = ['A-101', 'A-102', 'A-103', 'A-104', 'A-105'];
                  flats.forEach((flatNo, index) => {
                    db.run(
                      `INSERT INTO flats (society_id, flat_number, status) VALUES (?, ?, ?)`,
                      [societyId, flatNo, 'active']
                    );
                  });

                  // Add sample owners
                  const owners = [
                    { name: 'Raj Patel', email: 'raj@example.com', mobile: '9876543210', flat: 'A-101' },
                    { name: 'Priya Sharma', email: 'priya@example.com', mobile: '9876543211', flat: 'A-102' },
                    { name: 'Amit Kumar', email: 'amit@example.com', mobile: '9876543212', flat: 'A-103' }
                  ];

                  owners.forEach(owner => {
                    const ownerPassword = bcrypt.hashSync('owner123', 10);
                    db.run(
                      `INSERT INTO users (email, mobile, password, name, role, society_id, flat_number, family_members, status) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [owner.email, owner.mobile, ownerPassword, owner.name, 'user', societyId, owner.flat, 4, 'active']
                    );
                  });

                  // Add sample event
                  db.run(
                    `INSERT INTO events (society_id, name, date, time, location, type, description, organizer_id, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [societyId, 'Shree Krishna Janmashtami 2026', '2026-09-04', '9:00 PM', 'Saranga Society', 'Religious', 'Janmashtami celebration with Garba and Bhajan', organizerId, 'published'],
                    function (err) {
                      if (!err) {
                        const eventId = this.lastID;

                        // Add sample income
                        db.run(
                          `INSERT INTO income (society_id, event_id, category, description, amount, payment_method, received_from) 
                           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                          [societyId, eventId, 'Donation', 'Donation from Flat A-101', 25000, 'UPI', 'Raj Patel']
                        );

                        db.run(
                          `INSERT INTO income (society_id, event_id, category, description, amount, payment_method, received_from) 
                           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                          [societyId, eventId, 'Sponsorship', 'Sponsorship from local vendor', 15000, 'Bank Transfer', 'XYZ Company']
                        );

                        // Add sample expenses
                        db.run(
                          `INSERT INTO expenses (society_id, event_id, category, vendor, description, amount, payment_method) 
                           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                          [societyId, eventId, 'Decoration', 'Flower Decor', 'Decoration items', 8000, 'Cash']
                        );

                        db.run(
                          `INSERT INTO expenses (society_id, event_id, category, vendor, description, amount, payment_method) 
                           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                          [societyId, eventId, 'Sound System', 'XYZ Sound', 'Sound system rental', 6000, 'Cash']
                        );

                        db.run(
                          `INSERT INTO expenses (society_id, event_id, category, vendor, description, amount, payment_method) 
                           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                          [societyId, eventId, 'Food', 'Catering Services', 'Food for 200 people', 12000, 'Bank Transfer']
                        );
                      }
                    }
                  );
                }
              }
            );
          }
        }
      );
    }
  });
};

seedData();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Authorization middleware
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You are not authorized to access this section' });
    }
    next();
  };
};

// ==================== AUTH ROUTES ====================

app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;

  db.get(
    `SELECT * FROM users WHERE email = ? AND role = ?`,
    [email, role],
    (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Invalid login credentials' });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid login credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, society_id: user.society_id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          society_id: user.society_id,
          flat_number: user.flat_number
        }
      });
    }
  );
});

app.post('/api/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ==================== SOCIETY ROUTES ====================

app.get('/api/society', authenticateToken, (req, res) => {
  const societyId = req.user.society_id;

  db.get(
    `SELECT * FROM societies WHERE id = ?`,
    [societyId],
    (err, society) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(society);
    }
  );
});

app.post('/api/society', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { name, address, city, state, pincode, contact, total_flats } = req.body;

  db.run(
    `INSERT INTO societies (name, address, city, state, pincode, contact, total_flats, organizer_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, address, city, state, pincode, contact, total_flats, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Create flats automatically
      const societyId = this.lastID;
      for (let i = 1; i <= total_flats; i++) {
        const flatNumber = `${String.fromCharCode(64 + Math.ceil(i / 100))}-${String(i).padStart(3, '0')}`;
        db.run(
          `INSERT INTO flats (society_id, flat_number, status) VALUES (?, ?, ?)`,
          [societyId, flatNumber, 'active']
        );
      }

      db.get(`SELECT * FROM societies WHERE id = ?`, [societyId], (err, society) => {
        res.status(201).json(society);
      });
    }
  );
});

app.put('/api/society/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { name, address, city, state, pincode, contact } = req.body;

  db.run(
    `UPDATE societies SET name=?, address=?, city=?, state=?, pincode=?, contact=? WHERE id=? AND organizer_id=?`,
    [name, address, city, state, pincode, contact, req.params.id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT * FROM societies WHERE id = ?`, [req.params.id], (err, society) => {
        res.json(society);
      });
    }
  );
});

// ==================== FLATS ROUTES ====================

app.get('/api/flats', authenticateToken, (req, res) => {
  const societyId = req.user.society_id;

  db.all(
    `SELECT f.*, u.name as owner_name, u.email, u.mobile FROM flats f 
     LEFT JOIN users u ON f.owner_id = u.id 
     WHERE f.society_id = ? ORDER BY f.flat_number`,
    [societyId],
    (err, flats) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(flats);
    }
  );
});

app.post('/api/flats', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { flat_number, owner_id } = req.body;
  const societyId = req.user.society_id;

  db.run(
    `INSERT INTO flats (society_id, flat_number, owner_id, status) VALUES (?, ?, ?, ?)`,
    [societyId, flat_number, owner_id || null, 'active'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, flat_number, owner_id, status: 'active' });
    }
  );
});

app.put('/api/flats/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { flat_number, owner_id, status } = req.body;

  db.run(
    `UPDATE flats SET flat_number=?, owner_id=?, status=? WHERE id=?`,
    [flat_number, owner_id, status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: req.params.id, flat_number, owner_id, status });
    }
  );
});

app.delete('/api/flats/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  db.run(`DELETE FROM flats WHERE id=?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Flat deleted successfully' });
  });
});

// ==================== USERS ROUTES ====================

app.get('/api/users', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const societyId = req.user.society_id;

  db.all(
    `SELECT id, name, email, mobile, flat_number, role, status, family_members FROM users WHERE society_id = ? OR (id = ? AND role = ?)`,
    [societyId, req.user.id, 'organizer'],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(users);
    }
  );
});

app.post('/api/users', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { name, email, mobile, flat_number, family_members, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password || 'temppass123', 10);
  const societyId = req.user.society_id;

  db.run(
    `INSERT INTO users (name, email, mobile, password, role, society_id, flat_number, family_members, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, mobile, hashedPassword, 'user', societyId, flat_number, family_members, 'active'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Link flat to owner
      if (flat_number) {
        db.run(
          `UPDATE flats SET owner_id = ? WHERE society_id = ? AND flat_number = ?`,
          [this.lastID, societyId, flat_number]
        );
      }

      res.status(201).json({ id: this.lastID, name, email, mobile, role: 'user', status: 'active' });
    }
  );
});

app.put('/api/users/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { name, email, mobile, status, family_members } = req.body;

  db.run(
    `UPDATE users SET name=?, email=?, mobile=?, status=?, family_members=? WHERE id=?`,
    [name, email, mobile, status, family_members, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'User updated successfully' });
    }
  );
});

app.put('/api/users/:id/password', authenticateToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  db.get(`SELECT password FROM users WHERE id = ?`, [req.params.id], (err, user) => {
    if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run(
      `UPDATE users SET password=? WHERE id=?`,
      [hashedPassword, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Password changed successfully' });
      }
    );
  });
});

app.get('/api/users/profile/:id', authenticateToken, (req, res) => {
  db.get(
    `SELECT id, name, email, mobile, flat_number, family_members FROM users WHERE id = ?`,
    [req.params.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(user);
    }
  );
});

// ==================== EVENTS ROUTES ====================

app.get('/api/events', authenticateToken, (req, res) => {
  const societyId = req.user.society_id;

  db.all(
    `SELECT * FROM events WHERE society_id = ? ORDER BY date DESC`,
    [societyId],
    (err, events) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(events);
    }
  );
});

app.post('/api/events', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { name, date, time, location, type, description } = req.body;
  const societyId = req.user.society_id;

  db.run(
    `INSERT INTO events (society_id, name, date, time, location, type, description, organizer_id, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [societyId, name, date, time, location, type, description, req.user.id, 'published'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, date, time, location, type, description, status: 'published' });
    }
  );
});

app.put('/api/events/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { name, date, time, location, type, description, status } = req.body;

  db.run(
    `UPDATE events SET name=?, date=?, time=?, location=?, type=?, description=?, status=? WHERE id=?`,
    [name, date, time, location, type, description, status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Event updated successfully' });
    }
  );
});

app.delete('/api/events/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  db.run(`DELETE FROM events WHERE id=?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Event deleted successfully' });
  });
});

// ==================== INCOME ROUTES ====================

app.get('/api/income', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const societyId = req.user.society_id;
  const { eventId } = req.query;

  let query = `SELECT * FROM income WHERE society_id = ?`;
  let params = [societyId];

  if (eventId) {
    query += ` AND event_id = ?`;
    params.push(eventId);
  }

  db.all(query + ` ORDER BY created_at DESC`, params, (err, income) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(income);
  });
});

app.post('/api/income', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { event_id, category, description, amount, payment_method, received_from, reference_number, notes } = req.body;
  const societyId = req.user.society_id;

  db.run(
    `INSERT INTO income (society_id, event_id, category, description, amount, payment_method, received_from, reference_number, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [societyId, event_id, category, description, amount, payment_method, received_from, reference_number, notes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Log action
      db.run(
        `INSERT INTO audit_logs (user_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'add_income', 'income', this.lastID, `Added income ₹${amount}`]
      );

      res.status(201).json({ id: this.lastID, category, amount, payment_method });
    }
  );
});

app.put('/api/income/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { category, description, amount, payment_method, received_from, reference_number, notes } = req.body;

  db.run(
    `UPDATE income SET category=?, description=?, amount=?, payment_method=?, received_from=?, reference_number=?, notes=? WHERE id=?`,
    [category, description, amount, payment_method, received_from, reference_number, notes, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Income updated successfully' });
    }
  );
});

app.delete('/api/income/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  db.run(`DELETE FROM income WHERE id=?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Income deleted successfully' });
  });
});

// ==================== EXPENSES ROUTES ====================

app.get('/api/expenses', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const societyId = req.user.society_id;
  const { eventId } = req.query;

  let query = `SELECT * FROM expenses WHERE society_id = ?`;
  let params = [societyId];

  if (eventId) {
    query += ` AND event_id = ?`;
    params.push(eventId);
  }

  db.all(query + ` ORDER BY created_at DESC`, params, (err, expenses) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(expenses);
  });
});

app.post('/api/expenses', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { event_id, category, vendor, description, amount, payment_method, bill_number, notes } = req.body;
  const societyId = req.user.society_id;

  db.run(
    `INSERT INTO expenses (society_id, event_id, category, vendor, description, amount, payment_method, bill_number, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [societyId, event_id, category, vendor, description, amount, payment_method, bill_number, notes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Log action
      db.run(
        `INSERT INTO audit_logs (user_id, action, module, record_id, details) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'add_expense', 'expense', this.lastID, `Added expense ₹${amount}`]
      );

      res.status(201).json({ id: this.lastID, category, vendor, amount, payment_method });
    }
  );
});

app.put('/api/expenses/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { category, vendor, description, amount, payment_method, bill_number, notes } = req.body;

  db.run(
    `UPDATE expenses SET category=?, vendor=?, description=?, amount=?, payment_method=?, bill_number=?, notes=? WHERE id=?`,
    [category, vendor, description, amount, payment_method, bill_number, notes, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Expense updated successfully' });
    }
  );
});

app.delete('/api/expenses/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  db.run(`DELETE FROM expenses WHERE id=?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Expense deleted successfully' });
  });
});

// ==================== FINANCIAL SUMMARY ROUTES ====================

app.get('/api/financial-summary', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const societyId = req.user.society_id;
  const { eventId } = req.query;

  let incomeQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE society_id = ?`;
  let expenseQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE society_id = ?`;
  let params = [societyId];

  if (eventId) {
    incomeQuery += ` AND event_id = ?`;
    expenseQuery += ` AND event_id = ?`;
    params.push(eventId);
  }

  let result = {};

  db.get(incomeQuery, params, (err, incomeRow) => {
    if (err) return res.status(500).json({ error: err.message });
    result.totalIncome = incomeRow.total;

    db.get(expenseQuery, params, (err, expenseRow) => {
      if (err) return res.status(500).json({ error: err.message });
      result.totalExpense = expenseRow.total;
      result.balance = result.totalIncome - result.totalExpense;

      res.json(result);
    });
  });
});

// ==================== BILLS ROUTES ====================

app.get('/api/bills', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const societyId = req.user.society_id;

  db.all(
    `SELECT * FROM bills WHERE society_id = ? ORDER BY created_at DESC`,
    [societyId],
    (err, bills) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(bills);
    }
  );
});

app.post('/api/bills', authenticateToken, authorizeRole(['organizer']), upload.single('file'), (req, res) => {
  const { event_id, type, amount, vendor, category, date } = req.body;
  const societyId = req.user.society_id;

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const filePath = `bills/${req.file.filename}`;

  db.run(
    `INSERT INTO bills (society_id, event_id, type, file_path, amount, vendor, category, date) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [societyId, event_id, type, filePath, amount, vendor, category, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, file_path: filePath });
    }
  );
});

app.delete('/api/bills/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  db.get(`SELECT file_path FROM bills WHERE id=?`, [req.params.id], (err, bill) => {
    if (bill && fs.existsSync(`uploads/${bill.file_path}`)) {
      fs.unlinkSync(`uploads/${bill.file_path}`);
    }

    db.run(`DELETE FROM bills WHERE id=?`, [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Bill deleted successfully' });
    });
  });
});

// ==================== ANNOUNCEMENTS ROUTES ====================

app.get('/api/announcements', authenticateToken, (req, res) => {
  const societyId = req.user.society_id;

  db.all(
    `SELECT * FROM announcements WHERE society_id = ? ORDER BY created_at DESC`,
    [societyId],
    (err, announcements) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(announcements);
    }
  );
});

app.post('/api/announcements', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { title, description, date, status } = req.body;
  const societyId = req.user.society_id;

  db.run(
    `INSERT INTO announcements (society_id, title, description, date, status) 
     VALUES (?, ?, ?, ?, ?)`,
    [societyId, title, description, date, status],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, title, description, date, status });
    }
  );
});

app.put('/api/announcements/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { title, description, date, status } = req.body;

  db.run(
    `UPDATE announcements SET title=?, description=?, date=?, status=? WHERE id=?`,
    [title, description, date, status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Announcement updated successfully' });
    }
  );
});

app.delete('/api/announcements/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  db.run(`DELETE FROM announcements WHERE id=?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Announcement deleted successfully' });
  });
});

// ==================== PHOTOS ROUTES ====================

app.get('/api/photos', authenticateToken, (req, res) => {
  const societyId = req.user.society_id;
  const { eventId } = req.query;

  let query = `SELECT * FROM photos WHERE society_id = ?`;
  let params = [societyId];

  if (eventId) {
    query += ` AND event_id = ?`;
    params.push(eventId);
  }

  db.all(query + ` ORDER BY created_at DESC`, params, (err, photos) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(photos);
  });
});

app.post('/api/photos', authenticateToken, upload.single('file'), (req, res) => {
  const { event_id, caption, album_name } = req.body;
  const societyId = req.user.society_id;

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const filePath = `photos/${req.file.filename}`;

  db.run(
    `INSERT INTO photos (society_id, event_id, file_path, caption, album_name) 
     VALUES (?, ?, ?, ?, ?)`,
    [societyId, event_id, filePath, caption, album_name],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, file_path: filePath, caption, album_name });
    }
  );
});

app.delete('/api/photos/:id', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  db.get(`SELECT file_path FROM photos WHERE id=?`, [req.params.id], (err, photo) => {
    if (photo && fs.existsSync(`uploads/${photo.file_path}`)) {
      fs.unlinkSync(`uploads/${photo.file_path}`);
    }

    db.run(`DELETE FROM photos WHERE id=?`, [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Photo deleted successfully' });
    });
  });
});

// ==================== REPORTS ROUTES ====================

app.get('/api/reports/financial', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const societyId = req.user.society_id;
  const { eventId, startDate, endDate } = req.query;

  let result = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    incomeByCategory: {},
    expenseByCategory: {},
    transactions: []
  };

  let incomeQuery = `SELECT * FROM income WHERE society_id = ?`;
  let expenseQuery = `SELECT * FROM expenses WHERE society_id = ?`;
  let params = [societyId];

  if (eventId) {
    incomeQuery += ` AND event_id = ?`;
    expenseQuery += ` AND event_id = ?`;
    params.push(eventId);
  }

  db.all(incomeQuery, params, (err, incomeRecords) => {
    if (err) return res.status(500).json({ error: err.message });

    incomeRecords.forEach(record => {
      result.totalIncome += record.amount;
      if (!result.incomeByCategory[record.category]) {
        result.incomeByCategory[record.category] = 0;
      }
      result.incomeByCategory[record.category] += record.amount;
    });

    db.all(expenseQuery, params, (err, expenseRecords) => {
      if (err) return res.status(500).json({ error: err.message });

      expenseRecords.forEach(record => {
        result.totalExpense += record.amount;
        if (!result.expenseByCategory[record.category]) {
          result.expenseByCategory[record.category] = 0;
        }
        result.expenseByCategory[record.category] += record.amount;
      });

      result.balance = result.totalIncome - result.totalExpense;
      res.json(result);
    });
  });
});

// ==================== PDF GENERATION ROUTES ====================

app.post('/api/generate-pdf', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const { eventId } = req.body;
  const societyId = req.user.society_id;

  db.get(`SELECT * FROM societies WHERE id = ?`, [societyId], (err, society) => {
    if (err || !society) return res.status(500).json({ error: 'Society not found' });

    db.get(`SELECT * FROM events WHERE id = ? AND society_id = ?`, [eventId, societyId], (err, event) => {
      if (err || !event) return res.status(500).json({ error: 'Event not found' });

      // Get financial data
      db.all(
        `SELECT * FROM income WHERE event_id = ? ORDER BY created_at DESC`,
        [eventId],
        (err, incomeRecords) => {
          if (err) return res.status(500).json({ error: err.message });

          db.all(
            `SELECT * FROM expenses WHERE event_id = ? ORDER BY created_at DESC`,
            [eventId],
            (err, expenseRecords) => {
              if (err) return res.status(500).json({ error: err.message });

              const totalIncome = incomeRecords.reduce((sum, rec) => sum + rec.amount, 0);
              const totalExpense = expenseRecords.reduce((sum, rec) => sum + rec.amount, 0);
              const balance = totalIncome - totalExpense;

              // Create PDF
              const doc = new PDFDocument();
              const filename = `report-${Date.now()}.pdf`;
              const filepath = path.join('uploads', filename);

              doc.pipe(fs.createWriteStream(filepath));

              // Title
              doc.fontSize(20).font('Helvetica-Bold').text(society.name, 100, 50);
              doc.fontSize(12).font('Helvetica').text(society.address, 100, 75);
              doc.text(`${society.city}, ${society.state} - ${society.pincode}`, 100, 95);

              // Event info
              doc.fontSize(16).font('Helvetica-Bold').text('Event Report', 100, 130);
              doc.fontSize(11).font('Helvetica');
              doc.text(`Event: ${event.name}`, 100, 155);
              doc.text(`Date: ${event.date}`, 100, 175);
              doc.text(`Location: ${event.location}`, 100, 195);

              // Income section
              doc.fontSize(14).font('Helvetica-Bold').text('INCOME SUMMARY', 100, 230);
              doc.fontSize(11).font('Helvetica');
              doc.text(`Total Income: ₹${totalIncome.toLocaleString('en-IN')}`, 100, 255);

              doc.fontSize(10).font('Helvetica-Bold').text('Income Details:', 100, 280);
              doc.fontSize(9).font('Helvetica');
              let yPos = 300;
              incomeRecords.forEach(record => {
                doc.text(`${record.created_at} | ${record.category} | ${record.description} | ₹${record.amount}`, 100, yPos);
                yPos += 20;
              });

              // Expense section
              yPos += 20;
              doc.fontSize(14).font('Helvetica-Bold').text('EXPENSE SUMMARY', 100, yPos);
              doc.fontSize(11).font('Helvetica');
              doc.text(`Total Expense: ₹${totalExpense.toLocaleString('en-IN')}`, 100, yPos + 25);

              doc.fontSize(10).font('Helvetica-Bold').text('Expense Details:', 100, yPos + 50);
              doc.fontSize(9).font('Helvetica');
              yPos += 70;
              expenseRecords.forEach(record => {
                doc.text(`${record.created_at} | ${record.category} | ${record.vendor} | ₹${record.amount}`, 100, yPos);
                yPos += 20;
              });

              // Final summary
              yPos += 20;
              doc.fontSize(12).font('Helvetica-Bold').text('FINAL SUMMARY', 100, yPos);
              doc.fontSize(11).font('Helvetica');
              doc.text(`Total Income: ₹${totalIncome.toLocaleString('en-IN')}`, 100, yPos + 25);
              doc.text(`Total Expense: ₹${totalExpense.toLocaleString('en-IN')}`, 100, yPos + 45);
              doc.text(`Remaining Balance: ₹${balance.toLocaleString('en-IN')}`, 100, yPos + 65);

              doc.fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, 100, yPos + 100);

              doc.end();

              res.json({ filename, url: `/uploads/${filename}` });
            }
          );
        }
      );
    });
  });
});

// ==================== DASHBOARD STATS ====================

app.get('/api/dashboard-stats', authenticateToken, authorizeRole(['organizer']), (req, res) => {
  const societyId = req.user.society_id;

  db.get(`SELECT COUNT(*) as count FROM flats WHERE society_id = ?`, [societyId], (err, flatsData) => {
    db.get(`SELECT COUNT(*) as count FROM users WHERE society_id = ? AND role = ?`, [societyId, 'user'], (err, ownersData) => {
      db.get(`SELECT COUNT(*) as count FROM events WHERE society_id = ? AND status = ?`, [societyId, 'published'], (err, activeEventsData) => {
        db.get(`SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE society_id = ?`, [societyId], (err, incomeData) => {
          db.get(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE society_id = ?`, [societyId], (err, expenseData) => {
            res.json({
              totalFlats: flatsData.count,
              totalOwners: ownersData.count,
              activePrograms: activeEventsData.count,
              totalIncome: incomeData.total,
              totalExpense: expenseData.total,
              balance: incomeData.total - expenseData.total
            });
          });
        });
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
