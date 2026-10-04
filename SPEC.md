# SPEC.md — Style et Matière CRM v4.0 (full rebuild specification)

> **Audience:** Claude Code only. Fabien's manual preparation steps are in `PREPARATION.md` and are assumed done before Phase 0; if something from it is missing (a Script Property, a clasp file), stop and ask.
>
> **Scope:** rebuild the CRM as a clean Google Apps Script web app for **one business, Style et Matière (Stéphane Mattel)**. Do not design for multi-client use.
>
> **Starting point:** branch `feature/webapp-migration`. Its code is moved to `legacy/` for reference (see §14) and deleted at the end.
>
> **Language:** UI text is in French, with correct accents. Code, comments and docs are in English.
>
> **How to use this spec:**
> - Rules carry IDs (`BR-xx`, `NFR-xx`). Tests reference these IDs.
> - Work phase by phase (§17). A phase is done only when its Definition of Done is met.
> - If the spec is ambiguous, ask Fabien instead of guessing.

---

## 1. Context and constraints

| Topic | Fact |
|---|---|
| Users | Stéphane (`ms.styleetmatiere@gmail.com`), the only daily user. Fabien (`fabien.clauss@gmail.com`) for support. |
| Devices | Mostly an **iPad (Safari)**, often on site with a poor connection. Also a desktop browser. |
| Platform | Google Apps Script (V8) web app. Data in one Google Sheet. Documents in Google Docs/Drive. Emails as Gmail drafts. |
| Execution | `executeAs: USER_ACCESSING`. Files and Gmail drafts are created in the account of **whoever uses the app**. |
| Spreadsheet | Stays directly accessible to Stéphane. The app must survive light manual edits (see NFR-07). |
| Out of scope | Invoicing (moving to external e-invoicing), QR codes, multi-client use, modal UI inside Sheets, public intake form. |

---

## 2. Decisions log (agreed with Fabien)

1. The target is the standalone web app. The modal UI is removed.
2. Invoicing and all QR codes are removed completely.
3. **Clients → Projets → Devis** data model. A client is unique by **email**.
4. Several quotes and variants per project. Variants are numbered `2026-0012-A`, `-B`…
5. Quote statuses are `Nouveau`, `Devis envoyé`, `Projet gagné`, `Non retenu`, `Annulé`. Nothing is enforced; every change is logged with a timestamp. Project and client statuses are derived.
6. The deposit (acompte) stays on quotes as text, paid in cash or by transfer. There is no QR code.
7. Emails are **Gmail drafts only**, with the quote PDF(s) attached. Nothing is ever sent automatically.
8. Only Stéphane uses the contact form, on his iPad. It must work offline.
9. Access is limited to the 2 emails above. There is no extra login step; the existing Google session is used.
10. The dashboard revenue is **« CA signé HT »**: total excl. VAT of accepted quotes, grouped by month of acceptance.

**Further decisions:**

11. Creating a draft does not change any status. A « Marquer comme envoyé » button does.
12. A quote can be edited only while it is `Nouveau`. After that, changes go into a new variant.
13. One email can carry several variants of a project.
14. The deposit % is set per quote, default 30.
15. Winning a quote no longer fills the project start date automatically.
16. The UI is a **single-page app** (SPA): one page load, then instant view switches.
17. A weekly automatic **backup** of the spreadsheet is added.
18. The colour palette follows the **official logo**: charcoal and yellow (§7.1).
19. The services catalogue gets its **own editing screen** in the app (§7.3 « Catalogue »). The sheet stays editable as a fallback.

---

## 3. Architecture and conventions

### 3.1 Repository layout

```
/                       # repo root
├── CLAUDE.md           # short working rules for Claude Code (see §18.1)
├── SPEC.md             # this file
├── README.md           # setup, commands, deployment
├── package.json        # scripts: check, lint, typecheck, test, test:e2e, push:dev, push:prod
├── jsconfig.json       # checkJs + @types/google-apps-script
├── eslint.config.js  .prettierrc  jest.config.js  playwright.config.js
├── .clasp.dev.json.example  .clasp.prod.json.example   # real files are gitignored
├── src/                # clasp rootDir: ONLY this folder is pushed
│   ├── appsscript.json
│   ├── server/
│   │   ├── main.js         # doGet, include(), page shell
│   │   ├── api.js          # ALL client-callable functions (api*) - thin wrappers
│   │   ├── config.js       # constants, defaults, enums (no IDs: those are Script Properties)
│   │   ├── auth.js         # Auth namespace
│   │   ├── data.js         # Data namespace: sheet access, schema check, locking
│   │   ├── clients.js  projects.js  quotes.js  history.js
│   │   ├── documents.js    # Doc and PDF generation
│   │   ├── emails.js  dashboard.js  calendar.js  settings.js  contact.js
│   │   ├── maintenance.js  # backup, error journal, triggers
│   │   ├── migration.js    # one-time v3 → v4 migration
│   │   └── lib/            # PURE logic, no GAS services (unit-tested in Node)
│   │       ├── numbering.js  totals.js  status.js  validation.js
│   │       ├── placeholders.js  format.js  dates.js  revenue.js  legacy.js
│   ├── ui/
│   │   ├── index.html      # SPA shell: header, nav, view container
│   │   ├── styles.html     # design tokens and components (§7.1)
│   │   ├── core.html       # api.call(), router, store, toast, modal, escapeHtml, formatters
│   │   └── views/          # dashboard, clients, client-detail, quote-builder, calendar, settings, contact-form
│   └── tests_gas/
│       └── integration.js  # runs ONLY when Script Property ENV=dev
├── tests/
│   ├── unit/  static/  e2e/  fixtures/
├── dev/
│   └── preview-server.js   # local SPA preview with mocked google.script.run (§16.3)
├── docs/                   # ACCEPTANCE.md, DEPLOYMENT.md
└── legacy/                 # old code, read-only reference, deleted in the final phase
```

### 3.2 Coding rules

