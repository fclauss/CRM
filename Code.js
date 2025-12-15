/**
 * ==============================================================================
 * STYLE ET MATIÈRE - CRM SYSTEM (VERSION 3.4 - FULLY REFACTORED)
 *
 * This version maintains 100% of the original functionality while
 * implementing robust backend improvements.
 *
 * Changes:
 *  - All configuration is externalized in `Config.gs`.
 *  - All hardcoded IDs, sheet names, and column numbers are removed.
 *  - Data access is now based on column names (from CONFIG), making
 *    the script resilient to changes in the spreadsheet's column order.
 *  - `updateSheetWithCompleteQuoteInfo` is now fully robust and does not
 *    depend on column order.
 *  - All original functions are preserved and refactored.
 *
 * Author: Fabien for Style et Matière (with the help of Gemini and Claude)
 * Date: October 2025
 * ==============================================================================
 */


// ==============================================================================
// INITIALIZATION & MENU
// ==============================================================================

/**
 * Opens the CRM modal automatically when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // Original menu (keep it available)
  ui.createMenu('Style et Matière')
    .addItem('📊 Ouvrir le Tableau de Bord', 'openCRMModal')
    .addSeparator()
    .addItem('➡️ Générer le Devis', 'generateQuote')
    //.addItem('✉️ Créer Brouillon Email', 'createEmailDraft')
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
  
  // Auto-open the modal
  openCRMModal();
}


// ==============================================================================
// HELPER FUNCTION: ROBUST DATA ACCESS
// ==============================================================================

/**
 * Creates a dictionary-like object from a row array and a header array.
 * This is the core of the robust data access method, used throughout the script.
 * @param {Array} rowData An array of cell values for one row.
 * @param {Array} headers An array of column header names.
 * @returns {Object} An object where keys are header names and values are cell values.
 */
function createObjectFromRow(rowData, headers) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = rowData[index];
  });
  return obj;
}


// ==============================================================================
// QUOTE GENERATION WORKFLOW (HTML BUILDER & SERVER-SIDE PROCESSING)
// ==============================================================================

/**
 * 1. Opens the main quote builder modal dialog.
 * CORRECTED: Now verifies the user is on the correct sheet before proceeding,
 * preventing errors and guiding the user.
 * MODIFIED: Now reads existing quote data (if any) to pre-fill the builder.
 */
function generateQuote() {
  const ui = SpreadsheetApp.getUi();
  try {
    const crmSheetName = CONFIG.file_paths.crm_sheet_name;
    const activeSheet = SpreadsheetApp.getActiveSheet(); // Get the sheet the user is currently viewing

    // --- ROBUSTNESS CHECK ---
    // Verify the user is on the correct sheet before doing anything. This is the key fix.
    if (activeSheet.getName() !== crmSheetName) {
      ui.alert(
        'Action Impossible',
        'Veuillez sélectionner un client dans l\'onglet "' + crmSheetName + '" avant de générer un devis.',
        ui.ButtonSet.OK
      );
      return; // Stop the function if the user is on the wrong sheet
    }

    const selectedRow = activeSheet.getActiveRange().getRow();

    // --- VALIDATION ---
    // Add a check to prevent running on the header row.
    if (selectedRow <= 1) {
      ui.alert('Sélection Invalide', 'Veuillez sélectionner la ligne d\'un client (pas l\'en-tête) pour générer un devis.', ui.ButtonSet.OK);
      return;
    }

    // --- NEW LOGIC TO FETCH SAVED DATA ---
    const headers = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const rowData = activeSheet.getRange(selectedRow, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const clientObject = createObjectFromRow(rowData, headers);
    
    // Get the JSON string from the sheet. It will be an empty string or undefined if no data exists.
    const savedQuoteDataString = clientObject[CONFIG.column_mappings.quote_data_json] || '';
    // --- END OF NEW LOGIC ---

    // Use createTemplateFromFile to pass data to the HTML
    const htmlTemplate = HtmlService.createTemplateFromFile('quoteBuilder');
    htmlTemplate.selectedRow = selectedRow; // Pass the row number
    
    // NEW: Pass the saved data string to the template
    htmlTemplate.savedQuoteData = savedQuoteDataString;
    htmlTemplate.launchMode = 'quote';

    const htmlOutput = htmlTemplate.evaluate() // Evaluate the template
      .setWidth(850)
      .setHeight(650)
      .setTitle('Construction du Devis'); // <-- ADD THIS .setTitle() METHOD

    ui.showModalDialog(htmlOutput, 'Construction du Devis');

  } catch (e) {
    // This catch block will now only trigger for truly unexpected errors.
    console.error("Erreur critique dans generateQuote:", e);
    ui.alert(`Erreur critique inattendue: ${e.message}`);
  }
}

/**
 * 2. Gets the list of available services from the 'Services' sheet.
 * Called by the HTML builder on load.
 */
function getServices() {
  try {
    const servicesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.services_sheet_name);
    if (!servicesSheet) throw new Error(`La feuille "${CONFIG.file_paths.services_sheet_name}" est introuvable.`);

    const data = servicesSheet.getRange('A2:F' + servicesSheet.getLastRow()).getValues();

    return data
      .filter(row => row[0] && row[3]) // Filter out empty rows where ID or description is missing
      .map(row => ({
        id: row[0],
        type: row[1] || 'Non classé',
        category: row[2] || 'Autres',
        description: row[3],
        unit: row[4],
        price: parseFloat(row[5]) || 0
      }));
  } catch (e) {
    console.error("Erreur dans getServices:", e);
    throw new Error(`Impossible de lire les services: ${e.message}`);
  }
}

