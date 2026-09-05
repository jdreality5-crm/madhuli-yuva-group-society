# 🧪 Testing & Quality Assurance Guide

Comprehensive testing procedures for the Society Function Management System.

## Table of Contents
1. [Unit Testing](#unit-testing)
2. [Integration Testing](#integration-testing)
3. [Security Testing](#security-testing)
4. [Performance Testing](#performance-testing)
5. [User Acceptance Testing](#user-acceptance-testing)
6. [Test Cases](#test-cases)

## Unit Testing

### Backend Unit Tests

Create `tests/api.test.js`:

```javascript
const request = require('supertest');
const app = require('../server');

describe('Authentication API', () => {
    test('Login with valid credentials', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({
                email: 'admin@society.com',
                password: 'admin123',
                role: 'organizer'
            });

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.role).toBe('organizer');
    });

    test('Login with invalid credentials', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({
                email: 'admin@society.com',
                password: 'wrongpassword',
                role: 'organizer'
            });

        expect(response.statusCode).toBe(401);
    });

    test('Login with invalid email', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({
                email: 'nonexistent@society.com',
                password: 'admin123',
                role: 'organizer'
            });

        expect(response.statusCode).toBe(401);
    });
});

describe('Society API', () => {
    let token;

    beforeAll(async () => {
        const loginResponse = await request(app)
            .post('/api/login')
            .send({
                email: 'admin@society.com',
                password: 'admin123',
                role: 'organizer'
            });
        token = loginResponse.body.token;
    });

    test('Get society details', async () => {
        const response = await request(app)
            .get('/api/society')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('name');
    });

    test('Get society without authentication', async () => {
        const response = await request(app)
            .get('/api/society');

        expect(response.statusCode).toBe(401);
    });
});

describe('Financial Data Access Control', () => {
    let organizerToken;
    let userToken;

    beforeAll(async () => {
        const orgLogin = await request(app)
            .post('/api/login')
            .send({
                email: 'admin@society.com',
                password: 'admin123',
                role: 'organizer'
            });
        organizerToken = orgLogin.body.token;

        const userLogin = await request(app)
            .post('/api/login')
            .send({
                email: 'raj@example.com',
                password: 'owner123',
                role: 'user'
            });
        userToken = userLogin.body.token;
    });

    test('Organizer can access income data', async () => {
        const response = await request(app)
            .get('/api/income')
            .set('Authorization', `Bearer ${organizerToken}`);

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test('User cannot access income data', async () => {
        const response = await request(app)
            .get('/api/income')
            .set('Authorization', `Bearer ${userToken}`);

        expect(response.statusCode).toBe(403);
    });

    test('User cannot access expense data', async () => {
        const response = await request(app)
            .get('/api/expenses')
            .set('Authorization', `Bearer ${userToken}`);

        expect(response.statusCode).toBe(403);
    });

    test('User cannot access financial reports', async () => {
        const response = await request(app)
            .get('/api/reports/financial')
            .set('Authorization', `Bearer ${userToken}`);

        expect(response.statusCode).toBe(403);
    });
});
```

### Frontend Unit Tests

Create `src/App.test.jsx`:

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './App';

test('renders login page', () => {
    render(
        <AuthProvider>
            <App />
        </AuthProvider>
    );
    expect(screen.getByText(/Society Function Management/i)).toBeInTheDocument();
});

test('login form has email and password fields', () => {
    render(
        <AuthProvider>
            <App />
        </AuthProvider>
    );
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
});

test('role selector has organizer and user options', () => {
    render(
        <AuthProvider>
            <App />
        </AuthProvider>
    );
    expect(screen.getByText(/Organizer\/Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Flat Owner/i)).toBeInTheDocument();
});
```

## Integration Testing

### API Integration Tests

```javascript
describe('Complete Event Workflow', () => {
    let token;
    let eventId;
    let incomeId;
    let expenseId;

    beforeAll(async () => {
        // Login
        const loginResponse = await request(app)
            .post('/api/login')
            .send({
                email: 'admin@society.com',
                password: 'admin123',
                role: 'organizer'
            });
        token = loginResponse.body.token;
    });

    test('Create event', async () => {
        const response = await request(app)
            .post('/api/events')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Event',
                date: '2026-10-15',
                time: '10:00 AM',
                location: 'Society Hall',
                type: 'Religious',
                description: 'Test event description'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.name).toBe('Test Event');
        eventId = response.body.id;
    });

    test('Add income to event', async () => {
        const response = await request(app)
            .post('/api/income')
            .set('Authorization', `Bearer ${token}`)
            .send({
                event_id: eventId,
                category: 'Donation',
                description: 'Test donation',
                amount: 5000,
                payment_method: 'Cash',
                received_from: 'Test Donor'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.amount).toBe(5000);
        incomeId = response.body.id;
    });

    test('Add expense to event', async () => {
        const response = await request(app)
            .post('/api/expenses')
            .set('Authorization', `Bearer ${token}`)
            .send({
                event_id: eventId,
                category: 'Decoration',
                vendor: 'Test Vendor',
                description: 'Test decoration',
                amount: 2000,
                payment_method: 'Cash'
            });

        expect(response.statusCode).toBe(201);
        expect(response.body.amount).toBe(2000);
        expenseId = response.body.id;
    });

    test('Get financial summary', async () => {
        const response = await request(app)
            .get(`/api/financial-summary?eventId=${eventId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.totalIncome).toBe(5000);
        expect(response.body.totalExpense).toBe(2000);
        expect(response.body.balance).toBe(3000);
    });

    test('Delete income', async () => {
        const response = await request(app)
            .delete(`/api/income/${incomeId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
    });

    test('Delete event', async () => {
        const response = await request(app)
            .delete(`/api/events/${eventId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
    });
});
```

## Security Testing

### SQL Injection Tests

```javascript
test('SQL injection attempt - username', async () => {
    const response = await request(app)
        .post('/api/login')
        .send({
            email: "admin' OR '1'='1",
            password: 'admin123',
            role: 'organizer'
        });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBeDefined();
});

test('SQL injection attempt - password', async () => {
    const response = await request(app)
        .post('/api/login')
        .send({
            email: 'admin@society.com',
            password: "' OR '1'='1",
            role: 'organizer'
        });

    expect(response.statusCode).toBe(401);
});
```

### XSS Prevention Tests

```javascript
test('XSS attempt in event name', async () => {
    const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
            name: '<script>alert("XSS")</script>',
            date: '2026-10-15',
            time: '10:00 AM',
            location: 'Society Hall',
            type: 'Religious',
            description: 'Test'
        });

    expect(response.statusCode).toBe(201);
    // Server should sanitize/escape the input
    expect(response.body.name).not.toContain('<script>');
});
```

### CSRF Protection Tests

```javascript
test('Request without token is rejected', async () => {
    const response = await request(app)
        .post('/api/events')
        .send({
            name: 'Test Event',
            date: '2026-10-15',
            time: '10:00 AM',
            location: 'Society Hall',
            type: 'Religious',
            description: 'Test'
        });

    expect(response.statusCode).toBe(401);
});

test('Request with invalid token is rejected', async () => {
    const response = await request(app)
        .post('/api/events')
        .set('Authorization', 'Bearer invalid_token')
        .send({
            name: 'Test Event',
            date: '2026-10-15',
            time: '10:00 AM',
            location: 'Society Hall',
            type: 'Religious',
            description: 'Test'
        });

    expect(response.statusCode).toBe(403);
});
```

## Performance Testing

### Load Testing with Artillery

Create `load-test.yml`:

```yaml
config:
  target: "http://localhost:5000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up"
    - duration: 60
      arrivalRate: 100
      name: "Spike"

scenarios:
  - name: "Organizer Dashboard"
    flow:
      - post:
          url: "/api/login"
          json:
            email: "admin@society.com"
            password: "admin123"
            role: "organizer"
          capture:
            json: "$.token"
            as: "token"
      - get:
          url: "/api/dashboard-stats"
          headers:
            Authorization: "Bearer {{ token }}"
      - get:
          url: "/api/events"
          headers:
            Authorization: "Bearer {{ token }}"
```

Run load test:

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run load-test.yml

# Generate report
artillery run load-test.yml -o results.json
artillery report results.json
```

## User Acceptance Testing

### UAT Test Cases

#### Organizer UAT

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| TC-ORG-001 | Login with valid credentials | Dashboard displays | ✓ |
| TC-ORG-002 | View statistics | All stats displayed correctly | ✓ |
| TC-ORG-003 | Create event | Event created and displayed | ✓ |
| TC-ORG-004 | Add income | Income recorded correctly | ✓ |
| TC-ORG-005 | Add expense | Expense recorded correctly | ✓ |
| TC-ORG-006 | Generate PDF report | PDF downloads successfully | ✓ |
| TC-ORG-007 | Upload bill | Bill stored and accessible | ✓ |
| TC-ORG-008 | Publish announcement | Visible to flat owners | ✓ |
| TC-ORG-009 | Upload photo | Photo appears in gallery | ✓ |
| TC-ORG-010 | Generate financial report | Report shows correct data | ✓ |

#### User UAT

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| TC-USER-001 | Login with valid credentials | User dashboard displays | ✓ |
| TC-USER-002 | View events | Events list displays | ✓ |
| TC-USER-003 | View announcements | Announcements display | ✓ |
| TC-USER-004 | View photos | Photo gallery displays | ✓ |
| TC-USER-005 | View profile | Profile information correct | ✓ |
| TC-USER-006 | Change password | Password updates successfully | ✓ |
| TC-USER-007 | Cannot access income | Access denied error | ✓ |
| TC-USER-008 | Cannot access expenses | Access denied error | ✓ |
| TC-USER-009 | Cannot access reports | Access denied error | ✓ |
| TC-USER-010 | Mobile responsive | Displays correctly on mobile | ✓ |

## Test Cases

### Critical Test Cases

#### Authentication Tests
- Valid organizer login
- Valid user login
- Invalid credentials
- Expired token
- Tampered token
- Missing token

#### Authorization Tests
- Organizer access to admin features
- User cannot access admin features
- User cannot access financial data
- Organizer can access financial data

#### Data Validation Tests
- Invalid email format
- Empty required fields
- Amount field accepts only numbers
- Date field accepts only valid dates
- File upload size validation
- File type validation

#### Business Logic Tests
- Event creation with valid data
- Income/expense calculation accuracy
- Financial summary calculation
- Report generation accuracy
- Announcement visibility

### Test Coverage Target
- Unit tests: 80%
- Integration tests: 70%
- E2E tests: 50%

## Running All Tests

```bash
# Install test dependencies
npm install --save-dev jest supertest

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/api.test.js

# Run in watch mode
npm test -- --watch
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      sqlite:
        image: sqlite:3

    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Run tests
      run: npm test

    - name: Upload coverage
      uses: codecov/codecov-action@v2
      with:
        files: ./coverage/lcov.info
```

---

**Regular testing ensures product quality and user satisfaction.**
