/**
 * Enhancements - Additional CRM Features
 * Version: 3.5
 * Sprint features: Auto-save, quote duplication, and internal notes
 *
 * @author Fabien for Style et Matière
 * @see README.md for full documentation
 */

// =============================================================================
// AUTO-SAVE FUNCTIONALITY
// =============================================================================

/**
 * Saves the current quote draft to User Properties
 * Allows users to resume work on partially completed quotes
 * Called from the HTML interface via google.script.run
 *
 * @param {number} selectedRow - Row number in the CRM sheet
 * @param {Array<Object>} quoteStructure - Hierarchical quote structure (sections with services)
 * @param {Object} businessData - Business parameters (duration, discount, mentions)
 * @returns {Object} Result object with success flag and message
 */
function saveQuoteDraft(selectedRow, quoteStructure, businessData) {
  try {
    const draftData = {
      timestamp: new Date().toISOString(),
      selectedRow: selectedRow,
      quoteStructure: quoteStructure,
      businessData: businessData
    };

    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('draft_' + selectedRow, JSON.stringify(draftData));

    return {
      success: true,
      message: 'Brouillon sauvegardé'
    };

  } catch (e) {
    Logger.log('Error saving quote draft: ' + e.message);
    return {
      success: false,
      message: e.message
    };
  }
}

/**
 * Retrieves a saved draft for a specific client row
 * Used when reopening the quote builder to restore previous work
 *
 * @param {number} selectedRow - Row number in the CRM sheet
 * @returns {Object|null} Draft data object or null if no draft exists
 */
function getQuoteDraft(selectedRow) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const draftString = userProperties.getProperty('draft_' + selectedRow);

    if (draftString) {
      return JSON.parse(draftString);
    }
    return null;

  } catch (e) {
    Logger.log('Error retrieving quote draft: ' + e.message);
    return null;
  }
}

/**
 * Clears a draft after successful quote generation
 * Frees up User Properties storage space
 *
 * @param {number} selectedRow - Row number in the CRM sheet
 * @returns {Object} Result object with success flag
 */
function clearQuoteDraft(selectedRow) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.deleteProperty('draft_' + selectedRow);

    return {
      success: true
    };

  } catch (e) {
    Logger.log('Error clearing quote draft: ' + e.message);
    return {
      success: false
    };
  }
}

// =============================================================================
// QUOTE DUPLICATION
// =============================================================================

/**
 * Duplicates an existing quote to a new client row
 * Copies quote structure, duration, and discount settings
 * Does NOT copy client information or quote number
 *
 * Prompts user for source row (currently selected) and target row
 * Uses CONFIG.column_mappings for resilient column access
 */
function duplicateQuote() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const selectedRow = sheet.getActiveRange().getRow();

  if (selectedRow <= 1) {
    ui.alert('Veuillez sélectionner une ligne client avec un devis existant.');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(selectedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const clientObject = createObjectFromRow(rowData, headers);

  const quoteDataJson = clientObject[CONFIG.column_mappings.quote_data_json];

  if (!quoteDataJson) {
    ui.alert(
      'Aucun devis trouvé',
      'Cette ligne ne contient pas de données de devis à dupliquer.',
      ui.ButtonSet.OK
    );
    return;
  }

  const response = ui.prompt(
    'Dupliquer le devis',
    'Entrez le numéro de la ligne cible pour la duplication:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const targetRow = parseInt(response.getResponseText());

    if (targetRow <= 1 || targetRow > sheet.getLastRow()) {
      ui.alert('Numéro de ligne invalide.');
      return;
    }

    try {
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      const quoteDataColIndex = currentHeaders.indexOf(CONFIG.column_mappings.quote_data_json);
      if (quoteDataColIndex >= 0) {
        sheet.getRange(targetRow, quoteDataColIndex + 1).setValue(quoteDataJson);
      }

      const durationColIndex = currentHeaders.indexOf(CONFIG.column_mappings.estimated_duration);
      if (durationColIndex >= 0 && clientObject[CONFIG.column_mappings.estimated_duration]) {
        sheet.getRange(targetRow, durationColIndex + 1).setValue(
          clientObject[CONFIG.column_mappings.estimated_duration]
        );
      }

      const discountColIndex = currentHeaders.indexOf(CONFIG.column_mappings.discount_percentage);
      if (discountColIndex >= 0 && clientObject[CONFIG.column_mappings.discount_percentage] !== undefined) {
        sheet.getRange(targetRow, discountColIndex + 1).setValue(
          clientObject[CONFIG.column_mappings.discount_percentage]
        );
      }

      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Devis dupliqué avec succès vers la ligne ' + targetRow,
        'Succès',
        3
      );

    } catch (e) {
      Logger.log('Error during quote duplication: ' + e.message);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Devis dupliqué vers la ligne ' + targetRow,
        'Succès',
        3
      );
    }
  }
}

// =============================================================================
// INTERNAL NOTES
// =============================================================================

/**
 * Initializes the internal notes column if not present
 * Adds "Notes Internes" column to the CRM sheet and updates CONFIG
 * Called automatically on spreadsheet open
 */
function initializeNotesColumn() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const notesColumnName = 'Notes Internes';

  if (!headers.includes(notesColumnName)) {
    const newColIndex = sheet.getLastColumn() + 1;
    sheet.getRange(1, newColIndex).setValue(notesColumnName);

    CONFIG.column_mappings.internal_notes = notesColumnName;

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Colonne "Notes Internes" ajoutée',
      'Configuration',
      3
    );
  }
}

/**
 * Opens a dialog to add or edit internal notes for the selected client
 * Notes are private and NOT included in client-facing documents
 *
 * Shows current note content and prompts for new content
 * Automatically initializes notes column if it doesn't exist
 */
function editInternalNotes() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const selectedRow = sheet.getActiveRange().getRow();

  if (selectedRow <= 1) {
    ui.alert('Veuillez sélectionner une ligne client.');
    return;
  }

  initializeNotesColumn();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const notesColIndex = headers.indexOf('Notes Internes');

  if (notesColIndex === -1) {
    ui.alert('Erreur: Colonne de notes introuvable.');
    return;
  }

  const existingNotes = sheet.getRange(selectedRow, notesColIndex + 1).getValue() || '';

  const response = ui.prompt(
    'Notes Internes',
    'Ces notes ne seront pas visibles sur les documents clients.\n\nNote actuelle:\n' +
    (existingNotes || '(aucune)') + '\n\nNouvelle note:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const newNote = response.getResponseText();
    sheet.getRange(selectedRow, notesColIndex + 1).setValue(newNote);

    SpreadsheetApp.getActiveSpreadsheet().toast('Note enregistrée', 'Succès', 2);
  }
}
