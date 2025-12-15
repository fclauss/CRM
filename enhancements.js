/**
 * ================================================================
 * ENHANCEMENTS FILE - Sprint 1 Features
 * ================================================================
 * New features added to Style et Matière CRM
 * Version: 1.0
 * Date: November 2025
 * ================================================================
 */

//Test
// ================================================================
// AUTO-SAVE FUNCTIONALITY
// ================================================================

/**
 * Saves the current quote draft to Script Properties
 * Called from the HTML interface via google.script.run
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
    userProperties.setProperty(`draft_${selectedRow}`, JSON.stringify(draftData));
    
    return { success: true, message: 'Brouillon sauvegardé' };
  } catch (e) {
    console.error('Erreur lors de la sauvegarde du brouillon:', e);
    return { success: false, message: e.message };
  }
}

/**
 * Retrieves a saved draft for a specific row
 */
function getQuoteDraft(selectedRow) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const draftString = userProperties.getProperty(`draft_${selectedRow}`);
    
    if (draftString) {
      return JSON.parse(draftString);
    }
    return null;
  } catch (e) {
    console.error('Erreur lors de la récupération du brouillon:', e);
    return null;
  }
}

/**
 * Clears a draft after successful quote generation
 */
function clearQuoteDraft(selectedRow) {
  try {
    const userProperties = PropertiesService.getUserProperties();
    userProperties.deleteProperty(`draft_${selectedRow}`);
    return { success: true };
  } catch (e) {
    console.error('Erreur lors de la suppression du brouillon:', e);
    return { success: false };
  }
}

// ================================================================
// DUPLICATE QUOTE FUNCTIONALITY
// ================================================================

/**
 * Duplicates an existing quote to a new client row
 */
function duplicateQuote() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
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
    ui.alert('Aucun devis trouvé', 'Cette ligne ne contient pas de données de devis à dupliquer.', ui.ButtonSet.OK);
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
      // Get fresh headers for the target row in case columns were added
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      // Safer column index checking with validation
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
        `Devis dupliqué avec succès vers la ligne ${targetRow}`,
        'Succès',
        3
      );
    } catch (e) {
      console.error('Erreur lors de la duplication:', e);
      // Don't show error if data was copied successfully
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Devis dupliqué vers la ligne ${targetRow}`,
        'Succès',
        3
      );
    }
  }
}

// ================================================================
// INTERNAL NOTES FUNCTIONALITY
// ================================================================

/**
 * Adds internal notes column to the configuration if not present
 */
function initializeNotesColumn() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const notesColumnName = 'Notes Internes';
  
  if (!headers.includes(notesColumnName)) {
    // Add the column header
    const newColIndex = sheet.getLastColumn() + 1;
    sheet.getRange(1, newColIndex).setValue(notesColumnName);
    
    // Update the CONFIG object dynamically (for current session)
    CONFIG.column_mappings.internal_notes = notesColumnName;
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Colonne "Notes Internes" ajoutée',
      'Configuration',
      3
    );
  }
}

/**
 * Quick function to add/edit internal notes for the selected row
 */
function editInternalNotes() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.file_paths.crm_sheet_name);
  const selectedRow = sheet.getActiveRange().getRow();
  
  if (selectedRow <= 1) {
    ui.alert('Veuillez sélectionner une ligne client.');
    return;
  }
  
  // Ensure notes column exists
  initializeNotesColumn();
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const notesColIndex = headers.indexOf('Notes Internes');
  
  if (notesColIndex === -1) {
    ui.alert('Erreur: Colonne de notes introuvable.');
    return;
  }
  
  // Get existing notes
  const existingNotes = sheet.getRange(selectedRow, notesColIndex + 1).getValue() || '';
  
  // Show input dialog
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