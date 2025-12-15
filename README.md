# CRM for Craftsmen

A comprehensive Customer Relationship Management system built with Google Apps Script, designed specifically for craftsmen and small construction/renovation businesses. This system integrates with Google Sheets, Docs, and Drive to manage the complete customer lifecycle from initial contact to invoicing.

## Overview

This CRM application streamlines business operations for craftsmen by automating quote generation, invoice creation, and email communications. Built for "Style et Matière", a French construction company, it provides a complete workflow management system that operates entirely within the Google Workspace ecosystem.

**Version:** 3.4
**Author:** Fabien for Style et Matière
**Runtime:** Google Apps Script (V8)
**Timezone:** Europe/Paris

---

## Key Features

### 1. Client Management
- Centralized client database via Google Forms integration
- Automatic data capture from form submissions
- Client type classification (individual, professional)
- Complete contact information management
- Internal notes system for private client information
- Request type tracking and categorization

### 2. Quote Generation
- Interactive visual quote builder interface
- Service catalog integration with automatic pricing
- Multiple work types with automatic TVA calculation:
  - Renovation: 10% TVA
  - New Construction: 20% TVA
  - Subcontracting: 20% TVA
  - Collectivity: 20% TVA
- Customizable discount system
- Estimated duration tracking
- Auto-save draft functionality
- Quote duplication feature for similar projects
- Automatic PDF generation from templates
- Quote versioning and history
- 90-day validity period (configurable)

### 3. Invoice Generation
- Invoice builder with deposit/balance tracking
- Swiss QR code generation for payments (QR-bill compliant)
- Automatic invoice numbering with counter management
- Multiple invoice statuses: Draft, Sent, Paid
- Links invoices to original quotes
- PDF generation with company branding

### 4. Email Automation
- Three email templates:
  - **Quote Email**: Initial quote delivery with customizable message
  - **Follow-up Email**: Automatic quote follow-up reminders
  - **Testimonial Request**: Post-project satisfaction surveys
- Template variable replacement system
- Draft email creation in Gmail
- Automatic attachment of quote/invoice PDFs

### 5. Dashboard & Analytics
- Real-time business metrics:
  - Monthly revenue tracking
  - Pending quotes value
  - Active projects count
  - Conversion rate statistics
- Required actions feed
- Recent activity timeline
- Status-based filtering and search

---

## Technical Architecture

### File Structure

```
CRM/
├── Code.js                 # Main application logic and core functions
├── config.js              # Centralized configuration file
├── modalController.js     # Dashboard backend functions
├── enhancements.js        # Additional features (auto-save, duplication, notes)
├── crmModal.html          # Main dashboard UI interface
├── quoteBuilder.html      # Quote generation interface
├── appsscript.json        # Apps Script manifest and OAuth scopes
└── .clasp.json           # Clasp deployment configuration
```

### Core Components

#### 1. Configuration System (`config.js`)
Centralized configuration management that eliminates hardcoded values throughout the application:

- **Google API Integration**: Template IDs and folder locations
- **Beneficiary Details**: Banking information for QR code generation
- **Sheet Mappings**: Dynamic column name resolution
- **Status Management**: Standardized status values
- **Email Templates**: Customizable message templates
- **Placeholder System**: Document generation variables

**Key Benefit**: Column-order independent data access. The system uses column names rather than indices, making it resilient to spreadsheet structure changes.

#### 2. Data Access Layer (`createObjectFromRow`)
Robust data access method that creates dictionary-like objects from spreadsheet rows:

```javascript
function createObjectFromRow(rowData, headers) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = rowData[index];
  });
  return obj;
}
```

This allows accessing data semantically: `clientObject[CONFIG.column_mappings.client_name]` instead of `rowData[3]`.

#### 3. Modal Interface System
Two-modal architecture:
- **CRM Dashboard** ([crmModal.html](crmModal.html)): Main control center with tabs for dashboard, client list, email automation
- **Quote Builder** ([quoteBuilder.html](quoteBuilder.html)): Interactive quote construction interface with drag-and-drop service selection

#### 4. Document Generation Pipeline
1. User fills quote builder with services and details
2. System collects data and calculates totals (HT, TVA, TTC)
3. Template document is copied from Google Drive
4. Placeholders are replaced with actual values
5. PDF is generated and stored in designated folder
6. Link is saved back to spreadsheet
7. JSON data is stored for future reference/duplication

#### 5. Auto-Save & Draft System
- Utilizes `PropertiesService.getUserProperties()` for draft persistence
- Automatic periodic saves during quote building
- Row-specific draft storage: `draft_${selectedRow}`
- Draft restoration on modal reopening
- Automatic cleanup after successful quote generation

---

## Installation & Setup

### Prerequisites
- Google Workspace account (Gmail, Drive, Sheets, Docs access)
- Google Apps Script project creation permissions
- Basic understanding of Google Drive file IDs

### Quick Setup

1. **Create a new Google Sheets spreadsheet** for your CRM database

2. **Set up the required sheets**:
   - Main sheet: "Form Responses 1" (or rename in config)
   - Services sheet: "Services" - List your services with pricing
   - Import sheet: "Import_Clients" (optional for bulk imports)

