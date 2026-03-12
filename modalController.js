/**
 * Modal Controller - CRM Dashboard Backend
 * Version: 3.5
 * Handles all backend functions for the CRM dashboard modal interface
 *
 * @author Fabien for Style et Matière
 * @see README.md for full documentation
 */

// =============================================================================
// MODAL INTERFACE
// =============================================================================

/**
 * Opens the CRM dashboard modal
 * Displays as 1100x650 modal with empty title (styled header in HTML)
 */
function openCRMModal() {
  const html = HtmlService.createTemplateFromFile('crmModal')
    .evaluate()
    .setWidth(1100)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

// =============================================================================
// DASHBOARD METRICS
// =============================================================================

/**
 * Calculates and returns dashboard metrics for the home tab
 * PERFORMANCE OPTIMIZED: Uses direct array indexing instead of createObjectFromRow
 * Includes revenue, pending quotes, active projects, conversion rates, and activity feeds
 *
 * @returns {DashboardMetrics} Dashboard metrics object
 * @see types.js for DashboardMetrics type definition
 */
function getDashboardMetrics() {
  const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  // PERFORMANCE: Pre-compute column indices once instead of creating objects per row
  const C = CONFIG.column_mappings;
  const statusIdx = headers.indexOf(C.status);
  const quoteDateIdx = headers.indexOf(C.quote_date);
  const quoteJsonIdx = headers.indexOf(C.quote_data_json);
  const quoteNumberIdx = headers.indexOf(C.quote_number);
  const clientNameIdx = headers.indexOf(C.client_name);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Historical tracking for charts and trends
  const last6Months = getLast6MonthNames();
  const revenueByMonth = {}; // Format: { 'Jan 2026': 0, ... }
  const statusCounts = {
    [CONFIG.statuses.NEW]: 0,
    [CONFIG.statuses.SENT]: 0,
    [CONFIG.statuses.WON]: 0,
    [CONFIG.statuses.COMPLETED]: 0,
    [CONFIG.statuses.CANCELLED]: 0
  };

  // Previous month metrics for trend calculation
  let lastMonthActiveQuotes = 0;
  let lastMonthTotalValue = 0;
  let lastMonthWonProjects = 0;
  let lastMonthTotalQuotes = 0;
  let lastMonthWonQuotes = 0;

  let monthRevenue = 0;
  let lastMonthRevenue = 0;
  let pendingQuotes = 0;
  let pendingValue = 0;
  let activeProjects = 0;
  let totalQuotes = 0;
  let wonQuotes = 0;
  const requiredActions = [];
  const recentActivity = [];

  // PERFORMANCE: Single pass through data with direct array access
  data.forEach((row, index) => {
    const status = row[statusIdx];

    // Skip rows without status early
    if (!status) return;

    // Count status distribution (for pie chart)
    if (statusCounts.hasOwnProperty(status)) {
      statusCounts[status]++;
    }

    // Process won/completed quotes for revenue
    if (status === CONFIG.statuses.WON || status === CONFIG.statuses.COMPLETED) {
      const quoteDate = new Date(row[quoteDateIdx]);
      const amount = parseQuoteValueOptimized(row[quoteJsonIdx]);

      // Track revenue by month (for line chart)
      const monthKey = getMonthKey(quoteDate);
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + amount;

      if (quoteDate >= startOfMonth) {
        monthRevenue += amount;
      } else if (quoteDate >= startOfLastMonth && quoteDate < startOfMonth) {
        lastMonthRevenue += amount;
      }

      if (status === CONFIG.statuses.WON) {
        activeProjects++;
      }
      wonQuotes++;
    }

    // Process pending quotes
    if (status === CONFIG.statuses.SENT) {
      pendingQuotes++;
      pendingValue += parseQuoteValueOptimized(row[quoteJsonIdx]);

      const quoteDate = new Date(row[quoteDateIdx]);
      const daysSince = Math.floor((now - quoteDate) / (1000 * 60 * 60 * 24));

      if (daysSince > 7) {
        requiredActions.push({
          text: 'Relancer devis ' + row[quoteNumberIdx] + ' - ' + row[clientNameIdx] + ' (' + daysSince + ' jours)',
          onclick: 'sendReminderForRow(' + (index + 2) + ')',
          buttonText: 'Relancer'
        });
      }
    }

    // Count total quotes
    if (row[quoteNumberIdx]) {
      totalQuotes++;
    }

    // Track previous month metrics for trend calculation
    if (row[quoteDateIdx]) {
      const quoteDate = new Date(row[quoteDateIdx]);
      if (quoteDate >= startOfLastMonth && quoteDate < startOfMonth) {
        if (status === CONFIG.statuses.SENT) {
          lastMonthActiveQuotes++;
          lastMonthTotalValue += parseQuoteValueOptimized(row[quoteJsonIdx]);
        }
        if (status === CONFIG.statuses.WON || status === CONFIG.statuses.COMPLETED) {
          lastMonthWonProjects++;
          lastMonthWonQuotes++;
        }
        if (row[quoteNumberIdx]) {
          lastMonthTotalQuotes++;
        }
      }
    }

    // Collect recent activity (limit to 5)
    if (row[quoteDateIdx] && recentActivity.length < 5) {
      const date = new Date(row[quoteDateIdx]);
      const timeStr = formatTimeAgo(date);
      recentActivity.push({
        time: timeStr,
        description: 'Devis ' + row[quoteNumberIdx] + ' créé pour ' + row[clientNameIdx]
      });
    }
  });

  const revenueChange = lastMonthRevenue > 0
    ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : 0;

  const conversionRate = totalQuotes > 0
    ? Math.round((wonQuotes / totalQuotes) * 100)
    : 0;

  // Calculate real trend indicators
  const activeQuotesChange = lastMonthActiveQuotes > 0
    ? Math.round(((pendingQuotes - lastMonthActiveQuotes) / lastMonthActiveQuotes) * 100)
    : (pendingQuotes > 0 ? 100 : 0);

  const totalValueChange = lastMonthTotalValue > 0
    ? Math.round(((pendingValue - lastMonthTotalValue) / lastMonthTotalValue) * 100)
    : (pendingValue > 0 ? 100 : 0);

  const wonProjectsChange = lastMonthWonProjects > 0
    ? Math.round(((wonQuotes - lastMonthWonProjects) / lastMonthWonProjects) * 100)
    : (wonQuotes > 0 ? 100 : 0);

  const lastMonthConversionRate = lastMonthTotalQuotes > 0
    ? Math.round((lastMonthWonQuotes / lastMonthTotalQuotes) * 100)
    : 0;
  const conversionRateChange = lastMonthConversionRate > 0
    ? conversionRate - lastMonthConversionRate
    : 0;

  // Format chart data for frontend
  const revenueChartData = {
    labels: last6Months.map(m => m.name), // ['Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Jan']
    values: last6Months.map(m => revenueByMonth[m.key] || 0)
  };

  const statusDistribution = {
    labels: Object.keys(statusCounts),
    values: Object.values(statusCounts),
    colors: ['#9E9E9E', '#FF9800', '#4CAF50', '#00796b', '#F44336']
  };

  return {
    // Main metrics with REAL trend indicators
    activeQuotes: pendingQuotes,
    activeQuotesChange: activeQuotesChange,
    totalValue: pendingValue,
    totalValueChange: totalValueChange,
    wonProjects: wonQuotes,
    wonProjectsChange: wonProjectsChange,
    conversionRate: conversionRate,
    conversionRateChange: conversionRateChange,

    // Primary revenue metric (already exists, keep it)
    monthRevenue: monthRevenue,
    revenueChange: revenueChange,

    // NEW: Chart data
    revenueChartData: revenueChartData,
    statusDistribution: statusDistribution,

    // Existing fields (keep for compatibility)
    pendingQuotes: pendingQuotes,
    pendingValue: pendingValue,
    activeProjects: activeProjects,
    nextCompletion: activeProjects > 0 ? 'Dans 2 semaines' : 'Aucun',

    // Actions and activity
    requiredActions: requiredActions,
    recentActivity: recentActivity
  };
}

/**
 * Get last 6 month names and keys in French
 * @returns {Array<{name: string, key: string}>} Array of month objects with display name and grouping key
 */
function getLast6MonthNames() {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const result = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    result.push({
      name: monthName,
      key: `${monthName} ${year}`
    });
  }

  return result;
}

