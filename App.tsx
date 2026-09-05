import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// API configuration
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==================== CONTEXT ====================

const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return React.useContext(AuthContext);
}

// ==================== LOGIN PAGE ====================

function LoginPage() {
  const [role, setRole] = useState('organizer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    setEmail(role === 'organizer' ? 'admin@society.com' : 'raj@example.com');
    setPassword(role === 'organizer' ? 'admin123' : 'owner123');
  }, [role]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await API.post('/login', { email, password, role });
      login(response.data.user, response.data.token);
    } catch (err) {
      setError('Invalid login credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>📋 Society Function Management</h1>
          <p>Manage your society events with ease</p>
        </div>

        <div className="role-selector">
          <button
            className={`role-btn ${role === 'organizer' ? 'active' : ''}`}
            onClick={() => setRole('organizer')}
          >
            👨‍💼 Organizer/Admin
          </button>
          <button
            className={`role-btn ${role === 'user' ? 'active' : ''}`}
            onClick={() => setRole('user')}
          >
            🏠 Flat Owner
          </button>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div className="demo-credentials">
            <p><strong>Demo Credentials:</strong></p>
            <p>👨‍💼 Organizer: admin@society.com / admin123</p>
            <p>🏠 Owner: raj@example.com / owner123</p>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== ORGANIZER DASHBOARD ====================

function OrganizerDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [society, setSociety] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsRes, societyRes] = await Promise.all([
        API.get('/dashboard-stats'),
        API.get('/society')
      ]);
      setStats(statsRes.data);
      setSociety(societyRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="organizer-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} logout={logout} />
      
      <div className="main-content">
        {activeTab === 'dashboard' && <DashboardTab stats={stats} society={society} />}
        {activeTab === 'society' && <SocietyTab />}
        {activeTab === 'flats' && <FlatsTab />}
        {activeTab === 'owners' && <OwnersTab />}
        {activeTab === 'programs' && <ProgramsTab />}
        {activeTab === 'income' && <IncomeTab />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'bills' && <BillsTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'announcements' && <AnnouncementsTab />}
        {activeTab === 'photos' && <PhotosTab />}
      </div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, user, logout }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'ડેશબોર્ડ / Dashboard', icon: '📊' },
    { id: 'society', label: 'સોસાયટી / Society', icon: '🏢' },
    { id: 'flats', label: 'ફ્લેટ્સ / Flats', icon: '🏠' },
    { id: 'owners', label: 'માલિકો / Owners', icon: '👤' },
    { id: 'programs', label: 'કાર્યક્રમો / Programs', icon: '🎉' },
    { id: 'income', label: 'આવક / Income', icon: '💰' },
    { id: 'expenses', label: 'ખર્ચ / Expenses', icon: '💸' },
    { id: 'bills', label: 'બિલ્સ / Bills', icon: '📄' },
    { id: 'reports', label: 'રિપોર્ટ્સ / Reports', icon: '📈' },
    { id: 'announcements', label: 'સૂચના / Announcements', icon: '📢' },
    { id: 'photos', label: 'ફોટો / Photos', icon: '📸' }
  ];

  return (
    <div className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
        ☰
      </button>
      
      <div className="sidebar-header">
        <h2>📋 Society Manager</h2>
        <div className="user-info">
          <p className="username">{user?.name}</p>
          <p className="role">{user?.role}</p>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(item.id);
              setMobileOpen(false);
            }}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
          </button>
        ))}
      </nav>

      <button className="logout-btn" onClick={logout}>
        🚪 Logout
      </button>
    </div>
  );
}