- **Language:** plain JavaScript (V8) with **JSDoc types**, type-checked by `tsc --noEmit` (`checkJs: true`, `@types/google-apps-script`). Do not use TypeScript or a bundler; files stay editable in the Apps Script editor for emergency fixes.
- **Namespaces:** every server file defines **one namespace object**, e.g. `var Quotes = (function () { … return { generate, … }; })();`. The only top-level functions allowed are `doGet`, `include`, the `api*` functions, trigger handlers, and the admin functions `runIntegrationTests`, `migrateToV4`, `setupTriggers`, plus argument-free editor entry points `migrateDryRun()`, `migrateRun()` and `logHealthCheck()`. These exist because the Apps Script editor can't pass arguments; they log a readable result. This prevents duplicate global names and keeps internals uncallable from the browser.
- **Pure lib files:** they must not touch GAS services. End each file with `if (typeof module !== 'undefined') module.exports = <Namespace>;` so Jest can load it.
- **Load order:** do not reference another namespace at file top level; only inside functions (GAS file load order is not guaranteed).
- **Data access:** only `Data` may call `SpreadsheetApp`. Always open the spreadsheet by ID. **Never** use `getActiveSpreadsheet()`.
- **Column access:** always by header name through `CONFIG.sheets.<sheet>.columns`. Never by column index.
- **Return values:** every `api*` returns a JSON-safe envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. There are no `Date` objects (use ISO strings) and no `undefined` inside arrays.
- **Error text:** messages shown to the user are in French and actionable, e.g. « Adresse email déjà utilisée par le client X ».
- **Security:** always escape user data with `escapeHtml` before inserting HTML. Never build HTML from unescaped strings.
- **File size:** no file over ~600 lines. Split by responsibility.

### 3.3 Configuration

`config.js` holds enums, labels and defaults:
- statuses, work types with VAT rates, request types, client types, referral sources;
- `validity_days: 90`, `default_deposit_pct: 30`, `followup_after_days: 7`;
- the default email templates and the renovation attestation text.

**Environment-specific IDs are Script Properties**, never in code:

| Property | Meaning |
|---|---|
| `SPREADSHEET_ID` | the CRM spreadsheet |
| `QUOTE_TEMPLATE_ID` | Google Doc quote template |
| `QUOTE_FOLDER_ID` | Drive folder for generated quotes |
| `BACKUP_FOLDER_ID` | Drive folder for weekly backups |
| `ENV` | `dev` or `prod` |
| `ADMIN_EMAIL` | `fabien.clauss@gmail.com` |

`Config.get_(key)` throws a clear error if a property is missing. `apiHealthCheck` (§6) reports missing properties.

---

## 4. Data model

All sheets live in the spreadsheet `SPREADSHEET_ID`.

- Row 1 holds headers, which are **French and exact**.
- IDs are strings.
- Dates are stored as real date cells and returned as ISO strings.
- Money is stored as numbers rounded to cents.
- Every entity sheet has `Créé le` and `Modifié le`.

### 4.1 `Clients`

| Header | Key | Rules |
|---|---|---|
| ID Client | `id` | `CL-0001`, sequential, under lock |
| Type de client | `client_type` | Particulier / Professionnel |
| Nom du Client / Raison Sociale | `name` | required |
| Nom du Contact Principal | `contact` | |
| Adresse · Code Postal · Ville | `address` `postal_code` `city` | postal code is 5 digits |
| Adresse Email | `email` | required, **unique**, stored `trim().toLowerCase()` (BR-01) |
| Numéro de Téléphone | `phone` | stored as text (keeps the leading 0) |
| Source | `referral_source` | from the first contact |
| Créé le · Modifié le | | |

### 4.2 `Projets`

| Header | Key | Rules |
|---|---|---|
| ID Projet | `id` | `PR-0001` |
| ID Client | `client_id` | foreign key |
| Type de demande | `request_type` | |
| Détail du Projet | `details` | |
| Type de travaux | `work_type` | drives the VAT rate |
| Statut manuel | `manual_status` | empty, `Terminé` or `Annulé` |
| Date Début · Date Fin Prévue | `start_date` `end_date` | set manually; end ≥ start |
| Notes Internes | `notes` | max 2000 characters, never printed |
| ID Soumission | `submission_id` | UUID, unique when set (BR-40) |
| Créé le · Modifié le | | |

### 4.3 `Devis`

| Header | Key | Rules |
|---|---|---|
| Devis N° | `number` | **primary key** (BR-10) |
| ID Projet · ID Client | `project_id` `client_id` | |
| Variante · Libellé Variante | `variant` `variant_label` | `A`…; empty for legacy quotes |
| Statut | `status` | §5.3 |
| Date du Devis · Date de Validité | `date` `validity_date` | |
| Taux TVA · Remise % · Acompte % | `vat_rate` `discount_pct` `deposit_pct` | frozen at generation |
| Total HT · Montant TVA · Total TTC · Montant Acompte | numbers | §5.2 |
| Délai Estimé | `duration` | free text, e.g. « 3 jours » |
| Mentions (JSON) | `mentions` | array of strings |
| Contenu (JSON) | `content` | `{sections:[{name, lines:[{serviceId, description, unit, qty, unitPrice}]}]}` |
| Lien Doc · Lien PDF | `doc_url` `pdf_url` | |
| Créé le · Modifié le | | |

### 4.4 Supporting sheets

- **`Historique`** is append-only: `Horodatage | Type (Devis/Projet) | ID | Ancien statut | Nouveau statut | Utilisateur | Origine (manuel/auto/migration)`.
- **`Services`** keeps its existing columns `ID Prestation | Type | Catégorie | Description | Unité | Prix Unitaire HT`, and adds `Actif | Modifié le`.
  - It is edited through the **Catalogue** view (§7.3) or directly in the sheet.
  - A missing `ID Prestation` is generated as `SRV-0001` and written back.
  - A blank `Actif` counts as `Oui`.
  - Services are never deleted, only deactivated (BR-72).
- **`Mentions`**: column A holds one mention per row.
- **`Paramètres`**: key/value rows. It stores the email templates, the signature and any overrides of defaults. It is shared by both users; UserProperties are not used.
- **`Journal`**: `Horodatage | Fonction | Code | Message | Utilisateur`. It keeps the last 500 rows and never stores client email or phone numbers.
- **`Archive – Form Responses 1`**: legacy data after migration. Read-only, never deleted.

### 4.5 Data layer (`Data` namespace)

- `Data.table(name)` reads each sheet **once per request** (`getDataRange().getValues()`), caches it for the rest of that execution, and returns objects keyed by column key.
- `Data.insert(name, obj)` and `Data.update(name, id, patch, expectedUpdatedAt)` write only the cells that change.
- **Optimistic concurrency (BR-50):** an update whose `expectedUpdatedAt` differs from the stored `Modifié le` is rejected with `CONFLICT` and the message « Données modifiées ailleurs, rechargez ».
- **Locking:** `Data.withLock(fn)` wraps `LockService.getScriptLock().waitLock(20000)`. Every ID or number allocation and every multi-row write goes through it.
- **Schema check:** `Data.assertSchema()` runs on the first access in each execution. Missing headers produce `SCHEMA_ERROR`, with the sheet and header named. Extra columns are tolerated.
- **Tolerant parsing:** trim strings; parse numbers written with a comma decimal (« 12,5 »); treat blank rows as absent.