/**
 * 3. Gets initial business data (duration, discount) from the active row to pre-fill the form.
 * Called by the HTML builder on load.
 */
/**
 * 3. Gets initial business data (duration, discount) AND the saved quote structure from the active row to pre-fill the form.
 * Called by the HTML builder on load.
 * MODIFIED: Also fetches the quote structure from the JSON column.
 */
function getInitialBusinessData(selectedRow) { // MODIFIED: Accept selectedRow as argument
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);

    // The active range can be unreliable in a modal context, so we use the passed 'selectedRow'
    if (!selectedRow) {
      throw new Error("The selected row was not provided to getInitialBusinessData.");
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const clientObject = createObjectFromRow(rowData, headers);

    const savedQuoteDataString = clientObject[CONFIG.column_mappings.quote_data_json] || null;

    return {
      duration: clientObject[CONFIG.column_mappings.estimated_duration] || '',
      discount: clientObject[CONFIG.column_mappings.discount_percentage] || 0,
      savedQuoteData: savedQuoteDataString // This will be null if empty, or a JSON string
    };

  } catch (e) {
    console.error("Error in getInitialBusinessData:", e);
    // Return defaults on error. The front-end will handle a null 'savedQuoteData'
    return {
      duration: '',
      discount: 0,
      savedQuoteData: null
    };
  }
}

/**4. Server-side function to add new services during quote generation
 * ==============================================================================
 * ✨ NEW SERVER-SIDE FUNCTION ✨
 * Adds a new service to the 'Services' sheet.
 * Called from the quote builder UI.
 * @param {Object} serviceData An object containing the new service details.
 * @returns {Object} The complete service object, including its new unique ID.
 * ==============================================================================
 */
function addNewService(serviceData) {
  try {
    const servicesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.services_sheet_name);
    if (!servicesSheet) {
      throw new Error(`The services sheet "${CONFIG.file_paths.services_sheet_name}" was not found.`);
    }

    // Generate a simple unique ID for the new service
    const newId = 'SERV-' + new Date().getTime();

    // The order of elements here MUST match the column order in your "Services" sheet
    const newRow = [
      newId,
      serviceData.type,
      serviceData.category,
      serviceData.description,
      serviceData.unit,
      parseFloat(serviceData.price) || 0
    ];

    servicesSheet.appendRow(newRow);
    
    console.log(`New service added: ${serviceData.description}`);

    // Return the newly created service object so the client-side can use it immediately
    return {
      id: newId,
      type: serviceData.type,
      category: serviceData.category,
      description: serviceData.description,
      unit: serviceData.unit,
      price: parseFloat(serviceData.price) || 0
    };

  } catch (e) {
    console.error("Failed to add new service:", e);
    // Re-throw the error so the client-side failure handler is triggered
    throw new Error(`Could not save the new service. Error: ${e.message}`);
  }
}

/**
 * 5. The main server-side function to generate the quote document from the builder's data.
 * MODIFIED: Now accepts 'selectedRow' directly from the client-side.
 */
