/**
 * Style et Matière - CRM System
 * Version: 3.5
 * A complete CRM solution for craftsmen built on Google Apps Script
 *
 * @author Fabien for Style et Matière
 * @see README.md for full documentation
 */

// =============================================================================
// INITIALIZATION & MENU
// =============================================================================

/**
 * Initializes the CRM when spreadsheet opens
 * Creates menu, initializes columns, and opens dashboard
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('Style et Matière')
    .addItem('📊 Ouvrir le Tableau de Bord', 'openCRMModal')
    .addSeparator()
    .addItem('➡️ Générer le Devis', 'generateQuote')
    .addSeparator()
    .addItem('📄 Générer la Facture', 'openInvoiceEditor')
    .addItem('⚙️ Réinitialiser le numéro de facture', 'resetInvoiceCounter')
    .addSeparator()
    .addItem('📝 Modifier Notes Internes', 'editInternalNotes')
    .addItem('📋 Dupliquer un Devis', 'duplicateQuote')
    .addToUi();

  try {
    initializeNotesColumn();
  } catch (e) {
    Logger.log('Notes column initialization: ' + e.message);
  }

  openCRMModal();
}

/**
 * Forces re-authorization of all OAuth scopes
 * Run manually from script editor when permissions need to be reset
 */
function forceReauthorization() {
  try {
    DriveApp.getRootFolder();
    PropertiesService.getUserProperties().getKeys();
    PropertiesService.getScriptProperties().getKeys();
    SpreadsheetApp.getActiveSpreadsheet().getName();
    DocumentApp.create('temp').getId();
    GmailApp.createDraft('test@example.com', 'test', 'test');

    SpreadsheetApp.getUi().alert('✅ Autorisations accordées avec succès!');
  } catch(e) {
    SpreadsheetApp.getUi().alert('Veuillez autoriser toutes les permissions demandées.');
  }
}

// =============================================================================
// CORE DATA ACCESS UTILITIES
// =============================================================================

/**
 * Converts a row array and headers into a key-value object
 * This enables column-order independent data access throughout the application
 *
 * @param {Array} rowData - Array of cell values from one row
 * @param {Array} headers - Array of column header names
 * @returns {Object} Object where keys are header names and values are cell values
 *
 * @example
 * const headers = ['Name', 'Email', 'Phone'];
 * const row = ['John Doe', 'john@example.com', '555-1234'];
 * const obj = createObjectFromRow(row, headers);
 * // Returns: { Name: 'John Doe', Email: 'john@example.com', Phone: '555-1234' }
 */
function createObjectFromRow(rowData, headers) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = rowData[index];
  });
  return obj;
}

/**
 * Formats a number as French currency (1 234,56 €)
 *
 * @param {number|string} num - Number to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(num) {
  if (typeof num !== 'number') {
    num = parseFloat(num) || 0;
  }

  return num.toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
}

/**
 * Safely converts any value to a string for document placeholders
 * Handles null, undefined, dates, and other types
 *
 * @param {*} value - Value to convert
 * @returns {string} String representation
 */
function safeString(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(value);
}

/**
 * Extracts Google Doc ID from a Drive URL
 *
 * @param {string} url - Google Drive document URL
 * @returns {string} Document ID
 * @throws {Error} If ID cannot be extracted
 */