function DashboardTab({ stats, society }) {
  if (!stats) return null;

  return (
    <div className="tab-content">
      <h1>📊 ડેશબોર્ડ / Dashboard</h1>
      
      <div className="society-header">
        {society && (
          <>
            <h2>{society.name}</h2>
            <p>{society.address}, {society.city}</p>
          </>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🏠</div>
          <div className="stat-content">
            <h3>Total Flats</h3>
            <p className="stat-value">{stats.totalFlats}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Registered Owners</h3>
            <p className="stat-value">{stats.totalOwners}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎉</div>
          <div className="stat-content">
            <h3>Active Programs</h3>
            <p className="stat-value">{stats.activePrograms}</p>
          </div>
        </div>

        <div className="stat-card financial">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Income</h3>
            <p className="stat-value">₹{stats.totalIncome.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="stat-card financial">
          <div className="stat-icon">💸</div>
          <div className="stat-content">
            <h3>Total Expenses</h3>
            <p className="stat-value">₹{stats.totalExpense.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="stat-card financial">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <h3>Current Balance</h3>
            <p className="stat-value">₹{stats.balance.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>📝 Quick Actions</h3>
        <p>Use the menu on the left to manage your society and events.</p>
      </div>
    </div>
  );
}

function SocietyTab() {
  const [society, setSociety] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSociety();
  }, []);

  const loadSociety = async () => {
    try {
      const res = await API.get('/society');
      setSociety(res.data);
      setFormData(res.data || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (society?.id) {
        await API.put(`/society/${society.id}`, formData);
      } else {
        const res = await API.post('/society', formData);
        setSociety(res.data);
      }
      alert('Society information saved successfully!');
    } catch (err) {
      alert('Error saving society information');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>🏢 સોસાયટી / Society Management</h1>
      
      <div className="form-section">
        <h2>Society Information</h2>
        
        <div className="form-group">
          <label>Society Name</label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Address</label>
          <input
            type="text"
            value={formData.address || ''}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>City</label>
            <input
              type="text"
              value={formData.city || ''}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>State</label>
            <input
              type="text"
              value={formData.state || ''}
              onChange={(e) => setFormData({...formData, state: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Pincode</label>
            <input
              type="text"
              value={formData.pincode || ''}
              onChange={(e) => setFormData({...formData, pincode: e.target.value})}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Contact</label>
          <input
            type="tel"
            value={formData.contact || ''}
            onChange={(e) => setFormData({...formData, contact: e.target.value})}
          />
        </div>

        <button className="btn btn-primary" onClick={handleSave}>
          Save Society Information
        </button>
      </div>
    </div>
  );
}

function FlatsTab() {
  const [flats, setFlats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ flat_number: '', owner_id: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlats();
  }, []);

  const loadFlats = async () => {
    try {
      const res = await API.get('/flats');
      setFlats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFlat = async () => {
    try {
      await API.post('/flats', formData);
      loadFlats();
      setFormData({ flat_number: '', owner_id: null });
      setShowForm(false);
      alert('Flat added successfully!');
    } catch (err) {
      alert('Error adding flat');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>🏠 ફ્લેટ્સ / Flat Management</h1>
      
      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add New Flat
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Add New Flat</h2>
          <div className="form-group">
            <label>Flat Number</label>
            <input
              type="text"
              value={formData.flat_number}
              onChange={(e) => setFormData({...formData, flat_number: e.target.value})}
              placeholder="e.g., A-101"
            />
          </div>
          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddFlat}>Add Flat</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-section">
        <h2>All Flats</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Flat Number</th>
              <th>Owner</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {flats.map((flat) => (
              <tr key={flat.id}>
                <td>{flat.flat_number}</td>
                <td>{flat.owner_name || '-'}</td>
                <td>{flat.email || '-'}</td>
                <td>{flat.mobile || '-'}</td>
                <td><span className="badge">{flat.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {flats.length === 0 && <p className="empty-state">No flats created yet.</p>}
      </div>
    </div>
  );
}

function OwnersTab() {
  const [owners, setOwners] = useState([]);
  const [flats, setFlats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    flat_number: '',
    family_members: 4,
    password: 'temppass123'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ownersRes, flatsRes] = await Promise.all([
        API.get('/users'),
        API.get('/flats')
      ]);
      setOwners(ownersRes.data.filter(u => u.role === 'user'));
      setFlats(flatsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOwner = async () => {
    try {
      await API.post('/users', formData);
      loadData();
      setFormData({ name: '', email: '', mobile: '', flat_number: '', family_members: 4, password: 'temppass123' });
      setShowForm(false);
      alert('Flat owner added successfully!');
    } catch (err) {
      alert('Error adding flat owner');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>👥 માલિકો / Flat Owner Management</h1>
      
      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add New Owner
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Add New Flat Owner</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Mobile</label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({...formData, mobile: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Flat Number</label>
              <select
                value={formData.flat_number}
                onChange={(e) => setFormData({...formData, flat_number: e.target.value})}
              >
                <option value="">Select Flat</option>
                {flats.map((flat) => (
                  <option key={flat.id} value={flat.flat_number}>{flat.flat_number}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Family Members</label>
            <input
              type="number"
              value={formData.family_members}
              onChange={(e) => setFormData({...formData, family_members: parseInt(e.target.value)})}
            />
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddOwner}>Add Owner</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-section">
        <h2>All Flat Owners</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Flat</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Family Members</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={owner.id}>
                <td>{owner.name}</td>
                <td>{owner.flat_number}</td>
                <td>{owner.email}</td>
                <td>{owner.mobile}</td>
                <td>{owner.family_members}</td>
                <td><span className="badge">{owner.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {owners.length === 0 && <p className="empty-state">No flat owners added yet.</p>}
      </div>
    </div>
  );
}

function ProgramsTab() {
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    type: 'Religious',
    description: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const res = await API.get('/events');
      setPrograms(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProgram = async () => {
    try {
      await API.post('/events', formData);
      loadPrograms();
      setFormData({ name: '', date: '', time: '', location: '', type: 'Religious', description: '' });
      setShowForm(false);
      alert('Program created successfully!');
    } catch (err) {
      alert('Error creating program');
    }
  };

  const handleDeleteProgram = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await API.delete(`/events/${id}`);
        loadPrograms();
        alert('Program deleted successfully!');
      } catch (err) {
        alert('Error deleting program');
      }
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>🎉 કાર્યક્રમો / Programs & Events</h1>
      
      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Create New Program
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Create New Program</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Program Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Janmashtami 2026"
              />
            </div>
            <div className="form-group">
              <label>Program Type</label>
              <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                <option>Religious</option>
                <option>Cultural</option>
                <option>Garba</option>
                <option>Bhajan</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="e.g., Society Community Hall"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="4"
            />
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddProgram}>Create Program</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="programs-list">
        <h2>All Programs</h2>
        {programs.map((program) => (
          <div key={program.id} className="program-card">
            <div className="program-header">
              <h3>{program.name}</h3>
              <span className="badge">{program.type}</span>
            </div>
            <div className="program-details">
              <p><strong>📅 Date:</strong> {program.date}</p>
              <p><strong>⏰ Time:</strong> {program.time}</p>
              <p><strong>📍 Location:</strong> {program.location}</p>
              <p><strong>📝 Description:</strong> {program.description}</p>
            </div>
            <button className="btn btn-danger" onClick={() => handleDeleteProgram(program.id)}>
              Delete
            </button>
          </div>
        ))}
        {programs.length === 0 && <p className="empty-state">No programs created yet.</p>}
      </div>
    </div>
  );
}

function IncomeTab() {
  const [income, setIncome] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    event_id: '',
    category: 'Donation',
    description: '',
    amount: '',
    payment_method: 'UPI',
    received_from: '',
    reference_number: '',
    notes: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [incomeRes, programsRes] = await Promise.all([
        API.get('/income'),
        API.get('/events')
      ]);
      setIncome(incomeRes.data);
      setPrograms(programsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIncome = async () => {
    try {
      await API.post('/income', {...formData, amount: parseFloat(formData.amount)});
      loadData();
      setFormData({ event_id: '', category: 'Donation', description: '', amount: '', payment_method: 'UPI', received_from: '', reference_number: '', notes: '' });
      setShowForm(false);
      alert('Income added successfully!');
    } catch (err) {
      alert('Error adding income');
    }
  };

  const handleDeleteIncome = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await API.delete(`/income/${id}`);
        loadData();
      } catch (err) {
        alert('Error deleting income');
      }
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="tab-content">
      <h1>💰 આવક / Income Management</h1>
      
      <div className="financial-summary">
        <div className="summary-card">
          <h3>Total Income</h3>
          <p className="amount">₹{totalIncome.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Income
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Add Income</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Program/Event</label>
              <select value={formData.event_id} onChange={(e) => setFormData({...formData, event_id: e.target.value})}>
                <option value="">Select Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                <option>Donation</option>
                <option>Sponsorship</option>
                <option>Member Contribution</option>
                <option>Advertisement</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="2" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Amount (₹)</label>
              <input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({...formData, payment_method: e.target.value})}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Received From</label>
              <input type="text" value={formData.received_from} onChange={(e) => setFormData({...formData, received_from: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Reference Number</label>
              <input type="text" value={formData.reference_number} onChange={(e) => setFormData({...formData, reference_number: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows="2" />
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddIncome}>Add Income</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-section">
        <h2>Income Records</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Received From</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {income.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleDateString('en-IN')}</td>
                <td>{item.category}</td>
                <td>{item.description}</td>
                <td>{item.received_from}</td>
                <td>₹{item.amount.toLocaleString('en-IN')}</td>
                <td>{item.payment_method}</td>
                <td>
                  <button className="btn-delete" onClick={() => handleDeleteIncome(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {income.length === 0 && <p className="empty-state">No income records added yet.</p>}
      </div>
    </div>
  );
}

function ExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    event_id: '',
    category: 'Decoration',
    vendor: '',
    description: '',
    amount: '',
    payment_method: 'Cash',
    bill_number: '',
    notes: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [expensesRes, programsRes] = await Promise.all([
        API.get('/expenses'),
        API.get('/events')
      ]);
      setExpenses(expensesRes.data);
      setPrograms(programsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    try {
      await API.post('/expenses', {...formData, amount: parseFloat(formData.amount)});
      loadData();
      setFormData({ event_id: '', category: 'Decoration', vendor: '', description: '', amount: '', payment_method: 'Cash', bill_number: '', notes: '' });
      setShowForm(false);
      alert('Expense added successfully!');
    } catch (err) {
      alert('Error adding expense');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await API.delete(`/expenses/${id}`);
        loadData();
      } catch (err) {
        alert('Error deleting expense');
      }
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="tab-content">
      <h1>💸 ખર્ચ / Expense Management</h1>
      
      <div className="financial-summary">
        <div className="summary-card">
          <h3>Total Expenses</h3>
          <p className="amount">₹{totalExpense.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Expense
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Add Expense</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Program/Event</label>
              <select value={formData.event_id} onChange={(e) => setFormData({...formData, event_id: e.target.value})}>
                <option value="">Select Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                <option>Decoration</option>
                <option>Sound System</option>
                <option>Lighting</option>
                <option>Food</option>
                <option>Flowers</option>
                <option>Printing</option>
                <option>Tent</option>
                <option>Garba / Music</option>
                <option>Pooja Items</option>
                <option>Transportation</option>
                <option>Miscellaneous</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Vendor / Paid To</label>
              <input type="text" value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Bill Number</label>
              <input type="text" value={formData.bill_number} onChange={(e) => setFormData({...formData, bill_number: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="2" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Amount (₹)</label>
              <input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({...formData, payment_method: e.target.value})}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows="2" />
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddExpense}>Add Expense</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-section">
        <h2>Expense Records</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleDateString('en-IN')}</td>
                <td>{item.category}</td>
                <td>{item.vendor}</td>
                <td>{item.description}</td>
                <td>₹{item.amount.toLocaleString('en-IN')}</td>
                <td>{item.payment_method}</td>
                <td>
                  <button className="btn-delete" onClick={() => handleDeleteExpense(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <p className="empty-state">No expenses added yet.</p>}
      </div>
    </div>
  );
}

function BillsTab() {
  const [bills, setBills] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    event_id: '',
    type: 'invoice',
    amount: '',
    vendor: '',
    category: 'Decoration',
    date: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [billsRes, programsRes] = await Promise.all([
        API.get('/bills'),
        API.get('/events')
      ]);
      setBills(billsRes.data);
      setPrograms(programsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBill = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    try {
      const formDataWithFile = new FormData();
      formDataWithFile.append('event_id', formData.event_id);
      formDataWithFile.append('type', formData.type);
      formDataWithFile.append('amount', formData.amount);
      formDataWithFile.append('vendor', formData.vendor);
      formDataWithFile.append('category', formData.category);
      formDataWithFile.append('date', formData.date);
      formDataWithFile.append('file', file);
      formDataWithFile.append('fileType', 'bills');

      await API.post('/bills', formDataWithFile, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      loadData();
      setFormData({ event_id: '', type: 'invoice', amount: '', vendor: '', category: 'Decoration', date: '' });
      setFile(null);
      setShowForm(false);
      alert('Bill uploaded successfully!');
    } catch (err) {
      alert('Error uploading bill');
    }
  };

  const handleDeleteBill = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await API.delete(`/bills/${id}`);
        loadData();
      } catch (err) {
        alert('Error deleting bill');
      }
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>📄 બિલ્સ / Bills Management</h1>
      
      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Upload Bill
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Upload Bill / Receipt</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Program/Event</label>
              <select value={formData.event_id} onChange={(e) => setFormData({...formData, event_id: e.target.value})}>
                <option value="">Select Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                <option>Invoice</option>
                <option>Receipt</option>
                <option>Bill</option>
                <option>Payment Proof</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Vendor</label>
              <input type="text" value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Amount (₹)</label>
              <input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                <option>Decoration</option>
                <option>Food</option>
                <option>Sound</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Upload File (PDF, JPG, PNG)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files[0])}
            />
            {file && <p>Selected: {file.name}</p>}
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddBill}>Upload Bill</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-section">
        <h2>All Bills</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Vendor</th>
              <th>Category</th>
              <th>Amount</th>
              <th>File</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>{bill.date || 'N/A'}</td>
                <td>{bill.type}</td>
                <td>{bill.vendor}</td>
                <td>{bill.category}</td>
                <td>₹{bill.amount ? bill.amount.toLocaleString('en-IN') : 'N/A'}</td>
                <td>
                  <a href={`http://localhost:5000/${bill.file_path}`} target="_blank" rel="noreferrer">
                    View
                  </a>
                </td>
                <td>
                  <button className="btn-delete" onClick={() => handleDeleteBill(bill.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bills.length === 0 && <p className="empty-state">No bills uploaded yet.</p>}
      </div>
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const res = await API.get('/events');
      setPrograms(res.data);
      if (res.data.length > 0) {
        setSelectedEventId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (eventId) => {
    try {
      const res = await API.get('/reports/financial', { params: { eventId } });
      setReports(res.data);
    } catch (err) {
      alert('Error generating report');
    }
  };

  const handleGeneratePDF = async (eventId) => {
    try {
      const res = await API.post('/generate-pdf', { eventId });
      window.open(`http://localhost:5000/${res.data.url}`, '_blank');
    } catch (err) {
      alert('Error generating PDF');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>📈 રિપોર્ટ્સ / Financial Reports</h1>
      
      <div className="form-section">
        <h2>Select Program</h2>
        <div className="form-row">
          <div className="form-group">
            <label>Program/Event</label>
            <select value={selectedEventId} onChange={(e) => {
              setSelectedEventId(e.target.value);
              setReports(null);
            }}>
              <option value="">Select Program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="button-group" style={{alignSelf: 'flex-end'}}>
            <button className="btn btn-primary" onClick={() => handleGenerateReport(selectedEventId)}>
              Generate Report
            </button>
            <button className="btn btn-success" onClick={() => handleGeneratePDF(selectedEventId)}>
              Generate PDF
            </button>
          </div>
        </div>
      </div>

      {reports && (
        <div className="report-section">
          <h2>Financial Report</h2>
          
          <div className="report-summary">
            <div className="report-card">
              <h3>Total Income</h3>
              <p className="amount">₹{reports.totalIncome.toLocaleString('en-IN')}</p>
            </div>
            <div className="report-card">
              <h3>Total Expense</h3>
              <p className="amount">₹{reports.totalExpense.toLocaleString('en-IN')}</p>
            </div>
            <div className="report-card">
              <h3>Net Balance</h3>
              <p className="amount">₹{(reports.totalIncome - reports.totalExpense).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="report-details">
            <h3>Income Breakdown</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reports.incomeByCategory).map(([category, amount]) => (
                  <tr key={category}>
                    <td>{category}</td>
                    <td>₹{amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Expense Breakdown</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reports.expenseByCategory).map(([category, amount]) => (
                  <tr key={category}>
                    <td>{category}</td>
                    <td>₹{amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    status: 'published'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const res = await API.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnouncement = async () => {
    try {
      await API.post('/announcements', formData);
      loadAnnouncements();
      setFormData({ title: '', description: '', date: '', status: 'published' });
      setShowForm(false);
      alert('Announcement published successfully!');
    } catch (err) {
      alert('Error adding announcement');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await API.delete(`/announcements/${id}`);
        loadAnnouncements();
      } catch (err) {
        alert('Error deleting announcement');
      }
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>📢 સૂચના / Announcements</h1>
      
      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Publish Announcement
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Publish Announcement</h2>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Announcement title"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="4"
              placeholder="Announcement details"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                <option>published</option>
                <option>draft</option>
              </select>
            </div>
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddAnnouncement}>Publish</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="announcements-list">
        <h2>All Announcements</h2>
        {announcements.map((announcement) => (
          <div key={announcement.id} className="announcement-card">
            <div className="announcement-header">
              <h3>{announcement.title}</h3>
              <span className="badge">{announcement.status}</span>
            </div>
            <p>{announcement.description}</p>
            <p className="announcement-date">📅 {new Date(announcement.created_at).toLocaleDateString('en-IN')}</p>
            <button className="btn-delete" onClick={() => handleDeleteAnnouncement(announcement.id)}>
              Delete
            </button>
          </div>
        ))}
        {announcements.length === 0 && <p className="empty-state">No announcements published yet.</p>}
      </div>
    </div>
  );
}

function PhotosTab() {
  const [photos, setPhotos] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    event_id: '',
    caption: '',
    album_name: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [photosRes, programsRes] = await Promise.all([
        API.get('/photos'),
        API.get('/events')
      ]);
      setPhotos(photosRes.data);
      setPrograms(programsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!file) {
      alert('Please select an image');
      return;
    }

    try {
      const formDataWithFile = new FormData();
      formDataWithFile.append('event_id', formData.event_id);
      formDataWithFile.append('caption', formData.caption);
      formDataWithFile.append('album_name', formData.album_name);
      formDataWithFile.append('file', file);
      formDataWithFile.append('fileType', 'photos');

      await API.post('/photos', formDataWithFile, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      loadData();
      setFormData({ event_id: '', caption: '', album_name: '' });
      setFile(null);
      setShowForm(false);
      alert('Photo uploaded successfully!');
    } catch (err) {
      alert('Error uploading photo');
    }
  };

  const handleDeletePhoto = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await API.delete(`/photos/${id}`);
        loadData();
      } catch (err) {
        alert('Error deleting photo');
      }
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="tab-content">
      <h1>📸 ફોટો / Event Photos</h1>
      
      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Upload Photo
        </button>
      )}

      {showForm && (
        <div className="form-section">
          <h2>Upload Photo</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Program/Event</label>
              <select value={formData.event_id} onChange={(e) => setFormData({...formData, event_id: e.target.value})}>
                <option value="">Select Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Album Name</label>
              <input
                type="text"
                value={formData.album_name}
                onChange={(e) => setFormData({...formData, album_name: e.target.value})}
                placeholder="e.g., Garba Night 2026"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Caption</label>
            <input
              type="text"
              value={formData.caption}
              onChange={(e) => setFormData({...formData, caption: e.target.value})}
              placeholder="Photo description"
            />
          </div>

          <div className="form-group">
            <label>Upload Image (JPG, PNG)</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files[0])}
            />
            {file && <p>Selected: {file.name}</p>}
          </div>

          <div className="button-group">
            <button className="btn btn-primary" onClick={handleAddPhoto}>Upload Photo</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="photos-grid">
        <h2>All Photos</h2>
        {photos.map((photo) => (
          <div key={photo.id} className="photo-card">
            <img src={`http://localhost:5000/${photo.file_path}`} alt={photo.caption} />
            <div className="photo-info">
              <p className="caption">{photo.caption}</p>
              <p className="album">{photo.album_name}</p>
              <button className="btn-delete" onClick={() => handleDeletePhoto(photo.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {photos.length === 0 && <p className="empty-state">No photos uploaded yet.</p>}
      </div>
    </div>
  );
}

// ==================== USER DASHBOARD ====================

function UserDashboard() {
  const { user, logout } = useAuth();
  const [society, setSociety] = useState(null);
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [societyRes, eventsRes, announcementsRes] = await Promise.all([
        API.get('/society'),
        API.get('/events'),
        API.get('/announcements')
      ]);
      setSociety(societyRes.data);
      setEvents(eventsRes.data);
      setAnnouncements(announcementsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="user-layout">
      <UserHeader user={user} logout={logout} setActiveTab={setActiveTab} activeTab={activeTab} />
      
      <div className="user-content">
        {activeTab === 'home' && <UserHome society={society} events={events} announcements={announcements} />}
        {activeTab === 'events' && <UserEvents events={events} />}
        {activeTab === 'announcements' && <UserAnnouncements announcements={announcements} />}
        {activeTab === 'photos' && <UserPhotos society={society} />}
        {activeTab === 'profile' && <UserProfile user={user} />}
      </div>
    </div>
  );
}

function UserHeader({ user, logout, setActiveTab, activeTab }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'home', label: 'ઘર / Home', icon: '🏠' },
    { id: 'events', label: 'ઇવેન્ટ્સ / Events', icon: '🎉' },
    { id: 'announcements', label: 'સૂચના / Announcements', icon: '📢' },
    { id: 'photos', label: 'ફોટો / Photos', icon: '📸' },
    { id: 'profile', label: 'પ્રોફાઇલ / Profile', icon: '👤' }
  ];

  return (
    <>
      <header className="user-header">
        <div className="header-content">
          <h1>📋 Society Events</h1>
          <button className="mobile-nav-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            ☰
          </button>
          <div className="user-info">
            <span>{user?.name}</span>
            <button className="btn-logout" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <nav className={`user-nav ${mobileOpen ? 'mobile-open' : ''}`}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(item.id);
              setMobileOpen(false);
            }}
          >
            <span>{item.icon}</span> {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function UserHome({ society, events, announcements }) {
  return (
    <section className="user-section">
      <h2>{society?.name}</h2>
      <p className="society-details">{society?.address}, {society?.city}</p>

      <div className="upcoming-events">
        <h3>🎉 Upcoming Events</h3>
        {events.length > 0 ? (
          events.slice(0, 3).map((event) => (
            <div key={event.id} className="event-card-user">
              <h4>{event.name}</h4>
              <p><strong>📅 Date:</strong> {event.date}</p>
              <p><strong>⏰ Time:</strong> {event.time}</p>
              <p><strong>📍 Location:</strong> {event.location}</p>
              <p>{event.description}</p>
            </div>
          ))
        ) : (
          <p className="empty-state">No upcoming events</p>
        )}
      </div>

      <div className="recent-announcements">
        <h3>📢 Latest Announcements</h3>
        {announcements.length > 0 ? (
          announcements.slice(0, 3).map((ann) => (
            <div key={ann.id} className="announcement-card-user">
              <h4>{ann.title}</h4>
              <p>{ann.description}</p>
              <p className="date">{new Date(ann.created_at).toLocaleDateString('en-IN')}</p>
            </div>
          ))
        ) : (
          <p className="empty-state">No announcements</p>
        )}
      </div>
    </section>
  );
}

function UserEvents({ events }) {
  return (
    <section className="user-section">
      <h2>🎉 કાર્યક્રમો / All Events</h2>
      <div className="events-grid">
        {events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="event-card-user">
              <span className="event-badge">{event.type}</span>
              <h4>{event.name}</h4>
              <p><strong>📅</strong> {event.date}</p>
              <p><strong>⏰</strong> {event.time}</p>
              <p><strong>📍</strong> {event.location}</p>
              <p className="description">{event.description}</p>
            </div>
          ))
        ) : (
          <p className="empty-state">No events scheduled yet</p>
        )}
      </div>
    </section>
  );
}

function UserAnnouncements({ announcements }) {
  return (
    <section className="user-section">
      <h2>📢 સૂચના / Announcements</h2>
      <div className="announcements-list-user">
        {announcements.length > 0 ? (
          announcements.map((ann) => (
            <div key={ann.id} className="announcement-item-user">
              <h4>{ann.title}</h4>
              <p>{ann.description}</p>
              <p className="meta">📅 {new Date(ann.created_at).toLocaleDateString('en-IN')}</p>
            </div>
          ))
        ) : (
          <p className="empty-state">No announcements</p>
        )}
      </div>
    </section>
  );
}

function UserPhotos({ society }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const res = await API.get('/photos');
      setPhotos(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <section className="user-section">
      <h2>📸 ફોટો / Photo Gallery</h2>
      <div className="photos-grid">
        {photos.length > 0 ? (
          photos.map((photo) => (
            <div key={photo.id} className="photo-card-user">
              <img src={`http://localhost:5000/${photo.file_path}`} alt={photo.caption} />
              <div className="photo-overlay">
                <p className="caption">{photo.caption}</p>
                <p className="album">{photo.album_name}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">No photos yet</p>
        )}
      </div>
    </section>
  );
}

function UserProfile({ user }) {
  const [profile, setProfile] = useState(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await API.get(`/users/profile/${user.id}`);
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/users/${user.id}/password`, { oldPassword, newPassword });
      alert('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      alert('Error changing password');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <section className="user-section">
      <h2>👤 મારી પ્રોફાઇલ / My Profile</h2>
      
      <div className="profile-card">
        <h3>Profile Information</h3>
        <div className="profile-field">
          <label>Name</label>
          <p>{profile?.name}</p>
        </div>
        <div className="profile-field">
          <label>Flat Number</label>
          <p>{profile?.flat_number}</p>
        </div>
        <div className="profile-field">
          <label>Email</label>
          <p>{profile?.email}</p>
        </div>
        <div className="profile-field">
          <label>Mobile</label>
          <p>{profile?.mobile}</p>
        </div>
        <div className="profile-field">
          <label>Family Members</label>
          <p>{profile?.family_members}</p>
        </div>
      </div>

      <div className="password-card">
        <h3>Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Change Password</button>
        </form>
      </div>
    </section>
  );
}

// ==================== PROTECTED ROUTES ====================

function ProtectedRoute({ component: Component, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) return <Navigate to="/" />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" />;

  return Component;
}

// ==================== MAIN APP ====================

export default function App() {
  const { loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/organizer"
          element={<ProtectedRoute component={<OrganizerDashboard />} requiredRole="organizer" />}
        />
        <Route
          path="/user"
          element={<ProtectedRoute component={<UserDashboard />} requiredRole="user" />}
        />
      </Routes>
    </Router>
  );
}

// Render with AuthProvider
import ReactDOM from 'react-dom/client';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