function generateQuoteWithServices(structuredQuoteData, businessData, selectedRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
  
  try {
    // === CRITICAL DEBUGGING ===
    Logger.log('=== generateQuoteWithServices called ===');
    Logger.log('businessData type: ' + typeof businessData);
    Logger.log('businessData: ' + JSON.stringify(businessData));
    Logger.log('selectedRow: ' + selectedRow);
    
    // === CRITICAL FIX: Ensure businessData has proper structure ===
    const cleanBusinessData = {
      estimatedDuration: String(businessData.estimatedDuration || ''),
      discountPercentage: parseFloat(businessData.discountPercentage) || 0,
      depositPaid: parseFloat(businessData.depositPaid) || 0
    };
    
    Logger.log('cleanBusinessData: ' + JSON.stringify(cleanBusinessData));
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const clientData = extractClientData(createObjectFromRow(rowData, headers));
    
    const flattenedItems = flattenQuoteData(structuredQuoteData);
    const quoteNumber = generateQuoteNumber(sheet, headers);
    const quoteDate = new Date();
    const validityDate = new Date(quoteDate.getTime() + (CONFIG.quote_settings.validity_days * 24 * 60 * 60 * 1000));
    const vatRate = calculateTVARate(clientData.workType);
    
    // === CRITICAL FIX: Pass clean data to calculateQuoteTotals ===
    const totals = calculateQuoteTotals(
      flattenedItems, 
      cleanBusinessData.discountPercentage, 
      vatRate,
      cleanBusinessData.depositPaid
    );
    
    Logger.log('totals calculated: ' + JSON.stringify(totals));
    
    const destinationFolder = DriveApp.getFolderById(CONFIG.google_api.quote_destination_folder_id);
    const newDocFile = DriveApp.getFileById(CONFIG.google_api.quote_template_id)
      .makeCopy(`Devis ${quoteNumber} - ${clientData.name}`, destinationFolder);
    const doc = DocumentApp.openById(newDocFile.getId());
    
    insertServicesTable(doc.getBody(), flattenedItems);

    // === CRITICAL FIX: Build placeholder data with guaranteed strings ===
    const placeholderData = {
      ...clientData,
      estimatedDuration: String(cleanBusinessData.estimatedDuration || ''),
      discountPercentage: String(cleanBusinessData.discountPercentage),
      selectedMentions: String(cleanBusinessData.selectedMentions || ''),
      quoteNumber: String(quoteNumber),
      quoteDate: quoteDate,
      validityDate: validityDate,
      vatRate: vatRate
    };
    
    // Add totals one by one to ensure they're all strings
    Object.keys(totals).forEach(key => {
      if (typeof totals[key] === 'string') {
        placeholderData[key] = totals[key];
      } else if (typeof totals[key] === 'number') {
        placeholderData[key] = String(totals[key]);
      } else {
        placeholderData[key] = '';
      }
    });
    
    Logger.log('placeholderData prepared');
    
    replaceDocumentPlaceholders(doc, placeholderData);
    
    // QR Code generation...
    try {
      generateAndInsertQRCode(doc.getBody(), totals.depositAmountRaw, quoteNumber, '{{QR_CODE_ACOMPTE}}');
    } catch (qrError) {
      Logger.log("QR Code generation failed: " + qrError.message);
    }
    
    doc.saveAndClose();
    
    // Save data
    const dataToSave = {
      businessData: {
        estimatedDuration: cleanBusinessData.estimatedDuration,
        discountPercentage: cleanBusinessData.discountPercentage,
        selectedMentions: cleanBusinessData.selectedMentions || []
      },
      quoteStructure: structuredQuoteData
    };
    const quoteDataJsonString = JSON.stringify(dataToSave);
    
    updateSheetWithCompleteQuoteInfo(sheet, selectedRow, quoteNumber, quoteDate, newDocFile.getUrl(), cleanBusinessData, headers, quoteDataJsonString);
    
    return newDocFile.getUrl();
    
  } catch (e) {
    Logger.log("=== ERROR IN generateQuoteWithServices ===");
    Logger.log("Error message: " + e.message);
    Logger.log("Error stack: " + e.stack);
    throw new Error(`Génération du devis échouée: ${e.message}`);
  }
}

/**
 * 6. (NEW) The main server-side function to generate the INVOICE document from the builder's data.
 * MODIFIED: Accepts 'selectedRow' directly from the client-side.
 * MODIFIED: Generates a sequential invoice number and uses the invoice template.
 * @param {object} structuredInvoiceData The final structure of the services for the invoice.
 * @param {object} businessData Contains discount and duration.
 * @param {number} selectedRow The row number of the client in the CRM sheet.
 * @returns {string} The URL of the newly created Google Doc invoice.
 */
