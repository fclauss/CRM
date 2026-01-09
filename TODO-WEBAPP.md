# Web App Improvements - TODO List

## Session Status
✅ **Completed**: Fixed all JavaScript syntax errors across clients, calendar, and settings pages
- All pages now load without errors
- Basic functionality working

✅ **Completed**: 3-month calendar view with interactive navigation
- Visual calendar grid showing current month + 2 upcoming months
- Project markers on relevant dates with color-coded status
- Interactive project selection (click to navigate to client)
- Unplanned projects section
- Legend for project status colors
- Auto-selection using sessionStorage (survives OAuth redirects)

✅ **Completed**: Invoice Counter Management
- Added `getInvoiceCounter()` and `resetInvoiceCounterApi()` backend functions
- Created API endpoints for invoice counter operations
- Implemented user-friendly UI with input field and "Définir le compteur" button
- Accessible to all users (not just admin)
- Set specific invoice number (not just reset to 0)
- Double confirmation with current vs. new counter display
- Fixed API helper to expose methods correctly

✅ **Completed**: Spreadsheet Quick Access Link
- Added "Accès rapide" section in Settings page
- Direct link to Google Sheets for power users
- Opens in new tab with clear visual indicator
- Positioned after user profile section

## Planned Improvements for Next Session

### 1. Calendar Page - Performance Enhancement
- [ ] Speed up calendar-to-client navigation
  - **Current implementation**: Client-side only (loads all clients, then finds and selects)
  - **Proposed improvement**: Server-side pre-loading of specific client details
  - Parse row parameter in `webapp.js` before page render
  - Fetch specific client data server-side via `getClientDetails(row)`
  - Inject pre-selected client data as global variable for instant display
  - Maintain client-side fallback for compatibility
  - **Impact**: Faster perceived performance, instant client details display
  - **Files to modify**: `webapp.js`, `pages/clients.html`, `api.js`

### 2. Settings Page - Email Templates
- [ ] Replace English placeholders with French equivalents
  - Current: `{{CLIENT_NAME}}`, `{{QUOTE_NUMBER}}`, `{{QUOTE_LINK}}`
  - Proposed: `{{NOM_CLIENT}}`, `{{NUMERO_DEVIS}}`, `{{LIEN_DEVIS}}`
  - Add tooltip/help text explaining each placeholder in French
  - Update backend to support both French and English placeholders for backward compatibility

### 3. Dashboard Data Handling
- [ ] Improve data loading and display
  - Optimize API calls (reduce redundant requests)
  - Add proper loading states
  - Implement error handling with user-friendly messages
  - Add refresh functionality
  - Consider caching strategy for better performance

### 4. UI/UX Improvements

#### Dashboard Page
- [ ] Better metric cards layout
  - More visual hierarchy
  - Add icons for each metric
  - Improve color scheme consistency
  - Add trend indicators (up/down arrows)
  - Better spacing and typography

- [ ] Improved charts/graphs
  - Consider adding revenue chart
  - Project timeline visualization
  - Status distribution (pie/donut chart)

- [ ] Quick actions section
  - Prominent buttons for common tasks
  - Recent activity feed
  - Notifications/alerts area

#### Clients Page
- [ ] Enhanced client list view
  - Better sorting options (by name, date, value, status)
  - Filter dropdown (by status, date range)
  - Search improvements (highlight matches)
  - Bulk actions (mass email, export)

- [ ] Improved client details panel
  - Tabbed interface (Info, Documents, History, Notes)
  - Timeline of interactions
  - Quick edit mode for contact info
  - Document preview/thumbnails
  - Add notes functionality

- [ ] Better mobile responsiveness
  - Optimize for tablet/phone views
  - Touch-friendly controls
  - Collapsible sections

### 5. General Improvements
- [ ] Add loading skeletons instead of spinners
- [ ] Implement toast notifications system
- [ ] Add keyboard shortcuts for power users
- [ ] Improve error messages (more specific, actionable)
- [ ] Add help/documentation tooltips
- [ ] Implement dark mode toggle (optional)

## Technical Considerations

### Performance
- Implement pagination correctly (already started)
- Add debouncing to search inputs
- Lazy load images/documents
- Consider service worker for offline support

### Accessibility
- Add proper ARIA labels
- Ensure keyboard navigation works
- High contrast mode support
- Screen reader compatibility

### Data Consistency
- Implement optimistic updates with rollback
- Add conflict resolution for concurrent edits
- Better error recovery mechanisms

## Priority Order (Suggested)
1. **High Priority**: Dashboard data handling + UI improvements
2. **High Priority**: Clients page UI/UX enhancements
3. **Medium Priority**: Calendar-to-client navigation performance (server-side pre-loading)
4. **Low Priority**: Email template placeholders (French)

## Notes
- All changes should maintain backward compatibility with existing Google Sheets CRM
- Test thoroughly on mobile devices
- Keep French language consistency throughout
- Document any new API endpoints added