function getDocIdFromUrl(url) {
  const match = url.match(/d\/(.+?)\//);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error("Impossible d'extraire l'ID du document de l'URL.");
}

// =============================================================================
// QUOTE GENERATION WORKFLOW
// =============================================================================

/**
 * Opens the quote builder modal
 * Validates sheet selection and passes existing quote data if available
 */
function generateQuote() {
  const ui = SpreadsheetApp.getUi();

  try {
    const crmSheetName = CONFIG.file_paths.crm_sheet_name;
    const activeSheet = SpreadsheetApp.getActiveSheet();

    if (activeSheet.getName() !== crmSheetName) {
      ui.alert(
        'Action Impossible',
        'Veuillez sélectionner un client dans l\'onglet "' + crmSheetName + '" avant de générer un devis.',
        ui.ButtonSet.OK
      );
      return;
    }

    const selectedRow = activeSheet.getActiveRange().getRow();

    if (selectedRow <= 1) {
      ui.alert(
        'Sélection Invalide',
        'Veuillez sélectionner la ligne d\'un client (pas l\'en-tête) pour générer un devis.',
        ui.ButtonSet.OK
      );
      return;
    }

    const headers = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const rowData = activeSheet.getRange(selectedRow, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const clientObject = createObjectFromRow(rowData, headers);
    const savedQuoteDataString = clientObject[CONFIG.column_mappings.quote_data_json] || '';

    const htmlTemplate = HtmlService.createTemplateFromFile('quoteBuilder');
    htmlTemplate.selectedRow = selectedRow;
    htmlTemplate.savedQuoteData = savedQuoteDataString;
    htmlTemplate.launchMode = 'quote';

    const htmlOutput = htmlTemplate.evaluate()
      .setWidth(850)
      .setHeight(650)
      .setTitle('Construction du Devis');

    ui.showModalDialog(htmlOutput, 'Construction du Devis');

  } catch (e) {
    Logger.log('Error in generateQuote: ' + e.message);
    ui.alert('Erreur critique inattendue: ' + e.message);
  }
}

/**
 * Retrieves the service catalog from the Services sheet
 *
 * @returns {Array<Object>} Array of service objects with id, type, category, description, unit, price
 * @throws {Error} If Services sheet is not found
 */
function getServices() {
  try {
    const servicesSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.services_sheet_name);

    if (!servicesSheet) {
      throw new Error('La feuille "' + CONFIG.file_paths.services_sheet_name + '" est introuvable.');
    }

    const lastRow = servicesSheet.getLastRow();
    if (lastRow < 2) return [];

    const headers = servicesSheet.getRange(1, 1, 1, servicesSheet.getLastColumn()).getValues()[0];
    const data = servicesSheet.getRange(2, 1, lastRow - 1, servicesSheet.getLastColumn()).getValues();

    return data
      .filter(row => row[0] && row[3])
      .map((row, index) => {
        const serviceObj = createObjectFromRow(row, headers);
        return {
          id: serviceObj['ID'] || serviceObj['id'] || `service-${index}`,
          type: serviceObj['Type'] || 'Non classé',
          category: serviceObj['Catégorie'] || serviceObj['Category'] || 'Autres',
          description: serviceObj['Description'],
          unit: serviceObj['Unité'] || serviceObj['Unit'],
          price: parseFloat(serviceObj['Prix HT'] || serviceObj['Price']) || 0
        };
      });

  } catch (e) {
    Logger.log('Error in getServices: ' + e.message);
    throw new Error('Impossible de lire les services: ' + e.message);
  }
}

/**
 * Gets initial business data for a client row
 * Returns duration, discount, and saved quote structure
 *
 * @param {number} selectedRow - Row number in CRM sheet
 * @returns {Object} Object with duration, discount, and savedQuoteData
 */
function getInitialBusinessData(selectedRow) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.crm_sheet_name);

    if (!selectedRow) {
      throw new Error('Selected row was not provided');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const clientObject = createObjectFromRow(rowData, headers);
    const C = CONFIG.column_mappings;

    return {
      duration: clientObject[C.estimated_duration] || '',
      discount: clientObject[C.discount_percentage] || 0,
      savedQuoteData: clientObject[C.quote_data_json] || null
    };

  } catch (e) {
    Logger.log('Error in getInitialBusinessData: ' + e.message);
    return {
      duration: '',
      discount: 0,
      savedQuoteData: null
    };
  }
}

/**
 * Adds a new service to the Services sheet
 *
 * @param {Object} serviceData - Service details (type, category, description, unit, price)
 * @returns {Object} Complete service object including generated ID
 * @throws {Error} If service cannot be saved
 */