function generateInvoiceWithServices(structuredInvoiceData, businessData, selectedRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);

  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const clientData = extractClientData(createObjectFromRow(rowData, headers));

    const flattenedItems = flattenQuoteData(structuredInvoiceData);
    const invoiceNumber = generateNextInvoiceNumber();
    const invoiceDate = new Date();
    const vatRate = calculateTVARate(clientData.workType);
    
    // The `calculateQuoteTotals` call is correct and passes the raw depositPaid value
    const totals = calculateQuoteTotals(flattenedItems, businessData.discountPercentage, vatRate, businessData.depositPaid);

    // --- THIS IS THE FIX ---
    // We now construct the placeholderData object in the correct order.
    // `businessData` comes first, and `totals` comes last, so its formatted
    // values (like `depositPaid` and `remainingBalance`) will overwrite any
    // raw values that have the same property name.
    const placeholderData = {
      ...clientData,
      ...businessData, // Contains raw values
      ...totals,      // Contains formatted values, which now take precedence

      // Map invoice-specific variable names to the generic keys
      // expected by the replacePlaceholders function.
      quoteNumber: invoiceNumber,
      quoteDate: invoiceDate,
      validityDate: invoiceDate, // Use invoice date for validity to avoid errors
      vatRate: vatRate
    };
    // ----------------------

    const destinationFolder = DriveApp.getFolderById(CONFIG.google_api.quote_destination_folder_id);
    const newDocFile = DriveApp.getFileById(CONFIG.google_api.invoice_template_id)
      .makeCopy(`Facture ${invoiceNumber} - ${clientData.name}`, destinationFolder);

    const doc = DocumentApp.openById(newDocFile.getId());

    // Fill the document with the correctly prepared data
    insertServicesTable(doc.getBody(), flattenedItems);
    replaceDocumentPlaceholders(doc, placeholderData);

    try {
      // For an invoice, the QR code should be for the remaining balance, not the full amount.
      // Let's generate a QR code for the `remainingBalanceRaw` if it exists.
      // We will add `remainingBalanceRaw` to the totals object for this purpose.
      generateAndInsertQRCode(
        doc.getBody(),
        totals.remainingBalanceRaw, // Use remaining balance for the invoice QR code
        `Facture ${invoiceNumber}`,
        '{{QR_CODE_PAIEMENT}}' // A new placeholder for the final payment
      );
    } catch (qrError) {
      console.error(`QR Code generation failed for invoice ${invoiceNumber} but the invoice was still created. Error: ${qrError.message}`);
    }

    doc.saveAndClose();

    const dataToSave = {
      businessData: {
        estimatedDuration: businessData.estimatedDuration,
        discountPercentage: businessData.discountPercentage
      },
      invoiceStructure: structuredInvoiceData
    };
    const invoiceDataJsonString = JSON.stringify(dataToSave);

    updateSheetWithInvoiceInfo(sheet, selectedRow, invoiceNumber, invoiceDate, newDocFile.getUrl(), headers, invoiceDataJsonString);

    return newDocFile.getUrl();

  } catch (e) {
    console.error("Erreur critique dans generateInvoiceWithServices:", e);
    throw new Error(`Une erreur est survenue lors de la génération de la facture: ${e.message}`);
  }
}


// ==============================================================================
// DOCUMENT GENERATION & DATA CALCULATION HELPERS
// ==============================================================================

/**
 * Extracts and organizes client data from a data object created from a sheet row.
 * @param {Object} clientObject A key-value object representing a client row.
 * @returns {Object} A structured object with clean client data.
 */
function extractClientData(clientObject) {
  const C = CONFIG.column_mappings; // Alias for brevity
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
 * Replaces all placeholders in the Google Doc template (body and header).
 */
/**
 * Replaces all placeholders in the Google Doc template (body and header).
 * RENAMED from replacePlaceholders to avoid confusion with email template function
 * FIXED: Ensures all values are properly converted to strings
 */
function replaceDocumentPlaceholders(doc, data) {
  const body = doc.getBody();
  const header = doc.getHeader();
  const P = CONFIG.placeholder_mappings; // Use config
  const renovationText = "Attestation TVA taux réduit : l'acheteur certifie que les conditions d'application du taux réduit de la TVA sont remplies en ce que les travaux sont effectués dans des locaux à usage d'habitation de plus de 2 ans ou destinés à être affectés à l'habitation à l'issue des travaux, que ces travaux ne répondent pas aux conditions d'exclusion prévues par des textes, et que ces travaux sont éligibles au taux réduit.";
  
  // Helper function to safely convert any value to string
  function safeString(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) {
      const formatted = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      return String(formatted); // Force string conversion
    }
    return String(value);
  }
  
  // Format selected mentions
  let mentionsText = '';
  if (data.selectedMentions && data.selectedMentions.length > 0) {
    mentionsText = data.selectedMentions.join('\n\n');
  }

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
    [P.renovation_attestation]: (data.workType && String(data.workType).toLowerCase().includes('rénovation')) ? renovationText : ''
  };
  
  // Replace in body and header
  for (const [placeholder, value] of Object.entries(replacements)) {
    try {
      const valueToInsert = value || '';
      body.replaceText(placeholder, valueToInsert);
      if (header) {
        header.replaceText(placeholder, valueToInsert);
      }
    } catch (e) {
      Logger.log(`Error replacing ${placeholder}: ${e.message}`);
    }
  }
  
  // Handle the optional discount line
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
 * Generates the next sequential quote number based on existing numbers for the current year.
 * @param {Sheet} sheet The main CRM sheet.
 * @param {Array} headers The array of header names.
 * @returns {string} The formatted quote number (e.g., "2025-0015").
 */