/**
 * Get month key for grouping revenue data (e.g., "Jan 2026")
 * @param {Date} date - Date to extract month key from
 * @returns {string} Month key in format "MonthName Year"
 */
function getMonthKey(date) {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * PERFORMANCE OPTIMIZED: Parses quote total value from JSON data
 * Tries to use pre-calculated totals.total if available, falls back to calculation
 *
 * @param {string} quoteDataJson - JSON string containing quote structure and business data
 * @returns {number} Total quote value including VAT, rounded to 2 decimals
 */
function parseQuoteValueOptimized(quoteDataJson) {
  if (!quoteDataJson) return 0;

  try {
    const data = JSON.parse(quoteDataJson);

    // PERFORMANCE: Use pre-calculated total if available (from Phase 2 optimization)
    if (data.totals && data.totals.total) {
      return data.totals.total;
    }

    // Fallback: Calculate from services
    const services = data.quoteStructure || [];
    let subtotal = 0;

    services.forEach(section => {
      if (section.services) {
        section.services.forEach(service => {
          subtotal += (service.price * service.quantity);
        });
      }
    });

    const discount = data.businessData?.discountPercentage || 0;
    const afterDiscount = subtotal * (1 - discount / 100);
    const vatRate = 1.10;
    const total = afterDiscount * vatRate;

    return Math.round(total * 100) / 100;

  } catch (e) {
    Logger.log('Error parsing quote value: ' + e.message);
    return 0;
  }
}


/**
 * Formats time difference in French (il y a X jours/heures/minutes)
 *
 * @param {Date} date - Date to compare with current time
 * @returns {string} Formatted time ago string
 */
function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return 'il y a ' + minutes + ' minute' + (minutes > 1 ? 's' : '');
  if (hours < 24) return 'il y a ' + hours + ' heure' + (hours > 1 ? 's' : '');
  if (days < 30) return 'il y a ' + days + ' jour' + (days > 1 ? 's' : '');

  const months = Math.floor(days / 30);
  if (months < 12) return 'il y a ' + months + ' mois';

  const years = Math.floor(days / 365);
  return 'il y a ' + years + ' an' + (years > 1 ? 's' : '');
}

// =============================================================================
// CLIENT MANAGEMENT
// =============================================================================

/**
 * Retrieves all clients data in reverse chronological order (newest first)
 * Returns serialization-safe data (no Date objects)
 *
 * @returns {ClientListItem[]} Array of client list items
 * @see types.js for ClientListItem type definition
 */
function getClientsData() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      Logger.log('Sheet not found: ' + CONFIG.file_paths.crm_sheet_name);
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    const C = CONFIG.column_mappings;
    const clients = [];

    data.forEach((row, index) => {
      const rowData = createObjectFromRow(row, headers);

      if (rowData[C.client_name]) {
        const amount = parseQuoteValueOptimized(rowData[C.quote_data_json]);
        const quoteDate = rowData[C.quote_date] || rowData[C.timestamp];

        clients.push({
          row: index + 2,
          name: String(rowData[C.client_name] || ''),
          email: String(rowData[C.client_email] || ''),
          phone: String(rowData[C.phone] || ''),
          status: String(rowData[C.status] || 'Nouveau'),
          lastDocument: String(rowData[C.quote_number] || 'Aucun devis'),
          amount: formatCurrency(amount),
          lastAction: formatTimeAgo(quoteDate ? new Date(quoteDate) : new Date())
        });
      }
    });

    clients.sort((a, b) => b.row - a.row);

    Logger.log('Returning ' + clients.length + ' clients');
    return clients;

  } catch (error) {
    Logger.log('Error in getClientsData: ' + error.message);
    return [];
  }
}

/**
 * Retrieves detailed information for a specific client
 *
 * @param {number} row - Row number in the CRM sheet
 * @returns {ClientDetails} Detailed client information
 * @see types.js for ClientDetails type definition
 */
function getClientDetails(row) {
  const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const client = createObjectFromRow(rowData, headers);

  const C = CONFIG.column_mappings;

  let projectStartDate = '';
  let projectEndDate = '';

  if (client[C.project_start_date]) {
    try {
      const date = new Date(client[C.project_start_date]);
      projectStartDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    } catch (e) {
      Logger.log('Error formatting project start date: ' + e.message);
    }
  }

  if (client[C.project_end_date]) {
    try {
      const date = new Date(client[C.project_end_date]);
      projectEndDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    } catch (e) {
      Logger.log('Error formatting project end date: ' + e.message);
    }
  }

  const projectValue = client[C.project_value] || 0;

  let quoteDate = '';
  let invoiceDate = '';

  if (client[C.quote_date]) {
    try {
      const date = new Date(client[C.quote_date]);
      quoteDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    } catch (e) {
      Logger.log('Error formatting quote date: ' + e.message);
    }
  }

  if (client[C.invoice_date]) {
    try {
      const date = new Date(client[C.invoice_date]);
      invoiceDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    } catch (e) {
      Logger.log('Error formatting invoice date: ' + e.message);
    }
  }

  return {
    name: client[C.client_name],
    email: client[C.client_email],
    phone: client[C.phone],
    address: client[C.address] + ', ' + client[C.postal_code] + ' ' + client[C.city],
    addressStreet: client[C.address] || '',
    postalCode: client[C.postal_code] || '',
    city: client[C.city] || '',
    workType: client[C.work_type],
    status: client[C.status] || 'Nouveau',
    quoteNumber: client[C.quote_number],
    quoteUrl: client[C.quote_link],
    quoteDate: quoteDate,
    invoiceNumber: client[C.invoice_number],
    invoiceUrl: client[C.invoice_link],
    invoiceDate: invoiceDate,
    notes: client[C.internal_notes] || '',
    projectStartDate: projectStartDate,
    projectEndDate: projectEndDate,
    projectValue: projectValue,
    row: row
  };
}

