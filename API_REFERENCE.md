# API Reference - CRM Web Application

**Version:** 1.0
**Last Updated:** January 3, 2026

This document provides a complete reference for all API endpoints used in the CRM web application.

## Table of Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
  - [Dashboard](#dashboard)
  - [Client Management](#client-management)
  - [Calendar & Planning](#calendar--planning)
  - [Email Management](#email-management)
  - [Templates](#templates)
- [Data Types](#data-types)
- [Error Handling](#error-handling)

---

## Overview

All API calls use the `API` object defined in `pages/components/client-api.html`. The API uses POST requests with JSON payloads and returns JSON responses.

### Request Format
```javascript
{
  "action": "actionName",
  ...additionalParameters
}
```

### Response Format
```javascript
// Success
{
  "success": true,
  "data": { ...responseData }
}

// Error
{
  "success": false,
  "error": "Error message"
}
```

---

## API Endpoints

### Dashboard

#### `getDashboardMetrics()`
Returns dashboard metrics and statistics.

**Parameters:** None

**Returns:** `DashboardMetrics`
```javascript
{
  activeQuotes: 5,              // Number of pending quotes
  activeQuotesChange: 20,       // % change from previous period
  totalValue: 15000,            // Total value of pending quotes (EUR)
  totalValueChange: -5,         // % change from previous period
  wonProjects: 3,               // Number of won projects
  wonProjectsChange: 0,         // % change from previous period
  conversionRate: 60,           // Conversion rate (%)
  conversionRateChange: 5,      // % change from previous period
  requiredActions: [            // Actions requiring attention
    {
      type: "followup",
      title: "Relancer devis DEV-2024-001",
      description: "Client X - 15 jours",
      buttonLabel: "Relancer",
      clientId: "42"
    }
  ],
  recentActivity: [             // Recent activity feed
    {
      description: "Devis DEV-2024-005 créé pour Client Y",
      date: "2024-12-19T10:30:00Z"
    }
  ]
}
```

**Used By:** Dashboard page

**Implementation:** `modalController.js:39`

---

### Client Management

#### `getClientsData()`
Returns list of all clients with summary information.

**Parameters:** None

**Returns:** `ClientListItem[]`
```javascript
[
  {
    row: 42,                    // Row number in sheet
    name: "SARL Dupont",        // Client name
    email: "contact@dupont.fr", // Email address
    phone: "06 12 34 56 78",    // Phone number
    status: "Devis envoyé",     // Current status
    lastDocument: "DEV-2024-001", // Last quote/invoice
    amount: "15 000 €",         // Formatted amount
    lastAction: "il y a 5 jours" // Time since last action
  }
]
```

**Used By:** Clients page

**Implementation:** `modalController.js:249`

---

#### `getClientDetails(row)`
Returns detailed information for a specific client.

**Parameters:**
- `row` (number): Row number in the CRM sheet

**Returns:** `ClientDetails`
```javascript
{
  name: "SARL Dupont",
  email: "contact@dupont.fr",
  phone: "06 12 34 56 78",
  address: "123 Rue de la Paix, 75001 Paris",
  workType: "Rénovation (TVA 10%)",
  status: "Projet gagné",
  quoteNumber: "DEV-2024-001",
  quoteUrl: "https://docs.google.com/document/d/...",
  invoiceNumber: "FACT-2024-001",
  invoiceUrl: "https://docs.google.com/document/d/...",
  notes: "Client préfère paiement par virement",
  projectStartDate: "15/01/2024",
  projectEndDate: "30/01/2024",
  projectValue: 15000,
  row: 42
}
```

**Used By:** Clients page (detail view)

**Implementation:** `modalController.js:308`

---

#### `updateClientStatus(row, status)`
Updates the status of a client/quote.

**Parameters:**
- `row` (number): Row number in sheet
- `status` (string): New status (from `CONFIG.statuses`)

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Statut mis à jour: Projet gagné",
  newStatus: "Projet gagné"
}
```

**Used By:** Clients page

**Implementation:** `modalController.js:373`

---

#### `updateProjectDetails(row, startDate, endDate, value)`
Updates project timeline and value.

**Parameters:**
- `row` (number): Row number in sheet
- `startDate` (string): Start date in ISO format or empty
- `endDate` (string): End date in ISO format or empty
- `value` (number): Project value in EUR

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Détails du projet enregistrés (Date de début, Date de fin, Valeur)",
  startDate: "2024-01-15",
  endDate: "2024-01-30",
  projectValue: 15000
}
```

**Used By:** Clients page

**Implementation:** `modalController.js:428`

---

#### `saveClientNotes(row, notes)`
Saves internal notes for a client.

**Parameters:**
- `row` (number): Row number in sheet
- `notes` (string): Notes text (max 1000 characters)

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Notes enregistrées"
}
```

**Used By:** Clients page

**Implementation:** `modalController.js:525`

---

#### `getQuoteValue(row)`
Gets the total value of a quote for a client.

**Parameters:**
- `row` (number): Row number in sheet

**Returns:** `number` - Quote value in EUR

**Used By:** Clients page (auto-fill project value)

**Implementation:** `modalController.js:500`

---

### Calendar & Planning

#### `getCalendarData()`
Returns calendar view of projects for 3-month planning window.

**Parameters:** None

**Returns:** `CalendarData`
```javascript
{
  weeks: [
    {
      label: "Projets planifiés",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      projects: [
        {
          clientName: "SARL Dupont",
          workType: "Rénovation",
          startDate: "15/01/2024",
          endDate: "30/01/2024",
          duration: "15 jours",
          status: "in-progress",  // or 'planned', 'completed'
          row: 42
        }
      ]
    }
  ],
  unplanned: [
    {
      clientName: "SARL Martin",
      workType: "Construction neuve",
      status: "Projet gagné",
      row: 43
    }
  ],
  today: "2024-01-03"
}
```

**Used By:** Calendar page

**Implementation:** `modalController.js:570`

---

### Email Management

#### `generateQuoteEmailDraft(row)`
Creates a Gmail draft for sending a quote to a client.

**Parameters:**
- `row` (number): Row number in sheet

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Brouillon créé avec succès pour SARL Dupont",
  draftId: "r-1234567890"
}
```

**Used By:** Clients page, Emails tab

**Implementation:** `modalController.js:710`

---

#### `generateFollowUpEmailDraft(row)`
Creates a Gmail draft for following up on a sent quote.

**Parameters:**
- `row` (number): Row number in sheet

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Brouillon de relance créé pour SARL Dupont",
  draftId: "r-1234567891"
}
```

**Used By:** Dashboard (required actions), Clients page

**Implementation:** `modalController.js:785`

---

#### `generateTestimonialEmailDraft(row)`
Creates a Gmail draft requesting a testimonial from a client.

**Parameters:**
- `row` (number): Row number in sheet

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Brouillon de demande de témoignage créé pour SARL Dupont",
  draftId: "r-1234567892"
}
```

**Used By:** Clients page (for completed projects)

**Implementation:** `modalController.js:857`

---

### Templates

#### `getEmailTemplates()`
Returns all email templates (custom or defaults).

**Parameters:** None

**Returns:** `EmailTemplates`
```javascript
{
  quote: {
    subject: "Votre devis {{QUOTE_NUMBER}} - {{WORK_TYPE}}",
    body: "Bonjour {{CLIENT_NAME}},\n\nVeuillez trouver ci-joint..."
  },
  followup: {
    subject: "Relance : Devis {{QUOTE_NUMBER}}",
    body: "Bonjour {{CLIENT_NAME}},\n\nJe me permets de revenir..."
  },
  testimonial: {
    subject: "Demande d'avis - {{WORK_TYPE}}",
    body: "Bonjour {{CLIENT_NAME}},\n\nNous espérons que..."
  }
}
```

**Available Placeholders:**
- `{{CLIENT_NAME}}` - Client name
- `{{QUOTE_NUMBER}}` - Quote number
- `{{WORK_TYPE}}` - Type of work
- `{{TOTAL_AMOUNT}}` - Formatted total amount
- `{{DURATION}}` - Estimated duration
- `{{VALIDITY_DATE}}` - Quote validity date
- `{{QUOTE_DATE}}` - Quote creation date
- `{{DAYS_SINCE}}` - Days since quote sent
- `{{SENDER_NAME}}` - Sender name from CONFIG

**Used By:** Settings page

**Implementation:** `modalController.js:985`

---

#### `saveEmailTemplates(templates)`
Saves custom email templates.

**Parameters:**
- `templates` (EmailTemplates): Complete templates object

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Templates enregistrés avec succès"
}
```

**Used By:** Settings page

**Implementation:** `modalController.js:1008`

---

#### `resetEmailTemplates()`
Resets email templates to default values.

**Parameters:** None

**Returns:** `OperationResult`
```javascript
{
  success: true,
  message: "Templates restaurés"
}
```

**Used By:** Settings page

**Implementation:** `modalController.js:1032`

---

## Data Types

All data types are defined in `types.js` using JSDoc typedef syntax. See that file for complete type definitions.

### Common Types

- `DashboardMetrics` - Dashboard statistics and metrics
- `ClientListItem` - Client summary for list views
- `ClientDetails` - Complete client information
- `CalendarData` - Calendar view with project timeline
- `EmailTemplates` - Email template collection
- `OperationResult` - Standard operation result

---

## Error Handling

### Client-Side Handling

The `API` object in `client-api.html` handles errors automatically:

```javascript
try {
  const data = await API.getDashboardMetrics();
  // Use data
} catch (error) {
  console.error('API Error:', error.message);
  // Show error to user
}
```

### Server-Side Errors

All API functions should wrap operations in try-catch blocks and return proper error responses:

```javascript
function myApiFunction(params) {
  try {
    // Operation
    return { success: true, data: result };
  } catch (error) {
    Logger.log('Error in myApiFunction: ' + error.message);
    return { success: false, error: error.message };
  }
}
```

### Common Error Scenarios

1. **Sheet not found** - Check CONFIG.file_paths.crm_sheet_name
2. **Row out of bounds** - Validate row > 1 and row <= lastRow
3. **Column not found** - Verify CONFIG.column_mappings match sheet headers
4. **Permission denied** - Check user authorization in auth.js
5. **Data parsing error** - Validate JSON structure before parsing

---

## Best Practices

### For Adding New Endpoints

1. **Define the type** in `types.js`
2. **Document the function** in this API_REFERENCE.md
3. **Add JSDoc comments** with `@returns {TypeName}` and `@see types.js`
4. **Register the handler** in `api.js`
5. **Add client method** in `pages/components/client-api.html`
6. **Test thoroughly** before deployment

### For Modifying Existing Endpoints

1. **Update the type definition** in `types.js` first
2. **Update this documentation** with the changes
3. **Update all callers** to match the new structure
4. **Test all affected pages**
5. **Consider backward compatibility** if needed

---

## Quick Reference Table

| Endpoint | Parameters | Returns | Used By |
|----------|-----------|---------|---------|
| `getDashboardMetrics()` | - | `DashboardMetrics` | Dashboard |
| `getClientsData()` | - | `ClientListItem[]` | Clients |
| `getClientDetails(row)` | row | `ClientDetails` | Clients |
| `updateClientStatus(row, status)` | row, status | `OperationResult` | Clients |
| `updateProjectDetails(...)` | row, startDate, endDate, value | `OperationResult` | Clients |
| `saveClientNotes(row, notes)` | row, notes | `OperationResult` | Clients |
| `getQuoteValue(row)` | row | `number` | Clients |
| `getCalendarData()` | - | `CalendarData` | Calendar |
| `generateQuoteEmailDraft(row)` | row | `OperationResult` | Multiple |
| `generateFollowUpEmailDraft(row)` | row | `OperationResult` | Multiple |
| `generateTestimonialEmailDraft(row)` | row | `OperationResult` | Clients |
| `getEmailTemplates()` | - | `EmailTemplates` | Settings |
| `saveEmailTemplates(templates)` | templates | `OperationResult` | Settings |
| `resetEmailTemplates()` | - | `OperationResult` | Settings |

---

**Note:** This document should be updated whenever API endpoints are added, modified, or removed. Always keep the type definitions in `types.js` and this reference in sync with the actual implementation.
