/**
 * API Response Validation Helper
 * Version: 1.0
 *
 * Optional runtime validation for API responses.
 * Enable in development to catch type mismatches early.
 *
 * @author Fabien for Style et Matière
 */

/**
 * Validation mode - set to true to enable runtime validation
 * WARNING: Adds overhead, only enable in development/testing
 */
const VALIDATION_ENABLED = false;

/**
 * Schema definitions for API responses
 * These must match the typedef definitions in types.js
 */
const SCHEMAS = {
  DashboardMetrics: {
    activeQuotes: 'number',
    activeQuotesChange: 'number',
    totalValue: 'number',
    totalValueChange: 'number',
    wonProjects: 'number',
    wonProjectsChange: 'number',
    conversionRate: 'number',
    conversionRateChange: 'number',
    requiredActions: 'array',
    recentActivity: 'array'
  },

  ClientListItem: {
    row: 'number',
    name: 'string',
    email: 'string',
    phone: 'string',
    status: 'string',
    lastDocument: 'string',
    amount: 'string',
    lastAction: 'string'
  },

  ClientDetails: {
    name: 'string',
    email: 'string',
    phone: 'string',
    address: 'string',
    workType: 'string',
    status: 'string',
    quoteNumber: 'string',
    quoteUrl: 'string',
    invoiceNumber: 'string',
    invoiceUrl: 'string',
    notes: 'string',
    projectStartDate: 'string',
    projectEndDate: 'string',
    projectValue: 'number',
    row: 'number'
  },

  CalendarData: {
    weeks: 'array',
    unplanned: 'array',
    today: 'string'
  },

  EmailTemplates: {
    quote: 'object',
    followup: 'object',
    testimonial: 'object'
  },

  OperationResult: {
    success: 'boolean',
    message: 'string'
  }
};

/**
 * Validates data against a schema
 *
 * @param {*} data - Data to validate
 * @param {string} schemaName - Name of schema from SCHEMAS
 * @param {string} functionName - Name of function for error reporting
 * @returns {boolean} True if valid, throws error if invalid
 */
function validateResponse(data, schemaName, functionName) {
  if (!VALIDATION_ENABLED) {
    return true;
  }

  const schema = SCHEMAS[schemaName];
  if (!schema) {
    Logger.log('WARNING: No schema defined for ' + schemaName);
    return true;
  }

  const errors = [];

  // Check for required fields
  Object.keys(schema).forEach(function(field) {
    const expectedType = schema[field];
    const actualValue = data[field];
    const actualType = Array.isArray(actualValue) ? 'array' : typeof actualValue;

    // Allow null/undefined for some fields (they might be optional)
    if (actualValue === null || actualValue === undefined) {
      // Skip validation for optional fields
      return;
    }

    if (actualType !== expectedType) {
      errors.push(
        'Field "' + field + '" expected ' + expectedType + ' but got ' + actualType
      );
    }
  });

  // Check for unexpected fields (might indicate a typo)
  Object.keys(data).forEach(function(field) {
    if (!schema[field]) {
      Logger.log('INFO: Unexpected field "' + field + '" in ' + schemaName + ' (might be intentional)');
    }
  });

  if (errors.length > 0) {
    const errorMsg = 'Validation failed for ' + functionName + ' returning ' + schemaName + ':\n' + errors.join('\n');
    Logger.log('VALIDATION ERROR: ' + errorMsg);
    throw new Error(errorMsg);
  }

  return true;
}

/**
 * Wraps a function to validate its return value
 * Usage: const safeFn = withValidation(myFunction, 'MyReturnType');
 *
 * @param {Function} fn - Function to wrap
 * @param {string} returnType - Expected return type schema name
 * @returns {Function} Wrapped function with validation
 */
function withValidation(fn, returnType) {
  return function() {
    const result = fn.apply(this, arguments);
    validateResponse(result, returnType, fn.name);
    return result;
  };
}

/**
 * Validates array items against a schema
 *
 * @param {Array} data - Array of items to validate
 * @param {string} schemaName - Schema name for array items
 * @param {string} functionName - Function name for error reporting
 * @returns {boolean} True if valid
 */
function validateArrayResponse(data, schemaName, functionName) {
  if (!VALIDATION_ENABLED) {
    return true;
  }

  if (!Array.isArray(data)) {
    throw new Error(functionName + ' expected array but got ' + typeof data);
  }

  // Validate first few items as samples
  const sampleSize = Math.min(3, data.length);
  for (let i = 0; i < sampleSize; i++) {
    try {
      validateResponse(data[i], schemaName, functionName + '[' + i + ']');
    } catch (error) {
      Logger.log('Array validation failed at index ' + i + ': ' + error.message);
      throw error;
    }
  }

  return true;
}

/**
 * Enable validation mode
 * Call this from script editor for testing
 */
function enableValidation() {
  VALIDATION_ENABLED = true;
  Logger.log('Validation enabled');
  SpreadsheetApp.getUi().alert('Validation enabled for development');
}

/**
 * Disable validation mode
 */
function disableValidation() {
  VALIDATION_ENABLED = false;
  Logger.log('Validation disabled');
  SpreadsheetApp.getUi().alert('Validation disabled for production');
}

/**
 * Test validation with sample data
 * Run this to verify validation is working
 */
function testValidation() {
  // Enable validation temporarily
  const wasEnabled = VALIDATION_ENABLED;
  VALIDATION_ENABLED = true;

  try {
    // Test valid data
    const validData = {
      activeQuotes: 5,
      activeQuotesChange: 10,
      totalValue: 15000,
      totalValueChange: -5,
      wonProjects: 3,
      wonProjectsChange: 0,
      conversionRate: 60,
      conversionRateChange: 5,
      requiredActions: [],
      recentActivity: []
    };

    validateResponse(validData, 'DashboardMetrics', 'testValidation');
    Logger.log('✓ Valid data passed validation');

    // Test invalid data
    try {
      const invalidData = {
        activeQuotes: '5',  // Should be number
        totalValue: 15000
      };
      validateResponse(invalidData, 'DashboardMetrics', 'testValidation');
      Logger.log('✗ Invalid data should have failed but passed!');
    } catch (error) {
      Logger.log('✓ Invalid data correctly rejected: ' + error.message);
    }

    SpreadsheetApp.getUi().alert('Validation test completed - check logs');

  } finally {
    // Restore original state
    VALIDATION_ENABLED = wasEnabled;
  }
}