/**
 * Updates the status of a client
 * Automatically sets project start date when status changes to "Projet gagné"
 *
 * @param {number} row - Row number in the sheet
 * @param {string} newStatus - New status value from CONFIG.statuses
 * @returns {Object} Result object with success flag and message
 */
function updateClientStatus(row, newStatus) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      throw new Error('Feuille CRM introuvable');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;

    const statusColIndex = headers.indexOf(C.status);
    if (statusColIndex === -1) {
      throw new Error('Colonne "Statut du Devis" introuvable');
    }

    sheet.getRange(row, statusColIndex + 1).setValue(newStatus);

    // Log status change to history
    const historyColIndex = headers.indexOf(C.status_history_json);
    if (historyColIndex !== -1) {
      let history = [];
      const existingHistory = sheet.getRange(row, historyColIndex + 1).getValue();
      if (existingHistory) {
        try {
          history = JSON.parse(existingHistory);
        } catch (e) {
          history = [];
        }
      }
      history.push({
        date: new Date().toISOString(),
        status: newStatus
      });
      sheet.getRange(row, historyColIndex + 1).setValue(JSON.stringify(history));
    }

    if (newStatus === CONFIG.statuses.WON) {
      const projectStartColIndex = headers.indexOf(C.project_start_date);
      if (projectStartColIndex !== -1) {
        const currentDate = sheet.getRange(row, projectStartColIndex + 1).getValue();
        if (!currentDate) {
          sheet.getRange(row, projectStartColIndex + 1).setValue(new Date());
        }
      }
    }

    Logger.log('Status updated for row ' + row + ': ' + newStatus);

    return {
      success: true,
      message: 'Statut mis à jour: ' + newStatus,
      newStatus: newStatus
    };

  } catch (error) {
    Logger.log('Error updating status: ' + error.message);
    return {
      success: false,
      message: 'Erreur: ' + error.message
    };
  }
}

/**
 * Updates project details when a project is won
 *
 * @param {number} row - Row number in the sheet
 * @param {string} startDate - Project start date (ISO format or empty)
 * @param {string} endDate - Project end date (ISO format or empty)
 * @param {number} projectValue - Project value in euros
 * @returns {Object} Result object with success flag, message, and updated values
 */
function updateProjectDetails(row, startDate, endDate, projectValue) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      throw new Error('Feuille CRM introuvable');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;

    const updatedFields = [];

    if (startDate) {
      const projectStartColIndex = headers.indexOf(C.project_start_date);

      if (projectStartColIndex !== -1) {
        sheet.getRange(row, projectStartColIndex + 1).setValue(new Date(startDate));
        updatedFields.push('Date de début');
      } else {
        Logger.log('Column not found: ' + C.project_start_date);
      }
    }

    if (endDate) {
      const projectEndColIndex = headers.indexOf(C.project_end_date);

      if (projectEndColIndex !== -1) {
        sheet.getRange(row, projectEndColIndex + 1).setValue(new Date(endDate));
        updatedFields.push('Date de fin');
      } else {
        Logger.log('Column not found: ' + C.project_end_date);
      }
    }

    if (projectValue && projectValue > 0) {
      const projectValueColIndex = headers.indexOf(C.project_value);

      if (projectValueColIndex !== -1) {
        sheet.getRange(row, projectValueColIndex + 1).setValue(projectValue);
        updatedFields.push('Valeur');
      } else {
        Logger.log('Column not found: ' + C.project_value);
      }
    }

    Logger.log('Project details updated for row ' + row + ': ' + updatedFields.join(', '));

    return {
      success: true,
      message: 'Détails du projet enregistrés (' + updatedFields.join(', ') + ')',
      startDate: startDate,
      endDate: endDate,
      projectValue: projectValue
    };

  } catch (error) {
    Logger.log('Error updating project details: ' + error.message);
    return {
      success: false,
      message: 'Erreur: ' + error.message
    };
  }
}

/**
 * Updates all project information including work type
 * Used by the project editor form in clients page
 *
 * @param {number} row - Row number in the sheet
 * @param {Object} projectData - Project data object
 * @param {string} projectData.startDate - Project start date (YYYY-MM-DD)
 * @param {string} projectData.endDate - Project end date (YYYY-MM-DD)
 * @param {number} projectData.value - Project value
 * @param {string} projectData.workType - Type of work (determines VAT rate)
 * @returns {Object} Result with success status
 */
function updateProjectInfo(row, projectData) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      throw new Error('Feuille CRM introuvable');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;
    const updatedFields = [];

    // Update start date
    if (projectData.startDate) {
      const colIndex = headers.indexOf(C.project_start_date);
      if (colIndex !== -1) {
        sheet.getRange(row, colIndex + 1).setValue(new Date(projectData.startDate));
        updatedFields.push('Date de début');
      }
    }

    // Update end date
    if (projectData.endDate) {
      const colIndex = headers.indexOf(C.project_end_date);
      if (colIndex !== -1) {
        sheet.getRange(row, colIndex + 1).setValue(new Date(projectData.endDate));
        updatedFields.push('Date de fin');
      }
    }

    // Update project value
    if (projectData.value) {
      const colIndex = headers.indexOf(C.project_value);
      if (colIndex !== -1) {
        sheet.getRange(row, colIndex + 1).setValue(parseFloat(projectData.value));
        updatedFields.push('Valeur');
      }
    }

    // Update work type
    if (projectData.workType) {
      const colIndex = headers.indexOf(C.work_type);
      if (colIndex !== -1) {
        sheet.getRange(row, colIndex + 1).setValue(projectData.workType);
        updatedFields.push('Type de travaux');
      }
    }

    Logger.log('Project info updated for row ' + row + ': ' + updatedFields.join(', '));

    return {
      success: true,
      message: 'Projet mis à jour (' + updatedFields.join(', ') + ')'
    };

  } catch (error) {
    Logger.log('Error updating project info: ' + error.message);
    return {
      success: false,
      message: 'Erreur: ' + error.message
    };
  }
}

/**
 * Retrieves the quote value for a client (used to pre-fill project value)
 *
 * @param {number} row - Row number in the sheet
 * @returns {number} Quote total value including VAT
 */
function getQuoteValue(row) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);

    const quoteDataJson = client[CONFIG.column_mappings.quote_data_json];
    return parseQuoteValueOptimized(quoteDataJson);

  } catch (e) {
    Logger.log('Error getting quote value: ' + e.message);
    return 0;
  }
}

