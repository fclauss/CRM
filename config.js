/**
 * Configuration File - CRM Settings
 * Version: 3.5
 *
 * Centralizes all settings for the CRM application.
 * Edit values here to change templates, folders, or sheet names
 * without modifying the main application code.
 *
 * @author Fabien for Style et Matière
 * @see README.md for setup instructions
 *
 * IMPORTANT: After changing any IDs or sheet names, reload the spreadsheet
 * for changes to take effect.
 */

const CONFIG = {

  // ===========================================================================
  // GOOGLE DRIVE INTEGRATION
  // ===========================================================================
  // File and folder IDs from Google Drive
  // How to get IDs: Open the file/folder in Drive, copy ID from URL
  // Example URL: https://docs.google.com/document/d/FILE_ID_HERE/edit

  google_api: {
    // Template document for quote generation (Google Doc)
    quote_template_id: '1E18nJ6jtXGs0pjkfaYLjcXWrufzu1UQ1JOg4ubLYs28',

    // Folder where generated quote PDFs will be saved
    quote_destination_folder_id: '1xJR8IZY2-iFAZYij77SWCPj5SQ-8XF3C',

    // Template document for email generation (optional, currently unused)
    email_template_doc_id: '1I1CsMvMJ6ZyRHzqOEMkf0THoe7NBwpEIbtP0unRGw4Q',

    // Template document for invoice generation (Google Doc)
    invoice_template_id: '1V-l2zwbkCRxrHOudgZLnoApOSkSqXeGypxH3cUown0Q'
  },

  // ===========================================================================
  // PAYMENT INFORMATION
  // ===========================================================================
  // Beneficiary details for Swiss QR-bill generation on invoices
  // Update with your company's banking information

  beneficiary_details: {
    // Company name as it appears on bank account
    name: 'Style et Matière',

    // International Bank Account Number (IBAN format)
    iban: 'FR7615135090170800341513376',

    // Bank Identifier Code (BIC/SWIFT code)
    bic: 'CEPAFRPP513'
  },

  // ===========================================================================
  // SPREADSHEET CONFIGURATION
  // ===========================================================================
  // Names of sheets within your main CRM spreadsheet
  // Change these if you rename sheets in your Google Sheets file

  file_paths: {
    // Spreadsheet ID (needed for web app access)
    crm_sheet_id: '1W_NXSLvZ8ZdwL2OgUIZ6Kd9IdfzyBQeXucoA3qNrgL8',

    // Main sheet with client data (typically from Google Form responses)
    crm_sheet_name: 'Form Responses 1',

    // Sheet listing all services with descriptions and prices
    services_sheet_name: 'Services',

    // Sheet used for bulk client import (optional feature)
    import_sheet_name: 'Import_Clients'
  },

  // ===========================================================================
  // QUOTE SETTINGS
  // ===========================================================================
  // General settings for quote generation

  quote_settings: {
    // Number of days a quote remains valid (default: 90 days = 3 months)
    validity_days: 90
  },

  // ===========================================================================
  // EMAIL SETTINGS
  // ===========================================================================
  // Default sender information for email templates

  email_settings: {
    // Template for email subject line (with placeholder support)
    subject_template: 'Style et Matière - Devis n° {{DEVIS_NUMERO}} pour {{CLIENT_NAME}}',

    // Name that appears in email signature
    sender_name: 'Stéphane Mattel'
  },

  // ===========================================================================
  // COLUMN MAPPINGS
  // ===========================================================================
  // Maps logical field names to actual column headers in your CRM sheet
  // This makes the application resilient to column reordering
  //
  // IMPORTANT: Column header names must match EXACTLY (case-sensitive)
  // If you rename columns in your spreadsheet, update the values here

  column_mappings: {
    // Form submission metadata
    timestamp: 'Timestamp',                                     // When form was submitted
    request_type: 'Type de demande',                            // Type of client request
    client_type: 'Type de client',                              // Individual or professional

    // Client contact information
    client_name: 'Nom du Client / Raison Sociale',              // Client name or company name
    contact_principal: 'Nom du Contact Principal',              // Main contact person
    address: 'Adresse',                                         // Street address
    postal_code: 'Code Postale',                                // Postal/ZIP code
    city: 'Ville',                                              // City name
    client_email: 'Adresse Email',                              // Email address
    phone: 'Numero de Telephone',                               // Phone number

    // Project details
    project_details: 'Détail du Projet / Information complémentaires',  // Project description
    work_type: 'Type de travaux (pour calcul TVA)',             // Work type (determines VAT rate)
    referral_source: 'Comment avez-vous entendu parler de nous ?',  // How did you hear about us

    // Quote information
    quote_number: 'Devis N°',                                   // Generated quote number (YYYY-NNNN)
    quote_date: 'Date du Devis',                                // Date quote was generated
    status: 'Statut du Devis',                                  // Current quote status
    estimated_duration: 'Délai Estimé',                         // Estimated project duration
    discount_percentage: 'Pourcentage de remise',               // Discount % (0-100)
    quote_link: 'Lien vers le Devis',                           // URL to generated quote PDF
    quote_data_json: 'Quote Data (JSON)',                       // Complete quote structure (for duplication)

    // Project management
    project_start_date: 'Date Début Projet',                    // Actual project start date
    project_end_date: 'Date Fin Projet Prévue',                 // Projected end date
    project_value: 'Valeur du projet',                          // Total project value

    // Invoice information
    invoice_number: 'Facture N°',                               // Generated invoice number (F00001)
    invoice_date: 'Date de Facture',                            // Date invoice was generated
    invoice_link: 'Lien vers la Facture',                       // URL to generated invoice PDF
    invoice_status: 'Statut de la Facture',                     // Current invoice status
    invoice_data_json: 'Invoice Data (JSON)',                   // Complete invoice structure

    // Internal use
    internal_notes: 'Notes Internes',                           // Private notes (not on documents)
    status_history_json: 'Historique Statut (JSON)'             // Status change log (JSON array)
  },

  // ===========================================================================
  // STATUS VALUES
  // ===========================================================================
  // Standardized status values used throughout the application
  // These ensure consistency in status tracking and reporting

  // Quote lifecycle statuses
  statuses: {
    NEW: 'Nouveau',                // Initial status when quote is generated
    SENT: 'Devis envoyé',          // Quote has been sent to client
    WON: 'Projet gagné',           // Client accepted quote, project in progress
    COMPLETED: 'Terminé',          // Project completed successfully
    CANCELLED: 'Annulé'            // Quote declined or cancelled
  },

  // Invoice statuses
  invoice_statuses: {
    DRAFT: 'Brouillon',            // Invoice created but not sent
    SENT: 'Envoyée',               // Invoice sent to client
    PAID: 'Payée'                  // Invoice paid in full
  },

  // Work type options (displayed in UI)
  work_types: {
    RENOVATION: 'Rénovation (TVA 10%)',
    NEW_CONSTRUCTION: 'Construction neuve -2ans (TVA 20%)',
    SUBCONTRACTING: 'Sous-traitance (TVA 20%)',
    COLLECTIVITY: 'Collectivité (TVA 20%)'
  },

  // ===========================================================================
  // VAT (TVA) RATES
  // ===========================================================================
  // French VAT rates by work type
  // Renovation work in buildings >2 years old qualifies for reduced 10% rate
  // All other work types use standard 20% rate

  tva_rate: {
    'Rénovation (TVA 10%)': 10,
    'Construction neuve -2ans (TVA 20%)': 20,
    'Sous-traitance (TVA 20%)': 20,
    'Collectivité (TVA 20%)': 20
  },

  // ===========================================================================
  // EMAIL TEMPLATES
  // ===========================================================================
  // Default email templates for automated communications
  // Users can customize these via the dashboard or revert to defaults
  //
  // Available placeholders:
  // {{CLIENT_NAME}} - Client name
  // {{QUOTE_NUMBER}} - Quote number
  // {{WORK_TYPE}} - Type of work
  // {{TOTAL_AMOUNT}} - Total amount (formatted with currency)
  // {{DURATION}} - Estimated duration
  // {{VALIDITY_DATE}} - Quote expiration date
  // {{QUOTE_DATE}} - Quote creation date
  // {{DAYS_SINCE}} - Days since quote was sent
  // {{SENDER_NAME}} - Sender name (from email_settings)

  email_templates: {

    // Initial quote delivery email
    quote: {
      subject: 'Style et Matière - Devis n° {{QUOTE_NUMBER}} pour {{CLIENT_NAME}}',
      body: `Bonjour {{CLIENT_NAME}},

Suite à votre demande, veuillez trouver ci-joint le devis pour vos travaux de {{WORK_TYPE}}.

Ce devis est valable jusqu'au {{VALIDITY_DATE}}.

N'hésitez pas à me contacter si vous avez des questions ou si vous souhaitez des précisions complémentaires.

Je vous serais reconnaissant de bien vouloir me confirmer la bonne réception du document.
Merci pour l'intérêt que vous portez à mon entreprise.

Bien cordialement,

Stéphane Mattel
Gérant – Style et Matière
5, route de Lobsann
67250 Lampertsloch
Tél: 06.38.70.45.76`
    },

    // Follow-up/reminder email for pending quotes
    followup: {
      subject: 'Style et Matière - Relance devis n° {{QUOTE_NUMBER}}',
      body: `Bonjour {{CLIENT_NAME}},

Je me permets de revenir vers vous concernant le devis n° {{QUOTE_NUMBER}} que je vous ai envoyé le {{QUOTE_DATE}} pour vos travaux de {{WORK_TYPE}}.

**Rappel du devis:**
- Montant total TTC: {{TOTAL_AMOUNT}}
- Validité: {{VALIDITY_DATE}}

Avez-vous eu l'occasion de l'examiner ? Avez-vous des questions ou souhaitez-vous des précisions ?

Je reste à votre entière disposition pour en discuter.

Bien cordialement,

Stéphane Mattel
Gérant – Style et Matière
5, route de Lobsann
67250 Lampertsloch
Tél: 06.38.70.45.76`
    },

    // Post-project testimonial request email
    testimonial: {
      subject: 'Style et Matière - Merci pour votre confiance !',
      body: `Bonjour {{CLIENT_NAME}},

Je tenais à vous remercier pour votre confiance dans la réalisation de vos travaux de {{WORK_TYPE}}.

Ce fut un plaisir de travailler sur votre projet et j'espère que le résultat répond à vos attentes.

**Votre avis compte !**
Si vous êtes satisfait(e) du travail réalisé, un témoignage de votre part serait très précieux pour moi. Cela m'aiderait beaucoup à développer mon activité.

Vous pouvez répondre à ce message avec quelques mots sur:
- Votre satisfaction générale
- La qualité du travail
- Le respect des délais
- Notre collaboration

Je reste disponible si vous avez besoin de quoi que ce soit à l'avenir.

Avec toute ma reconnaissance,

Stéphane Mattel
Gérant – Style et Matière
5, route de Lobsann
67250 Lampertsloch
Tél: 06.38.70.45.76`
    }
  },

  // ===========================================================================
  // DOCUMENT PLACEHOLDER MAPPINGS
  // ===========================================================================
  // Placeholders used in Google Docs templates for quote and invoice generation
  // These are replaced with actual values during document generation
  //
  // IMPORTANT: These must match the placeholders in your template documents
  // Format: {{placeholder_name}} in documents
  //
  // To add a new placeholder:
  // 1. Add it to this object
  // 2. Add it to your template documents
  // 3. Add replacement logic in replaceDocumentPlaceholders() function

  placeholder_mappings: {
    // Document identification
    devis_numero: '{{devis_numero}}',                          // Quote/invoice number
    devis_date: '{{devis_date}}',                              // Generation date
    devis_validity_date: '{{devis_validity_date}}',            // Expiration date

    // Client information
    client_name: '{{client_name}}',                            // Client name
    client_address: '{{client_address}}',                      // Street address
    client_postal_code: '{{client_postal_code}}',              // Postal code
    client_city: '{{client_city}}',                            // City
    client_email: '{{client_email}}',                          // Email
    client_phone: '{{client_phone}}',                          // Phone

    // Project details
    work_type: '{{work_type}}',                                // Type of work
    estimated_duration: '{{estimated_duration}}',              // Project duration

    // Financial calculations
    sous_total_ht: '{{SOUS_TOTAL_HT}}',                       // Subtotal (excl. VAT)
    tva_taux: '{{TVA_TAUX}}',                                 // VAT rate percentage
    montant_tva: '{{MONTANT_TVA}}',                           // VAT amount
    total_ttc: '{{TOTAL_TTC}}',                               // Total (incl. VAT)
    montant_acompte: '{{MONTANT_ACOMPTE}}',                   // Deposit amount (30%)
    montant_acompte_verse: '{{MONTANT_ACOMPTE_VERSE}}',       // Deposit already paid
    solde_a_payer: '{{SOLDE_A_PAYER}}',                       // Remaining balance

    // Conditional sections
    renovation_attestation: '{{renovation_attestation}}',      // TVA attestation text (renovation only)
    mention_speciale: '{{MENTION_SPECIALE}}',                 // Special mentions/conditions

    // Discount handling (conditional display)
    ligne_remise: '{{LIGNE_REMISE}}',                         // Start discount section
    ligne_remise_end: '{{/LIGNE_REMISE}}',                    // End discount section
    ligne_remise_label: '{{LIGNE_REMISE_LABEL}}',             // Discount label with %
    ligne_remise_valeur: '{{LIGNE_REMISE_VALEUR}}'            // Discount amount
  },

  // ===========================================================================
  // WEB APP AUTHENTICATION
  // ===========================================================================
  // Authentication settings for standalone web app
  // Add email addresses of authorized users

  auth: {
    // Allowed users (must match Google account email)
    // IMPORTANT: Update these with actual email addresses
    allowed_users: [
      'fabien@optimal-ai.eu',        // Admin user (Fabien)
      'ms.styleetmatiere@gmail.com'  // User (Style et Matière)
    ],

    // Admin users (full access including settings and reset)
    admins: [
      'fabien@optimal-ai.eu'          // Fabien has admin access
    ],

    // Custom display names (optional)
    // If not specified, name is extracted from email
    user_names: {
      'fabien@optimal-ai.eu': 'Fabien',
      'ms.styleetmatiere@gmail.com': 'Stéphane'
    }
  }
};