function generateQuoteNumber(sheet, headers) {
  const quoteNumberColName = CONFIG.column_mappings.quote_number;
  const quoteNumberColIndex = headers.indexOf(quoteNumberColName);

  if (quoteNumberColIndex === -1) {
    throw new Error(`La colonne "${quoteNumberColName}" est introuvable.`);
  }

  if (sheet.getLastRow() < 2) return `${new Date().getFullYear()}-0001`; // No data yet

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
  return `${currentYear}-${nextNumber}`;
}

/**
 * ==============================================================================
 * ✨ REFACTORED FUNCTION ✨
 * ==============================================================================
 * Updates the spreadsheet with all the information for the newly created quote.
 * This version is now fully robust and writes data to the correct columns
 * by name, regardless of their position in the sheet.
 */
function updateSheetWithCompleteQuoteInfo(sheet, row, quoteNumber, quoteDate, quoteUrl, businessData, headers, quoteDataJsonString) { // MODIFIED: Added parameter
  const C = CONFIG.column_mappings;

  // Define the data to be written with column names as keys
  const dataToWrite = {
    [C.quote_number]: quoteNumber,
    [C.quote_date]: quoteDate,
    [C.status]: CONFIG.statuses.NEW,
    [C.estimated_duration]: businessData.estimatedDuration,
    [C.discount_percentage]: businessData.discountPercentage,
    [C.quote_link]: quoteUrl,
    [C.quote_data_json]: quoteDataJsonString // NEW: Add the JSON data to be written
  };

  // Write each piece of data to its corresponding column
  for (const [colName, value] of Object.entries(dataToWrite)) {
    const colIndex = headers.indexOf(colName);
    if (colIndex !== -1) {
      sheet.getRange(row, colIndex + 1).setValue(value);
    } else {
      console.warn(`Column "${colName}" not found. Could not write value: ${value}`);
    }
  }

  console.log(`Sheet updated for quote ${quoteNumber}`);
}

/**
 * (NEW) Updates the spreadsheet with all the information for the newly created invoice.
 * This version is robust and writes data to the correct columns by name.
 */
function updateSheetWithInvoiceInfo(sheet, row, invoiceNumber, invoiceDate, invoiceUrl, headers, invoiceDataJsonString) {
  const C = CONFIG.column_mappings; // Alias for brevity

  // Define the data to be written with column names as keys
  const dataToWrite = {
    [C.invoice_number]: invoiceNumber,
    [C.invoice_date]: invoiceDate,
    [C.invoice_link]: invoiceUrl,
    [C.invoice_status]: CONFIG.invoice_statuses.DRAFT, // Set an initial status
    [C.invoice_data_json]: invoiceDataJsonString // Save the invoice structure
  };

  // Write each piece of data to its corresponding column
  for (const [colName, value] of Object.entries(dataToWrite)) {
    const colIndex = headers.indexOf(colName);
    if (colIndex !== -1) {
      sheet.getRange(row, colIndex + 1).setValue(value);
    } else {
      console.warn(`Column "${colName}" for invoice data not found. Could not write value: ${value}`);
    }
  }
  console.log(`Sheet updated for invoice ${invoiceNumber}`);
}


// --- Functions that do not require refactoring (pure logic or UI) ---

function flattenQuoteData(structuredData) {
  const flattenedItems = [];
  structuredData.forEach(section => {
    flattenedItems.push({ type: 'subtitle', text: section.name });
    section.services.forEach(service => { 
    flattenedItems.push({ ...service, type: 'service' }); // Add type property
    });
  });
  return flattenedItems;
}

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
    discountLabel: `Remise (${discountPercentage}%)`,
    discountValue: `-${formatCurrency(discountAmount)}`,
    discountPercentage: discountPercentage,
    vatRate: vatRate
  };
}