/**
 * Saves internal notes for a client
 *
 * @param {number} row - Row number in the sheet
 * @param {string} notes - Notes text to save (max 1000 characters)
 * @returns {Object} Result object with success flag and message
 */
function saveClientNotes(row, notes) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      throw new Error('Feuille CRM introuvable');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;

    const notesColIndex = headers.indexOf(C.internal_notes);

    if (notesColIndex === -1) {
      throw new Error('Colonne "Notes Internes" introuvable');
    }

    if (notes && notes.length > 1000) {
      throw new Error('Les notes ne peuvent pas dépasser 1000 caractères');
    }

    sheet.getRange(row, notesColIndex + 1).setValue(notes);

    Logger.log('Notes saved successfully for row ' + row);

    return {
      success: true,
      message: 'Notes enregistrées'
    };

  } catch (error) {
    Logger.log('Error saving notes: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

// =============================================================================
// CLIENT DETAILS ENHANCEMENTS
// =============================================================================

/**
 * Helper: Parse French date format (dd/MM/yyyy) to Date object
 * @param {string} dateStr - Date string in dd/MM/yyyy format
 * @returns {Date} Date object or epoch if invalid
 */
function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('/');
  if (parts.length !== 3) return new Date(0);
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

/**
 * Helper: Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Helper: Get icon for a given status
 * @param {string} status - Status value from CONFIG.statuses
 * @returns {string} Emoji icon for the status
 */
function getStatusIcon(status) {
  const icons = {
    'Nouveau': '🆕',
    'Devis envoyé': '📨',
    'Projet gagné': '🎉',
    'Terminé': '✅',
    'Annulé': '❌'
  };
  return icons[status] || '📋';
}

/**
 * Helper: Extract Google Drive file ID from URL
 * @param {string} url - Google Drive file URL
 * @returns {string} File ID or empty string if not found
 */
function getDocIdFromUrl(url) {
  if (!url) return '';

  try {
    const patterns = [
      /\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /\/file\/d\/([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return '';
  } catch (e) {
    Logger.log('Error extracting file ID from URL: ' + e.message);
    return '';
  }
}

/**
 * Updates a single contact field for a client
 * Used for inline editing in Info tab
 *
 * @param {number} row - Row number in the sheet
 * @param {string} field - Field name (email, phone, address, postal_code, city)
 * @param {string} value - New value for the field
 * @returns {Object} Result object with success flag and message
 */
function updateClientContact(row, field, value) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      throw new Error('Feuille CRM introuvable');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;

    const fieldMap = {
      'email': C.client_email,
      'phone': C.phone,
      'address': C.address,
      'postal_code': C.postal_code,
      'city': C.city
    };

    const columnName = fieldMap[field];
    if (!columnName) {
      throw new Error('Champ non valide: ' + field);
    }

    const colIndex = headers.indexOf(columnName);
    if (colIndex === -1) {
      throw new Error('Colonne introuvable: ' + columnName);
    }

    if (field === 'email' && value && !isValidEmail(value)) {
      throw new Error('Format email invalide');
    }

    if (value && value.length > 200) {
      throw new Error('La valeur ne peut pas dépasser 200 caractères');
    }

    sheet.getRange(row, colIndex + 1).setValue(value);

    Logger.log('Contact field updated for row ' + row + ': ' + field + ' = ' + value);

    return {
      success: true,
      message: 'Contact mis à jour',
      field: field,
      value: value
    };

  } catch (error) {
    Logger.log('Error updating contact: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Retrieves activity history for a client
 * Reconstructs timeline from existing data (backward compatible)
 *
 * @param {number} row - Row number in the sheet
 * @returns {Array<Object>} Array of history events
 */
function getClientHistory(row) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);

    const C = CONFIG.column_mappings;
    const events = [];

    if (client[C.timestamp]) {
      const ts = new Date(client[C.timestamp]);
      events.push({
        date: formatDate(ts),
        sortTime: ts.getTime(),
        type: 'creation',
        icon: '📝',
        title: 'Client créé',
        description: 'Formulaire de contact soumis'
      });
    }

    if (client[C.quote_date]) {
      const qd = new Date(client[C.quote_date]);
      events.push({
        date: formatDate(qd),
        sortTime: qd.getTime(),
        type: 'quote',
        icon: '📄',
        title: 'Devis ' + (client[C.quote_number] || ''),
        description: 'Devis généré et enregistré'
      });
    }

    // Read status history from JSON column
    const statusHistoryJson = client[C.status_history_json];
    if (statusHistoryJson) {
      try {
        const statusHistory = JSON.parse(statusHistoryJson);
        statusHistory.forEach(entry => {
          const entryDate = new Date(entry.date);
          events.push({
            date: formatDate(entryDate),
            sortTime: entryDate.getTime(),
            type: 'status',
            icon: getStatusIcon(entry.status),
            title: entry.status,
            description: 'Changement de statut'
          });
        });
      } catch (e) {
        Logger.log('Error parsing status history: ' + e.message);
      }
    }

    if (client[C.invoice_date]) {
      const id = new Date(client[C.invoice_date]);
      events.push({
        date: formatDate(id),
        sortTime: id.getTime(),
        type: 'invoice',
        icon: '🧾',
        title: 'Facture ' + (client[C.invoice_number] || ''),
        description: 'Facture générée'
      });
    }

    const invoiceStatus = client[C.invoice_status];
    if (invoiceStatus === CONFIG.invoice_statuses.PAID && client[C.invoice_date]) {
      const pd = new Date(client[C.invoice_date]);
      events.push({
        date: formatDate(pd),
        sortTime: pd.getTime() + 1, // Slightly after invoice creation
        type: 'payment',
        icon: '💰',
        title: 'Facture payée',
        description: 'Paiement reçu et confirmé'
      });
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.sortTime - a.sortTime);

    return events;

  } catch (error) {
    Logger.log('Error in getClientHistory: ' + error.message);
    return [];
  }
}

/**
 * Generates thumbnail URL for a Google Drive PDF
 * Uses Drive API thumbnailLink property
 *
 * @param {string} fileId - Drive file ID
 * @returns {string} Thumbnail URL or empty string if unavailable
 */
function getDocumentThumbnail(fileId) {
  try {
    if (!fileId) return '';

    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w300-h400';

  } catch (error) {
    Logger.log('Error generating thumbnail for ' + fileId + ': ' + error.message);
    return '';
  }
}

/**
 * Enhanced getClientDetails with document thumbnails
 * Adds thumbnail URLs to quote and invoice links
 *
 * @param {number} row - Row number in the sheet
 * @returns {Object} Enhanced client details with thumbnails
 */
function getClientDetailsWithThumbnails(row) {
  const client = getClientDetails(row);

  if (client.quoteUrl) {
    try {
      const quoteId = getDocIdFromUrl(client.quoteUrl);
      client.quoteThumbnail = getDocumentThumbnail(quoteId);
    } catch (e) {
      Logger.log('Error getting quote thumbnail: ' + e.message);
      client.quoteThumbnail = '';
    }
  }

  if (client.invoiceUrl) {
    try {
      const invoiceId = getDocIdFromUrl(client.invoiceUrl);
      client.invoiceThumbnail = getDocumentThumbnail(invoiceId);
    } catch (e) {
      Logger.log('Error getting invoice thumbnail: ' + e.message);
      client.invoiceThumbnail = '';
    }
  }

  return client;
}

// =============================================================================
// CALENDAR & PROJECT PLANNING
// =============================================================================

/**
 * Retrieves calendar data for 3-month project planning view
 * Returns projects with dates and unplanned projects
 *
 * @returns {CalendarData} Calendar data with projects and timeline
 * @see types.js for CalendarData type definition
 */
function getCalendarData() {
  const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  const C = CONFIG.column_mappings;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfThirdMonth = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  const weeks = [];
  const unplannedProjects = [];

  data.forEach((row, index) => {
    const rowData = createObjectFromRow(row, headers);
    const status = rowData[C.status];

    if (status === CONFIG.statuses.WON || status === CONFIG.statuses.COMPLETED) {
      const startDate = rowData[C.project_start_date];
      const endDate = rowData[C.project_end_date];
      const clientName = rowData[C.client_name];
      const workType = rowData[C.work_type] || 'Travaux';
      const rowNumber = index + 2;

      let projectStatus = 'planned';
      if (status === CONFIG.statuses.COMPLETED) {
        projectStatus = 'completed';
      } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (start <= today) {
          projectStatus = 'in-progress';
        }
      }

      if (!startDate || !endDate) {
        unplannedProjects.push({
          clientName: clientName,
          workType: workType,
          status: status,
          row: rowNumber
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (start > endOfThirdMonth || end < startOfCurrentMonth) {
        return;
      }

      const startStr = Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      const endStr = Utilities.formatDate(end, Session.getScriptTimeZone(), 'dd/MM/yyyy');

      const durationMs = end - start;
      const durationDays = Math.ceil(durationMs / (24 * 60 * 60 * 1000)) + 1;

      if (weeks.length === 0) {
        weeks.push({
          label: 'Projets planifiés',
          startDate: Utilities.formatDate(startOfCurrentMonth, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          endDate: Utilities.formatDate(endOfThirdMonth, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          projects: []
        });
      }

      weeks[0].projects.push({
        clientName: clientName,
        workType: workType,
        startDate: startStr,
        endDate: endStr,
        duration: durationDays + ' jour' + (durationDays > 1 ? 's' : ''),
        status: projectStatus,
        row: rowNumber
      });
    }
  });

  return {
    weeks: weeks,
    unplanned: unplannedProjects,
    today: Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
}

// =============================================================================
// ACTION TRIGGERS
// =============================================================================

/**
 * Activates a specific row and triggers quote generation
 *
 * @param {number} row - Row number in the sheet
 */
function generateQuoteForRow(row) {
  const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);

  sheet.getRange(row, 1).activate();
  generateQuote();
}

/**
 * Activates a specific row and triggers invoice generation
 *
 * @param {number} row - Row number in the sheet
 */
function generateInvoiceForRow(row) {
  const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);

  sheet.getRange(row, 1).activate();
  openInvoiceEditor();
}

// =============================================================================
// EMAIL DRAFT GENERATION
// =============================================================================

/**
 * Generates a Gmail draft email for a quote
 * Attaches quote PDF and uses template from CONFIG or custom templates
 *
 * @param {number} row - Row number in the sheet
 * @returns {Object} Result object with success flag, message, and draft ID
 */
function generateQuoteEmailDraft(row) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);
    const C = CONFIG.column_mappings;

    if (!client[C.client_email]) {
      throw new Error('Adresse email du client introuvable');
    }

    if (!client[C.quote_link]) {
      throw new Error('Lien vers le devis manquant. Veuillez d\'abord générer le devis.');
    }

    const docId = getDocIdFromUrl(client[C.quote_link]);
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    pdfBlob.setName('Devis ' + client[C.quote_number] + ' - ' + client[C.client_name] + '.pdf');

    const quoteData = client[C.quote_data_json] ? JSON.parse(client[C.quote_data_json]) : {};
    const totalAmount = calculateQuoteTotalFromData(quoteData);

    const templateData = {
      '{{CLIENT_NAME}}': client[C.client_name] || '',
      '{{QUOTE_NUMBER}}': client[C.quote_number] || '',
      '{{WORK_TYPE}}': client[C.work_type] || '',
      '{{TOTAL_AMOUNT}}': formatCurrency(totalAmount),
      '{{DURATION}}': client[C.estimated_duration] || 'À définir',
      '{{VALIDITY_DATE}}': formatValidityDate(client[C.quote_date]),
      '{{QUOTE_DATE}}': formatDate(client[C.quote_date]),
      '{{SENDER_NAME}}': CONFIG.email_settings.sender_name
    };

    const templates = getEmailTemplates();
    const template = templates.quote;
    const subject = replaceTemplatePlaceholders(template.subject, templateData);
    const body = replaceTemplatePlaceholders(template.body, templateData);

    const draft = GmailApp.createDraft(
      client[C.client_email],
      subject,
      body,
      {
        attachments: [pdfBlob],
        htmlBody: body.replace(/\n/g, '<br>')
      }
    );

    Logger.log('Email draft created for ' + client[C.client_name]);

    return {
      success: true,
      message: 'Brouillon créé avec succès pour ' + client[C.client_name],
      draftId: draft.getId()
    };

  } catch (error) {
    Logger.log('Error creating email draft: ' + error.message);
    return {
      success: false,
      message: 'Erreur: ' + error.message
    };
  }
}

/**
 * Generates a Gmail draft for a follow-up/reminder email
 * Used when quote needs follow-up after being sent
 *
 * @param {number} row - Row number in the sheet
 * @returns {Object} Result object with success flag, message, and draft ID
 */
function generateFollowUpEmailDraft(row) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);
    const C = CONFIG.column_mappings;

    if (!client[C.client_email]) {
      throw new Error('Adresse email du client introuvable');
    }

    if (!client[C.quote_number]) {
      throw new Error('Aucun devis trouvé pour ce client');
    }

    const quoteDate = new Date(client[C.quote_date]);
    const daysSince = Math.floor((new Date() - quoteDate) / (1000 * 60 * 60 * 24));

    const quoteData = client[C.quote_data_json] ? JSON.parse(client[C.quote_data_json]) : {};
    const totalAmount = calculateQuoteTotalFromData(quoteData);

    const templateData = {
      '{{CLIENT_NAME}}': client[C.client_name] || '',
      '{{QUOTE_NUMBER}}': client[C.quote_number] || '',
      '{{WORK_TYPE}}': client[C.work_type] || '',
      '{{TOTAL_AMOUNT}}': formatCurrency(totalAmount),
      '{{DURATION}}': client[C.estimated_duration] || 'À définir',
      '{{VALIDITY_DATE}}': formatValidityDate(client[C.quote_date]),
      '{{QUOTE_DATE}}': formatDate(client[C.quote_date]),
      '{{DAYS_SINCE}}': daysSince.toString(),
      '{{SENDER_NAME}}': CONFIG.email_settings.sender_name
    };

    const templates = getEmailTemplates();
    const template = templates.followup;
    const subject = replaceTemplatePlaceholders(template.subject, templateData);
    const body = replaceTemplatePlaceholders(template.body, templateData);

    const draft = GmailApp.createDraft(
      client[C.client_email],
      subject,
      body,
      {
        htmlBody: body.replace(/\n/g, '<br>')
      }
    );

    return {
      success: true,
      message: 'Brouillon de relance créé pour ' + client[C.client_name],
      draftId: draft.getId()
    };

  } catch (error) {
    Logger.log('Error creating follow-up draft: ' + error.message);
    return {
      success: false,
      message: 'Erreur: ' + error.message
    };
  }
}