3. **Create template documents in Google Drive**:
   - Quote template (Google Doc)
   - Invoice template (Google Doc)
   - Email template (Google Doc) - optional
   - Destination folder for generated quotes
   - Destination folder for generated invoices

4. **Copy all script files** to your Apps Script project:
   - Extensions → Apps Script
   - Create files matching the structure above
   - Copy code from each file

5. **Configure the system** by editing [config.js](config.js):

   ```javascript
   // Update Google Drive file and folder IDs
   "google_api": {
     "quote_template_id": "YOUR_QUOTE_TEMPLATE_ID",
     "quote_destination_folder_id": "YOUR_FOLDER_ID",
     "email_template_doc_id": "YOUR_EMAIL_TEMPLATE_ID",
     "invoice_template_id": "YOUR_INVOICE_TEMPLATE_ID"
   },

   // Update beneficiary banking details for QR codes
   "beneficiary_details": {
     "name": "Your Company Name",
     "iban": "YOUR_IBAN",
     "bic": "YOUR_BIC"
   },

   // Update sheet names if different
   "file_paths": {
     "crm_sheet_name": "Form Responses 1",
     "services_sheet_name": "Services",
     "import_sheet_name": "Import_Clients"
   }
   ```

6. **Set up OAuth scopes** (already configured in [appsscript.json](appsscript.json)):
   - Spreadsheets access
   - Documents access
   - Drive access
   - Gmail compose
   - External requests (for QR code generation)

7. **Test the installation**:
   - Reload your spreadsheet
   - The "Style et Matière" menu should appear
   - Click "Ouvrir le Tableau de Bord" to launch the CRM modal
   - Authorize the required permissions when prompted

### Configuration Details

#### Column Mappings
The system requires specific columns in your CRM sheet. Update `CONFIG.column_mappings` in [config.js](config.js:46-75) to match your sheet structure:

```javascript
"column_mappings": {
  "client_name": "Nom du Client / Raison Sociale",
  "client_email": "Adresse Email",
  "quote_number": "Devis N°",
  "status": "Statut du Devis",
  // ... add all required columns
}
```

#### Services Sheet Structure
Create a "Services" sheet with the following columns:
- Service name
- Description
- Unit price (HT)
- Category (optional)

#### Template Document Setup
Your Google Docs templates should contain placeholders in the format `{{placeholder_name}}`:
- `{{client_name}}`
- `{{devis_numero}}`
- `{{devis_date}}`
- `{{TOTAL_TTC}}`
- etc.

See [config.js](config.js:178-203) for the complete list of available placeholders.

---

## Technical Details

### OAuth Scopes
The application requires the following Google API permissions:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

### Data Flow

1. **Client Intake**: Google Form → Form Responses sheet → Automatic status assignment
2. **Quote Creation**: Dashboard → Quote Builder → Template processing → PDF generation → Link storage
3. **Email Sending**: Template selection → Variable replacement → Gmail draft creation → Manual review & send
4. **Invoice Generation**: Quote reference → Invoice builder → QR code generation → PDF creation → Status update

### Storage Mechanisms

- **Spreadsheet Cells**: Primary data storage for all client and transaction information
- **JSON Columns**: Complex data structures (quote details, invoice data) stored as JSON strings
- **User Properties**: Temporary draft storage using `PropertiesService`
- **Google Drive**: Generated PDF documents with automatic naming and organization

### TVA Calculation Logic

The system automatically applies the correct TVA rate based on work type:

```javascript
"tva_rate": {
  'Rénovation (TVA 10%)': 10,
  'Construction neuve -2ans (TVA 20%)': 20,
  'Sous-traitance (TVA 20%)': 20,
  'Collectivité (TVA 20%)': 20
}
```

Total calculation flow:
1. Calculate subtotal (HT) from selected services
2. Apply discount percentage if specified
3. Calculate TVA amount based on work type
4. Calculate total (TTC) = HT + TVA

### QR Code Integration

Swiss QR-bill generation for invoices using an external service:
- Beneficiary information from config
- Invoice amount and reference
- QR code image embedded in invoice PDF
- Compliant with Swiss payment standards

---

## API Reference

### Core Functions

#### `onOpen()`
Auto-executes when spreadsheet opens. Initializes menu and launches CRM modal.

#### `openCRMModal()`
Opens the main CRM dashboard interface (1100x650px modal).

#### `generateQuote()`
Launches the quote builder interface. Validates sheet selection before opening.

#### `createObjectFromRow(rowData, headers)`
Core data access function. Converts row arrays to named objects.
- **Parameters**:
  - `rowData` (Array): Cell values from one row
  - `headers` (Array): Column header names
- **Returns**: Object with headers as keys

#### `getDashboardMetrics()`
Calculates and returns real-time business metrics for dashboard display.
- **Returns**: Object containing revenue, quote counts, pending actions, etc.

