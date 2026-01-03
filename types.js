/**
 * Type Definitions for CRM API
 * Version: 1.0
 *
 * This file defines all data structures used in the API layer.
 * Use these JSDoc types throughout the codebase for consistency.
 *
 * @author Fabien for Style et Matière
 */

/**
 * Dashboard metrics response structure
 * @typedef {Object} DashboardMetrics
 * @property {number} activeQuotes - Number of pending quotes awaiting response
 * @property {number} activeQuotesChange - Percentage change from previous period
 * @property {number} totalValue - Total value of all pending quotes (EUR)
 * @property {number} totalValueChange - Percentage change from previous period
 * @property {number} wonProjects - Number of projects won
 * @property {number} wonProjectsChange - Percentage change from previous period
 * @property {number} conversionRate - Quote-to-win conversion rate (percentage)
 * @property {number} conversionRateChange - Percentage change from previous period
 * @property {ActionItem[]} requiredActions - List of actions requiring attention
 * @property {ActivityItem[]} recentActivity - Recent activity feed items
 */

/**
 * Action item requiring user attention
 * @typedef {Object} ActionItem
 * @property {string} type - Action type: 'followup', 'quote', 'invoice'
 * @property {string} title - Short action title
 * @property {string} description - Detailed description
 * @property {string} buttonLabel - Label for action button
 * @property {string} clientId - Client row number or identifier
 */

/**
 * Activity feed item
 * @typedef {Object} ActivityItem
 * @property {string} description - Activity description (e.g., "Devis créé pour Client X")
 * @property {string} date - ISO date string of the activity
 */

/**
 * Client list item
 * @typedef {Object} ClientListItem
 * @property {number} row - Row number in the CRM sheet
 * @property {string} name - Client name
 * @property {string} email - Client email address
 * @property {string} phone - Client phone number
 * @property {string} status - Current status (from CONFIG.statuses)
 * @property {string} lastDocument - Last quote/invoice number
 * @property {string} amount - Formatted amount (e.g., "1 500 €")
 * @property {string} lastAction - Time since last action (e.g., "il y a 2 jours")
 */

/**
 * Detailed client information
 * @typedef {Object} ClientDetails
 * @property {string} name - Client name
 * @property {string} email - Client email
 * @property {string} phone - Client phone
 * @property {string} address - Full formatted address
 * @property {string} workType - Type of work (from CONFIG.work_types)
 * @property {string} status - Current status
 * @property {string} quoteNumber - Quote number (if exists)
 * @property {string} quoteUrl - URL to quote PDF
 * @property {string} invoiceNumber - Invoice number (if exists)
 * @property {string} invoiceUrl - URL to invoice PDF
 * @property {string} notes - Internal notes
 * @property {string} projectStartDate - Formatted start date (dd/MM/yyyy)
 * @property {string} projectEndDate - Formatted end date (dd/MM/yyyy)
 * @property {number} projectValue - Project value in EUR
 * @property {number} row - Row number in sheet
 */

/**
 * Calendar project item
 * @typedef {Object} CalendarProject
 * @property {string} clientName - Client name
 * @property {string} workType - Type of work
 * @property {string} startDate - Formatted start date (dd/MM/yyyy)
 * @property {string} endDate - Formatted end date (dd/MM/yyyy)
 * @property {string} duration - Duration string (e.g., "14 jours")
 * @property {string} status - Project status: 'planned', 'in-progress', 'completed'
 * @property {number} row - Row number in sheet
 */

/**
 * Calendar data response
 * @typedef {Object} CalendarData
 * @property {CalendarWeek[]} weeks - Array of week groupings with projects
 * @property {UnplannedProject[]} unplanned - Projects without dates
 * @property {string} today - Today's date in yyyy-MM-dd format
 */

/**
 * Calendar week grouping
 * @typedef {Object} CalendarWeek
 * @property {string} label - Week label
 * @property {string} startDate - Week start date (yyyy-MM-dd)
 * @property {string} endDate - Week end date (yyyy-MM-dd)
 * @property {CalendarProject[]} projects - Projects in this week
 */

/**
 * Unplanned project (missing dates)
 * @typedef {Object} UnplannedProject
 * @property {string} clientName - Client name
 * @property {string} workType - Type of work
 * @property {string} status - Current status
 * @property {number} row - Row number in sheet
 */

/**
 * Email template
 * @typedef {Object} EmailTemplate
 * @property {string} subject - Email subject line (supports {{PLACEHOLDERS}})
 * @property {string} body - Email body text (supports {{PLACEHOLDERS}})
 */

/**
 * Email templates collection
 * @typedef {Object} EmailTemplates
 * @property {EmailTemplate} quote - Template for quote emails
 * @property {EmailTemplate} followup - Template for follow-up emails
 * @property {EmailTemplate} testimonial - Template for testimonial requests
 */

/**
 * API response wrapper for successful operations
 * @typedef {Object} ApiSuccessResponse
 * @property {boolean} success - Always true for success
 * @property {*} data - Response data (type varies by endpoint)
 */

/**
 * API response wrapper for errors
 * @typedef {Object} ApiErrorResponse
 * @property {boolean} success - Always false for errors
 * @property {string} error - Error message
 */

/**
 * Standard operation result
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} message - User-friendly message
 */

// Export types for use in other files (Apps Script doesn't support ES6 modules,
// but this allows the file to be included and types referenced via JSDoc)