/**
 * Generates a Gmail draft for a testimonial request email
 * Used after project completion to request client feedback
 *
 * @param {number} row - Row number in the sheet
 * @returns {Object} Result object with success flag, message, and draft ID
 */
function generateTestimonialEmailDraft(row) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);
    const C = CONFIG.column_mappings;

    if (!client[C.client_email]) {
      throw new Error('Adresse email du client introuvable');
    }

    const templateData = {
      '{{CLIENT_NAME}}': client[C.client_name] || '',
      '{{WORK_TYPE}}': client[C.work_type] || 'vos travaux',
      '{{SENDER_NAME}}': CONFIG.email_settings.sender_name
    };

    const templates = getEmailTemplates();
    const template = templates.testimonial;
    const subject = replaceTemplatePlaceholders(template.subject, templateData);
    const body = replaceTemplatePlaceholders(template.body, templateData);

    const draft = GmailApp.createDraft(
      client[C.client_email],
      subject,
      body,
      {
        htmlBody: body.replace(/\n/g, '<br>')
      }
    );

    return {
      success: true,
      message: 'Brouillon de demande de témoignage créé pour ' + client[C.client_name],
      draftId: draft.getId()
    };

  } catch (error) {
    Logger.log('Error creating testimonial draft: ' + error.message);
    return {
      success: false,
      message: 'Erreur: ' + error.message
    };
  }
}