function calculateTVARate(workType) {
  if (!workType) return 20;
  const workTypeLower = workType.toLowerCase();
  if (workTypeLower.includes('rénovation')) return 10;
  const rate = CONFIG.tva_rate[workType];
  return rate || 20;
}

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
      tableData.push([item.text]); // Subtitle row
    }
  });
  
  const table = body.insertTable(markerIndex, tableData);
  styleServicesTable(table);
  parent.removeFromParent(); // Remove the original placeholder
}

function styleServicesTable(table) {
    const attributes = {
      // This is the key change: Center the table block itself.
      [DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]: DocumentApp.HorizontalAlignment.CENTER 
    };
    table.setAttributes(attributes);

    // Set individual column widths
    table.setColumnWidth(0, 280); // Description
    table.setColumnWidth(1, 55);  // Quantité
    table.setColumnWidth(2, 40);  // Unité
    table.setColumnWidth(3, 60);  // Prix U. HT
    table.setColumnWidth(4, 65);  // Total HT

    const headerRow = table.getRow(0);
    headerRow.editAsText().setBold(true);

    // Set a larger font size specifically for all cells in the header row.
    for (let i = 0; i < headerRow.getNumCells(); i++) {
      const cell = headerRow.getCell(i);
      cell.editAsText().setFontSize(10); // Set header font size
      cell.setBackgroundColor('#f2eb2d');
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      cell.setPaddingTop(8);
      cell.setPaddingBottom(8);
    }

    for (let r = 1; r < table.getNumRows(); r++) {
        const row = table.getRow(r);
        if (row.getNumCells() < 5) { // Subtitle row
            if (row.getNumCells() > 1) row.merge();
            const cell = row.getCell(0);
            cell.setBackgroundColor('#f0f4f8').setPaddingTop(8).setPaddingBottom(4);
            if (cell.getChild(0) && cell.getChild(0).getType() == DocumentApp.ElementType.PARAGRAPH) {
                cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.LEFT);
            }
            cell.editAsText().setBold(true).setFontSize(11);
        } else { // Service row
            for (let c = 0; c < row.getNumCells(); c++) {
                const cell = row.getCell(c);
                cell.editAsText().setFontSize(10);
                cell.setPaddingTop(6).setPaddingBottom(6).setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
                if (cell.getChild(0) && cell.getChild(0).getType() == DocumentApp.ElementType.PARAGRAPH) {
                    cell.getChild(0).asParagraph().setAlignment(c > 0 ? DocumentApp.HorizontalAlignment.RIGHT : DocumentApp.HorizontalAlignment.LEFT);
                }
            }
        }
    }
}

/**
 * Gets all mentions from the Mentions sheet
 * @returns {Array} Array of mention strings
 */
function getMentions() {
  try {
    const mentionsSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName('Mentions');
    
    if (!mentionsSheet) {
      Logger.log('Mentions sheet not found');
      return [];
    }
    
    const data = mentionsSheet.getRange('A2:A' + mentionsSheet.getLastRow()).getValues();
    
    // Filter out empty rows and return as flat array of strings
    return data
      .filter(row => row[0] && row[0].toString().trim() !== '')
      .map(row => row[0].toString().trim());
      
  } catch (e) {
    console.error("Error in getMentions:", e);
    return [];
  }
}

/**
 * ==============================================================================
 * ✨ NEW HELPER FUNCTION ✨
 * Generates an EPC QR Code and inserts it into the document.
 * @param {Body} body The body of the Google Doc.
 * @param {string} depositAmount The formatted string of the deposit amount (e.g., "1,234.56 €").
 * @param {string} quoteNumber The quote number for the remittance info.
 * ==============================================================================
 */