---

## 5. Business rules

### 5.1 Clients and projects

- **BR-01:** client emails are normalised (trim, lowercase) and unique. Creating or editing a client with an existing email is rejected, naming the existing client.
- **BR-02:** a request for an existing email creates a **new project under that client**. If the submitted contact data differs, the user chooses whether to update the client record.
- **BR-03:** deleting records is not supported in the UI. Use the status `Annulé` instead.

### 5.2 Totals (`lib/totals.js`)

- **BR-20:** `lineTotal = round2(qty × unitPrice)`, `subtotal = Σ lineTotal`.
- **BR-21:** `discount = round2(subtotal × discountPct / 100)`, `totalHT = subtotal − discount`.
- **BR-22:** `vat = round2(totalHT × vatRate / 100)`, `totalTTC = totalHT + vat`.
- **BR-23:** `deposit = round2(totalTTC × depositPct / 100)`.
- **BR-24:** `vatRate` is 10 if the work type contains « rénovation » (case-insensitive), otherwise 20. It comes from the project at generation time and is frozen on the quote.
- **BR-25:** a quote needs at least one line. `qty` must be > 0, `unitPrice` ≥ 0 and `discountPct` between 0 and 100. `depositPct` must be between 0 and 100.
- `round2` rounds half away from zero to 2 decimals. Formatting uses `fr-FR`, with a narrow no-break space and `€`.

### 5.3 Numbering (`lib/numbering.js`)

- **BR-10:** a new base number is `YYYY-NNNN`, where `NNNN` = the highest number for the current year across all `Devis` rows (legacy and suffixed) + 1, padded to 4 digits. The counter resets every year.
- **BR-11:** the first quote of a project gets suffix `-A`. Later quotes in the **same project** keep the base and take the next free letter after the highest existing one.
- **BR-12:** a legacy quote without a suffix counts as `A`, so its variants start at `-B`.
- **BR-13:** a variant created in a later year keeps its original base.
- **BR-14:** numbers are allocated only at generation time, under lock. Drafts have no number.

### 5.4 Statuses

- **BR-30:** quote statuses are `Nouveau`, `Devis envoyé`, `Projet gagné`, `Non retenu`, `Annulé`. Any status can change to any other. Every change made by the app appends to `Historique`. Setting the same status again is a no-op and is not logged.
- **BR-31:** when a quote becomes `Projet gagné`, every other quote in the **same project** with status `Nouveau` or `Devis envoyé` becomes `Non retenu` (origin `auto`). Reverting the winner does not revert its siblings.
- **BR-32:** the derived project status (`lib/status.js`) uses the first rule that matches:
  1. manual status `Terminé` → **Terminé**;
  2. any quote `Projet gagné` → **Projet gagné**;
  3. manual status `Annulé` → **Annulé**;
  4. any quote `Devis envoyé` → **Devis envoyé**;
  5. at least one quote exists and all are `Annulé` or `Non retenu` → **Annulé**;
  6. otherwise → **Nouveau**.
- **BR-33:** the client status is the derived status of the client's most recent project (by `Créé le`).
- **BR-34:** only a quote in status `Nouveau` can be edited and regenerated. Any other status makes the quote read-only.
- **BR-35:** the acceptance date of a quote is the timestamp of the latest `Historique` entry that set it to `Projet gagné`. Legacy quotes without such an entry use the quote date.

### 5.5 Dashboard figures (`lib/revenue.js`)

- **BR-60:** « CA signé HT » is the sum of `Total HT` of quotes whose current status is `Projet gagné`, grouped by the month of acceptance (BR-35). The UI subtitle reads: « Total HT des devis acceptés, par mois d'acceptation ».
- **BR-61:** « Devis en attente » is the count and sum of `Total HT` of quotes in `Devis envoyé`.
- **BR-62:** « Taux de conversion (12 mois) » = projects with a won quote ÷ projects with at least one quote sent or won, restricted to projects created in the last 12 months.
- **BR-63:** the « Actions requises » list contains:
  - quotes in `Devis envoyé` for more than `followup_after_days` since the status change → « Relancer »;
  - projects `Projet gagné` without a start date → « Planifier »;
  - projects `Nouveau` without any quote for more than 3 days → « Préparer le devis ».

### 5.6 Contact form

- **BR-40:** every submission carries a UUID `submissionId` created on the device. Submitting the same ID again returns the existing project and creates nothing.
- **BR-41:** server-side validation (`lib/validation.js`):
  - name, email, address, postal code (5 digits), city and request type are required;
  - email format is checked;
  - the phone is optional; it is normalised to digits and must contain 10 digits if present.

---

### 5.7 Services catalogue (`lib/validation.js`)

- **BR-70:** description, unit and type are required. Unit price is a number ≥ 0, entered with a comma or a dot and stored rounded to cents. Type is `Intérieur` or `Extérieur`. Category is free text, suggested from existing categories.
- **BR-71:** a service with the same description and unit (case- and accent-insensitive) as another **active** service is rejected. The error names the existing service.
- **BR-72:** deactivating a service (`Actif` = `Non`) hides it from the builder search. It has no effect on existing quotes, because quotes store their own copy of each line (description, unit, price).
- **BR-73:** changing a price affects only quotes generated afterwards. A draft keeps the prices already in its lines.

## 6. Server API (`src/server/api.js`)

Each function starts with `Auth.requireUser()`, then delegates to a namespace, and is wrapped by `Api.handle_()` (envelope, try/catch, `Journal` logging). Arguments are plain objects. Write functions return the **updated entity** so the client store can refresh without reloading.