// =============================================================================
// EMAIL TEMPLATE UTILITIES
// =============================================================================

/**
 * Replaces placeholders in email templates with actual values
 * Uses global regex replacement for all occurrences
 *
 * @param {string} template - Template string with {{PLACEHOLDER}} markers
 * @param {Object} data - Key-value pairs for replacement
 * @returns {string} Template with all placeholders replaced
 */
function replaceTemplatePlaceholders(template, data) {
  let result = template;
  for (const [placeholder, value] of Object.entries(data)) {
    result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }
  return result;
}

/**
 * Calculates total quote value from quote data structure
 * Used for email template placeholders
 *
 * @param {Object} quoteData - Quote data object with quoteStructure and businessData
 * @returns {number} Total amount including discount and VAT
 */
function calculateQuoteTotalFromData(quoteData) {
  if (!quoteData.quoteStructure) return 0;

  let subtotal = 0;
  quoteData.quoteStructure.forEach(section => {
    if (section.services) {
      section.services.forEach(service => {
        subtotal += (service.price * service.quantity);
      });
    }
  });

  const discount = quoteData.businessData?.discountPercentage || 0;
  const afterDiscount = subtotal * (1 - discount / 100);
  const vatRate = 1.10;

  return afterDiscount * vatRate;
}

/**
 * Formats quote validity date (adds validity days from CONFIG to quote date)
 *
 * @param {Date|string} quoteDate - Quote creation date
 * @returns {string} Formatted validity date (dd/MM/yyyy)
 */
function formatValidityDate(quoteDate) {
  if (!quoteDate) return 'À définir';
  const date = new Date(quoteDate);
  date.setDate(date.getDate() + CONFIG.quote_settings.validity_days);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/**
 * Formats a date in French format (dd/MM/yyyy)
 *
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

// =============================================================================
// EMAIL TEMPLATE MANAGEMENT
// =============================================================================

/**
 * Retrieves email templates (custom from UserProperties or defaults from CONFIG)
 *
 * @returns {Object} Email templates object with quote, followup, and testimonial templates
 */
function getEmailTemplates() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const customTemplates = userProperties.getProperty('EMAIL_TEMPLATES');

    if (customTemplates) {
      return JSON.parse(customTemplates);
    }

    return CONFIG.email_templates;

  } catch (error) {
    Logger.log('Error getting email templates: ' + error.message);
    return CONFIG.email_templates;
  }
}

/**
 * Saves custom email templates to UserProperties
 *
 * @param {Object} templates - Email templates object to save
 * @returns {Object} Result object with success flag and message
 */
function saveEmailTemplates(templates) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('EMAIL_TEMPLATES', JSON.stringify(templates));

    return {
      success: true,
      message: 'Templates enregistrés avec succès'
    };

  } catch (error) {
    Logger.log('Error saving email templates: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Resets email templates to default values from CONFIG
 *
 * @returns {Object} Result object with success flag and message
 */
function resetEmailTemplates() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.deleteProperty('EMAIL_TEMPLATES');

    return {
      success: true,
      message: 'Templates restaurés'
    };

  } catch (error) {
    Logger.log('Error resetting email templates: ' + error.message);
    return {
      success: false,
      message: error.message
    };
  }
}

// =============================================================================
// PUBLIC CONTACT FORM
// =============================================================================

/**
 * Submits a contact/quote request form to the CRM sheet
 * This function is called from the public contact form (no authentication required)
 * Includes recurring customer detection unless forceNew option is set
 *
 * @param {Object} formData - Form data object
 * @param {string} formData.requestType - Type de demande
 * @param {string} formData.clientType - Type de client
 * @param {string} formData.clientName - Nom du Client / Raison Sociale
 * @param {string} formData.contactName - Nom du Contact Principal (optional)
 * @param {string} formData.address - Adresse (optional)
 * @param {string} formData.postalCode - Code Postal (optional)
 * @param {string} formData.city - Ville (optional)
 * @param {string} formData.email - Adresse Email
 * @param {string} formData.phone - Numéro de Téléphone
 * @param {string} formData.projectDetails - Détail du Projet (optional)
 * @param {string} formData.workType - Type de travaux (optional)
 * @param {Object} options - Optional settings
 * @param {boolean} options.forceNew - Skip recurring customer check if true
 * @returns {Object} Result object with success flag and message, or recurring customer info
 */
