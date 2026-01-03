# Preventing Type Mismatches - Developer Guide

**Last Updated:** January 3, 2026

This guide explains the systems in place to prevent type/naming mismatches between API and frontend code.

## The Problem We're Solving

When the API returns data with field names that don't match what the frontend expects, you get:
- Silent failures (spinner keeps spinning)
- Undefined values causing display issues
- Difficult-to-debug problems

**Example of what went wrong:**
```javascript
// API returned:
{ pendingQuotes: 5, pendingValue: 15000 }

// Dashboard expected:
{ activeQuotes: 5, totalValue: 15000 }

// Result: Dashboard showed 0s everywhere
```

## Our Solution: Three-Layered Approach

### Layer 1: Type Definitions (`types.js`)

**Purpose:** Single source of truth for all data structures

**How to use:**
1. When creating a new API endpoint, define its return type first in `types.js`
2. Use JSDoc typedef syntax
3. Document every field with comments

**Example:**
```javascript
/**
 * Dashboard metrics response structure
 * @typedef {Object} DashboardMetrics
 * @property {number} activeQuotes - Number of pending quotes awaiting response
 * @property {number} totalValue - Total value of all pending quotes (EUR)
 * @property {Array} requiredActions - Actions requiring attention
 */
```

**Then reference it in your function:**
```javascript
/**
 * Gets dashboard metrics
 * @returns {DashboardMetrics} Dashboard metrics object
 * @see types.js for DashboardMetrics type definition
 */
function getDashboardMetrics() {
  return {
    activeQuotes: 5,
    totalValue: 15000,
    requiredActions: []
  };
}
```

### Layer 2: API Reference (`API_REFERENCE.md`)

**Purpose:** Human-readable documentation with examples

**How to use:**
1. Before implementing a feature, check API_REFERENCE.md
2. When adding/changing an endpoint, update the reference immediately
3. Include example request/response for every endpoint

**What it includes:**
- Endpoint name and parameters
- Return type with example values
- Which pages use this endpoint
- Link to implementation

**When to update:**
- ✅ Adding a new API endpoint
- ✅ Changing return structure of existing endpoint
- ✅ Adding/removing fields from a type
- ✅ Changing parameter requirements

### Layer 3: Runtime Validation (`validation.js`)

**Purpose:** Optional development-time type checking

**How to enable:**
```javascript
// In validation.js, change:
const VALIDATION_ENABLED = false;
// to:
const VALIDATION_ENABLED = true;

// Or run from script editor:
enableValidation();
```

**What it does:**
- Checks that returned data matches expected schema
- Warns about unexpected fields (might be typos)
- Throws errors when types don't match
- Only runs when enabled (zero overhead in production)

**Testing validation:**
```javascript
// Run from script editor:
testValidation();
// Check execution logs for results
```

## Workflow for New Features

### Adding a New API Endpoint

Follow these steps **in order**:

1. **Define the type** in `types.js`
   ```javascript
   /**
    * @typedef {Object} MyNewType
    * @property {string} field1 - Description
    * @property {number} field2 - Description
    */
   ```

2. **Document in API_REFERENCE.md**
   ```markdown
   #### `getMyNewData()`
   Returns my new data.

   **Parameters:** None

   **Returns:** `MyNewType`
   ```

   Example:
   ```javascript
   {
     field1: "value",
     field2: 42
   }
   ```

3. **Implement the function** with JSDoc
   ```javascript
   /**
    * Gets my new data
    * @returns {MyNewType} My new type
    * @see types.js for MyNewType definition
    */
   function getMyNewData() {
     return {
       field1: "value",
       field2: 42
     };
   }
   ```

4. **Register in `api.js`**
   ```javascript
   const handlers = {
     'getMyNewData': () => getMyNewData(),
     // ... other handlers
   };
   ```

5. **Add client method** in `client-api.html`
   ```javascript
   getMyNewData: function() {
     return this.call('getMyNewData');
   }
   ```

6. **Add schema** to `validation.js` (optional but recommended)
   ```javascript
   SCHEMAS.MyNewType = {
     field1: 'string',
     field2: 'number'
   };
   ```

7. **Test with validation enabled**
   ```javascript
   enableValidation();
   // Test your endpoint
   disableValidation();
   ```

8. **Deploy and test in web app**

### Modifying an Existing Endpoint

**CRITICAL:** Changing return structures affects all callers!