| Function | Purpose |
|---|---|
| `apiBootstrap()` | user, config enums and labels, services, mentions, settings, app version. One call at shell load |
| `apiListClients()` | clients with derived status, project count, last activity |
| `apiGetClient(clientId)` | the client, its projects, their quotes and a history timeline |
| `apiUpdateClient(clientId, patch, expectedUpdatedAt)` | BR-01 and BR-50 |
| `apiCreateProject(clientId, data)` / `apiUpdateProject(projectId, patch, expectedUpdatedAt)` | |
| `apiSetProjectManualStatus(projectId, status or '')` | logged |
| `apiGetQuoteDraft(key)` / `apiSaveQuoteDraft(key, draft)` / `apiClearQuoteDraft(key)` | ScriptProperties, key `draft:<projectId>:new` or `draft:<number>` |
| `apiGenerateQuote({projectId, fromNumber?, editNumber?, content, business})` | §8 |
| `apiSetQuoteStatus(number, status)` | BR-30 and BR-31; returns every quote it changed |
| `apiMarkQuotesSent(numbers[])` | sets them to `Devis envoyé` |
| `apiCreateQuoteEmailDraft(numbers[])` / `apiCreateFollowUpDraft(numbers[], attachPdf)` / `apiCreateTestimonialDraft(projectId)` | §9 |
| `apiDashboard()` / `apiCalendar(fromIso, months)` | |
| `apiSubmitContactForm(payload)` | BR-40, BR-41, BR-02 |
| `apiFindClientByEmail(email)` | for the returning-client banner |
| `apiListServices({includeInactive})` | catalogue for the Catalogue view |
| `apiSaveService(service, expectedUpdatedAt?)` | create (without `id`) or update; BR-70, BR-71, BR-50; invalidates the cache |
| `apiSetServiceActive(id, active)` | BR-72; invalidates the cache |
| `apiExportServicesCsv()` | writes `Catalogue prestations yyyy-mm-dd.csv` to the quotes folder and returns its URL |
| `apiImportServicesCsv(csvText, {dryRun})` | bulk update from a pasted CSV with the same columns; returns a per-row report; applied only if `dryRun` is false and there are no errors |
| `apiGetSettings()` / `apiSaveSettings(patch)` / `apiResetEmailTemplates()` | |
| `apiHealthCheck()` | Script Properties, schema, template placeholders, folder access |

- **Caching:** `CacheService` (script cache, 10 min) holds services, mentions and settings, and is invalidated on write.
- **Heavy reads:** dashboard and client-list data are computed in one pass over the tables.

---

## 7. User interface

### 7.1 Design system (`styles.html`)

- **Brand:** the colours come from the official logo.

  | Token | Value |
  |---|---|
  | `--ink` | `#2D2824` (charcoal) |
  | `--accent` | `#FFE812` (logo yellow) |
  | `--bg` | `#FAFAF7` |
  | `--surface` | `#FFFFFF` |
  | `--border` | `#E4E1DA` |
  | `--text` | `#2D2824` |
  | `--muted` | `#6B665F` |

  - Yellow is only ever a background or fill with charcoal text, never text on white (contrast).
  - All colours are tokens, so a palette change is a one-file edit.
- **Status colours** (as a chip with a text label, never colour alone):

  | Status | Colour |
  |---|---|
  | Nouveau | slate |
  | Devis envoyé | amber |
  | Projet gagné | green |
  | Terminé | charcoal |
  | Non retenu | grey |
  | Annulé | red |

- **Typography:**
  - Headings: Playfair Display (brand guide), with fallback Georgia and serif.
  - Body: `-apple-system, system-ui, "Segoe UI", Roboto, sans-serif` at 16px, line-height 1.5.
  - Fonts load non-blocking; the app must render correctly without them (offline).
- **iPad-first:**
  - Touch targets at least 44×44 px.
  - Inputs at 16px or larger, so Safari doesn't zoom in.
  - `inputmode="decimal"` for prices and quantities (comma accepted); `inputmode="numeric"` for postal codes; `type="email"` and `type="tel"` where relevant.
  - Layout works from 768px wide, portrait and landscape, up to desktop.
- **Components:**
  - header with logo text and navigation: Tableau de bord · Clients · Calendrier · Catalogue · Nouveau contact · Paramètres;
  - cards, tables that become card lists below 900px, status chips;
  - toasts: success 3 s, errors stay until dismissed;
  - a confirmation modal for impactful actions;
  - skeleton loaders;
  - empty states with a primary action.
- **Accessibility:** labels are tied to inputs, focus is visible, and the pages meet WCAG AA contrast.

### 7.2 Shell and navigation (`index.html` and `core.html`)

**Loading:**
- `doGet` serves the shell once:
  - title « Style et Matière – CRM »;
  - `addMetaTag('viewport', 'width=device-width, initial-scale=1')`;
  - XFrameOptionsMode left at the default (not `ALLOWALL`).
- **Unauthorised users** get a simple page: « Accès non autorisé », the detected email, and a hint to switch Google account.

**Routing:**
- The client-side router uses `google.script.history.push()` and `google.script.url.getLocation()`.
- Deep links work on first load: `?view=client&id=CL-0001`, `?view=project&id=PR-0001`, `?view=quote-builder&project=PR-0001[&from=…|&edit=…]`, `?view=calendar`, `?view=contact`.
- The browser Back button works.

**Data:**
- A `store` loads `apiBootstrap` plus the current view's data.
- Views render from the store and refresh in the background (stale-while-revalidate).
- After a write, the store is updated from the returned entity. There is no full reload.
- `api.call(name, ...args)` is the **only** way to reach the server. It handles the envelope, shows errors as toasts, and retries once on network errors for read calls only.

**Offline:**
- A global banner shows « Hors ligne ».
- Write actions are disabled offline, except the contact form (§10).

### 7.3 Views

**Tableau de bord**
- KPI cards: CA signé HT for the current month, with a trend arrow against the previous month (BR-60); Devis en attente (BR-61); Taux de conversion (BR-62); Projets gagnés this month.
- Charts (Chart.js from a CDN, pinned version, lazy-loaded): CA signé HT over the last 6 months as a bar chart, and project status distribution.
- « Actions requises » (BR-63), each with a one-tap action.
- « Activité récente »: the last 10 `Historique` entries plus quote generations.
- Refresh button.

**Clients**
- The list is searchable by name, email, city or quote number, with 250 ms debounce and highlighted matches.
- Status filter and sort (name, last activity, status).
- Each row shows name, city, derived status chip, number of projects and last activity.
- « Nouveau client » opens the contact form.

**Fiche client** (`?view=client`)
- Contact block with inline edit (BR-01, BR-50).
- Project cards, newest first. Each card shows:
  - request type, work type, derived status, dates (editable), notes (autosaved 1 s after typing stops), and the actions « Marquer terminé », « Annuler le projet », « Rouvrir »;
  - a quote table: number, variant label, date, status dropdown, Total HT and TTC, Doc and PDF links;
  - quote actions: « Modifier » (only if `Nouveau`), « Créer une variante », « Dupliquer vers un autre projet »;
  - a checkbox per quote, plus the buttons « Préparer l'email », « Relance », « Marquer comme envoyé »;
  - a mini timeline built from `Historique`.
- « Nouveau devis » on each project; « Nouveau projet » on the client.

**Créateur de devis**

*Header*
- Shows client, project, and the future number (« 2026-00xx-B », marked as provisional).

*Editor*
- Sections (« pièces »): add, rename, delete (with confirmation), reorder with up/down buttons.
- Lines:
  - added through the catalogue search (description, category, type), grouped by category;
  - after insertion, description, qty, unit and unit price can be edited;
  - reorder with up/down, delete.