function addNewService(serviceData) {
  try {
    const servicesSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.file_paths.services_sheet_name);

    if (!servicesSheet) {
      throw new Error('Services sheet not found');
    }

    const newId = 'SERV-' + new Date().getTime();
    const newRow = [
      newId,
      serviceData.type,
      serviceData.category,
      serviceData.description,
      serviceData.unit,
      parseFloat(serviceData.price) || 0
    ];

    servicesSheet.appendRow(newRow);
    Logger.log('New service added: ' + serviceData.description);

    return {
      id: newId,
      type: serviceData.type,
      category: serviceData.category,
      description: serviceData.description,
      unit: serviceData.unit,
      price: parseFloat(serviceData.price) || 0
    };

  } catch (e) {
    Logger.log('Failed to add service: ' + e.message);
    throw new Error('Could not save the new service: ' + e.message);
  }
}

/**
 * Generates a quote document from structured data
 * Main server-side function called from quote builder
 *
 * @param {Array<Object>} structuredQuoteData - Hierarchical quote structure (sections with services)
 * @param {Object} businessData - Business parameters (duration, discount, deposit, mentions)
 * @param {number} selectedRow - Client row number
 * @returns {string} URL of generated quote document
 * @throws {Error} If quote generation fails
 */
function generateQuoteWithServices(structuredQuoteData, businessData, selectedRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);

  try {
    const cleanBusinessData = {
      estimatedDuration: String(businessData.estimatedDuration || ''),
      discountPercentage: parseFloat(businessData.discountPercentage) || 0,
      depositPaid: parseFloat(businessData.depositPaid) || 0,
      selectedMentions: businessData.selectedMentions || []
    };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const clientData = extractClientData(createObjectFromRow(rowData, headers));

    const flattenedItems = flattenQuoteData(structuredQuoteData);
    const quoteNumber = generateQuoteNumber(sheet, headers);
    const quoteDate = new Date();
    const validityDate = new Date(quoteDate.getTime() + (CONFIG.quote_settings.validity_days * 24 * 60 * 60 * 1000));
    const vatRate = calculateTVARate(clientData.workType);

    const totals = calculateQuoteTotals(
      flattenedItems,
      cleanBusinessData.discountPercentage,
      vatRate,
      cleanBusinessData.depositPaid
    );

    const destinationFolder = DriveApp.getFolderById(CONFIG.google_api.quote_destination_folder_id);
    const newDocFile = DriveApp.getFileById(CONFIG.google_api.quote_template_id)
      .makeCopy('Devis ' + quoteNumber + ' - ' + clientData.name, destinationFolder);
    const doc = DocumentApp.openById(newDocFile.getId());

    insertServicesTable(doc.getBody(), flattenedItems);

    const placeholderData = {
      ...clientData,
      estimatedDuration: cleanBusinessData.estimatedDuration,
      discountPercentage: String(cleanBusinessData.discountPercentage),
      selectedMentions: cleanBusinessData.selectedMentions.join('\n\n'),
      quoteNumber: String(quoteNumber),
      quoteDate: quoteDate,
      validityDate: validityDate,
      vatRate: vatRate,
      ...totals
    };

    replaceDocumentPlaceholders(doc, placeholderData);

    doc.saveAndClose();

    const dataToSave = {
      businessData: {
        estimatedDuration: cleanBusinessData.estimatedDuration,
        discountPercentage: cleanBusinessData.discountPercentage,
        selectedMentions: cleanBusinessData.selectedMentions
      },
      quoteStructure: structuredQuoteData
    };
    const quoteDataJsonString = JSON.stringify(dataToSave);

    updateSheetWithCompleteQuoteInfo(
      sheet,
      selectedRow,
      quoteNumber,
      quoteDate,
      newDocFile.getUrl(),
      cleanBusinessData,
      headers,
      quoteDataJsonString
    );

    return newDocFile.getUrl();

  } catch (e) {
    Logger.log('Error in generateQuoteWithServices: ' + e.message);
    throw new Error('Génération du devis échouée: ' + e.message);
  }
}

/**
 * Gets all special mentions from the Mentions sheet
 *
 * @returns {Array<string>} Array of mention text strings
 */
function getMentions() {
  try {
    const mentionsSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName('Mentions');

    if (!mentionsSheet) {
      Logger.log('Mentions sheet not found');
      return [];
    }

    const lastRow = mentionsSheet.getLastRow();
    if (lastRow < 2) return [];

    const data = mentionsSheet.getRange(2, 1, lastRow - 1, 1).getValues();

    return data
      .filter(row => row[0] && String(row[0]).trim() !== '')
      .map(row => String(row[0]).trim());

  } catch (e) {
    Logger.log('Error in getMentions: ' + e.message);
    return [];
  }
}

