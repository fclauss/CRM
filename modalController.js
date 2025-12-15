/**
 * ================================================================
 * MODAL CONTROLLER - Backend Functions
 * ================================================================
 */


/**
 * Opens the CRM Control Center modal
 */
function openCRMModal() {
  const html = HtmlService.createTemplateFromFile('crmModal')
    .evaluate()
    .setWidth(1100)
    .setHeight(650);
  
  // Use empty string for native dialog title since we have styled header in HTML
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/**
 * Get dashboard metrics for the home tab
 */
function getDashboardMetrics() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  
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
  let requiredActions = [];
  let recentActivity = [];
  
  const C = CONFIG.column_mappings;
  
  data.forEach((row, index) => {
    const rowData = createObjectFromRow(row, headers);
    
    // Calculate revenues
    if (rowData[C.status] === CONFIG.statuses.WON || rowData[C.status] === CONFIG.statuses.COMPLETED) {
      const quoteDate = new Date(rowData[C.quote_date]);
      // Parse amount from quote data if available
      const amount = parseQuoteValue(rowData[C.quote_data_json]);
      
      if (quoteDate >= startOfMonth) {
        monthRevenue += amount;
      } else if (quoteDate >= startOfLastMonth && quoteDate < startOfMonth) {
        lastMonthRevenue += amount;
      }
    }
    
    // Count pending quotes
    if (rowData[C.status] === CONFIG.statuses.SENT) {
      pendingQuotes++;
      pendingValue += parseQuoteValue(rowData[C.quote_data_json]);
      
      // Check if needs follow-up (>7 days old)
      const quoteDate = new Date(rowData[C.quote_date]);
      const daysSince = Math.floor((now - quoteDate) / (1000 * 60 * 60 * 24));
      if (daysSince > 7) {
        requiredActions.push({
          text: `Relancer devis ${rowData[C.quote_number]} - ${rowData[C.client_name]} (${daysSince} jours)`,
          onclick: `sendReminderForRow(${index + 2})`,
          buttonText: 'Relancer'
        });
      }
    }
    
    // Count active projects
    if (rowData[C.status] === CONFIG.statuses.WON) {
      activeProjects++;
    }
    
    // Track conversion
    if (rowData[C.quote_number]) {
      totalQuotes++;
      if (rowData[C.status] === CONFIG.statuses.WON || rowData[C.status] === CONFIG.statuses.COMPLETED) {
        wonQuotes++;
      }
    }
    
    // Recent activity (last 5 actions)
    if (rowData[C.quote_date] && recentActivity.length < 5) {
      const date = new Date(rowData[C.quote_date]);
      const timeStr = formatTimeAgo(date);
      recentActivity.push({
        time: timeStr,
        description: `Devis ${rowData[C.quote_number]} créé pour ${rowData[C.client_name]}`
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
    monthRevenue,
    revenueChange,
    pendingQuotes,
    pendingValue,
    activeProjects,
    nextCompletion: activeProjects > 0 ? 'Dans 2 semaines' : 'Aucun',
    conversionRate,
    conversionTrend: 5, // Mock for now
    requiredActions,
    recentActivity
  };
}

/**
 * Get all clients data for the clients tab
 */
/**
 * Get all clients data in REVERSE CHRONOLOGICAL order (newest first)
 * SERIALIZATION-SAFE VERSION - Only returns plain objects/strings/numbers
 */
function getClientsData() {
  try {
    Logger.log("=== getClientsData() START ===");
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    if (!sheet) {
      Logger.log("ERROR: Sheet not found: " + CONFIG.file_paths.crm_sheet_name);
      return []; // Return empty array
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log("No data rows");
      return []; // No clients yet
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    const C = CONFIG.column_mappings;
    const clients = [];
    
    // Process all rows
    data.forEach((row, index) => {
      const rowData = createObjectFromRow(row, headers);
      
      // Only include rows with a client name
      if (rowData[C.client_name]) {
        const amount = parseQuoteValue(rowData[C.quote_data_json]);
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
          // REMOVED: timestamp Date object - not serializable
        });
      }
    });
    
    // Sort by row number DESCENDING (newest first)
    clients.sort((a, b) => b.row - a.row);
    
    Logger.log("✓ Returning " + clients.length + " clients");
    return clients;
    
  } catch (error) {
    Logger.log("❌ ERROR: " + error.toString());
    return []; // Always return array
  }
}


/**
 * Get detailed client information
 */
function getClientDetails(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const client = createObjectFromRow(rowData, headers);
  
  const C = CONFIG.column_mappings;
  
  // Format dates
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
  
  // Get project value
  const projectValue = client[C.project_value] || 0;
  
  return {
    name: client[C.client_name],
    email: client[C.client_email],
    phone: client[C.phone],
    address: `${client[C.address]}, ${client[C.postal_code]} ${client[C.city]}`,
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
 * Update the status of a client
 * @param {number} row - Row number in the sheet
 * @param {string} newStatus - New status value
 * @returns {Object} Success/failure result
 */
function updateClientStatus(row, newStatus) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    if (!sheet) {
      throw new Error("Feuille CRM introuvable");
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;
    
    // Find the status column
    const statusColIndex = headers.indexOf(C.status);
    if (statusColIndex === -1) {
      throw new Error("Colonne 'Statut du Devis' introuvable");
    }
    
    // Update the status
    sheet.getRange(row, statusColIndex + 1).setValue(newStatus);
    
    // If status is "Projet gagné", add project start date if column exists
    if (newStatus === CONFIG.statuses.WON) {
      const projectStartColIndex = headers.indexOf(C.project_start_date);
      if (projectStartColIndex !== -1) {
        // Only set if not already set
        const currentDate = sheet.getRange(row, projectStartColIndex + 1).getValue();
        if (!currentDate) {
          sheet.getRange(row, projectStartColIndex + 1).setValue(new Date());
        }
      }
    }
    
    Logger.log(`Status updated for row ${row}: ${newStatus}`);
    
    return { 
      success: true, 
      message: `Statut mis à jour: ${newStatus}`,
      newStatus: newStatus
    };
    
  } catch (error) {
    Logger.log(`Error updating status: ${error.message}`);
    return { 
      success: false, 
      message: `Erreur: ${error.message}` 
    };
  }
}

/**
 * Update project details when a project is won
 * @param {number} row - Row number in the sheet
 * @param {string} startDate - Project start date (ISO format or empty)
 * @param {string} endDate - Project end date (ISO format or empty)
 * @param {number} projectValue - Project value in euros
 * @returns {Object} Success/failure result with updated values
 */
function updateProjectDetails(row, startDate, endDate, projectValue) {
  try {
    Logger.log(`=== updateProjectDetails called ===`);
    Logger.log(`Row: ${row}`);
    Logger.log(`Start Date: ${startDate}`);
    Logger.log(`End Date: ${endDate}`);
    Logger.log(`Project Value: ${projectValue}`);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    if (!sheet) {
      throw new Error("Feuille CRM introuvable");
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log(`Headers: ${headers}`);
    
    const C = CONFIG.column_mappings;
    
    let updatedFields = [];
    
    // Update project start date if provided
    if (startDate) {
      const projectStartColIndex = headers.indexOf(C.project_start_date);
      Logger.log(`Looking for column: ${C.project_start_date}, found at index: ${projectStartColIndex}`);
      
      if (projectStartColIndex !== -1) {
        sheet.getRange(row, projectStartColIndex + 1).setValue(new Date(startDate));
        updatedFields.push('Date de début');
        Logger.log(`✓ Updated start date at column ${projectStartColIndex + 1}`);
      } else {
        Logger.log(`✗ WARNING: Column "${C.project_start_date}" not found in headers`);
        Logger.log(`Available columns: ${headers.join(', ')}`);
      }
    }
    
    // Update project end date if provided
    if (endDate) {
      const projectEndColIndex = headers.indexOf(C.project_end_date);
      Logger.log(`Looking for column: ${C.project_end_date}, found at index: ${projectEndColIndex}`);
      
      if (projectEndColIndex !== -1) {
        sheet.getRange(row, projectEndColIndex + 1).setValue(new Date(endDate));
        updatedFields.push('Date de fin');
        Logger.log(`✓ Updated end date at column ${projectEndColIndex + 1}`);
      } else {
        Logger.log(`✗ WARNING: Column "${C.project_end_date}" not found in headers`);
      }
    }
    
    // Update project value if provided
    if (projectValue && projectValue > 0) {
      const projectValueColIndex = headers.indexOf(C.project_value);
      Logger.log(`Looking for column: ${C.project_value}, found at index: ${projectValueColIndex}`);
      
      if (projectValueColIndex !== -1) {
        sheet.getRange(row, projectValueColIndex + 1).setValue(projectValue);
        updatedFields.push('Valeur');
        Logger.log(`✓ Updated project value at column ${projectValueColIndex + 1}: ${projectValue}`);
      } else {
        Logger.log(`✗ WARNING: Column "${C.project_value}" not found in headers`);
      }
    }
    
    Logger.log(`Successfully updated fields: ${updatedFields.join(', ')}`);
    
    return { 
      success: true, 
      message: `Détails du projet enregistrés (${updatedFields.join(', ')})`,
      startDate: startDate,
      endDate: endDate,
      projectValue: projectValue
    };
    
  } catch (error) {
    Logger.log(`❌ Error updating project details: ${error.message}`);
    Logger.log(error.stack);
    return { 
      success: false, 
      message: `Erreur: ${error.message}` 
    };
  }
}

/**
 * Get the quote value for a client row (to pre-fill project value)
 * @param {number} row - Row number in the sheet
 * @returns {number} Quote total value
 */
function getQuoteValue(row) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);
    
    const quoteDataJson = client[CONFIG.column_mappings.quote_data_json];
    return parseQuoteValue(quoteDataJson);
    
  } catch (e) {
    Logger.log('Error getting quote value: ' + e.message);
    return 0;
  }
}

/**
 * Get calendar data for projects
 */
/**
 * Get calendar data for 3-month grid view
 * Returns projects mapped to all days across 3 full months
 */
function getCalendarData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 
    sheet.getLastColumn()).getValues();
  
  const C = CONFIG.column_mappings;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate 3 full months instead of 4 weeks
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfThirdMonth = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  
  const weeks = [];
  const unplannedProjects = [];
  
  // Process all clients with won projects
  data.forEach((row, index) => {
    const rowData = createObjectFromRow(row, headers);
    const status = rowData[C.status];
    
    if (status === CONFIG.statuses.WON || status === CONFIG.statuses.COMPLETED) {
      const startDate = rowData[C.project_start_date];
      const endDate = rowData[C.project_end_date];
      const clientName = rowData[C.client_name];
      const workType = rowData[C.work_type] || 'Travaux';
      const rowNumber = index + 2;
      
      // Determine project status
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
      
      // If no dates, add to unplanned
      if (!startDate || !endDate) {
        unplannedProjects.push({
          clientName: clientName,
          workType: workType,
          status: status,
          row: rowNumber
        });
        return;
      }
      
      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      // Only process if project overlaps with our 3-month window
      if (start > endOfThirdMonth || end < startOfCurrentMonth) {
        return; // Skip projects outside our window
      }
      
      // Format dates for display
      const startStr = Utilities.formatDate(start, Session.getScriptTimeZone(), 
        'dd/MM/yyyy');
      const endStr = Utilities.formatDate(end, Session.getScriptTimeZone(), 
        'dd/MM/yyyy');
      
      // Calculate duration in days (inclusive)
      const durationMs = end - start;
      const durationDays = Math.ceil(durationMs / (24 * 60 * 60 * 1000)) + 1;
      
      // Create a single weeks entry with the full project info
      // The frontend will map it to specific dates
      if (weeks.length === 0) {
        weeks.push({
          label: 'Projets planifiés',
          startDate: Utilities.formatDate(startOfCurrentMonth, 
            Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          endDate: Utilities.formatDate(endOfThirdMonth, 
            Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          projects: []
        });
      }
      
      weeks[0].projects.push({
        clientName: clientName,
        workType: workType,
        startDate: startStr,
        endDate: endStr,
        duration: `${durationDays} jour${durationDays > 1 ? 's' : ''}`,
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

/**
 * Helper function to parse quote total from JSON data
 * @param {string} quoteDataJson - JSON string containing quote data
 * @returns {number} Total quote value including VAT
 */
function parseQuoteValue(quoteDataJson) {
  if (!quoteDataJson) return 0;
  
  try {
    const data = JSON.parse(quoteDataJson);
    const services = data.quoteStructure || [];
    let subtotal = 0;
    
    services.forEach(section => {
      if (section.services) {
        section.services.forEach(service => {
          subtotal += (service.price * service.quantity);
        });
      }
    });
    
    // Apply discount if present
    const discount = data.businessData?.discountPercentage || 0;
    const afterDiscount = subtotal * (1 - discount / 100);
    
    // Add VAT (get from work type if available, otherwise assume 10%)
    const vatRate = 1.10; // You can make this dynamic based on work type
    const total = afterDiscount * vatRate;
    
    return Math.round(total * 100) / 100; // Round to 2 decimals
    
  } catch (e) {
    Logger.log('Error parsing quote value: ' + e.message);
    return 0;
  }
}

/**
 * Helper function to format currency in French format
 */
function formatCurrency(amount) {
  if (!amount || isNaN(amount)) amount = 0;
  
  // Use simple formatting instead of toLocaleString for better compatibility
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Helper function to format time ago in French
 */
function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  if (hours < 24) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
  if (days < 30) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  
  const years = Math.floor(days / 365);
  return `il y a ${years} an${years > 1 ? 's' : ''}`;
}

/**
 * Helper function to select a row and trigger an action
 */
function selectClientAndGenerateQuote() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
  
  const response = ui.prompt(
    'Générer un Devis',
    'Entrez le numéro de ligne du client (2 pour le premier client):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const row = parseInt(response.getResponseText());
    if (row > 1 && row <= sheet.getLastRow()) {
      sheet.getRange(row, 1).activate();
      generateQuote();
    } else {
      ui.alert('Numéro de ligne invalide.');
    }
  }
}

function generateInvoiceForRow(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
  sheet.getRange(row, 1).activate();
  openInvoiceEditor();
}

/**
 * ================================================================
 * EMAIL INTEGRATION - PHASE 1: DRAFT GENERATION
 * ================================================================
 */

/**
 * Generate a draft email for a quote
 * @param {number} row - Row number in the sheet
 * @returns {Object} Success result with draft link
 */
function generateQuoteEmailDraft(row) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);
    const C = CONFIG.column_mappings;
    
    // Validate required data
    if (!client[C.client_email]) {
      throw new Error("Adresse email du client introuvable");
    }
    
    if (!client[C.quote_link]) {
      throw new Error("Lien vers le devis manquant. Veuillez d'abord générer le devis.");
    }
    
    // Get quote PDF
    const docId = getDocIdFromUrl(client[C.quote_link]);
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    pdfBlob.setName(`Devis ${client[C.quote_number]} - ${client[C.client_name]}.pdf`);
    
    // Parse quote data for totals
    const quoteData = client[C.quote_data_json] ? JSON.parse(client[C.quote_data_json]) : {};
    const totalAmount = calculateQuoteTotalFromData(quoteData);
    
    // Prepare template data
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
    
    // Generate email from template
    const templates = getEmailTemplates();
    const template = templates.quote;
    const subject = replaceTemplatePlaceholders(template.subject, templateData);
    const body = replaceTemplatePlaceholders(template.body, templateData);
    
    // Create Gmail draft
    const draft = GmailApp.createDraft(
      client[C.client_email],
      subject,
      body,
      {
        attachments: [pdfBlob],
        htmlBody: body.replace(/\n/g, '<br>')
      }
    );
    
    Logger.log(`Email draft created for ${client[C.client_name]}`);
    
    return {
      success: true,
      message: `Brouillon créé avec succès pour ${client[C.client_name]}`,
      draftId: draft.getId()
    };
    
  } catch (error) {
    Logger.log(`Error creating email draft: ${error.message}`);
    return {
      success: false,
      message: `Erreur: ${error.message}`
    };
  }
}

/**
 * Generate a follow-up email draft
 */
function generateFollowUpEmailDraft(row) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);
    const C = CONFIG.column_mappings;
    
    if (!client[C.client_email]) {
      throw new Error("Adresse email du client introuvable");
    }
    
    if (!client[C.quote_number]) {
      throw new Error("Aucun devis trouvé pour ce client");
    }
    
    // Calculate days since quote sent
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
      message: `Brouillon de relance créé pour ${client[C.client_name]}`,
      draftId: draft.getId()
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Erreur: ${error.message}`
    };
  }
}

/**
 * Generate a testimonial request email draft
 */
function generateTestimonialEmailDraft(row) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const client = createObjectFromRow(rowData, headers);
    const C = CONFIG.column_mappings;
    
    if (!client[C.client_email]) {
      throw new Error("Adresse email du client introuvable");
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
      message: `Brouillon de demande de témoignage créé pour ${client[C.client_name]}`,
      draftId: draft.getId()
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Erreur: ${error.message}`
    };
  }
}