- « Ajouter une prestation au catalogue » opens the same form as the Catalogue view (BR-70, BR-71) and adds the new service straight into the current section.

*Business panel*
- Libellé variante, délai estimé, remise %, acompte % (default 30) and mentions (checkboxes).

*Totals*
- A live panel shows sous-total, remise, HT, TVA (with its rate), TTC and acompte, computed by the same `lib/totals.js` code as the server (shared through `include`).

*Draft and generation*
- Autosave the draft every 15 s and when the page is hidden. Offer to restore a draft on open.
- The preview step shows the exact totals. « Générer le devis » then asks for confirmation.
- On success:
  - show links to the Doc and PDF;
  - show any warnings (leftover placeholders);
  - show the actions « Préparer l'email » and « Retour à la fiche ».

*Guards and shortcuts*
- Warn before leaving with unsaved changes.
- Keyboard shortcuts on desktop only: Ctrl+S save, Ctrl+Enter generate, Esc cancel.

**Calendrier**
- 3-month grid (current month and the next two, with previous and next navigation).
- Project bars from start to end, coloured by status.
- A list « À planifier » (BR-63).
- Tapping a project opens its client record, scrolled to that project.

**Catalogue** (`?view=services`)

*List*
- Searchable (description, category) and filterable by type, category and Actif/Inactif (inactive services hidden by default).
- Grouped by category. Each row shows description, unit, price HT, type and an Actif toggle.

*Editing*
- « Nouvelle prestation » and tapping a row open a form panel: Type, Catégorie (with autocomplete), Description, Unité (with suggestions: m², ml, u, h, forfait), Prix unitaire HT.
- Validation follows BR-70 and BR-71.
- Saving uses optimistic concurrency (BR-50).
- Deactivating asks for confirmation and explains BR-72.
- « Dupliquer » pre-fills the form from an existing service.

*Import and export*
- « Exporter CSV » creates a CSV file in the quotes folder (`apiExportServicesCsv`) and opens its Drive link. Browser downloads are unreliable inside the Apps Script iframe on iPad Safari.
- « Importer CSV » accepts pasted text. It shows the dry-run report first (new / modified / errors), then « Appliquer ».

*Price changes*
- Each save shows a note that only future quotes are affected (BR-73).

**Nouveau contact** (§10)

**Paramètres**
- Email templates editor: 3 templates, a placeholder help list, a live preview with sample data, and a reset button.
- Signature and defaults (validity days, deposit %, follow-up days).
- Quick links: spreadsheet, quotes folder, backups folder.
- Health check (`apiHealthCheck`) with green or red lines.
- The last 20 `Journal` errors.
- Last backup date and app version.

### 7.4 UX rules

- Every write shows a pending state, then a success or error toast.
- Buttons are disabled while their action runs, to prevent double submits.
- Destructive or irreversible actions ask for confirmation: generating a quote, cancelling a project, resetting templates.
- Dates are shown as `dd/mm/yyyy` and money as `1 234,56 €`. All server dates use the time zone `Europe/Paris`.

---

## 8. Document generation (`documents.js`)

### 8.1 Steps (`Quotes.generate`)

1. Validate (BR-25).
2. **Under lock:** allocate the number (BR-10–14), write the `Devis` row with status `Nouveau`, and release the lock.
3. Copy the template to `QUOTE_FOLDER_ID`, named `Devis <N°> - <Client>`.
4. Insert the services table at `{{TABLEAU_SERVICES}}`. Port `insertServicesTable` and `styleServicesTable` from legacy, and use `--accent` for the header row.
5. Replace the placeholders in the body **and** the header.
6. Handle the conditional blocks (discount, attestation).
7. `saveAndClose`, then export the PDF to the same folder.
8. Update the row with links and totals, log `Nouveau` in `Historique`, and clear the draft.
9. **On failure after step 2:** trash any created files, mark the row as failed, and return an error. Retrying reuses the same number.

**Regenerating** a quote in status `Nouveau` (BR-34): same number, the old Doc and PDF go to the trash (`setTrashed(true)`, never a permanent delete), then new files are created.

### 8.2 Placeholders (`lib/placeholders.js` defines the map)

| Group | Placeholders |
|---|---|
| Identification | `{{devis_numero}}` `{{devis_date}}` `{{devis_validity_date}}` `{{LIBELLE_VARIANTE}}` |
| Client | `{{client_name}}` `{{client_address}}` `{{client_postal_code}}` `{{client_city}}` `{{client_email}}` `{{client_phone}}` |
| Project | `{{work_type}}` `{{estimated_duration}}` |
| Services | `{{TABLEAU_SERVICES}}` |
| Totals | `{{SOUS_TOTAL_HT}}` `{{TVA_TAUX}}` `{{MONTANT_TVA}}` `{{TOTAL_TTC}}` `{{ACOMPTE_TAUX}}` `{{MONTANT_ACOMPTE}}` |
| Conditional content | `{{renovation_attestation}}` (text only when VAT is 10%) · `{{MENTION_SPECIALE}}` · `{{LIGNE_REMISE}}…{{/LIGNE_REMISE}}` with `{{LIGNE_REMISE_LABEL}}` and `{{LIGNE_REMISE_VALEUR}}` (the block is removed when the discount is 0) |

**Replacement values:**
- Escape regex specials in the search pattern (`replaceText` uses regex).
- Escape `$` in replacement values.

**After replacement:**
- Scan for leftover `\{\{[^}]+\}\}`. Each one found becomes a **warning** returned to the UI and logged.
- `apiHealthCheck` verifies that the template contains every required placeholder, each written exactly and not split by formatting.

---

## 9. Emails (`emails.js`)

**Quote email draft** (`apiCreateQuoteEmailDraft`):
- Takes 1 to n quotes of the **same project**; mixing projects is rejected.
- Attaches each stored PDF. A missing PDF is exported first.
- Subject: `Style et Matière – Devis n° {{QUOTE_NUMBERS}} – {{CLIENT_NAME}}`.
- For several quotes, `{{QUOTE_LIST}}` renders one line per quote: « Variante A – Finition standard : 1 234,56 € TTC ».

**Follow-up and testimonial drafts:**
- The follow-up uses the `followup` template, with PDFs attached optionally.
- The testimonial draft is per project.

**Placeholders** (French names, with the old English names accepted as aliases):

