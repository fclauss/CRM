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

    // Process won/completed quotes for revenue
    if (status === CONFIG.statuses.WON || status === CONFIG.statuses.COMPLETED) {
      const quoteDate = new Date(row[quoteDateIdx]);
      const amount = parseQuoteValueOptimized(row[quoteJsonIdx]);

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

  return {
    // Main metrics (matching dashboard field names)
    activeQuotes: pendingQuotes,
    activeQuotesChange: 0, // Change indicators not implemented - shows 0
    totalValue: pendingValue,
    totalValueChange: 0, // Change indicators not implemented - shows 0
    wonProjects: wonQuotes,
    wonProjectsChange: 0, // Change indicators not implemented - shows 0
    conversionRate: conversionRate,
    conversionRateChange: 0, // Change indicators not implemented - shows 0

    // Additional metrics for compatibility
    monthRevenue: monthRevenue,
    revenueChange: revenueChange,
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

  return {
    name: client[C.client_name],
    email: client[C.client_email],
    phone: client[C.phone],
    address: client[C.address] + ', ' + client[C.postal_code] + ' ' + client[C.city],
    workType: client[C.work_type],
    status: client[C.status] || 'Nouveau',
    quoteNumber: client[C.quote_number],
    quoteUrl: client[C.quote_link],
    invoiceNumber: client[C.invoice_number],
    invoiceUrl: client[C.invoice_link],
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
