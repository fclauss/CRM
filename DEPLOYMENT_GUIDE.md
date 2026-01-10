# Web App Deployment Guide

## Prerequisites

1. **Update Configuration**
   - Open `config.js`
   - Find the `auth` section (around line 347)
   - Replace `'your-email@example.com'` with your actual Gmail/Google Workspace email
   - Verify `'styleematiere@gmail.com'` is correct

```javascript
auth: {
  allowed_users: [
    'fabien@yourdomain.com',        // Replace with your email
    'styleematiere@gmail.com'       // Verify this email
  ],
  admins: [
    'fabien@yourdomain.com'         // Replace with your email
  ],
  user_names: {
    'fabien@yourdomain.com': 'Fabien',
    'styleematiere@gmail.com': 'Style et Matière'
  }
}
```

2. **Verify appsscript.json Settings**
   - `executeAs`: Should be `"USER_ACCESSING"`
   - `access`: Should be `"ANYONE"` (for custom auth with Gmail accounts)

## Deployment Steps

### 1. Push Code to Apps Script

```bash
clasp push
```

### 2. Deploy as Web App

**Option A: Using clasp (Recommended)**

```bash
# Create new deployment
clasp deploy --description "Web App v1.0"

# Note the deployment ID and URL from the output
```

**Option B: Using Apps Script Web Interface**

1. Open your project: `clasp open`
2. Click **Deploy** > **New deployment**
3. Settings:
   - **Type**: Web app
   - **Execute as**: User accessing the web app
   - **Who has access**: Anyone
4. Click **Deploy**
5. **Important**: Copy the Web App URL

### 3. Authorize the Application

When you first access the web app URL:

1. You'll see a Google authorization screen
2. Click **Review Permissions**
3. Choose your Google account
4. You may see "Google hasn't verified this app" warning
   - Click **Advanced**
   - Click **Go to [Project Name] (unsafe)**
5. Review the permissions and click **Allow**

**Required Permissions:**
- View and manage spreadsheets
- View and manage documents
- View and manage files in Drive
- Manage drafts and send emails
- Connect to external services (for QR code API)

### 4. Test the Application

After authorization:
- You should be redirected to the dashboard
- If you see the login page again, check:
  - Your email is in the `allowed_users` list in config.js
  - The appsscript.json has `"access": "ANYONE"`
  - You've pushed the latest code with `clasp push`

## Troubleshooting

### Infinite Authorization Loop

**Symptoms**: Authorization popup appears repeatedly

**Causes & Solutions**:

1. **Wrong Access Setting**
   - Check `appsscript.json`: `"access"` must be `"ANYONE"`
   - If it says `"DOMAIN"`, change to `"ANYONE"` and redeploy

2. **Email Not in Config**
   - Verify your email in `config.js` → `auth.allowed_users`
   - Must match exactly (case-sensitive)

3. **Session.getEffectiveUser() Returns Empty**
   - This happens if OAuth permissions weren't granted
   - Solution: Create a **NEW deployment** (don't update existing)
   - New URL will trigger fresh OAuth flow

4. **Cache Issues**
   - Clear browser cache and cookies
   - Try in incognito/private browsing mode

### "Unauthorized" Error After Login

**Check**:
1. Your email is in `CONFIG.auth.allowed_users` (exact match)
2. You've pushed the updated config.js: `clasp push`
3. Check Apps Script execution logs:
   ```bash
   clasp logs
   ```
   - Look for: "Auth failed: User not authorized: [your-email]"

### Web App Shows Old Version

**Solution**: Create new deployment instead of updating existing one

```bash
# List existing deployments
clasp deployments

# Create NEW deployment (recommended after major changes)
clasp deploy --description "Web App v1.1 - Auth fix"
```

**Why?**: Google caches web app deployments aggressively. New deployments get new URLs that bypass cache.

### Checking Execution Logs

View detailed logs to debug authentication issues:

```bash
# View recent logs
clasp logs

# Or in Apps Script Editor:
# 1. clasp open
# 2. Go to "Executions" tab (left sidebar)
# 3. Click on recent executions to see logs
```

**Look for**:
- `Auth failed: No email in session` → OAuth not granted or access setting wrong
- `Auth failed: User not authorized: [email]` → Email not in allowed_users list
- `Auth success: [email] (role: admin)` → Everything working!

## Post-Deployment Configuration

### 1. Update Email Templates (Optional)

1. Open web app
2. Go to **Settings** page
3. Customize email templates for:
   - Quote emails
   - Follow-up emails
   - Testimonial requests
4. Click **Save**

### 2. Share Web App URL

- Give the web app URL to authorized users
- They'll need to authorize on first access
- Bookmark the URL for quick access

### 3. Updating the App

When you make changes:

```bash
# 1. Push changes
clasp push

# 2. For minor updates, update existing deployment
clasp deploy --deploymentId [YOUR_DEPLOYMENT_ID] --description "Bug fix"

# 3. For major changes, create new deployment
clasp deploy --description "Major update v1.1"
```

## Security Notes

### Access Control

- Only users in `CONFIG.auth.allowed_users` can access the app
- Even with `"access": "ANYONE"`, unauthorized users will see the login page
- Admin actions are restricted to users in `CONFIG.auth.admins`

### OAuth Scopes

The app requests these permissions:
- **Spreadsheets**: Read/write client data
- **Documents**: Generate quotes/invoices from templates
- **Drive**: Store generated PDFs
- **Gmail**: Create email drafts
- **External requests**: Generate QR codes for invoices

### Best Practices

1. **Keep Config Secure**: Don't commit real email addresses to public repos
2. **Regular Backups**: Your data is in Google Sheets - make regular backups
3. **Test New Features**: Use a separate deployment for testing
4. **Monitor Logs**: Check execution logs regularly for errors

## Architecture Reference

### Authentication Flow

```
User visits URL
    ↓
doGet() called
    ↓
authenticateRequest()
    ↓
Session.getEffectiveUser().getEmail()
    ↓
Check if email in CONFIG.auth.allowed_users
    ↓
If YES: Render requested page
If NO: Render login page
```

### Web App vs Modal System

**Web App** (Current):
- Dashboard, Clients, Calendar, Settings
- Full browser tab
- Bookmarkable URL
- Better for daily use

**Modal System** (Legacy - Still active):
- Quote Builder, Invoice Builder
- Opens from Sheets menu
- Will be migrated in Phase 2

Both systems share the same backend functions in Code.js and modalController.js.

## Next Steps

1. Test all pages:
   - Dashboard: Metrics and activity
   - Clients: List, search, details
   - Calendar: Project timeline
   - Settings: Email templates

2. Report any issues with:
   - Specific page/feature that failed
   - Error message or screenshot
   - Browser console logs (F12 → Console)
   - Apps Script execution logs (`clasp logs`)

3. Plan Phase 2:
   - Migrate Quote Builder to web app
   - Migrate Invoice Builder to web app
   - Deprecate modal system (optional)

4. Future features
   - User authentification
   - Multilangual handling
   - Automations 
---

**Need Help?**
- Check execution logs: `clasp logs`
- Review browser console: F12 → Console tab
- Check the WEBAPP_MIGRATION_PLAN.md for architecture details