| Placeholder | Content |
|---|---|
| `{{NOM_CLIENT}}` | client name |
| `{{NUMEROS_DEVIS}}` | quote number(s) |
| `{{LISTE_DEVIS}}` | one line per quote (see above) |
| `{{TYPE_TRAVAUX}}` | work type |
| `{{MONTANT_TTC}}` | total incl. VAT |
| `{{DATE_DEVIS}}` | quote date |
| `{{DATE_VALIDITE}}` | validity date |
| `{{JOURS_DEPUIS_ENVOI}}` | days since sent |
| `{{SIGNATURE}}` | signature |

The signature (name, role, address, phone) is a separate setting. Port the default template texts from `legacy/config.js` and move the signature lines into `{{SIGNATURE}}`.

**After creating a draft:**
- Return the draft ID and a Gmail link.
- The UI says: « Brouillon créé dans la boîte Gmail de <utilisateur> » and offers « Marquer comme envoyé ».
- No status changes (decision 11).

---

## 10. Contact form (`views/contact-form` and `contact.js`)

**Placement and fields:**
- The form is a view inside the SPA, so it keeps working while offline once the app is open.
- Fields, all labels with correct accents:
  - Type de demande: Demande de devis / Demande d'information / Demande de rendez-vous;
  - Type de client: Particulier / Professionnel;
  - Nom / Raison sociale, Contact principal, Adresse, Code postal, Ville, Email, Téléphone, Détail du projet;
  - Type de travaux: the 4 work types;
  - Source: Bouche à oreille / Panneau de chantier / Recherche internet / Recommandation / Réseaux sociaux / Autre.

**Behaviour:**
- Client-side validation uses the same rules as the server (`lib/validation.js`, shared).
- **Returning client:** when the email field loses focus and the app is online, call `apiFindClientByEmail`. If found, show « Client existant : <nom> » and pre-fill the empty fields. On submit, if values differ, ask « Mettre à jour la fiche client ? » with the choices Oui / Non.

**Offline queue:**
- On submit, the entry, its `submissionId` and a timestamp are stored in `localStorage` (`sm_contact_queue_v1`) **before** any network call.
- An entry is removed from the queue only after the server confirms success.
- Sync runs on the `online` event, when the app opens, and through a manual « Synchroniser (n) » button.
- A badge on the navigation item shows the number of pending entries.
- Failed entries show their error and can be edited and resubmitted.
- **After a successful submit:** « Demande enregistrée » with the buttons « Ouvrir la fiche » and « Nouveau contact ».
- **Help text:** « Ouvrez l'application avant de partir sur le chantier et gardez l'onglet ouvert. »

---

## 11. Security and access

- **Allow-list:** `CONFIG.allowedUsers = ['ms.styleetmatiere@gmail.com', 'fabien.clauss@gmail.com']`, compared in lowercase.
  - `Auth.requireUser()` uses `Session.getActiveUser().getEmail()` and throws `FORBIDDEN` for anyone not listed.
  - `Auth.requireAdmin()` (Fabien only) guards `migrateToV4` and `runIntegrationTests`.
- **Scopes** in `appsscript.json` are exactly those needed:
  - `spreadsheets`, `documents`, `drive`, `gmail.compose`, `script.scriptapp` (triggers), `userinfo.email`, `script.container.ui` (only if the sheet menu stays);
  - remove `script.external_request` unless it turns out to be used.
- **Deployment:** update the **existing** deployment. Create a new one only when scopes change (users must then re-authorise).
- **Logging:** no client personal data in logs. The `Journal` sheet stores IDs, not emails or phone numbers.
- **HTML:** all rendering of user data goes through `escapeHtml`. There is no `innerHTML` with unescaped values.

---

## 12. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | The shell becomes interactive in ≤ 4 s on an iPad over 4G; view switches from the store in ≤ 300 ms. |
| NFR-02 | `apiListClients` and `apiDashboard` run in ≤ 3 s with 500 clients, 800 projects and 1,500 quotes. |
| NFR-03 | Every `api*` call returns JSON-safe data (§3.2) and never an unhandled exception. |
| NFR-04 | No data is lost: contact-form queue (§10), quote drafts (§7.3), lock on allocations (§4.5). |
| NFR-05 | Idempotency: contact submissions (BR-40); generating twice after a network error does not create two numbers (the client sends an `idempotencyKey`, and the server returns the earlier result if that key is already known, kept 1 hour in the cache). |
| NFR-06 | Errors are visible: French toast for the user, `Journal` row for Fabien. |
| NFR-07 | Survives manual spreadsheet edits: schema check, tolerant parsing, sorted or filtered sheets never break the app (lookups by ID, not by row). Status columns in the sheet get data-validation dropdowns. |
| NFR-08 | Backup: `setupTriggers()` (admin only, idempotent) installs a weekly time-driven trigger that copies the spreadsheet to `BACKUP_FOLDER_ID` as `Sauvegarde CRM yyyy-mm-dd`, keeping the last 8 copies. It also runs once before migration. |
| NFR-09 | Maintainability: namespaces, files ≤ 600 lines, JSDoc on every public function, `npm run check` passes. |

---

## 13. Google Apps Script pitfalls (check every change against this list)

1. **Serialisation:** functions called through `google.script.run` must return plain data. A `Date` or function inside the result silently turns the result into `null`.
2. **Global namespace:** all `.js` files share one global scope. Duplicate function names override each other silently. Use namespaces (§3.2).
3. **Doc templates:** a placeholder must appear exactly as `{{name}}` in the template. A mismatch, or a placeholder split by formatting, means zero replacements and no error. Check leftovers (§8.2) and use `apiHealthCheck`.
4. **Deployments:** update the existing deployment instead of creating a new one, to avoid re-authorisation. Declare the full scope set up front.
5. **Data layout:** store fields as real columns. JSON is only for structures such as quote content and mentions.
6. **`getActiveSpreadsheet()`** is unreliable in web apps. Always use `openById`.
7. **Web app iframe:** links must target `_top` and use `ScriptApp.getService().getUrl()`. The `/dev` and `/exec` URLs differ. Prefer the SPA with `google.script.history`.
8. **Mobile:** HtmlService needs `addMetaTag('viewport', …)`; a `<meta>` tag in the HTML is ignored.
9. **Quotas and time limits:** 6 minutes per execution. Batch reads and writes, and never call `getValue` in loops.
10. **`replaceText`** takes a regex. Escape the pattern and any `$` in replacement values.
11. **LockService:** always release the lock in `finally`. Keep the locked section short, and do no Drive or Docs work inside it.
12. **Script Properties** are limited to 9 KB per value. Quote drafts larger than that fail: compress the JSON, or reject with a clear message.
13. **File load order** is not guaranteed. Do not reference another namespace at top level.
14. **`Session.getActiveUser()`** can return an empty string if the user hasn't granted access yet. Show the unauthorised page with a « Réautoriser » hint.