#### `sendQuoteEmail(selectedRow, emailType)`
Generates and creates Gmail draft for quote-related emails.
- **Parameters**:
  - `selectedRow` (Number): Row index in spreadsheet
  - `emailType` (String): 'quote', 'followup', or 'testimonial'

### Enhancement Functions

#### `saveQuoteDraft(selectedRow, quoteStructure, businessData)`
Saves work-in-progress quote to user properties.
- **Returns**: `{success: boolean, message: string}`

#### `getQuoteDraft(selectedRow)`
Retrieves saved draft for specific client row.
- **Returns**: Draft object or null

#### `duplicateQuote()`
Copies quote data from one client row to another.

#### `editInternalNotes()`
Opens dialog for adding/editing private client notes.

---

## Workflow Example

### Complete Client Journey

1. **Lead Capture**
   - Client submits Google Form
   - Data populates "Form Responses 1" sheet
   - Status automatically set to "Nouveau"

2. **Quote Creation**
   - Open CRM Dashboard
   - Navigate to client in list
   - Click "Générer le Devis"
   - Select services from catalog
   - Set work type for TVA calculation
   - Add discount if applicable
   - Set estimated duration
   - Generate PDF quote

3. **Quote Sending**
   - Select "Quote Email" template
   - System creates Gmail draft with PDF attached
   - Review and send manually from Gmail

4. **Follow-up**
   - If no response, use "Follow-up Email" template
   - System includes quote details and deadline

5. **Project Won**
   - Update status to "Projet gagné"
   - Set project start/end dates
   - Track progress in dashboard

6. **Invoice Generation**
   - Open "Générer la Facture"
   - System pre-fills from quote data
   - Specify deposit amount if applicable
   - Generate invoice with QR code
   - PDF created and linked

7. **Post-Project**
   - Mark status as "Terminé"
   - Send testimonial request email
   - Update invoice status to "Payée"

---

## Customization Guide

### Adding New Email Templates

Edit [config.js](config.js:102-175):

```javascript
"email_templates": {
  "your_template_name": {
    "subject": "Subject with {{VARIABLES}}",
    "body": `Your email content here

    Use {{PLACEHOLDERS}} for dynamic content`
  }
}
```

### Adding Custom Service Categories

No code changes needed:
1. Add categories to your Services sheet
2. Quote builder automatically groups by category

### Modifying Quote Validity Period

Edit [config.js](config.js:35):
```javascript
"quote_settings": {
  "validity_days": 90  // Change to desired number of days
}
```

### Customizing Status Values

Edit [config.js](config.js:78-89):
```javascript
"statuses": {
  "NEW": "Nouveau",
  "SENT": "Devis envoyé",
  "WON": "Projet gagné",
  "COMPLETED": "Terminé",
  "CANCELLED": "Annulé"
}
```

---

## Troubleshooting

### Common Issues

**Modal doesn't open**
- Check browser popup blockers
- Verify script authorization status
- Check browser console for errors

**Template not found errors**
- Verify file IDs in [config.js](config.js:13-16)
- Ensure script has access to Drive files
- Check file sharing permissions

**Column not found errors**
- Verify column names match [config.js](config.js:46-75) mappings
- Check for extra spaces in column headers
- Ensure all required columns exist

**QR code not generating**
- Check external request permissions in OAuth scopes
- Verify IBAN/BIC format in config
- Check network connectivity

**Email drafts not creating**
- Verify Gmail OAuth scope authorization
- Check email template syntax
- Ensure client has valid email address

### Debug Mode

Enable detailed logging by adding to your script:
```javascript
function debugMode() {
  Logger.log('Current Config:', CONFIG);
  Logger.log('Active Sheet:', SpreadsheetApp.getActiveSheet().getName());
}
```

---

## System Requirements

- **Google Workspace**: Any tier with Apps Script access
- **Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Permissions**: Edit access to spreadsheet for all users
- **Storage**: Adequate Google Drive quota for PDF documents

---

## Performance Considerations

- **Batch Operations**: Dashboard loads all data at once; large datasets (>1000 rows) may slow initial load
- **Draft Storage**: User Properties has 500KB limit per script; complex quotes may approach limit
- **PDF Generation**: Each document generation requires ~2-5 seconds processing time
- **Spreadsheet Size**: Recommended maximum 5000 client rows for optimal performance

---

## Version History

### Version 3.4 (Current)
- Full code refactoring with externalized configuration
- Column-order independent data access
- Enhanced error handling and validation
- Auto-save draft functionality
- Quote duplication feature
- Internal notes system

### Previous Versions
- Version 3.x: Core CRM functionality
- Version 2.x: Initial quote and invoice generation
- Version 1.x: Basic client management

---

## Credits

Developed by **Fabien** for **Style et Matière**
With assistance from Gemini and Claude AI

Built with:
- Google Apps Script (V8 Runtime)
- Google Workspace APIs
- Swiss QR-bill API (external service)

---

## Support

For internal support and questions, contact the development team or refer to:
- Google Apps Script documentation: https://developers.google.com/apps-script
- Google Workspace APIs: https://developers.google.com/workspace

---

*This README reflects the system as of December 2024. For the most current information, always refer to the actual code and configuration files.*