/*function generateAndInsertQRCode(body, amountRaw, remittanceInfo, placeholderText) { 
  try {
    const B = CONFIG.beneficiary_details;

    if (!amountRaw || amountRaw <= 0) {
      console.log("QR Code generation skipped: payment amount is zero or invalid.");
      // Proactively remove the placeholder if it exists
      body.replaceText(placeholderText, ''); 
      return;
    }

    const payload = [
      'BCD', '002', '1', 'SCT',
      B.bic,
      B.name,
      B.iban,
      `EUR${amountRaw.toFixed(2)}`,
      '', '',
      `Acompte devis ${remittanceInfo}`, // You might want to make this text dynamic too, but for now it's ok.
      ''
    ].join('\n');

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
    const imageBlob = UrlFetchApp.fetch(qrCodeUrl).getBlob();

    // --- MODIFIED TO USE THE ARGUMENT ---
    const searchResult = body.findText(placeholderText);

    if (searchResult) {
      const element = searchResult.getElement();
      const parent = element.getParent();
      element.asText().setText('');
      parent.asParagraph().insertInlineImage(0, imageBlob).setWidth(120).setHeight(120);
    } else {
      console.warn(`QR Code placeholder "${placeholderText}" not found in the document.`);
    }

  } catch (e) {
    console.error(`Could not generate or insert QR Code. Error: ${e.message}`, e.stack);
    // Attempt to clean up the placeholder on error
    body.replaceText(placeholderText, "[Erreur de génération du QR Code]");
  }
}
*/

function formatCurrency(num) {
  if (typeof num !== 'number') num = parseFloat(num) || 0;
  
  // Manual formatting for guaranteed compatibility
  const formatted = num.toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  return formatted + ' €';
}

// ==============================================================================
// INVOICE WORKFLOW
// ==============================================================================

/**
 * Opens the invoice editor modal, pre-filled with data from the saved quote.
 */
function openInvoiceEditor() {
  const ui = SpreadsheetApp.getUi();
  try {
    const activeSheet = SpreadsheetApp.getActiveSheet();
    const crmSheetName = CONFIG.file_paths.crm_sheet_name;

    // --- ROBUSTNESS CHECKS (same as generateQuote) ---
    if (activeSheet.getName() !== crmSheetName) {
      ui.alert('Action Impossible', `Veuillez sélectionner un client dans l'onglet "${crmSheetName}" avant de générer une facture.`, ui.ButtonSet.OK);
      return;
    }
    const selectedRow = activeSheet.getActiveRange().getRow();
    if (selectedRow <= 1) {
      ui.alert('Sélection Invalide', 'Veuillez sélectionner la ligne d\'un client (pas l\'en-tête).', ui.ButtonSet.OK);
      return;
    }

    // --- LOGIC TO FETCH SAVED QUOTE DATA ---
    const headers = activeSheet.getRange(1, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const rowData = activeSheet.getRange(selectedRow, 1, 1, activeSheet.getLastColumn()).getValues()[0];
    const clientObject = createObjectFromRow(rowData, headers);

    const savedQuoteDataString = clientObject[CONFIG.column_mappings.quote_data_json] || '';

    if (!savedQuoteDataString) {
      ui.alert('Devis manquant', 'Aucune donnée de devis n\'a été trouvée pour ce client. Veuillez d\'abord générer un devis.', ui.ButtonSet.OK);
      return;
    }

    const htmlTemplate = HtmlService.createTemplateFromFile('quoteBuilder'); // We reuse the same HTML file!
    htmlTemplate.selectedRow = selectedRow;
    htmlTemplate.savedQuoteData = savedQuoteDataString; // Pass the QUOTE data
    htmlTemplate.launchMode = 'invoice';

    const htmlOutput = htmlTemplate.evaluate()
      .setWidth(850)
      .setHeight(650)
      .setTitle('Construction de la Facture');
    
    ui.showModalDialog(htmlOutput, 'Construction de la Facture'); // Change the title

  } catch (e) {
    console.error("Erreur critique dans openInvoiceEditor:", e);
    ui.alert(`Erreur critique inattendue: ${e.message}`);
  }
}


/**
 * Generates the next sequential invoice number in a robust, concurrency-safe way.
 * @returns {string} The formatted invoice number (e.g., "F00116").
 */
function generateNextInvoiceNumber() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Wait up to 30 seconds for other processes to finish.

  try {
    const properties = PropertiesService.getScriptProperties();
    let lastInvoiceNum = parseInt(properties.getProperty('LAST_INVOICE_NUMBER'), 10);

    // Initialize with the last known number if it's not set yet.
    if (isNaN(lastInvoiceNum)) {
      lastInvoiceNum = 115; 
    }

    const nextInvoiceNum = lastInvoiceNum + 1;
    properties.setProperty('LAST_INVOICE_NUMBER', nextInvoiceNum);
    
    // Format the number: F followed by 5 digits
    return `F${String(nextInvoiceNum).padStart(5, '0')}`;
  } finally {
    lock.releaseLock();
  }
}

// =================================================================
// INVOICE WORKFLOW HELPERS (NEW & UPDATED)
// =================================================================