/**
 * Helper: Replace placeholders in EMAIL TEMPLATES (string-based)
 * RENAMED from replacePlaceholders to avoid confusion with document function
 */
function replaceTemplatePlaceholders(template, data) {
  let result = template;
  for (const [placeholder, value] of Object.entries(data)) {
    result = result.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }
  return result;
}

/**
 * Helper: Calculate total from quote data
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
  const vatRate = 1.10; // You can make this dynamic based on work type
  
  return afterDiscount * vatRate;
}

/**
 * Helper: Format validity date (90 days from quote date)
 */
function formatValidityDate(quoteDate) {
  if (!quoteDate) return 'À définir';
  const date = new Date(quoteDate);
  date.setDate(date.getDate() + CONFIG.quote_settings.validity_days);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/**
 * Helper: Format date
 */
function formatDate(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/**
 * ================================================================
 * EMAIL TEMPLATE MANAGEMENT
 * ================================================================
 */

/**
 * Get email templates (custom or defaults from CONFIG)
 */
function getEmailTemplates() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const customTemplates = userProperties.getProperty('EMAIL_TEMPLATES');
    
    if (customTemplates) {
      return JSON.parse(customTemplates);
    }
    
    // Return defaults from CONFIG
    return CONFIG.email_templates;
  } catch (error) {
    Logger.log('Error getting email templates: ' + error.message);
    return CONFIG.email_templates;
  }
}

