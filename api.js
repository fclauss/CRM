/**
 * API Layer
 * Version: 1.0
 * Provides REST-like API endpoints for web app
 * Replaces google.script.run RPC calls with POST-based API
 *
 * @author Fabien for Style et Matière
 */

/**
 * Handles API requests from web app
 * Routes action to appropriate handler function
 *
 * @param {string} action - API action name
 * @param {Object} data - Request data
 * @param {Object} user - Authenticated user object
 * @returns {ContentService.TextOutput} JSON response
 */
function handleApiRequest(action, data, user) {
  try {
    Logger.log('API call: ' + action + ' by ' + user.email);

    // Check authorization for this action
    if (!isAuthorizedAction(action, user)) {
      return jsonResponse({
        success: false,
        error: 'Non autorisé'
      }, 403);
    }

    // Route to appropriate handler
    const handlers = {
      // Dashboard APIs
      'getDashboardMetrics': () => getDashboardMetrics(),
      'getClientsData': () => getClientsData(),
      'getCalendarData': () => getCalendarData(),

      // Client management APIs
      'getClientDetails': (d) => getClientDetails(d.row),
      'updateClientStatus': (d) => updateClientStatus(d.row, d.status),
      'updateProjectDetails': (d) => updateProjectDetails(d.row, d.startDate, d.endDate, d.value),
      'saveClientNotes': (d) => saveClientNotes(d.row, d.notes),
      'getQuoteValue': (d) => getQuoteValue(d.row),

      // Quote/Invoice APIs (for modal compatibility)
      'getServices': () => getServices(),
      'getInitialBusinessData': (d) => getInitialBusinessData(d.row),
      'generateQuoteWithServices': (d) => generateQuoteWithServices(d.quoteStructure, d.businessData, d.row),
      'generateInvoiceWithServices': (d) => generateInvoiceWithServices(d.invoiceStructure, d.businessData, d.row),
      'addNewService': (d) => addNewService(d.serviceData),

      // Email APIs
      'generateQuoteEmailDraft': (d) => generateQuoteEmailDraft(d.row),
      'generateFollowUpEmailDraft': (d) => generateFollowUpEmailDraft(d.row),
      'generateTestimonialEmailDraft': (d) => generateTestimonialEmailDraft(d.row),

      // Email template APIs
      'getEmailTemplates': () => getEmailTemplates(),
      'saveEmailTemplates': (d) => saveEmailTemplates(d.templates),
      'resetEmailTemplates': () => resetEmailTemplates(),

      // Invoice counter APIs
      'getInvoiceCounter': () => getInvoiceCounter(),
      'resetInvoiceCounter': (d) => resetInvoiceCounterApi(d.nextNumber),

      // Mentions API
      'getMentions': () => getMentions(),

      // Draft APIs
      'getQuoteDraft': (d) => getQuoteDraft(d.row),
      'saveQuoteDraft': (d) => saveQuoteDraft(d.row, d.quoteStructure, d.businessData),
      'clearQuoteDraft': (d) => clearQuoteDraft(d.row)
    };

    const handler = handlers[action];
    if (!handler) {
      Logger.log('Unknown action: ' + action);
      return jsonResponse({
        success: false,
        error: 'Action inconnue: ' + action
      }, 400);
    }

    // Execute handler and return result
    const result = handler(data);

    return jsonResponse({
      success: true,
      data: result
    });

  } catch (error) {
    Logger.log('API error [' + action + ']: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);

    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

/**
 * Utility: Includes HTML file content
 * Used for template includes in pages
 *
 * @param {string} filename - File name (without extension)
 * @returns {string} HTML content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
