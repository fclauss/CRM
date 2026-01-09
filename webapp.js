/**
 * Web App Entry Point
 * Version: 1.0
 * Handles HTTP requests and routes them to appropriate pages/APIs
 *
 * @author Fabien for Style et Matière
 */

/**
 * Handles GET requests to the web app
 * Routes to appropriate page based on 'page' parameter
 *
 * @param {Object} e - Event object with request parameters
 * @returns {HtmlOutput} Rendered HTML page
 */
function doGet(e) {
  try {
    // Check authentication
    const user = authenticateRequest(e);
    if (!user) {
      Logger.log('doGet: No user, rendering login page');
      return renderLoginPage();
    }

    Logger.log('doGet: User authenticated, rendering page');

    // Extract route and parameters
    const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'dashboard';
    const params = (e && e.parameter) ? e.parameter : {};

    Logger.log('doGet: Routing to page: ' + page);

    // Route to appropriate page
    return routeRequest(page, params, user);

  } catch (error) {
    Logger.log('doGet error: ' + error.message);
    Logger.log('doGet error stack: ' + error.stack);
    return renderErrorPage(error.message);
  }
}

/**
 * Handles POST requests (API calls)
 * All AJAX calls from the web app come through here
 *
 * @param {Object} e - Event object with POST data
 * @returns {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  try {
    // Check authentication
    const user = authenticateRequest(e);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Parse request body
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (!action) {
      return jsonResponse({ error: 'No action specified' }, 400);
    }

    // Route to API handler
    return handleApiRequest(action, data, user);

  } catch (error) {
    Logger.log('doPost error: ' + error.message);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

/**
 * Routes GET requests to appropriate page renderer
 *
 * @param {string} page - Page name
 * @param {Object} params - URL parameters
 * @param {Object} user - Authenticated user object
 * @returns {HtmlOutput} Rendered page
 */
function routeRequest(page, params, user) {
  const routes = {
    'dashboard': renderDashboardWorking,
    'clients': renderClients,
    'calendar': renderCalendar,
    'settings': renderSettings
  };

  const handler = routes[page];
  if (!handler) {
    return render404();
  }

  return handler(params, user);
}

/**
 * Renders working dashboard (uses google.script.run instead of POST)
 */
function renderDashboardWorking(params, user) {
  const template = HtmlService.createTemplateFromFile('pages/dashboard-working');
  template.user = user;
  template.webAppUrl = ScriptApp.getService().getUrl();
  template.currentPage = 'dashboard';

  return template.evaluate()
    .setTitle('Dashboard - Style et Matière')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Renders the clients page
 * Shows client list with search and details
 *
 * @param {Object} params - URL parameters
 * @param {Object} user - Authenticated user
 * @returns {HtmlOutput} Clients page
 */
function renderClients(params, user) {
  const template = HtmlService.createTemplateFromFile('pages/clients');
  template.user = user;
  template.webAppUrl = ScriptApp.getService().getUrl();
  template.currentPage = 'clients';

  // Safely serialize user object for client-side
  try {
    template.userJson = user ? JSON.stringify(user) : 'null';
  } catch (e) {
    Logger.log('Error serializing user object: ' + e.message);
    template.userJson = 'null';
  }

  template.config = getClientConfig();

  return template.evaluate()
    .setTitle('Style et Matière - Clients')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Renders the calendar page
 * Shows project timeline and planning
 *
 * @param {Object} params - URL parameters
 * @param {Object} user - Authenticated user
 * @returns {HtmlOutput} Calendar page
 */
function renderCalendar(params, user) {
  const template = HtmlService.createTemplateFromFile('pages/calendar');
  template.user = user;
  template.webAppUrl = ScriptApp.getService().getUrl();
  template.currentPage = 'calendar';

  // Safely serialize user object for client-side
  try {
    template.userJson = user ? JSON.stringify(user) : 'null';
  } catch (e) {
    Logger.log('Error serializing user object: ' + e.message);
    template.userJson = 'null';
  }

  template.config = getClientConfig();

  return template.evaluate()
    .setTitle('Style et Matière - Calendrier')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Renders the settings page
 * Email templates, preferences, etc.
 *
 * @param {Object} params - URL parameters
 * @param {Object} user - Authenticated user
 * @returns {HtmlOutput} Settings page
 */
function renderSettings(params, user) {
  const template = HtmlService.createTemplateFromFile('pages/settings');
  template.user = user;
  template.webAppUrl = ScriptApp.getService().getUrl();
  template.currentPage = 'settings';

  // Get spreadsheet URL for direct access link
  template.spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  // Safely serialize user object for client-side
  try {
    template.userJson = user ? JSON.stringify(user) : 'null';
  } catch (e) {
    Logger.log('Error serializing user object: ' + e.message);
    template.userJson = 'null';
  }

  template.config = getClientConfig();

  return template.evaluate()
    .setTitle('Style et Matière - Paramètres')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Renders login/unauthorized page
 *
 * @returns {HtmlOutput} Login page
 */
function renderLoginPage() {
  const template = HtmlService.createTemplateFromFile('pages/login');

  return template.evaluate()
    .setTitle('Style et Matière - Connexion')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Renders 404 not found page
 *
 * @returns {HtmlOutput} 404 page
 */
function render404() {
  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Page non trouvée</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f5f7fa;
        }
        .error-container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #00796b; font-size: 48px; margin: 0; }
        p { color: #666; font-size: 18px; }
        a { color: #00796b; text-decoration: none; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>404</h1>
        <p>Page non trouvée</p>
        <a href="?page=dashboard">← Retour au tableau de bord</a>
      </div>
    </body>
    </html>
  `);

  return html
    .setTitle('404 - Page non trouvée')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Renders error page
 *
 * @param {string} message - Error message
 * @returns {HtmlOutput} Error page
 */
function renderErrorPage(message) {
  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Erreur - Style et Matière</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f5f7fa;
        }
        .error-container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          max-width: 500px;
        }
        h1 { color: #f44336; font-size: 36px; margin: 0 0 20px 0; }
        p { color: #666; font-size: 16px; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
        a { color: #00796b; text-decoration: none; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>⚠️ Erreur</h1>
        <p>Une erreur est survenue:</p>
        <code>${message}</code>
        <br><br>
        <a href="?page=dashboard">← Retour au tableau de bord</a>
      </div>
    </body>
    </html>
  `);

  return html
    .setTitle('Erreur')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Creates JSON response for API calls
 *
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (for reference only)
 * @returns {ContentService.TextOutput} JSON response
 */
function jsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // Note: Apps Script doesn't support custom HTTP status codes
  // We include status in response body for client-side handling
  if (statusCode !== 200) {
    data._statusCode = statusCode;
  }

  return output;
}