---

## 14. Porting map (from `legacy/`, i.e. `feature/webapp-migration`)

**Port** (copy the logic, restructure into the new namespaces, add tests):
- `insertServicesTable`, `styleServicesTable`, `replaceDocumentPlaceholders`, `handleDiscountSection` (Code.js). Fix regex and `$` escaping and add the leftover scan.
- The renovation attestation text, verbatim. `calculateTVARate` becomes BR-24.
- The `getServices` column mapping, including its header fallbacks, and `addNewService`.
- The default email template texts and `replaceTemplatePlaceholders` (config.js, modalController.js).
- The UX of the quote-builder editor (`pages/quote-builder.html`): sections, lines, search, preview, autosave, shortcuts. Rebuild it as an SPA view on the new data calls.
- The `localStorage` offline queue logic and the fields of `pages/contact-form.html`.
- Chart.js setup (dashboard), the 3-month grid rendering (calendar), and search and filter patterns (clients).
- Utilities: `escapeHtml`, date and currency formatters (rewritten into `lib/format.js`).
- The status-history JSON format, read only by the migration.

**Rewrite:** data access, numbering, statuses, auth, routing, API layer, dashboard and calendar computations, returning-client logic, settings storage.

**Drop:**
- Invoicing, QR codes and IBAN/BIC; `crmModal.html`, `quoteBuilder.html`, `modalController.js`.
- `enhancements.js` (row-based drafts and duplication), `validation.js` and `types.js` (replaced by checkJs), `api.js` and `doPost` (unused transport), `get-url.js`, `login.html`.
- Roles and admin lists; `XFrameOptionsMode.ALLOWALL`.
- All legacy planning and fix docs.

---

## 15. Migration (`migrateToV4({ dryRun, force })`, admin only)

1. Run a backup (NFR-08) first. Refuse to run if `Clients`, `Projets` or `Devis` contain data rows, unless `force` is set.
2. Create any missing sheets with their headers and data validation. Add `Actif` (set to `Oui`) and `Modifié le` to `Services`, generate any missing `ID Prestation`, and normalise `Type` values to `Intérieur` or `Extérieur` (for example « Exterieur » becomes « Extérieur »; unknown values are listed in the report).
3. For each row of `Form Responses 1` (mapping in `lib/legacy.js`, pure and unit-tested):
   - **Client:** match by normalised email, otherwise create one. Rows without an email always create a new client and are flagged.
   - **Project:** always one per row, with `Créé le` = Timestamp. Copy request type, details, work type, dates and notes.
   - **Quote:** only if `Devis N°` is set. The number is unchanged (no suffix).
     - Recompute the totals from `Quote Data (JSON)` using BR-20–23. If the JSON is missing or invalid, use `Valeur du projet` as Total HT and flag the row.
     - Set `deposit_pct` = 30. `doc_url` comes from the legacy link; `pdf_url` stays empty and is created lazily.
   - **Status mapping:**

     | Legacy status | New quote status | Project manual status |
     |---|---|---|
     | Nouveau | Nouveau | |
     | Devis envoyé | Devis envoyé | |
     | Projet gagné | Projet gagné | |
     | Terminé | Projet gagné | Terminé |
     | Annulé | Annulé | Annulé |

     Rows without a quote carry their status on the project only.
   - **History:** legacy `Historique Statut (JSON)` entries become `Historique` rows with origin `migration`.
4. Rename the source sheet to `Archive – Form Responses 1` and protect it with a warning-only protection.
5. Write a `Rapport migration` sheet:
   - counts per entity;
   - emails shared by rows with different names;
   - rows without an email;
   - rows with bad JSON;
   - the sum of Total HT before and after.
6. `dryRun` writes only the report sheet.

**Acceptance:** number of projects = number of archive rows; number of quotes = number of archive rows with a quote number; every legacy number appears exactly once; a second run without `force` is refused.

---

## 16. Tests

`npm run check` runs lint, typecheck, unit and static tests. It must pass before every commit.

### 16.1 Unit tests (Jest, `tests/unit/`) on `src/server/lib/*`

| Module | Minimum cases |
|---|---|
| totals | BR-20–25: VAT 10/20, discount 0/15%, rounding (3 × 33,33; 0,005 edge), deposit 0/30/100, invalid inputs throw |
| numbering | BR-10–14: empty, legacy + suffixed mix, year rollover, padding, next letter after gaps, legacy → B |
| status | BR-32 each rule and priority; BR-31 sibling changes; BR-33 |
| revenue | BR-35, BR-60–63 including reverted wins and legacy fallback |
| validation | BR-41 every field; phone normalisation; BR-70/71 services (comma price, duplicates with accents and case) |
| placeholders | full map; `$` and regex escaping; leftover detection |
| format / dates | fr-FR money, dates, Europe/Paris boundaries (midnight, DST change) |
| legacy | every status mapping, missing email, bad JSON, value fallback |

**Coverage:** at least 90% of lines in `lib/`.

### 16.2 Static tests (`tests/static/`)

- There are no duplicate top-level identifiers across `src/**/*.js` and the `<script>` blocks in `src/**/*.html`.
- The source contains no `getActiveSpreadsheet`, `invoice`/`facture`/`qr`, `ALLOWALL`, or `innerHTML =` with template literals lacking `escapeHtml`.
- Every `api.call('X'` in the UI has a matching `function X` in `api.js`, and each `api*` function body starts with `Auth.requireUser`.
- Every header in `CONFIG.sheets` is unique per sheet, and every rule ID cited in this spec appears in at least one test title.

### 16.3 E2E UI tests (Playwright, `tests/e2e/`) against the local preview

**The preview:** `dev/preview-server.js` serves `src/ui/index.html`, resolves `<?!= include('…') ?>`, and injects a mock `google.script.run` whose `api*` handlers use in-memory fixtures (`tests/fixtures/*.json`) and the real `lib/` code.

**Setup:**
- Projects: iPad (`devices['iPad (gen 7)']`, portrait and landscape) and Desktop Chrome.
- **Scenarios:**
  1. Navigation and deep links; Back button.
  2. Clients search, filter and sort.
  3. Contact form with validation errors, then success.
  4. Returning-client banner.
  5. **Offline:** `context.setOffline(true)`, submit 2 entries, reload is not possible so close and reopen the view, go online, check the queue drains and there are no duplicates.
  6. Quote builder: add sections and lines, check live totals, reorder, draft restore, generate, check the result panel.
  7. Win variant B: the A chip becomes « Non retenu ».
  8. Email draft button with 2 quotes selected.
  9. Error toast when the mock returns `{ok:false}`.
  10. Catalogue: create, edit, duplicate, deactivate. A deactivated service is gone from the builder search. A duplicate is rejected. CSV import dry-run report.
  11. Touch targets are at least 44px (check the size of interactive elements) and no horizontal scroll at 768px.

