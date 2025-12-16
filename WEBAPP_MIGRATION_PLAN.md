# CRM Migration Plan: Modal-Based to Standalone Web App

## Executive Summary

This document outlines the complete migration strategy from the current modal-based CRM to a standalone Google Apps Script web app. The migration maintains all existing functionality while providing a superior user experience through full browser access, better performance, and enhanced UI flexibility.

**Strategic Benefits:**
- ✅ Better UX - Full viewport, responsive design, no Sheets UI overhead
- ✅ Client bookmarkable - Direct URL access
- ✅ Faster performance - No spreadsheet loading overhead
- ✅ Professional appearance - Standalone application feel
- ✅ Data remains in Sheets - Your key differentiator stays intact
- ✅ Easy client access - Share a simple URL

**Risk Level:** Medium
**Effort:** 2-3 weeks
**Backward Compatibility:** Full (existing sheet access remains functional)

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Target Architecture](#target-architecture)
3. [Migration Strategy](#migration-strategy)
4. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
5. [Authentication & Security](#authentication--security)
6. [Data Access Layer](#data-access-layer)
7. [URL Routing & Navigation](#url-routing--navigation)
8. [Deployment & Testing](#deployment--testing)
9. [Rollout Strategy](#rollout-strategy)

---

## Current Architecture Analysis

### How It Works Now

```
┌─────────────────────┐
│  Google Spreadsheet │
│   (Data Storage)    │
└──────────┬──────────┘
           │ onOpen()
           ↓
┌─────────────────────┐
│   Menu + Modals     │
│  (UI Layer)         │
│                     │
│  • crmModal.html    │
│  • quoteBuilder.html│
└──────────┬──────────┘
           │ google.script.run
           ↓
┌─────────────────────┐
│  Server Functions   │
│  (Business Logic)   │
│                     │
│  • Code.js          │
│  • modalController  │
└──────────┬──────────┘
           │ SpreadsheetApp API
           ↓
┌─────────────────────┐
│   Google Services   │
│  • Sheets           │
│  • Drive            │
│  • Gmail            │
│  • Docs             │
└─────────────────────┘
```

**Key Characteristics:**
- Entry point: Spreadsheet menu (`onOpen` trigger)
- UI: Modal dialogs (1100x650px)
- Communication: `google.script.run` RPC
- Auth: Implicit (spreadsheet access = app access)
- Session: None (modal stays open in sheet context)
- URL: None (accessed through spreadsheet)

### Critical Dependencies

1. **SpreadsheetApp UI Methods:**
   - `SpreadsheetApp.getUi().showModalDialog()`
   - `SpreadsheetApp.getActiveSpreadsheet()`
   - `SpreadsheetApp.getActiveSheet()`

2. **OAuth Scope:** `script.container.ui`
   - **⚠️ INCOMPATIBLE with web apps** - Must be removed

3. **google.script.run API:**
   - Bidirectional RPC between HTML and server
   - Only works in container-bound scripts (modals, sidebars)
   - **Must be replaced for web app**

---

## Target Architecture

### How It Will Work

```
┌─────────────────────┐
│     Web Browser     │
│  https://script.    │
│  google.com/...     │
└──────────┬──────────┘
           │ HTTPS
           ↓
┌─────────────────────┐
│  Web App Entry      │
│   (webapp.js)       │
│                     │
│  • doGet()          │
│  • doPost()         │
│  • Routing          │
│  • Auth checks      │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ↓           ↓
┌─────────┐  ┌──────────┐
│   UI    │  │   API    │
│ Layer   │  │  Layer   │
│         │  │          │
│ HTML    │  │ REST-like│
│ Pages   │  │ Endpoints│
└────┬────┘  └────┬─────┘
     │            │
     └─────┬──────┘
           ↓
┌─────────────────────┐
│   Business Logic    │
│                     │
│  • Service Layer    │
│  • Data Access      │
│  • Auth Module      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Google Spreadsheet │
│   (Data Storage)    │
│   + Drive/Gmail     │
└─────────────────────┘
```

**Key Characteristics:**
- Entry point: Direct URL (web app deployment)
- UI: Full browser pages (responsive)
- Communication: Custom API layer (REST-like)
- Auth: Explicit (Google OAuth or custom)
- Session: Token/cookie-based
- URL: Routing system (`/dashboard`, `/quote/:id`, etc.)

---

## Migration Strategy

### Approach: Parallel Development with Soft Launch

**Why This Approach:**
- Zero downtime - Current system remains functional
- Gradual rollout - Test with subset of users
- Easy rollback - Revert to old system if issues arise
- Risk mitigation - Identify problems before full migration

### Three-Phase Strategy

**Phase 1: Foundation (Week 1)**
- Set up web app infrastructure
- Create authentication system
- Build API layer
- Implement routing

**Phase 2: UI Migration (Week 2)**
- Convert modals to web pages
- Implement navigation
- Add responsive design
- Maintain feature parity

**Phase 3: Testing & Rollout (Week 3)**
- Internal testing
- Beta user testing
- Performance optimization
- Full deployment

---

## Phase-by-Phase Implementation

### Phase 1: Foundation Layer (Week 1)

#### 1.1 Create Web App Entry Point

**New File: `webapp.js`**

```javascript
/**
 * Web App Entry Point
 * Handles all incoming HTTP requests and routes them appropriately
 */

/**
 * Handles GET requests to the web app
 * @param {Object} e - Event object with request parameters
 * @returns {HtmlOutput} Rendered HTML page
 */
function doGet(e) {
  // Extract route and parameters
  const route = e.parameter.page || 'dashboard';
  const params = e.parameter;

  // Check authentication
  const user = authenticateRequest(e);
  if (!user) {
    return renderLoginPage();
  }

  // Route to appropriate page
  return routeRequest(route, params, user);
}

/**
 * Handles POST requests (API calls)
 * @param {Object} e - Event object with POST data
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  // Check authentication
  const user = authenticateRequest(e);
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Parse request
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  // Route to API handler
  return handleApiRequest(action, data, user);
}

/**
 * Routes GET requests to appropriate page renderer
 */
function routeRequest(route, params, user) {
  const routes = {
    'dashboard': renderDashboard,
    'clients': renderClients,
    'quote': renderQuoteBuilder,
    'invoice': renderInvoiceBuilder,
    'calendar': renderCalendar,
    'settings': renderSettings
  };

  const handler = routes[route];
  if (!handler) {
    return render404();
  }

  return handler(params, user);
}

/**
 * Renders the dashboard page
 */
function renderDashboard(params, user) {
  const template = HtmlService.createTemplateFromFile('pages/dashboard');
  template.user = user;
  template.config = getClientConfig();

  return template.evaluate()
    .setTitle('Style et Matière - Tableau de Bord')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
```

#### 1.2 Create Authentication Module

**New File: `auth.js`**

```javascript
/**
 * Authentication and Authorization Module
 * Handles user authentication using Google OAuth
 */

/**
 * Authenticates incoming request
 * @param {Object} e - Event object with request data
 * @returns {Object|null} User object or null if not authenticated
 */
function authenticateRequest(e) {
  try {
    // Get current user from Apps Script session
    const email = Session.getActiveUser().getEmail();

    if (!email) {
      return null;
    }

    // Verify user has access to the CRM
    if (!isAuthorizedUser(email)) {
      return null;
    }

    return {
      email: email,
      name: getUserName(email),
      role: getUserRole(email)
    };

  } catch (e) {
    Logger.log('Auth error: ' + e.message);
    return null;
  }
}

/**
 * Checks if user is authorized to access CRM
 * @param {string} email - User email
 * @returns {boolean} True if authorized
 */
function isAuthorizedUser(email) {
  // Option 1: Check against allowed users list in CONFIG
  const allowedUsers = CONFIG.auth?.allowed_users || [];
  if (allowedUsers.length > 0) {
    return allowedUsers.includes(email);
  }

  // Option 2: Check if user has access to the spreadsheet
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id);
    const protection = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];

    if (!protection) {
      return true; // No protection = all domain users
    }

    const editors = protection.getEditors().map(u => u.getEmail());
    return editors.includes(email);

  } catch (e) {
    Logger.log('Error checking sheet access: ' + e.message);
    return false;
  }
}

/**
 * Gets user role for authorization
 * @param {string} email - User email
 * @returns {string} User role (admin, user, readonly)
 */
function getUserRole(email) {
  const admins = CONFIG.auth?.admins || [];
  if (admins.includes(email)) {
    return 'admin';
  }

  // Check for read-only users
  const readOnlyUsers = CONFIG.auth?.readonly_users || [];
  if (readOnlyUsers.includes(email)) {
    return 'readonly';
  }

  return 'user';
}

/**
 * Renders login page
 */
function renderLoginPage() {
  const template = HtmlService.createTemplateFromFile('pages/login');
  return template.evaluate()
    .setTitle('Style et Matière - Connexion')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

#### 1.3 Create API Layer

**New File: `api.js`**

```javascript
/**
 * API Layer
 * Provides REST-like API endpoints for client-server communication
 * Replaces google.script.run RPC calls
 */

/**
 * Handles API requests from web app
 * @param {string} action - API action name
 * @param {Object} data - Request data
 * @param {Object} user - Authenticated user
 * @returns {ContentService.TextOutput} JSON response
 */
function handleApiRequest(action, data, user) {
  try {
    // Route to appropriate handler
    const handlers = {
      // Dashboard
      'getDashboardMetrics': () => getDashboardMetrics(),
      'getClientsData': () => getClientsData(),
      'getCalendarData': () => getCalendarData(),

      // Client management
      'getClientDetails': (d) => getClientDetails(d.row),
      'updateClientStatus': (d) => updateClientStatus(d.row, d.status),
      'updateProjectDetails': (d) => updateProjectDetails(d.row, d.startDate, d.endDate, d.value),
      'saveClientNotes': (d) => saveClientNotes(d.row, d.notes),

      // Quote/Invoice
      'getServices': () => getServices(),
      'getInitialBusinessData': (d) => getInitialBusinessData(d.row),
      'generateQuoteWithServices': (d) => generateQuoteWithServices(d.quoteStructure, d.businessData, d.row),
      'generateInvoiceWithServices': (d) => generateInvoiceWithServices(d.invoiceStructure, d.businessData, d.row),
      'addNewService': (d) => addNewService(d.serviceData),

      // Email
      'generateQuoteEmailDraft': (d) => generateQuoteEmailDraft(d.row),
      'generateFollowUpEmailDraft': (d) => generateFollowUpEmailDraft(d.row),
      'generateTestimonialEmailDraft': (d) => generateTestimonialEmailDraft(d.row),

      // Templates
      'getEmailTemplates': () => getEmailTemplates(),
      'saveEmailTemplates': (d) => saveEmailTemplates(d.templates),
      'resetEmailTemplates': () => resetEmailTemplates(),

      // Mentions
      'getMentions': () => getMentions(),

      // Drafts
      'getQuoteDraft': (d) => getQuoteDraft(d.row),
      'saveQuoteDraft': (d) => saveQuoteDraft(d.row, d.quoteStructure, d.businessData),
      'clearQuoteDraft': (d) => clearQuoteDraft(d.row)
    };

    const handler = handlers[action];
    if (!handler) {
      return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }

    // Check authorization
    if (!isAuthorizedAction(action, user)) {
      return jsonResponse({ error: 'Unauthorized action' }, 403);
    }

    // Execute handler
    const result = handler(data);
    return jsonResponse({ success: true, data: result });

  } catch (error) {
    Logger.log('API error [' + action + ']: ' + error.message);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

/**
 * Creates JSON response
 */
function jsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // Note: Apps Script web apps don't support custom HTTP status codes
  // Status is included in response body instead
  if (statusCode !== 200) {
    data._statusCode = statusCode;
  }

  return output;
}

/**
 * Checks if user is authorized for action
 */
function isAuthorizedAction(action, user) {
  // Read-only users cannot perform write operations
  const writeActions = [
    'updateClientStatus',
    'updateProjectDetails',
    'saveClientNotes',
    'generateQuoteWithServices',
    'generateInvoiceWithServices',
    'addNewService',
    'saveEmailTemplates',
    'saveQuoteDraft'
  ];

  if (user.role === 'readonly' && writeActions.includes(action)) {
    return false;
  }

  // Admin-only actions
  const adminActions = [
    'resetInvoiceCounter',
    'saveEmailTemplates'
  ];

  if (user.role !== 'admin' && adminActions.includes(action)) {
    return false;
  }

  return true;
}
```

#### 1.4 Create Client-Side API Helper

**New File: `client-api.js`** (included in HTML pages)

```javascript
/**
 * Client-Side API Helper
 * Provides fetch-based API calls to replace google.script.run
 */

const API = {
  /**
   * Makes API call to server
   * @param {string} action - API action name
   * @param {Object} data - Request data
   * @returns {Promise} Response promise
   */
  call: async function(action, data = {}) {
    try {
      const response = await fetch(window.location.href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          ...data
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      return result.data;

    } catch (error) {
      console.error('API call failed [' + action + ']:', error);
      throw error;
    }
  },

  /**
   * Convenience methods for common operations
   */
  getDashboardMetrics: () => API.call('getDashboardMetrics'),
  getClientsData: () => API.call('getClientsData'),
  getClientDetails: (row) => API.call('getClientDetails', { row }),
  updateClientStatus: (row, status) => API.call('updateClientStatus', { row, status }),

  // Add more convenience methods as needed...
};
```

#### 1.5 Update Configuration

**Update `config.js`:**

```javascript
// Add to CONFIG object
CONFIG.auth = {
  // Option 1: Explicit allowed users list
  allowed_users: [
    'user1@yourdomain.com',
    'user2@yourdomain.com'
  ],

  // Admin users (full access)
  admins: [
    'admin@yourdomain.com'
  ],

  // Read-only users
  readonly_users: [
    'viewer@yourdomain.com'
  ],

  // Or Option 2: Allow all users with sheet access (leave arrays empty)
  // allowed_users: [],
  // admins: [],
  // readonly_users: []
};

// Add spreadsheet ID (needed for web app access)
CONFIG.file_paths.crm_sheet_id = 'YOUR_SPREADSHEET_ID_HERE';
```

#### 1.6 Update appsscript.json

```json
{
  "timeZone": "Europe/Paris",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/script.scriptapp"
  ],
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_ACCESSING",
    "access": "DOMAIN"
  }
}
```

**Key Changes:**
- ❌ Removed: `script.container.ui` (incompatible with web apps)
- ✅ Added: `script.scriptapp` (for session management)
- ✅ Changed: `executeAs` from `USER_DEPLOYING` to `USER_ACCESSING`
  - This makes the script run as the accessing user, not the deployer
  - Better for multi-user scenarios
  - Each user's permissions are respected

---

### Phase 2: UI Migration (Week 2)

#### 2.1 Create Page Structure

**New folder: `pages/`**

Structure:
```
pages/
├── dashboard.html      # Main dashboard (converted from crmModal.html)
├── quote-builder.html  # Quote builder (converted from quoteBuilder.html)
├── login.html          # Login/unauthorized page
├── 404.html            # Not found page
└── components/
    ├── header.html     # Shared navigation header
    ├── sidebar.html    # Shared sidebar (if needed)
    └── footer.html     # Shared footer
```

#### 2.2 Convert Dashboard Modal to Web Page

**New File: `pages/dashboard.html`**

Key changes from `crmModal.html`:
1. Remove modal-specific CSS (fixed width/height)
2. Add responsive CSS (viewport-based sizing)
3. Replace `google.script.run` with `API.call()`
4. Add navigation header
5. Add client-side routing for tabs
6. Use full viewport instead of 1100x650px

Example structure:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Style et Matière - Tableau de Bord</title>

  <style>
    /* Responsive styles instead of fixed modal dimensions */
    :root {
      --primary: #00796b;
      --primary-dark: #004d40;
      --secondary: #f2eb2d;
      /* ... rest of CSS variables */
    }

    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f5f7fa;
    }

    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* Responsive layout */
    @media (max-width: 768px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .clients-container {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <?!= include('client-api'); ?>
</head>
<body>
  <div class="app-container">
    <?!= include('components/header'); ?>

    <!-- Main content (same as crmModal.html but with responsive styles) -->
    <div class="content-area">
      <!-- Dashboard content here -->
    </div>
  </div>

  <script>
    // Replace all google.script.run calls with API.call()

    // OLD:
    // google.script.run
    //   .withSuccessHandler(displayMetrics)
    //   .getDashboardMetrics();

    // NEW:
    API.getDashboardMetrics()
      .then(displayMetrics)
      .catch(handleError);
  </script>
</body>
</html>
```

#### 2.3 Create Shared Navigation Header

**New File: `pages/components/header.html`**

```html
<header class="app-header">
  <div class="header-content">
    <div class="logo">
      🎨 Style et Matière CRM
    </div>

    <nav class="main-nav">
      <a href="?page=dashboard" class="nav-link">📊 Tableau de Bord</a>
      <a href="?page=clients" class="nav-link">👥 Clients</a>
      <a href="?page=calendar" class="nav-link">📅 Calendrier</a>
      <a href="?page=settings" class="nav-link">⚙️ Paramètres</a>
    </nav>

    <div class="user-menu">
      <span class="user-name"><?= user.name ?></span>
      <button onclick="logout()">Déconnexion</button>
    </div>
  </div>
</header>

<style>
  .app-header {
    background: var(--primary);
    color: white;
    padding: 1rem 2rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1400px;
    margin: 0 auto;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .main-nav {
    display: flex;
    gap: 1rem;
  }

  .nav-link {
    color: white;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .nav-link:hover {
    background: rgba(255,255,255,0.1);
  }

  .user-menu {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
    }

    .main-nav {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>
```

#### 2.4 Create Utility Functions

**New File: `utils.js`**

```javascript
/**
 * Utility functions for web app
 */

/**
 * Includes HTML file content (for templates)
 * @param {string} filename - File name without extension
 * @returns {string} HTML content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Gets configuration safe for client-side
 * Removes sensitive data before sending to client
 */
function getClientConfig() {
  const safeCONFIG = JSON.parse(JSON.stringify(CONFIG));

  // Remove sensitive data
  delete safeCONFIG.file_paths.crm_sheet_id;
  delete safeCONFIG.auth;
  delete safeCONFIG.company_info.iban;
  delete safeCONFIG.company_info.bic;

  return safeCONFIG;
}

/**
 * Gets user name from email
 */
function getUserName(email) {
  // Extract name from email (before @)
  const name = email.split('@')[0];

  // Capitalize first letter of each word
  return name
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

---

### Phase 3: Testing & Deployment (Week 3)

#### 3.1 Testing Checklist

**Functionality Testing:**
- [ ] Dashboard loads and displays metrics correctly
- [ ] Client list displays with pagination
- [ ] Client details load correctly
- [ ] Quote builder works (create new quote)
- [ ] Quote builder works (edit existing quote)
- [ ] Invoice generation works
- [ ] Email draft generation works
- [ ] Service catalog loads
- [ ] New service creation works
- [ ] Auto-save functionality works
- [ ] Calendar view displays correctly
- [ ] All filters and search work
- [ ] Status updates work
- [ ] Project details update works
- [ ] Notes saving works

**Authentication Testing:**
- [ ] Authorized users can access
- [ ] Unauthorized users are blocked
- [ ] Admin users have full access
- [ ] Read-only users have limited access
- [ ] Session persists across page refreshes
- [ ] Logout works correctly

**Performance Testing:**
- [ ] Dashboard loads in < 2 seconds
- [ ] Client list renders quickly
- [ ] API calls respond in < 1 second
- [ ] No memory leaks on long sessions
- [ ] Works on slow connections

**Cross-Browser Testing:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

**Responsive Design Testing:**
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

#### 3.2 Deployment Process

**Step 1: Deploy as Test Version**

1. In Apps Script editor, click **Deploy** → **New deployment**
2. Select type: **Web app**
3. Configuration:
   - Description: "CRM Web App - Test Version"
   - Execute as: **User accessing the web app**
   - Who has access: **Only myself** (for testing)
4. Click **Deploy**
5. Copy the web app URL

**Step 2: Internal Testing**

1. Open web app URL in private/incognito window
2. Test all functionality according to checklist
3. Check browser console for errors
4. Monitor Apps Script execution logs

**Step 3: Beta Testing**

1. Create new deployment with access: **Anyone at [your domain]**
2. Share URL with 2-3 beta testers
3. Collect feedback
4. Fix any issues

**Step 4: Production Deployment**

1. Once testing is complete, create production deployment
2. Configuration:
   - Description: "CRM Web App - Production"
   - Execute as: **User accessing the web app**
   - Who has access: **Anyone at [your domain]** or **Anyone** (if external access needed)
3. Note the deployment ID for updates

**Step 5: Update Existing Deployments**

For future updates, use deployment ID to update existing deployment:
```bash
clasp deploy --deploymentId YOUR_DEPLOYMENT_ID
```

---

## Authentication & Security

### Authentication Flow

```
1. User visits web app URL
   ↓
2. doGet() checks Session.getActiveUser()
   ↓
3a. Email found → Check authorization
3b. No email → Redirect to Google login
   ↓
4a. Authorized → Render page
4b. Not authorized → Show access denied
```

### Security Considerations

**1. Data Access Control:**
- Check user permissions on every API call
- Validate row-level access (user can only access their clients)
- Implement role-based access control (admin, user, readonly)

**2. Input Validation:**
- Sanitize all user input before processing
- Validate row numbers (prevent access to arbitrary rows)
- Escape HTML to prevent XSS

**3. CSRF Protection:**
- Apps Script web apps are somewhat protected by Google's auth
- For sensitive operations, add additional token verification

**4. Rate Limiting:**
- Implement request throttling for API calls
- Use Apps Script quotas wisely

**5. Error Handling:**
- Don't expose sensitive error details to client
- Log detailed errors server-side
- Show user-friendly messages client-side

### Recommended Access Levels

**Development/Testing:**
- Access: "Only myself"
- Allows safe testing without affecting production

**Internal Use (Style et Matière employees):**
- Access: "Anyone at yourdomain.com"
- Restricts to your Google Workspace domain
- Most secure for internal CRM

**Client Access (if needed in future):**
- Access: "Anyone"
- Requires additional authentication layer
- Implement email verification
- Add client-specific permissions

---

## URL Routing & Navigation

### URL Structure

```
Base URL: https://script.google.com/macros/s/DEPLOYMENT_ID/exec

Pages:
- /                           → Dashboard (default)
- /?page=dashboard            → Dashboard
- /?page=clients              → Client list
- /?page=clients&id=123       → Client detail (row 123)
- /?page=quote                → New quote builder
- /?page=quote&id=456         → Edit quote (row 456)
- /?page=invoice&id=456       → New invoice from quote
- /?page=calendar             → Project calendar
- /?page=settings             → Settings page
```

### Client-Side Routing (SPA Approach)

For better UX, implement single-page app routing:

```javascript
// In dashboard.html
function navigate(page, params = {}) {
  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('page', page);
  Object.entries(params).forEach(([key, val]) => {
    url.searchParams.set(key, val);
  });

  // Update browser history
  window.history.pushState({}, '', url);

  // Load content
  loadPage(page, params);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
  const url = new URL(window.location);
  const page = url.searchParams.get('page') || 'dashboard';
  loadPage(page);
});
```

---

## Rollout Strategy

### Timeline

**Week 1: Foundation**
- Days 1-2: Set up web app entry, auth, API layer
- Days 3-4: Test foundation, fix issues
- Day 5: Internal demo

**Week 2: UI Migration**
- Days 1-2: Convert dashboard to web page
- Days 3-4: Convert quote/invoice builder
- Day 5: Polish UI, responsive design

**Week 3: Testing & Launch**
- Days 1-2: Internal testing, bug fixes
- Days 3-4: Beta testing with select users
- Day 5: Production deployment

### Communication Plan

**Before Migration:**
- Announce upcoming web app to users
- Explain benefits (faster, bookmarkable, better UX)
- Set expectations for transition period

**During Migration:**
- Keep existing modal system working
- Allow users to choose: modal or web app
- Provide feedback channel

**After Migration:**
- Monitor usage and performance
- Collect user feedback
- Gradually deprecate modal system (if desired)

### Rollback Plan

If critical issues arise:

1. **Immediate:** Change web app deployment access to "Only myself"
2. **Short-term:** Users continue with modal system
3. **Fix issues:** Debug and resolve problems
4. **Re-deploy:** Once fixed, restore web app access

---

## Backward Compatibility

### Maintain Both Systems (Recommended)

**Option 1: Parallel Systems**
- Keep modal system functional
- Add web app as alternative access method
- Let users choose their preferred method
- Monitor usage, deprecate later if web app is preferred

**Option 2: Gradual Migration**
- Start with web app for new features
- Maintain existing modal for core functions
- Migrate modules one-by-one
- Fully deprecate modals after 3-6 months

**Shared Backend:**
- All business logic remains in existing files
- Both modal and web app call same functions
- Data storage unchanged (still in Sheets)
- No duplicate code maintenance

---

## Cost & Performance Considerations

### Apps Script Quotas

**Free Tier:**
- 20,000 URL fetches/day
- 90 minutes script runtime/day
- 5 concurrent executions

**Workspace Edition:**
- Unlimited URL fetches
- 6 hours script runtime/day
- 30 concurrent executions

### Performance Optimization

**Already Implemented (Phase 1):**
- ✅ Client-side caching (services)
- ✅ Pagination (client list)
- ✅ Optimized metrics calculation
- ✅ Reduced auto-refresh frequency

**Additional for Web App:**
- Implement HTTP caching headers
- Use CDN for static assets (if needed)
- Compress responses
- Lazy load non-critical features

---

## Next Steps

### Immediate Actions

1. **Decision Time:**
   - Review this migration plan
   - Approve approach and timeline
   - Allocate development time

2. **Prepare Environment:**
   - Create backup of current system
   - Set up version control (Git)
   - Document current functionality

3. **Start Phase 1:**
   - Create `webapp.js`
   - Implement authentication
   - Build API layer
   - Test foundation

### Questions to Answer

Before starting migration:

1. **Access Control:**
   - Who needs access? (employees only, or clients too?)
   - What roles are needed? (admin, user, readonly)
   - Should specific clients see only their data?

2. **Deployment:**
   - Keep modal system? (recommended: yes, initially)
   - Gradual rollout or all-at-once?
   - Beta testing with select users?

3. **Features:**
   - Any new features to add during migration?
   - Any features to remove/simplify?
   - Mobile app in future?

4. **Branding:**
   - Custom domain? (requires Google Workspace)
   - Logo and color scheme updates?
   - Custom styling for web app?

---

## Support & Resources

### Documentation

- [Google Apps Script Web Apps Guide](https://developers.google.com/apps-script/guides/web)
- [HTML Service Best Practices](https://developers.google.com/apps-script/guides/html/best-practices)
- [OAuth Scopes Reference](https://developers.google.com/apps-script/guides/services/authorization)

### Getting Help

For implementation support:
1. Refer to this migration plan
2. Check Apps Script execution logs
3. Test in incognito mode to isolate auth issues
4. Monitor browser console for client-side errors

---

## Conclusion

This migration plan provides a complete roadmap to transform your CRM from a modal-based application to a professional, standalone web app while maintaining all existing functionality and keeping data in Google Sheets (your key differentiator).

**Key Takeaways:**
- ✅ Phased approach minimizes risk
- ✅ Backward compatible (can keep both systems)
- ✅ Authentication and security built-in
- ✅ Better UX with full browser access
- ✅ Maintains Sheet-based data storage
- ✅ Ready for future enhancements

**Ready to start?** Begin with Phase 1 (Foundation Layer) and build from there!

---

**Document Version:** 1.0
**Last Updated:** 2025-12-16
**Status:** Ready for Implementation
**Estimated Effort:** 2-3 weeks
**Risk Level:** Medium (with mitigation strategies in place)