1. **Check who uses it** in API_REFERENCE.md ("Used By" section)

2. **Update type definition** in `types.js`
   - Add new fields
   - Mark removed fields with `@deprecated` first
   - Consider backward compatibility

3. **Update API_REFERENCE.md**
   - Update example response
   - Note breaking changes

4. **Update implementation**
   - Modify the function
   - Update JSDoc

5. **Update all callers**
   - Find all pages that use this endpoint
   - Update their code to match new structure

6. **Update validation schema** if enabled

7. **Test thoroughly**
   - Test all affected pages
   - Verify no console errors

## Quick Checks Before Deployment

Use this checklist before deploying changes:

- [ ] Is the type defined in `types.js`?
- [ ] Does API_REFERENCE.md have current documentation?
- [ ] Do field names match between API and frontend?
- [ ] Are JSDoc comments complete with `@returns {TypeName}`?
- [ ] Did I test with validation enabled?
- [ ] Did I test all pages that use this endpoint?
- [ ] Is error handling in place?

## Common Pitfalls to Avoid

### ❌ Don't: Return different field names than documented
```javascript
// types.js says:
// @property {number} totalValue

// But code returns:
return { pendingValue: 1000 }; // WRONG!
```

### ✅ Do: Match exactly
```javascript
return { totalValue: 1000 }; // CORRECT
```

---

### ❌ Don't: Skip updating API_REFERENCE.md
```javascript
// Changed the API but forgot to update docs
// Other developer uses old docs = bugs
```

### ✅ Do: Update docs immediately
```javascript
// 1. Change code
// 2. Update API_REFERENCE.md
// 3. Commit both together
```

---

### ❌ Don't: Add fields without updating type definition
```javascript
// Added new field but didn't document it
return {
  activeQuotes: 5,
  newField: "surprise!" // Nobody knows this exists
};
```

### ✅ Do: Document new fields
```javascript
// 1. Add to types.js typedef
// 2. Add to API_REFERENCE.md
// 3. Add to validation schema
// 4. Implement
```

---

### ❌ Don't: Use magic strings for field names
```javascript
const value = data['activeQuotes']; // Typo = silent failure
```

### ✅ Do: Use constants or rely on IDE autocomplete
```javascript
// Or better: trust your types.js definitions
// and use validation during development
```

## IDE Setup for Better Type Safety

### Visual Studio Code

1. **Enable JSDoc type checking:**

   Create/update `.vscode/settings.json`:
   ```json
   {
     "javascript.implicitProjectConfig.checkJs": true,
     "javascript.suggest.completeFunctionCalls": true
   }
   ```

2. **Add JSDoc validation:**
   - Install "Document This" extension
   - Use Ctrl+Shift+P → "Document This" to generate JSDoc

### Apps Script Editor

- Add `@type` hints for variables:
  ```javascript
  /** @type {DashboardMetrics} */
  const metrics = getDashboardMetrics();
  // Now you get autocomplete for metrics.activeQuotes, etc.
  ```

## When to Use Each Layer

| Situation | Use |
|-----------|-----|
| Creating new endpoint | types.js + API_REFERENCE.md |
| Learning the API | API_REFERENCE.md |
| Debugging type issues | validation.js (enable temporarily) |
| Development | All three layers |
| Production | types.js + API_REFERENCE.md only |
| Code review | Check all three are updated |

## Maintenance

### Monthly Review

- Check that API_REFERENCE.md is up to date
- Run validation tests: `testValidation()`
- Look for TypeErrors in execution logs
- Update type definitions for new fields

### When Things Go Wrong

If you see errors like "Cannot read property X of undefined":

1. **Check the API response**
   ```javascript
   // In client code, add:
   console.log('API response:', data);
   ```

2. **Check types.js** - Is the type defined correctly?

3. **Check API_REFERENCE.md** - What should the API return?

4. **Check implementation** - Does it return what it claims?

5. **Enable validation** - Let it catch the mismatch

6. **Fix the source** - Either API or frontend, whichever is wrong

## Summary

**The Three-Layer Protection:**

1. **types.js** = Contract (what the data should look like)
2. **API_REFERENCE.md** = Documentation (how to use it)
3. **validation.js** = Enforcement (catch mistakes early)

**The Golden Rule:**
> When API and frontend disagree on field names, update types.js first, then implementation, then documentation. Never update just one!

**Questions?**
Check API_REFERENCE.md for the endpoint you need, and types.js for the data structure.