function submitContactForm(formData, options) {
  try {
    options = options || {};

    // Validate required fields
    if (!formData.clientName || !formData.clientName.trim()) {
      return {
        success: false,
        error: 'Le nom du client est requis'
      };
    }

    if (!formData.email || !formData.email.trim()) {
      return {
        success: false,
        error: 'L\'adresse email est requise'
      };
    }

    // Validate email format
    if (!isValidEmail(formData.email.trim())) {
      return {
        success: false,
        error: 'Format d\'email invalide'
      };
    }

    // Address, postal code, and city are required
    if (!formData.address || !formData.address.trim()) {
      return {
        success: false,
        error: 'L\'adresse est requise'
      };
    }

    if (!formData.postalCode || !formData.postalCode.trim()) {
      return {
        success: false,
        error: 'Le code postal est requis'
      };
    }

    if (!formData.city || !formData.city.trim()) {
      return {
        success: false,
        error: 'La ville est requise'
      };
    }

    // Check for recurring customer unless forceNew is set
    if (!options.forceNew) {
      const existingCustomer = checkExistingCustomer(formData.email.trim());
      if (existingCustomer.isRecurring) {
        Logger.log('Recurring customer detected: ' + existingCustomer.customerName);
        return {
          success: false,
          isRecurringCustomer: true,
          existingCustomer: existingCustomer,
          formData: formData // Return form data for use in createProjectForExistingCustomer
        };
      }
    }

    // Get the CRM sheet
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      throw new Error('Feuille CRM introuvable');
    }

    // Get headers to find column indices
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;

    // Find the actual last row with data (to avoid issues with formatted empty rows)
    const timestampColIdx = headers.indexOf(C.timestamp);
    const lastRow = findLastRowWithData(sheet, timestampColIdx + 1);
    const insertRow = lastRow + 1;

    // Build row data array matching column order
    const newRow = new Array(headers.length).fill('');

    // Helper function to set value by column name
    const setColumnValue = (columnName, value) => {
      const idx = headers.indexOf(columnName);
      if (idx !== -1) {
        newRow[idx] = value || '';
      }
    };

    // Set values for form fields
    setColumnValue(C.timestamp, new Date());                              // Timestamp
    setColumnValue(C.request_type, formData.requestType || '');           // Type de demande
    setColumnValue(C.client_type, formData.clientType || '');             // Type de client
    setColumnValue(C.client_name, formData.clientName.trim());            // Nom du Client
    setColumnValue(C.contact_principal, formData.contactName || '');      // Nom du Contact Principal
    setColumnValue(C.address, formData.address.trim());                   // Adresse
    setColumnValue(C.postal_code, formData.postalCode.trim());            // Code Postal
    setColumnValue(C.city, formData.city.trim());                         // Ville
    setColumnValue(C.client_email, formData.email.trim());                // Adresse Email
    setColumnValue(C.phone, formData.phone || '');                        // Numéro de Téléphone (optional)
    setColumnValue(C.project_details, formData.projectDetails || '');     // Détail du Projet
    setColumnValue(C.work_type, formData.workType || '');                 // Type de travaux
    setColumnValue(C.referral_source, formData.referralSource || '');     // Comment avez-vous entendu parler de nous

    // Set default status for new entries
    setColumnValue(C.status, CONFIG.statuses.NEW);

    // Insert at the correct row (after actual data, not at sheet end)
    sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);

    Logger.log('Contact form submitted successfully at row ' + insertRow + ': ' + formData.clientName);

    return {
      success: true,
      message: 'Votre demande a été envoyée avec succès. Nous vous contacterons rapidement.'
    };

  } catch (error) {
    Logger.log('Error submitting contact form: ' + error.message);
    return {
      success: false,
      error: 'Une erreur est survenue lors de l\'envoi. Veuillez réessayer.'
    };
  }
}

/**
 * Finds the last row with actual data in a specific column
 * This avoids issues with formatted empty rows that extend beyond data
 *
 * @param {Sheet} sheet - The sheet to search
 * @param {number} column - The column number (1-indexed) to check for data
 * @returns {number} The last row number with data
 */
function findLastRowWithData(sheet, column) {
  const data = sheet.getRange(1, column, sheet.getLastRow(), 1).getValues();

  // Find last non-empty row
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0] !== '' && data[i][0] !== null) {
      return i + 1; // Convert to 1-indexed
    }
  }

  return 1; // Return 1 if only header exists
}

// =============================================================================
// AUTHORIZATION MANAGEMENT
// =============================================================================

/**
 * Triggers all OAuth scopes required by the application
 * Call this function to force re-authorization when permissions change
 *
 * @returns {Object} Result with success status and triggered services
 */
