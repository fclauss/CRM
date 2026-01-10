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

✅ **Completed**: Dashboard Analytics & Visual Charts
- Revenue-focused layout with monthly CA as primary metric
- Real trend indicators with colored arrows (↗️ green, ↘️ red, → gray)
- Chart.js integration for visual analytics
- Revenue evolution line chart (6-month trend with formatted currency)
- Status distribution doughnut chart (pipeline health visualization)
- Quick action buttons for calendar and filtered client views
- 5-minute client-side caching with manual refresh
- Mobile-responsive design with adaptive layouts
- All trend calculations based on real month-over-month data

✅ **Completed**: Client Page Filtering & URL Parameter Handling
- Fixed server-side URL parameter passing through template injection
- Added status filter dropdown with 5 status options
- Automatic dropdown sync with URL parameters from dashboard
- Combined search term and status filtering
- One-click navigation from dashboard to filtered client views
- Resolved iframe URL parameter issue

✅ **Completed**: Quote & Invoice Builder Migration to Webapp
- Migrated modal-based quote/invoice builders to full-page webapp implementation
- Complete feature parity with original modal system
- URL-based routing: `?page=quote-builder&row=X` and `?page=invoice-builder&row=X`
- Dual-mode architecture (single file handles both quote and invoice modes)
- Full editor interface with sections → services hierarchy
- Real-time service search with autocomplete
- Preview view with business data forms (discount, duration, deposit, mentions)
- Auto-save draft system (30s interval with graceful degradation)
- Keyboard shortcuts: Ctrl+S (save), Ctrl+Enter (generate), Alt+N (add section), Esc (cancel)
- "Add new service" modal for expanding service catalog
- PDF generation with proper navigation flow
- Fixed navigation issues using window.top.location for reliable redirects
- Integrated with clients page (navigation buttons fully functional)
- Comprehensive testing completed for both quote and invoice workflows
- **Files created**: `pages/quote-builder.html` (~1240 lines)
- **Files modified**: `webapp.js`, `pages/components/api-helper.html`, `pages/clients.html`

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

### 3. Clients Page - Additional Enhancements
- [ ] Enhanced client list view
  - Better sorting options (by name, date, value, status)
  - Date range filtering
  - Search improvements (highlight matches)
  - Bulk actions (mass email, export)

- [ ] Improved client details panel
  - Tabbed interface (Info, Documents, History, Notes)
  - Timeline of interactions
  - Quick edit mode for contact info
  - Document preview/thumbnails
  - Add notes functionality

### 4. General Improvements
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
1. **High Priority**: Clients page additional enhancements (sorting, date range, bulk actions)
2. **Medium Priority**: Calendar-to-client navigation performance (server-side pre-loading)
3. **Low Priority**: Email template placeholders (French)
4. **Low Priority**: General UX improvements (loading skeletons, toast notifications, dark mode)

## Notes
- All changes should maintain backward compatibility with existing Google Sheets CRM
- Test thoroughly on mobile devices
- Keep French language consistency throughout
- Document any new API endpoints added