/**
 * Save custom email templates
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
 * Reset email templates to defaults
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

/**
 * ================================================================
 * CLIENT NOTES MANAGEMENT
 * ================================================================
 */

/**
 * Save client notes to the spreadsheet
 * @param {number} row - Row number in the sheet
 * @param {string} notes - Notes text to save
 * @returns {Object} Success/failure result
 */
function saveClientNotes(row, notes) {
  try {
    Logger.log(`=== saveClientNotes called ===`);
    Logger.log(`Row: ${row}`);
    Logger.log(`Notes length: ${notes ? notes.length : 0}`);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);
    
    if (!sheet) {
      throw new Error("Feuille CRM introuvable");
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const C = CONFIG.column_mappings;
    
    // Find the notes column
    const notesColIndex = headers.indexOf(C.internal_notes);
    Logger.log(`Notes column index: ${notesColIndex}`);
    
    if (notesColIndex === -1) {
      throw new Error(`Colonne "Notes Internes" introuvable`);
    }
    
    // Validate notes length
    if (notes && notes.length > 1000) {
      throw new Error('Les notes ne peuvent pas dépasser 1000 caractères');
    }
    
    // Update the notes column
    sheet.getRange(row, notesColIndex + 1).setValue(notes);
    
    Logger.log(`✓ Notes saved successfully for row ${row}`);
    
    return {
      success: true,
      message: 'Notes enregistrées'
    };
  } catch (error) {
    Logger.log(`❌ Error saving notes: ${error.message}`);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Activate a specific row and trigger quote generation
 * @param {number} row - Row number in the sheet
 */
function generateQuoteForRow(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  
  // Activate the row
  sheet.getRange(row, 1).activate();
  
  // Trigger quote generation
  generateQuote();
}