// =============================================================================
// INVOICE GENERATION WORKFLOW
// =============================================================================

/**
 * Opens the invoice editor modal
 * Pre-fills with data from existing quote
 */
function openInvoiceEditor() {
  const ui = SpreadsheetApp.getUi();

  try {
    const activeSheet = SpreadsheetApp.getActiveSheet();
    const crmSheetName = CONFIG.file_paths.crm_sheet_name;

    if (activeSheet.getName() !== crmSheetName) {
      ui.alert(
        'Action Impossible',
        'Veuillez sélectionner un client dans l\'onglet "' + crmSheetName + '" avant de générer une facture.',
        ui.ButtonSet.OK
      );
      return;
    }

    const selectedRow = activeSheet.getActiveRange().getRow();

    if (selectedRow <= 1) {
      ui.alert(
        'Sélection Invalide',
        'Veuillez sélectionner la ligne d\'un client (pas l\'en-tête).',
        ui.ButtonSet.OK
      );
      return;
    }

    const headers = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const rowData = activeSheet.getRange(selectedRow, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const clientObject = createObjectFromRow(rowData, headers);
    const savedQuoteDataString = clientObject[CONFIG.column_mappings.quote_data_json] || '';

    if (!savedQuoteDataString) {
      ui.alert(
        'Devis manquant',
        'Aucune donnée de devis trouvée. Veuillez d\'abord générer un devis.',
        ui.ButtonSet.OK
      );
      return;
    }

    const htmlTemplate = HtmlService.createTemplateFromFile('quoteBuilder');
    htmlTemplate.selectedRow = selectedRow;
    htmlTemplate.savedQuoteData = savedQuoteDataString;
    htmlTemplate.launchMode = 'invoice';

    const htmlOutput = htmlTemplate.evaluate()
      .setWidth(850)
      .setHeight(650)
      .setTitle('Construction de la Facture');

    ui.showModalDialog(htmlOutput, 'Construction de la Facture');

  } catch (e) {
    Logger.log('Error in openInvoiceEditor: ' + e.message);
    ui.alert('Erreur critique inattendue: ' + e.message);
  }
}

/**
 * Generates an invoice document from structured data
 *
 * @param {Array<Object>} structuredInvoiceData - Hierarchical invoice structure
 * @param {Object} businessData - Business parameters (duration, discount, depositPaid)
 * @param {number} selectedRow - Client row number
 * @returns {string} URL of generated invoice document
 * @throws {Error} If invoice generation fails
 */
function generateInvoiceWithServices(structuredInvoiceData, businessData, selectedRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);

  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const clientData = extractClientData(createObjectFromRow(rowData, headers));

    const flattenedItems = flattenQuoteData(structuredInvoiceData);
    const invoiceNumber = generateNextInvoiceNumber();
    const invoiceDate = new Date();
    const vatRate = calculateTVARate(clientData.workType);

    const totals = calculateQuoteTotals(
      flattenedItems,
      businessData.discountPercentage,
      vatRate,
      parseFloat(businessData.depositPaid) || 0
    );

    const placeholderData = {
      ...clientData,
      ...businessData,
      ...totals,
      quoteNumber: invoiceNumber,
      quoteDate: invoiceDate,
      validityDate: invoiceDate,
      vatRate: vatRate
    };

    const destinationFolder = DriveApp.getFolderById(CONFIG.google_api.quote_destination_folder_id);
    const newDocFile = DriveApp.getFileById(CONFIG.google_api.invoice_template_id)
      .makeCopy('Facture ' + invoiceNumber + ' - ' + clientData.name, destinationFolder);

    const doc = DocumentApp.openById(newDocFile.getId());

    insertServicesTable(doc.getBody(), flattenedItems);
    replaceDocumentPlaceholders(doc, placeholderData);

    doc.saveAndClose();

    const dataToSave = {
      businessData: {
        estimatedDuration: businessData.estimatedDuration,
        discountPercentage: businessData.discountPercentage
      },
      invoiceStructure: structuredInvoiceData
    };
    const invoiceDataJsonString = JSON.stringify(dataToSave);

    updateSheetWithInvoiceInfo(
      sheet,
      selectedRow,
      invoiceNumber,
      invoiceDate,
      newDocFile.getUrl(),
      headers,
      invoiceDataJsonString
    );

    return newDocFile.getUrl();

  } catch (e) {
    Logger.log('Error in generateInvoiceWithServices: ' + e.message);
    throw new Error('Génération de la facture échouée: ' + e.message);
  }
}