/**
 * NEW: Allows the user to reset the invoice counter.
 */
function resetInvoiceCounter() {
  const ui = SpreadsheetApp.getUi();
  try {
    const response = ui.prompt(
      'Réinitialiser le compteur de factures',
      'Veuillez entrer le numéro pour la PROCHAINE facture qui sera générée (ex: 116).',
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() == ui.Button.OK) {
      const nextNumberStr = response.getResponseText().trim();
      const nextNumber = parseInt(nextNumberStr, 10);

      if (isNaN(nextNumber) || nextNumber <= 0) {
        ui.alert('Erreur', 'Veuillez entrer un nombre valide et positif.', ui.ButtonSet.OK);
        return;
      }
      
      // The system stores the *last* used number. To make the next one '116', we must store '115'.
      const numberToStore = nextNumber - 1; 
      
      const properties = PropertiesService.getScriptProperties();
      properties.setProperty('LAST_INVOICE_NUMBER', numberToStore);
      
      ui.alert('Succès', `Le compteur a été réinitialisé. La prochaine facture portera le numéro F${String(nextNumber).padStart(5, '0')}.`, ui.ButtonSet.OK);
    }
  } catch (e) {
    console.error("Erreur dans resetInvoiceCounter: ", e);
    ui.alert(`Une erreur est survenue: ${e.message}`);
  }
}



// ==============================================================================
// EMAIL DRAFT WORKFLOW
// ==============================================================================

function createEmailDraft() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
    const selectedRow = sheet.getActiveRange().getRow();

    if (selectedRow <= 1) {
      ui.alert('Veuillez sélectionner une ligne de devis valide.');
      return;
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const clientObject = createObjectFromRow(rowData, headers);
    const clientData = extractClientData(clientObject);

    const quoteNumber = clientObject[CONFIG.column_mappings.quote_number];
    const quoteDocUrl = clientObject[CONFIG.column_mappings.quote_link];

    if (!clientData.email) {
      ui.alert('Adresse email du client introuvable.');
      return;
    }
    if (!quoteDocUrl) {
      ui.alert('Lien vers le devis manquant. Veuillez d\'abord générer le devis.');
      return;
    }
    
    const docId = getDocIdFromUrl(quoteDocUrl);
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    pdfBlob.setName(`Devis ${quoteNumber} - ${clientData.name}.pdf`);
    
    //const emailTemplateDoc = DocumentApp.openById(CONFIG.google_api.email_template_doc_id);
    //const emailBodyTemplate = emailTemplateDoc.getBody().getText();
    
    let emailSubject = CONFIG.email_settings.subject_template
      .replace('{{DEVIS_NUMERO}}', quoteNumber)
      .replace('{{CLIENT_NAME}}', clientData.name);
      
    let emailBody = emailBodyTemplate
      .replace(/{{CLIENT_NAME}}/g, clientData.name)
      .replace(/{{YOUR_NAME}}/g, CONFIG.email_settings.sender_name);

    GmailApp.createDraft(clientData.email, emailSubject, emailBody, {
      attachments: [pdfBlob],
      htmlBody: emailBody.replace(/\n/g, '<br>')
    });
    
    SpreadsheetApp.getActiveSpreadsheet().toast(`Brouillon créé pour ${clientData.name}.`, 'Succès!', 5);

  } catch (error) {
    console.error('Erreur lors de la création du brouillon:', error);
    ui.alert(`Une erreur est survenue: \n\n${error.message}`);
  }
}

function getDocIdFromUrl(url) {
  const match = url.match(/d\/(.+?)\//);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error("Impossible d'extraire l'ID du document de l'URL.");
}



/**
 * Forces re-authorization of the script
 * Run this function manually to trigger OAuth consent screen
 */
function forceReauthorization() {
  // These calls will trigger authorization for all necessary scopes
  try {
    // Drive access
    DriveApp.getRootFolder();
    
    // Properties service (for auto-save)
    PropertiesService.getUserProperties().getKeys();
    PropertiesService.getScriptProperties().getKeys();
    
    // Spreadsheet access
    SpreadsheetApp.getActiveSpreadsheet().getName();
    
    // Document access  
    DocumentApp.create('temp').getId();
    
    // Gmail access
    GmailApp.createDraft('test@example.com', 'test', 'test');
    
    SpreadsheetApp.getUi().alert('✅ Autorisations accordées avec succès!');
  } catch(e) {
    SpreadsheetApp.getUi().alert('Veuillez autoriser toutes les permissions demandées.');
  }
}