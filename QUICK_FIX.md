# Quick Fix for Authorization Loop

## The Problem
No executions are logged = the web app is running OLD code that doesn't have our fixes.

## Solution: Manual Deployment via Web Interface

### Step 1: Update Config (Do this first!)

1. Open `config.js` in your editor
2. Find line 350 (search for "allowed_users")
3. Replace `'your-email@example.com'` with YOUR actual Gmail/Google Workspace email
4. Save the file

Example:
```javascript
allowed_users: [
  'fabien.clauss@gmail.com',        // ← Your real email
  'styleematiere@gmail.com'
],
admins: [
  'fabien.clauss@gmail.com'         // ← Your real email
],
user_names: {
  'fabien.clauss@gmail.com': 'Fabien',
  'styleematiere@gmail.com': 'Style et Matière'
}
```

### Step 2: Open Apps Script Editor

Open your terminal and run:
```bash
cd /Users/fabien/Documents/Optimal_AI/CRM
npx @google/clasp open
```

This will open your Apps Script project in the browser.

### Step 3: Push Your Code

In the terminal:
```bash
npx @google/clasp push
```

When asked "Manifest file has been updated. Do you want to push and overwrite?", answer **Yes**

### Step 4: Verify Files Are Updated

In the Apps Script editor (browser):
1. Click on `auth.js` in the left sidebar
2. Look for line 20 - it should say `Session.getEffectiveUser()`
3. Click on `appsscript.json`
4. Verify line 17 says `"access": "ANYONE"`

If these don't match, the push didn't work. Try again or copy-paste manually.

### Step 5: Deploy Web App

In the Apps Script editor:

1. Click the **Deploy** button (top right, looks like a rocket 🚀)
2. Select **New deployment**
3. Click the gear icon ⚙️ next to "Select type"
4. Choose **Web app**
5. Configure:
   - **Description**: "Web App v1.0 - Auth Fixed"
   - **Execute as**: Me (your-email@gmail.com)
   - **Who has access**: **Anyone** ← IMPORTANT!
6. Click **Deploy**
7. You may need to authorize again - click **Authorize access**
8. **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/ABC.../exec`)

### Step 6: Test with NEW URL

1. Open the NEW web app URL in an **INCOGNITO window** (to avoid cache)
2. You should see the Google authorization screen
3. Click **Continue** or **Allow**
4. You should now see the dashboard (not loop!)

### Step 7: Check Logs

If it still loops, check the logs:

```bash
npx @google/clasp logs
```

You should now see executions logged, like:
- `Auth failed: User not authorized: [email]` ← Email not in config
- `Auth success: [email] (role: admin)` ← Success!

## Common Issues

### Issue: "npx command not found"

You need Node.js installed. Check:
```bash
node --version
```

If not installed, download from: https://nodejs.org/

### Issue: Still seeing old code in Apps Script editor

**Manual upload option:**

1. In Apps Script editor, delete all existing files
2. Click **+** next to Files
3. Create new script files and copy-paste code from your local files:
   - `webapp.js`
   - `auth.js`
   - `api.js`
   - `config.js` (with your email!)
   - All other .js files
4. Create HTML files:
   - `pages/dashboard.html`
   - `pages/clients.html`
   - etc.
5. Update `appsscript.json` (use the editor, change "access" to "ANYONE")

### Issue: "Who has access" is greyed out

This means you're trying to UPDATE an existing deployment. You need to create a NEW deployment:
- Click **New deployment** (not "Manage deployments")
- Follow Step 5 above

### Issue: Still looping after all this

Check these in order:

1. **Verify your email in config.js matches EXACTLY**:
   ```bash
   cat config.js | grep -A 5 "allowed_users"
   ```
   Your email should be there, spelled exactly as your Google account email

2. **Verify appsscript.json**:
   ```bash
   cat appsscript.json | grep "access"
   ```
   Should show: `"access": "ANYONE"`

3. **Verify you're using the NEW deployment URL**
   - Not the old one
   - Fresh incognito window
   - Wait 1-2 minutes after deploying (Google caches aggressively)

4. **Check execution logs exist**:
   If no logs appear at all, the web app is still running old code or not being executed

## Alternative: Test Authentication First

Create a simple test to verify auth is working:

1. In Apps Script editor, create a new file: `test.js`
2. Paste this code:
```javascript
function testAuth() {
  const email = Session.getEffectiveUser().getEmail();
  Logger.log('User email: ' + email);
  Logger.log('Is authorized: ' + isAuthorizedUser(email));
}
```
3. Run the function (click ▶️ next to `testAuth`)
4. Check the Execution log - it should show your email and true/false
5. This confirms if the auth code works at all

## Need More Help?

Run these commands and share the output:

```bash
cd /Users/fabien/Documents/Optimal_AI/CRM

# Check current deployment
npx @google/clasp deployments

# Check what's in config
grep -A 10 "allowed_users" config.js

# Check appsscript.json
cat appsscript.json

# Push and see any errors
npx @google/clasp push
```