function triggerReauthorization() {
  try {
    const triggeredServices = [];

    // Trigger Spreadsheet access
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id);
    triggeredServices.push('Spreadsheets');

    // Trigger Drive access
    const folder = DriveApp.getFolderById(CONFIG.google_api.quote_destination_folder_id);
    triggeredServices.push('Drive');

    // Trigger Document access
    const doc = DriveApp.getFileById(CONFIG.google_api.quote_template_id);
    triggeredServices.push('Documents');

    // Trigger Gmail access (compose scope)
    const tempDraft = GmailApp.createDraft('', '', '');
    tempDraft.deleteDraft();
    triggeredServices.push('Gmail');

    // Trigger external URL fetch (for QR codes)
    UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
    triggeredServices.push('URL Fetch');

    Logger.log('Reauthorization triggered for: ' + triggeredServices.join(', '));

    return {
      success: true,
      message: 'Autorisations vérifiées avec succès',
      services: triggeredServices
    };
  } catch (error) {
    Logger.log('Reauthorization error: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// =============================================================================
// RECURRING CUSTOMER DETECTION
// =============================================================================

/**
 * Checks if a customer with the given email already exists in the CRM
 * Used for recurring customer detection on contact form submission
 *
 * @param {string} email - Email address to search for (case-insensitive)
 * @returns {Object} Result object with customer information
 * @returns {boolean} result.isRecurring - True if customer exists
 * @returns {string} result.customerName - Name of the existing customer
 * @returns {number} result.projectCount - Number of existing projects
 * @returns {Object} result.lastProject - Details of most recent project
 * @returns {Array<number>} result.rows - Array of row numbers for this customer
 * @returns {number} result.mostRecentRow - Row number of most recent project
 */
function checkExistingCustomer(email) {
  try {
    if (!email || !email.trim()) {
      return { isRecurring: false };
    }

    const normalizedEmail = email.trim().toLowerCase();

    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      Logger.log('Sheet not found in checkExistingCustomer');
      return { isRecurring: false };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { isRecurring: false };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    const C = CONFIG.column_mappings;
    const emailIdx = headers.indexOf(C.client_email);
    const nameIdx = headers.indexOf(C.client_name);
    const statusIdx = headers.indexOf(C.status);
    const quoteNumberIdx = headers.indexOf(C.quote_number);
    const quoteDateIdx = headers.indexOf(C.quote_date);
    const quoteJsonIdx = headers.indexOf(C.quote_data_json);

    if (emailIdx === -1) {
      Logger.log('Email column not found');
      return { isRecurring: false };
    }

    const matchingRows = [];
    let mostRecentRow = null;
    let mostRecentDate = null;
    let customerName = '';

    data.forEach((row, index) => {
      const rowEmail = row[emailIdx];
      if (rowEmail && rowEmail.toString().trim().toLowerCase() === normalizedEmail) {
        const rowNumber = index + 2; // Convert to 1-indexed sheet row
        matchingRows.push(rowNumber);

        // Track customer name from first match
        if (!customerName && row[nameIdx]) {
          customerName = row[nameIdx];
        }

        // Track most recent project by quote date or row number
        const quoteDate = row[quoteDateIdx] ? new Date(row[quoteDateIdx]) : null;
        if (!mostRecentRow || (quoteDate && (!mostRecentDate || quoteDate > mostRecentDate))) {
          mostRecentRow = rowNumber;
          mostRecentDate = quoteDate;
        } else if (!quoteDate && !mostRecentDate && rowNumber > mostRecentRow) {
          mostRecentRow = rowNumber;
        }
      }
    });

    if (matchingRows.length === 0) {
      return { isRecurring: false };
    }

    // Get details of the most recent project
    const recentRowData = data[mostRecentRow - 2]; // Convert back to 0-indexed
    const lastProject = {
      quoteNumber: recentRowData[quoteNumberIdx] || null,
      status: recentRowData[statusIdx] || CONFIG.statuses.NEW,
      quoteDate: recentRowData[quoteDateIdx] ? formatDate(new Date(recentRowData[quoteDateIdx])) : null,
      value: parseQuoteValueOptimized(recentRowData[quoteJsonIdx])
    };

    Logger.log('Found recurring customer: ' + customerName + ' with ' + matchingRows.length + ' project(s)');

    return {
      isRecurring: true,
      customerName: customerName,
      projectCount: matchingRows.length,
      lastProject: lastProject,
      rows: matchingRows,
      mostRecentRow: mostRecentRow
    };

  } catch (error) {
    Logger.log('Error in checkExistingCustomer: ' + error.message);
    return { isRecurring: false };
  }
}

/**
 * Retrieves all projects for a customer identified by email
 * Used by the dashboard "Autres projets" tab
 *
 * @param {string} email - Email address to search for (case-insensitive)
 * @returns {Array<Object>} Array of project objects
 */
function getRelatedProjects(email) {
  try {
    if (!email || !email.trim()) {
      return [];
    }

    const normalizedEmail = email.trim().toLowerCase();

    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    const C = CONFIG.column_mappings;
    const emailIdx = headers.indexOf(C.client_email);
    const nameIdx = headers.indexOf(C.client_name);
    const statusIdx = headers.indexOf(C.status);
    const quoteNumberIdx = headers.indexOf(C.quote_number);
    const quoteDateIdx = headers.indexOf(C.quote_date);
    const quoteJsonIdx = headers.indexOf(C.quote_data_json);
    const workTypeIdx = headers.indexOf(C.work_type);
    const timestampIdx = headers.indexOf(C.timestamp);

    if (emailIdx === -1) {
      return [];
    }

    const projects = [];

    data.forEach((row, index) => {
      const rowEmail = row[emailIdx];
      if (rowEmail && rowEmail.toString().trim().toLowerCase() === normalizedEmail) {
        const rowNumber = index + 2;
        const quoteDate = row[quoteDateIdx] ? new Date(row[quoteDateIdx]) : null;
        const timestamp = row[timestampIdx] ? new Date(row[timestampIdx]) : null;
        const displayDate = quoteDate || timestamp;

        projects.push({
          row: rowNumber,
          clientName: row[nameIdx] || '',
          quoteNumber: row[quoteNumberIdx] || null,
          status: row[statusIdx] || CONFIG.statuses.NEW,
          quoteDate: displayDate ? formatDate(displayDate) : null,
          sortDate: displayDate ? displayDate.getTime() : 0,
          projectValue: parseQuoteValueOptimized(row[quoteJsonIdx]),
          workType: row[workTypeIdx] || ''
        });
      }
    });

    // Sort by date (newest first)
    projects.sort((a, b) => b.sortDate - a.sortDate);

    return projects;

  } catch (error) {
    Logger.log('Error in getRelatedProjects: ' + error.message);
    return [];
  }
}

/**
 * Creates a new project row for an existing customer
 * Auto-fills contact information from the source row
 *
 * @param {Object} formData - New project form data
 * @param {number} sourceRow - Row number to copy customer info from
 * @returns {Object} Result object with success flag and new row number
 */
function createProjectForExistingCustomer(formData, sourceRow) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.file_paths.crm_sheet_id)
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!sheet) {
      throw new Error('Feuille CRM introuvable');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;

    // Get existing customer data from source row
    const sourceData = sheet.getRange(sourceRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const sourceClient = createObjectFromRow(sourceData, headers);

    // Find the last row with data
    const timestampColIdx = headers.indexOf(C.timestamp);
    const lastRow = findLastRowWithData(sheet, timestampColIdx + 1);
    const insertRow = lastRow + 1;

    // Build new row with auto-filled contact info
    const newRow = new Array(headers.length).fill('');

    const setColumnValue = (columnName, value) => {
      const idx = headers.indexOf(columnName);
      if (idx !== -1) {
        newRow[idx] = value || '';
      }
    };

    // Copy contact information from source row
    setColumnValue(C.client_name, sourceClient[C.client_name]);
    setColumnValue(C.contact_principal, sourceClient[C.contact_principal]);
    setColumnValue(C.address, sourceClient[C.address]);
    setColumnValue(C.postal_code, sourceClient[C.postal_code]);
    setColumnValue(C.city, sourceClient[C.city]);
    setColumnValue(C.client_email, sourceClient[C.client_email]);
    setColumnValue(C.phone, sourceClient[C.phone]);
    setColumnValue(C.client_type, sourceClient[C.client_type]);

    // Set new project data from form
    setColumnValue(C.timestamp, new Date());
    setColumnValue(C.request_type, formData.requestType || '');
    setColumnValue(C.project_details, formData.projectDetails || '');
    setColumnValue(C.work_type, formData.workType || '');
    setColumnValue(C.referral_source, formData.referralSource || 'Client existant');
    setColumnValue(C.status, CONFIG.statuses.NEW);

    // Insert the new row
    sheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);

    Logger.log('Created new project for existing customer at row ' + insertRow + ': ' + sourceClient[C.client_name]);

    return {
      success: true,
      message: 'Nouveau projet créé pour ' + sourceClient[C.client_name],
      newRow: insertRow,
      customerName: sourceClient[C.client_name]
    };

  } catch (error) {
    Logger.log('Error in createProjectForExistingCustomer: ' + error.message);
    return {
      success: false,
      error: 'Erreur lors de la création du projet: ' + error.message
    };
  }
}