### 16.4 GAS integration tests (`src/tests_gas/integration.js`)

**Guards:** `runIntegrationTests()` refuses to run unless `ENV === 'dev'` and the user is the admin. It runs against the **dev** spreadsheet and folder only.

**Harness:** a small harness writes results to the `Logger` and to a `Résultats tests` sheet (name, OK/KO, message, ms). Every test creates `TEST-` data and cleans up after itself: rows deleted, files trashed, drafts deleted.

**Scenarios:**
1. New contact creates a client and a project; same email in a different case gives the same client and a new project; a duplicate `submissionId` creates nothing.
2. Generate A, create variant B, and a new project gets a new base. Doc and PDF exist; totals are written; history is logged.
3. Regenerate A while `Nouveau`: same number, old files trashed. Editing a sent quote is rejected.
4. Draft with A and B: 2 attachments, both numbers in the subject, no status change.
5. Win B: A becomes `Non retenu`; project derived as `Projet gagné`; the dashboard includes B only.
6. Manual `Terminé`, then cleared: derivation follows and history is logged.
7. Migration on a fixture archive sheet of 12 legacy rows: counts reconcile, report is correct, second run is refused.
8. Every `api*` read result survives `JSON.parse(JSON.stringify(r))` unchanged.
9. `requireUser` throws for an unlisted email (via a test seam).
10. 20 sequential generations give 20 unique, strictly increasing numbers.
11. `apiHealthCheck` is fully green on dev.
12. A concurrency conflict (BR-50) is detected.
13. Services: create, update, deactivate; the cache is invalidated (next `apiBootstrap` reflects the change); a CSV import dry-run changes nothing.

**Running:** from the Apps Script editor, or `clasp run runIntegrationTests` if configured. Both ways are documented in `README.md`.

### 16.5 Manual acceptance (`docs/ACCEPTANCE.md`)

Claude Code writes this checklist; it is run on the **real iPad** outside Claude Code. It covers:
- offline contact flow;
- a full quote with variants → email → win → schedule → completion;
- catalogue edits reflected in the builder;
- the PDF looks right: discount, attestation, deposit, no `{{…}}`;
- Gmail draft attachments;
- access refused for another Google account;
- backup file appears.

---

## 17. Build plan

Each phase ends with `npm run check` green, one commit, and a short note in `docs/PROGRESS.md`.

| Phase | Content | Definition of Done |
|---|---|---|
| 0. Scaffold | Create branch `v4`; move the old code to `legacy/`; set up the tooling (§3.1, §18); `src/` skeleton; CI-less `npm run check` | check passes on empty namespaces; static tests active |
| 1. Core logic | `lib/*` with the unit tests of §16.1 | coverage ≥ 90%, all BR tests present |
| 2. Data and migration | `Data`, sheets (including the `Actif` and `Modifié le` columns on `Services`), schema check, backup, `migrateToV4`, `Journal` | integration tests 7, 10 and 12 green on dev; **stop** and ask Fabien to review the dry-run report |
| 3. Domain and API | clients, projects, quotes, documents, emails, statuses, dashboard, calendar, settings, services catalogue, `apiHealthCheck` | integration tests 1–6, 8, 9, 11 and 13 green |
| 4. UI shell and views | design system, router, store, all views, preview server | Playwright suite green (iPad and desktop) |
| 5. Contact form offline | §10 | E2E scenario 5 green, plus a manual iPad test |
| 6. Hardening | NFR checks, performance test with generated data, security review, docs | NFR-02 measured and logged; ACCEPTANCE.md written |
| 7. Cut-over | prepare the release notes and the cut-over checklist in `docs/DEPLOYMENT.md`; after Fabien has migrated and deployed prod, delete `legacy/` | Fabien confirms go-live |

---

## 18. Claude Code project files (created in Phase 0)

### 18.1 `CLAUDE.md` (keep it under 60 lines)

It must contain:
- « Read SPEC.md before any task; cite rule IDs in commits and tests. »
- The commands: `npm run check`, `npm run test:e2e`, `npm run preview`, `npm run push:dev`.
- « **Never** run `push:prod` or deploy. Fabien does that. »
- The coding rules of §3.2 in short form and the pitfalls list of §13 by reference.
- « Ask when the spec is ambiguous; do not invent business rules. »
- « Legacy code in `legacy/` is reference only; never import from it. »

### 18.2 `.claude/settings.json` (committed)

- **Permissions:**
  - `allow`: `Bash(npm run check*)`, `Bash(npm run test*)`, `Bash(npm run preview*)`, `Bash(npm run push:dev*)`, `Bash(git status*)`, `Bash(git diff*)`, `Bash(git add*)`, `Bash(git commit*)`;
  - `ask`: `Bash(clasp*)`, `Bash(git push*)`;
  - `deny`: `Bash(npm run push:prod*)`, `Bash(clasp deploy*)`, `Read(~/.clasprc.json)` (the clasp OAuth token), `Read(.clasp.prod.json)`.
- **Hooks:**
  - `PostToolUse`, matcher `Edit|Write`: run Prettier and ESLint `--fix` on the edited file and print the remaining lint errors, so Claude sees them.
  - `Stop`: `.claude/hooks/check.sh` runs `npm run check`. If it fails, exit with code 2 and print the failures, so Claude cannot finish with a red build. The script must exit 0 when `stop_hook_active` is true, to avoid loops.

### 18.3 Project subagents (`.claude/agents/`)

- **`gas-reviewer`** reviews each phase's diff against §3.2, §11 and §13. It is read-only.
- **`spec-auditor`** checks the current phase's Definition of Done and the BR/NFR coverage in the tests, and lists the gaps. It is read-only.

### 18.4 Project skill (`.claude/skills/gas-release/SKILL.md`, with `disable-model-invocation: true`)

This is a checklist Fabien triggers manually:
1. `npm run check` and `npm run test:e2e`.
2. `push:dev`.
3. Run the integration tests on dev.
4. Hand over to Fabien for the prod push and the update of the existing deployment.

### 18.5 Tools available in the session

The plugins and MCP server listed in `PREPARATION.md` are installed. In particular:
- use the Google Workspace developer-docs MCP to verify Apps Script APIs and OAuth scopes before using them;
- use Playwright against the local preview (`npm run preview`), never against the production web app.