/**
 * Generates next sequential invoice number with concurrency protection
 * Uses LockService to prevent race conditions
 *
 * @returns {string} Formatted invoice number (e.g., "F00116")
 */
function generateNextInvoiceNumber() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const properties = PropertiesService.getScriptProperties();
    let lastInvoiceNum = parseInt(properties.getProperty('LAST_INVOICE_NUMBER'), 10);

    if (isNaN(lastInvoiceNum)) {
      lastInvoiceNum = 115;
    }

    const nextInvoiceNum = lastInvoiceNum + 1;
    properties.setProperty('LAST_INVOICE_NUMBER', nextInvoiceNum);

    return 'F' + String(nextInvoiceNum).padStart(5, '0');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Allows manual reset of invoice counter
 * Prompts user for next invoice number
 */
function resetInvoiceCounter() {
  const ui = SpreadsheetApp.getUi();

  try {
    const response = ui.prompt(
      'Réinitialiser le compteur de factures',
      'Veuillez entrer le numéro pour la PROCHAINE facture qui sera générée (ex: 116).',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() === ui.Button.OK) {
      const nextNumberStr = response.getResponseText().trim();
      const nextNumber = parseInt(nextNumberStr, 10);

      if (isNaN(nextNumber) || nextNumber <= 0) {
        ui.alert('Erreur', 'Veuillez entrer un nombre valide et positif.', ui.ButtonSet.OK);
        return;
      }

      const numberToStore = nextNumber - 1;
      const properties = PropertiesService.getScriptProperties();
      properties.setProperty('LAST_INVOICE_NUMBER', numberToStore);

      ui.alert(
        'Succès',
        'Le compteur a été réinitialisé. La prochaine facture portera le numéro F' +
        String(nextNumber).padStart(5, '0') + '.',
        ui.ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log('Error in resetInvoiceCounter: ' + e.message);
    ui.alert('Une erreur est survenue: ' + e.message);
  }
}

// =============================================================================
// DOCUMENT GENERATION HELPERS
// =============================================================================

/**
 * Extracts and structures client data from a row object
 *
 * @param {Object} clientObject - Key-value object from createObjectFromRow
 * @returns {Object} Structured client data
 */
function extractClientData(clientObject) {
  const C = CONFIG.column_mappings;
  return {
    name: clientObject[C.client_name] || '',
    email: clientObject[C.client_email] || '',
    phone: clientObject[C.phone] || '',
    projectDetails: clientObject[C.project_details] || '',
    workType: clientObject[C.work_type] || '',
    address: clientObject[C.address] || '',
    postalCode: clientObject[C.postal_code] || '',
    city: clientObject[C.city] || ''
  };
}

/**
 * Replaces all placeholders in a Google Doc template
 * Handles body, header, and conditional sections (discount, attestation)
 *
 * @param {Document} doc - Google Document object
 * @param {Object} data - Key-value pairs for placeholder replacement
 */
function replaceDocumentPlaceholders(doc, data) {
  const body = doc.getBody();
  const header = doc.getHeader();
  const P = CONFIG.placeholder_mappings;

  const renovationText = "Attestation TVA taux réduit : l'acheteur certifie que les conditions d'application du taux réduit de la TVA sont remplies en ce que les travaux sont effectués dans des locaux à usage d'habitation de plus de 2 ans ou destinés à être affectés à l'habitation à l'issue des travaux, que ces travaux ne répondent pas aux conditions d'exclusion prévues par des textes, et que ces travaux sont éligibles au taux réduit.";

  const mentionsText = (data.selectedMentions && data.selectedMentions.length > 0)
    ? data.selectedMentions
    : '';

  const replacements = {
    [P.devis_numero]: safeString(data.quoteNumber),
    [P.devis_date]: safeString(data.quoteDate),
    [P.devis_validity_date]: safeString(data.validityDate),
    [P.client_name]: safeString(data.name),
    [P.client_address]: safeString(data.address),
    [P.client_postal_code]: safeString(data.postalCode),
    [P.client_city]: safeString(data.city),
    [P.client_email]: safeString(data.email),
    [P.client_phone]: safeString(data.phone),
    [P.work_type]: safeString(data.workType),
    [P.estimated_duration]: safeString(data.estimatedDuration),
    [P.mention_speciale]: mentionsText,
    [P.sous_total_ht]: safeString(data.subtotal),
    [P.tva_taux]: safeString(data.vatRate) + '%',
    [P.montant_tva]: safeString(data.vatAmount),
    [P.total_ttc]: safeString(data.grandTotal),
    [P.montant_acompte]: safeString(data.depositAmount),
    [P.montant_acompte_verse]: safeString(data.depositPaid),
    [P.solde_a_payer]: safeString(data.remainingBalance),
    [P.renovation_attestation]: (data.workType && String(data.workType).toLowerCase().includes('rénovation'))
      ? renovationText
      : ''
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    try {
      const valueToInsert = value || '';
      body.replaceText(placeholder, valueToInsert);
      if (header) {
        header.replaceText(placeholder, valueToInsert);
      }
    } catch (e) {
      Logger.log('Error replacing ' + placeholder + ': ' + e.message);
    }
  }

  handleDiscountSection(body, data);
}

/**
 * Handles conditional discount section in document
 * Shows or removes discount line based on whether discount was applied
 *
 * @param {Body} body - Document body
 * @param {Object} data - Data including discountPercentage
 */
function handleDiscountSection(body, data) {
  const P = CONFIG.placeholder_mappings;
  const discountStartSearchResult = body.findText(P.ligne_remise);
  const discountEndSearchResult = body.findText(P.ligne_remise_end);

  if (data.discountPercentage > 0) {
    if (discountStartSearchResult) body.replaceText(P.ligne_remise, '');
    if (discountEndSearchResult) body.replaceText(P.ligne_remise_end, '');
    body.replaceText(P.ligne_remise_label, safeString(data.discountLabel));
    body.replaceText(P.ligne_remise_valeur, safeString(data.discountValue));
  } else {
    if (discountStartSearchResult) {
      const startElement = discountStartSearchResult.getElement();
      startElement.getParent().asText().setText('');
    }
    if (discountEndSearchResult) {
      const endElement = discountEndSearchResult.getElement();
      endElement.getParent().asText().setText('');
    }
  }
}

/**
 * Generates sequential quote number for current year
 * Format: YYYY-NNNN (e.g., 2025-0015)
 *
 * @param {Sheet} sheet - CRM sheet
 * @param {Array} headers - Column headers
 * @returns {string} Formatted quote number
 */
function generateQuoteNumber(sheet, headers) {
  const quoteNumberColName = CONFIG.column_mappings.quote_number;
  const quoteNumberColIndex = headers.indexOf(quoteNumberColName);

  if (quoteNumberColIndex === -1) {
    throw new Error('La colonne "' + quoteNumberColName + '" est introuvable.');
  }

  if (sheet.getLastRow() < 2) {
    return new Date().getFullYear() + '-0001';
  }

  const quoteNumbers = sheet.getRange(2, quoteNumberColIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  const currentYear = new Date().getFullYear();
  let maxNumber = 0;

  quoteNumbers.forEach(cell => {
    const quoteNum = cell[0];
    if (quoteNum && typeof quoteNum === 'string') {
      const match = quoteNum.match(/^(\d{4})-(\d+)$/);
      if (match && parseInt(match[1]) === currentYear) {
        const num = parseInt(match[2]);
        if (num > maxNumber) maxNumber = num;
      }
    }
  });

  const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
  return currentYear + '-' + nextNumber;
}

/**
 * Updates sheet with generated quote information
 *
 * @param {Sheet} sheet - CRM sheet
 * @param {number} row - Row number
 * @param {string} quoteNumber - Generated quote number
 * @param {Date} quoteDate - Quote date
 * @param {string} quoteUrl - URL to generated document
 * @param {Object} businessData - Business parameters
 * @param {Array} headers - Column headers
 * @param {string} quoteDataJsonString - JSON string of quote structure
 */
function updateSheetWithCompleteQuoteInfo(sheet, row, quoteNumber, quoteDate, quoteUrl, businessData, headers, quoteDataJsonString) {
  const C = CONFIG.column_mappings;

  const dataToWrite = {
    [C.quote_number]: quoteNumber,
    [C.quote_date]: quoteDate,
    [C.status]: CONFIG.statuses.NEW,
    [C.estimated_duration]: businessData.estimatedDuration,
    [C.discount_percentage]: businessData.discountPercentage,
    [C.quote_link]: quoteUrl,
    [C.quote_data_json]: quoteDataJsonString
  };

  for (const [colName, value] of Object.entries(dataToWrite)) {
    const colIndex = headers.indexOf(colName);
    if (colIndex !== -1) {
      sheet.getRange(row, colIndex + 1).setValue(value);
    } else {
      Logger.log('Column "' + colName + '" not found. Could not write value: ' + value);
    }
  }

  Logger.log('Sheet updated for quote ' + quoteNumber);
}

/**
 * Updates sheet with generated invoice information
 *
 * @param {Sheet} sheet - CRM sheet
 * @param {number} row - Row number
 * @param {string} invoiceNumber - Generated invoice number
 * @param {Date} invoiceDate - Invoice date
 * @param {string} invoiceUrl - URL to generated document
 * @param {Array} headers - Column headers
 * @param {string} invoiceDataJsonString - JSON string of invoice structure
 */
function updateSheetWithInvoiceInfo(sheet, row, invoiceNumber, invoiceDate, invoiceUrl, headers, invoiceDataJsonString) {
  const C = CONFIG.column_mappings;

  const dataToWrite = {
    [C.invoice_number]: invoiceNumber,
    [C.invoice_date]: invoiceDate,
    [C.invoice_link]: invoiceUrl,
    [C.invoice_status]: CONFIG.invoice_statuses.DRAFT,
    [C.invoice_data_json]: invoiceDataJsonString
  };

  for (const [colName, value] of Object.entries(dataToWrite)) {
    const colIndex = headers.indexOf(colName);
    if (colIndex !== -1) {
      sheet.getRange(row, colIndex + 1).setValue(value);
    } else {
      Logger.log('Column "' + colName + '" for invoice not found. Could not write value: ' + value);
    }
  }

  Logger.log('Sheet updated for invoice ' + invoiceNumber);
}

/**
 * Flattens hierarchical quote structure into flat array for table insertion
 *
 * @param {Array<Object>} structuredData - Sections with nested services
 * @returns {Array<Object>} Flat array with type markers (subtitle/service)
 */
function flattenQuoteData(structuredData) {
  const flattenedItems = [];
  structuredData.forEach(section => {
    flattenedItems.push({ type: 'subtitle', text: section.name });
    section.services.forEach(service => {
      flattenedItems.push({ ...service, type: 'service' });
    });
  });
  return flattenedItems;
}

/**
 * Calculates all financial totals for a quote/invoice
 * Handles subtotal, discount, VAT, deposit, and remaining balance
 *
 * @param {Array<Object>} services - Flattened service items
 * @param {number} discountPercentage - Discount percentage (0-100)
 * @param {number} vatRate - VAT rate (10 or 20)
 * @param {number} depositPaid - Amount already paid as deposit
 * @returns {Object} All calculated totals (formatted and raw values)
 */
function calculateQuoteTotals(services, discountPercentage, vatRate, depositPaid = 0) {
  const serviceItems = services.filter(s => s.type === 'service');
  const subtotal = serviceItems.reduce((acc, s) => acc + (s.price * s.quantity), 0);
  const discountAmount = subtotal * (discountPercentage / 100);
  const totalAfterDiscount = subtotal - discountAmount;
  const vatAmount = totalAfterDiscount * (vatRate / 100);
  const grandTotal = totalAfterDiscount + vatAmount;
  const depositAmount = grandTotal * 0.30;
  const remainingBalance = grandTotal - depositPaid;

  return {
    subtotal: formatCurrency(subtotal),
    discountAmount: formatCurrency(discountAmount),
    totalAfterDiscount: formatCurrency(totalAfterDiscount),
    vatAmount: formatCurrency(vatAmount),
    grandTotal: formatCurrency(grandTotal),
    depositAmount: formatCurrency(depositAmount),
    grandTotalRaw: grandTotal,
    depositAmountRaw: depositAmount,
    depositPaid: formatCurrency(depositPaid),
    remainingBalance: formatCurrency(remainingBalance),
    remainingBalanceRaw: remainingBalance,
    discountLabel: 'Remise (' + discountPercentage + '%)',
    discountValue: '-' + formatCurrency(discountAmount),
    discountPercentage: discountPercentage,
    vatRate: vatRate
  };
}

/**
 * Determines VAT rate based on work type
 * Renovation: 10%, Others: 20%
 *
 * @param {string} workType - Type of work
 * @returns {number} VAT rate (10 or 20)
 */
function calculateTVARate(workType) {
  if (!workType) return 20;
  const workTypeLower = String(workType).toLowerCase();
  if (workTypeLower.includes('rénovation')) return 10;
  const rate = CONFIG.tva_rate[workType];
  return rate || 20;
}

/**
 * Inserts services table into document body
 * Replaces {{TABLEAU_SERVICES}} placeholder with formatted table
 *
 * @param {Body} body - Document body
 * @param {Array<Object>} items - Flattened items with subtitles and services
 */
function insertServicesTable(body, items) {
  const searchResult = body.findText('{{TABLEAU_SERVICES}}');
  if (!searchResult) return;

  const markerElement = searchResult.getElement();
  const parent = markerElement.getParent();
  const markerIndex = parent.getParent().getChildIndex(parent);

  const tableData = [['Description', 'Quantité', 'Unité', 'Prix U. HT', 'Total HT']];

  items.forEach(item => {
    if (item.type === 'service') {
      tableData.push([
        item.description,
        item.quantity.toString(),
        item.unit,
        formatCurrency(item.price),
        formatCurrency(item.price * item.quantity)
      ]);
    } else if (item.type === 'subtitle') {
      tableData.push([item.text]);
    }
  });

  const table = body.insertTable(markerIndex, tableData);
  styleServicesTable(table);
  parent.removeFromParent();
}

/**
 * Applies professional styling to services table
 * Sets column widths, header styles, and row formatting
 *
 * @param {Table} table - Google Docs table object
 */
function styleServicesTable(table) {
  const attributes = {
    [DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]: DocumentApp.HorizontalAlignment.CENTER
  };
  table.setAttributes(attributes);

  table.setColumnWidth(0, 280);
  table.setColumnWidth(1, 55);
  table.setColumnWidth(2, 40);
  table.setColumnWidth(3, 60);
  table.setColumnWidth(4, 65);

  const headerRow = table.getRow(0);
  headerRow.editAsText().setBold(true);

  for (let i = 0; i < headerRow.getNumCells(); i++) {
    const cell = headerRow.getCell(i);
    cell.editAsText().setFontSize(10);
    cell.setBackgroundColor('#f2eb2d');
    cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    cell.setPaddingTop(8);
    cell.setPaddingBottom(8);
  }

  for (let r = 1; r < table.getNumRows(); r++) {
    const row = table.getRow(r);

    if (row.getNumCells() < 5) {
      if (row.getNumCells() > 1) row.merge();
      const cell = row.getCell(0);
      cell.setBackgroundColor('#f0f4f8').setPaddingTop(8).setPaddingBottom(4);
      if (cell.getChild(0) && cell.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) {
        cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.LEFT);
      }
      cell.editAsText().setBold(true).setFontSize(11);
    } else {
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        cell.editAsText().setFontSize(10);
        cell.setPaddingTop(6).setPaddingBottom(6).setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
        if (cell.getChild(0) && cell.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) {
          cell.getChild(0).asParagraph().setAlignment(
            c > 0 ? DocumentApp.HorizontalAlignment.RIGHT : DocumentApp.HorizontalAlignment.LEFT
          );
        }
      }
    }
  }
}
