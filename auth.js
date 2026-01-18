/**
 * Authentication and Authorization Module
 * Version: 1.0
 * Simple 2-user authentication: 1 admin (Fabien) + 1 user (Style et Matière)
 *
 * @author Fabien for Style et Matière
 */

/**
 * Authenticates incoming request using Google Apps Script session
 * Checks if user is in authorized users list from CONFIG
 *
 * @param {Object} e - Event object with request data
 * @returns {Object|null} User object with {email, name, role} or null if not authenticated
 */
function authenticateRequest(e) {
  const result = authenticateRequestWithDebug(e);
  return result.user;
}

/**
 * Authenticates incoming request and returns debug info
 * Used by doGet to show detected email on login page for troubleshooting
 *
 * @param {Object} e - Event object with request data
 * @returns {Object} Object with {user, detectedEmail, failReason}
 */
function authenticateRequestWithDebug(e) {
  try {
    // Get current user from Apps Script session
    // Use getEffectiveUser() which is more reliable for web apps
    const session = Session.getEffectiveUser();
    const email = session.getEmail();

    // IMPORTANT: In web apps, getEmail() might return empty string
    // if the user hasn't granted OAuth permissions yet
    if (!email || email === '') {
      Logger.log('Auth failed: No email in session (OAuth not granted or DOMAIN access issue)');
      Logger.log('Deployment mode should be USER_ACCESSING, access should be DOMAIN or ANYONE');
      return { user: null, detectedEmail: '(vide)', failReason: 'no_email' };
    }

    // Check if user is authorized
    if (!isAuthorizedUser(email)) {
      Logger.log('Auth failed: User not authorized: ' + email);
      return { user: null, detectedEmail: email, failReason: 'not_authorized' };
    }

    // Get user details
    const role = getUserRole(email);
    const name = getUserName(email);

    Logger.log('Auth success: ' + email + ' (role: ' + role + ')');

    return {
      user: {
        email: email,
        name: name,
        role: role
      },
      detectedEmail: email,
      failReason: null
    };

  } catch (error) {
    Logger.log('Auth error: ' + error.message);
    return { user: null, detectedEmail: '(erreur: ' + error.message + ')', failReason: 'error' };
  }
}

/**
 * Checks if user email is in authorized users list
 * Uses CONFIG.auth.allowed_users
 *
 * @param {string} email - User email address
 * @returns {boolean} True if authorized
 */
function isAuthorizedUser(email) {
  const allowedUsers = CONFIG.auth?.allowed_users || [];

  if (allowedUsers.length === 0) {
    // If no users configured, deny access (security by default)
    Logger.log('No allowed users configured in CONFIG');
    return false;
  }

  return allowedUsers.includes(email);
}

/**
 * Gets user role for authorization checks
 * Checks CONFIG.auth.admins list
 *
 * @param {string} email - User email address
 * @returns {string} User role: 'admin' or 'user'
 */
function getUserRole(email) {
  const admins = CONFIG.auth?.admins || [];

  if (admins.includes(email)) {
    return 'admin';
  }

  return 'user';
}

/**
 * Gets display name from email address
 * Extracts name from email (before @) and capitalizes
 *
 * @param {string} email - User email address
 * @returns {string} Display name
 */
function getUserName(email) {
  // Check if there's a custom name mapping in CONFIG
  const customNames = CONFIG.auth?.user_names || {};
  if (customNames[email]) {
    return customNames[email];
  }

  // Extract name from email (before @)
  const namePart = email.split('@')[0];

  // Capitalize first letter of each word (handle dot-separated names)
  return namePart
    .split('.')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Checks if user is authorized to perform specific action
 * Currently only admin/user distinction (no readonly role needed for 2 users)
 *
 * @param {string} action - API action name
 * @param {Object} user - User object from authenticateRequest
 * @returns {boolean} True if authorized
 */
function isAuthorizedAction(action, user) {
  // Admin-only actions
  const adminActions = [
    'saveEmailTemplates',
    'resetEmailTemplates'
  ];

  if (adminActions.includes(action) && user.role !== 'admin') {
    Logger.log('Action denied: ' + action + ' requires admin role');
    return false;
  }

  // All other actions allowed for both admin and user
  return true;
}

/**
 * Gets client-safe configuration object
 * Removes sensitive data before sending to client
 *
 * @returns {Object} Safe configuration object
 */
function getClientConfig() {
  // Deep clone CONFIG
  const safeCONFIG = JSON.parse(JSON.stringify(CONFIG));

  // Remove sensitive data (with null checks)
  if (safeCONFIG.file_paths) {
    delete safeCONFIG.file_paths.crm_sheet_id;
  }

  delete safeCONFIG.auth;

  if (safeCONFIG.company_info) {
    delete safeCONFIG.company_info.iban;
    delete safeCONFIG.company_info.bic;
    delete safeCONFIG.company_info.qr_code_api_endpoint;
  }

  return safeCONFIG;
}
