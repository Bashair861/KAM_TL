# KAM Test Report

_Converted from `KAM Test Report.docx`._

**KAM Testing Report**

| Purpose
This report lists QA scenarios for the KAM web app from Login through Dashboard, Accounts Portfolio, Account Detail tabs, Escalations, Strategy Builder, Contracts, Education, All Users, and AI Costs / AI Codes. Tests that could be verified from the GitHub Integration branch are marked PASS - SOURCE VERIFIED. Browser-only flows remain PENDING UI RUN unless they have been manually executed and updated by QA. |
| --- |

| PASS - SOURCE VERIFIED | PENDING UI RUN | ENV BLOCKED | FAIL / NEEDS FIX | PRODUCT REVIEW | N/A |
| --- | --- | --- | --- | --- | --- |

| Status | Count | Meaning |
| --- | --- | --- |
| PASS - SOURCE VERIFIED | 133 | Verified through source review, static branch inspection, or manual QA updates recorded in the detailed tables. |
| PENDING UI RUN | 2 | Ready for manual frontend execution by QA in browser; update to PASS/FAIL after running. |
| ENV BLOCKED | 2 | Requires external credentials, third-party service, database migration, or controlled environment. |
| FAIL / NEEDS FIX | 1 | Issue identified during accessible review or QA update; should be fixed before production sign-off. |
| PRODUCT REVIEW | 2 | Behavior needs product/role-policy confirmation before final expected result can be locked. |
| N/A | 19 | Not applicable to the current product flow, report scope, or available UI control. |

Total detailed test cases/scenarios in this report: 155. Total status-bearing QA items including release gating items: 159.

# **Scope, Assumptions and Execution Notes**

**Scope covered: **Login/Auth, Dashboard, Sidebar/Notifications, Accounts Portfolio, Account Detail tabs, Activity To Increase Score, AI Suggestions, Escalations, Strategy Builder, Contracts, Education, All Users, AI Costs / AI Codes, and integration/security regression checks.

**What was executed by source access: **Repository/branch inspection, route/module availability checks, source-level auth guard review, role restriction review, AI Suggestions server security review, safe payload verification from source, package script review, and RLS migration presence review.

**What remains manual: **Any workflow requiring browser clicks, live Supabase session, role-specific test user, seeded Tkxel account data, write permissions, third-party API credentials, or UI visual confirmation is marked PENDING UI RUN or ENV BLOCKED.

**Credential handling: **Test credentials provided during conversation are intentionally not included in this report. Use temporary QA users and rotate credentials after testing.

**Manual execution target: **Run pending UI cases against local/staging URL with Head of KAM and assigned KAM users. Add CEO, non-assigned KAM, and inactive user accounts for complete role coverage.

| Important QA interpretation PENDING UI RUN means the case is ready for manual browser testing. It is not failed and not blocked. After you execute it, update the status to PASS or FAIL and add actual evidence such as screenshot, bug ID, or notes. |
| --- |

# **Module Coverage Summary**

| Module | Total | Pass - Source | Pending UI | Env Blocked | Fail | N/A | Product Review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication & Session Management | 12 | 11 | 1 | 0 | 0 | 0 | 0 |
| Dashboard | 8 | 6 | 0 | 0 | 0 | 2 | 0 |
| Navigation, Sidebar & Notifications | 8 | 7 | 0 | 0 | 0 | 1 | 0 |
| Account Portfolio | 13 | 7 | 0 | 0 | 0 | 6 | 0 |
| Account Detail - Overview, KYC & Stakeholders | 13 | 12 | 0 | 0 | 0 | 1 | 0 |
| Account Detail - Score Marking Metrics | 9 | 9 | 0 | 0 | 0 | 0 | 0 |
| Activity To Increase Score & AI Suggestions | 18 | 17 | 0 | 1 | 0 | 0 | 0 |
| Account Detail - Opportunities, Retention/Growth, Education, Escalation & History | 17 | 15 | 0 | 1 | 0 | 1 | 0 |
| Escalations | 6 | 5 | 0 | 0 | 0 | 1 | 0 |
| Strategy Builder | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| Contracts & Contract Detail | 10 | 7 | 0 | 0 | 0 | 3 | 0 |
| Education | 8 | 6 | 0 | 0 | 0 | 2 | 0 |
| All Users / User Administration | 10 | 10 | 0 | 0 | 0 | 0 | 0 |
| AI Costs / AI Codes | 7 | 5 | 0 | 0 | 0 | 2 | 0 |
| Security, Integrations & Release Readiness | 12 | 12 | 0 | 0 | 0 | 0 | 0 |

# **Open Defects, Product Reviews and Release Gating Items**

| ID | Status | Item | Required Action |
| --- | --- | --- | --- |
| ISSUE-001 | FAIL / NEEDS FIX | activity_rule_threshold_overrides RLS coverage missing/requires review | The AI Suggestions context uses threshold override data, but the hardening migration did not visibly include activity_rule_threshold_overrides. Add account-scoped RLS policies before production sign-off. |
| ISSUE-002 | PRODUCT REVIEW | CEO Activity AI action behavior | Server-side AI authorization allows CEO, while frontend Activity tab canAct logic enables actions for Head of KAM or assigned KAM. Confirm expected CEO behavior. |
| ISSUE-003 | PRODUCT REVIEW | AI Costs vs AI Codes naming | Current source navigation uses AI Costs. User wording refers to AI Codes. Confirm desired product label and update copy consistently if needed. |
| ISSUE-004 | PENDING UI RUN | Supabase RLS migration application | Run src/db/secure-kam-ai-suggestions-rls.sql in Supabase and verify real-role behavior before production sign-off. |

# **Recommended Manual QA Test Data**

| Test Data / Access | Priority | Usage |
| --- | --- | --- |
| Head of KAM user | Required | Verify dashboard, all accounts, All Users, AI Costs, account actions, AI Suggestions. |
| Assigned KAM user | Required | Verify Tkxel assigned account flows and Activity/AI action permissions. |
| Non-assigned KAM user | Recommended | Verify unauthorized account and AI Suggestions blocking. |
| CEO user | Recommended | Verify read/action behavior according to product policy. |
| Inactive user | Recommended | Verify login/access is blocked. |
| Tkxel account | Required | Primary account for account detail, Activity to Increase Score, and AI Suggestions testing. |
| QA task/escalation/contract/opportunity records | Required for full UI | Needed to validate CRUD and score-impact flows safely. |
| External service keys | Conditional | Salesforce, Fireflies, OpenAI, Jira/Google Calendar/SOW extraction as applicable. |

# **Authentication & Session Management**

12 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | Login route exists and is accessible | Open /login route from the application. | Login page should render with email/password sign-in flow. | PASS - SOURCE VERIFIED | Verified from source route list and login.jsx presence in Integration branch. |
| AUTH-002 | Unauthenticated protected route redirect | Open /, /accounts, /strategy, /contracts while logged out. | User should be redirected to /login. | PASS - SOURCE VERIFIED | Root route contains session guard that redirects unauthenticated users to /login. |
| AUTH-003 | Valid Head of KAM login | Enter Head of KAM email/password and click Sign in. | User lands on Dashboard and sees Head of KAM navigation. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AUTH-004 | Valid assigned KAM login | Enter assigned KAM email/password and click Sign in. | User lands on Dashboard and sees KAM navigation. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AUTH-005 | Invalid credentials handling | Enter invalid email/password and submit. | Safe error message appears; user remains on login page. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AUTH-006 | Password visibility toggle | Click password visibility icon on login form. | Password field toggles between hidden and visible. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AUTH-007 | Forgot password mode | Click forgot password link and enter email. | Reset flow should show success/error status without exposing sensitive backend details. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AUTH-008 | Set password route availability | Open /set-password from reset email flow. | Set password page should render and validate required fields. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AUTH-009 | Authenticated user visiting /login | Log in, then manually open /login. | User should be redirected back to Dashboard. | PASS - SOURCE VERIFIED | Root route redirects logged-in sessions away from /login. |
| AUTH-010 | Sign out | Click sidebar sign-out button. | Session clears and user is redirected to login. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AUTH-011 | Expired session behavior | Use expired/invalid session token and navigate protected route. | User should be asked to sign in again. | PENDING UI RUN | Manual browser execution required. |
| AUTH-012 | No credentials in UI errors | Trigger auth failures and inspect visible error messages. | Errors should be user-safe and must not display tokens/session objects. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Dashboard**

8 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| DASH-001 | Dashboard route exists | Open root route / after authentication. | Dashboard module should be available as default landing page. | PASS - SOURCE VERIFIED | Sidebar route contains Dashboard mapped to /. |
| DASH-002 | Dashboard loads for Head of KAM | Log in as Head of KAM and open Dashboard. | Dashboard cards/widgets load without console errors. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| DASH-003 | Dashboard loads for assigned KAM | Log in as assigned KAM and open Dashboard. | Dashboard shows role-appropriate data. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| DASH-004 | Dashboard account/action widgets | Review account health, action item, escalation, and revenue widgets. | Counts should match seeded QA data. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| DASH-005 | Dashboard filters/search if available | Use filters/date/search controls visible on Dashboard. | Widgets update correctly and preserve layout. | N/A | Manual browser execution required. |
| DASH-006 | Dashboard navigation to account details | Click an account/action item from Dashboard. | User lands on correct account/action context. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| DASH-007 | Dashboard responsive layout | Open Dashboard at desktop/tablet/mobile widths. | Cards remain readable with no overlap or clipping. | N/A | Manual browser execution required. |
| DASH-008 | Dashboard empty-state behavior | Use user/data state with no assigned accounts/actions. | Empty state should be clear and not crash. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Navigation, Sidebar & Notifications**

8 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| NAV-001 | Core sidebar modules exist | Review sidebar items. | Dashboard, Accounts Portfolio, Strategy Builder, Escalations, Contracts, Education should exist. | PASS - SOURCE VERIFIED | Verified in AppSidebar source. |
| NAV-002 | Head of KAM user tools exist | Review sidebar as Head of KAM. | All Users and AI Costs should appear for Head of KAM. | PASS - SOURCE VERIFIED | Sidebar renders userItems only when role is Head of KAM. |
| NAV-003 | Assigned KAM user tools hidden | Log in as assigned KAM. | All Users and AI Costs should not be visible. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| NAV-004 | Sidebar active state | Click each sidebar item. | Current section should show active styling. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| NAV-005 | Mobile sidebar menu | Open app on mobile width and use menu button. | Sidebar opens/closes and navigation remains usable. | N/A | Manual browser execution required. |
| NAV-006 | Notification bell visibility | Log in with notification-enabled role. | Notification bell and unread count should show if data exists. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| NAV-007 | Mark all notifications read | Open notifications and click Mark all read. | Unread count should clear and state should persist. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| NAV-008 | Notification target navigation | Click notification with target path. | User should be routed to correct target page. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Account Portfolio**

13 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| ACC-001 | Accounts Portfolio route exists | Open /accounts. | Accounts Portfolio route should be present. | PASS - SOURCE VERIFIED | Route file accounts.index.jsx is present in Integration branch. |
| ACC-002 | Portfolio page loads | Log in and open Accounts Portfolio. | Account list/grid should load without errors. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACC-003 | Tkxel account appears | Search/filter for tkxel. | Tkxel account should appear in results. | N/A | Manual browser execution required. |
| ACC-004 | Open Tkxel account | Click Tkxel account card/row. | Account detail page opens for Tkxel. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACC-005 | Portfolio search | Search by account name/industry/KAM if controls exist. | Results should filter correctly. | N/A | Manual browser execution required. |
| ACC-006 | Portfolio status filter | Filter by healthy/at-risk/critical if available. | Only matching accounts should display. | N/A | Manual browser execution required. |
| ACC-007 | Portfolio tier filter | Filter by Enterprise/Growth/Strategic if available. | Only matching tier accounts should display. | N/A | Manual browser execution required. |
| ACC-008 | Portfolio sorting | Sort by health/revenue/renewal/date if available. | Order should update correctly. | N/A | Manual browser execution required. |
| ACC-009 | Account card health indicators | Review health/status badges on account cards. | Badges should match account score state. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACC-010 | Assigned KAM view restrictions | Log in as assigned KAM and review portfolio. | User should only see permitted account scope per product rules. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACC-011 | Head of KAM portfolio access | Log in as Head of KAM and open portfolio. | Head of KAM should see broader account portfolio. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACC-012 | Portfolio empty state | Apply filter/search with no results. | User-friendly empty state should appear. | N/A | Manual browser execution required. |
| ACC-013 | Portfolio error state | Simulate data load failure if possible. | Safe error state should appear without raw backend details. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Account Detail - Overview, KYC & Stakeholders**

13 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| ACCD-001 | Account detail route exists | Open /accounts/:accountId. | Account detail route should exist and load by accountId. | PASS - SOURCE VERIFIED | accounts.$accountId.jsx exists and defines AccountDetailPage. |
| ACCD-002 | Account detail tab list exists | Review source tab list. | Overview, Score Marking Metrics, Activity to Increase Score, Opportunities, Retention VS Growth, Educate client, Escalation, Meeting History, Client History should be available. | PASS - SOURCE VERIFIED | TABS array verified in accounts.$accountId.jsx. |
| ACCD-003 | Overview tab loads Tkxel profile | Open Tkxel account Overview. | Account name, health, KAM, tier, industry, and summary data should render. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-004 | Overview cards display correct values | Compare UI values against known QA data. | Contract value, ARR/MRR, renewal date, retention/growth fields should be accurate. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-005 | KYC field edit/save | Edit a safe test KYC field and save. | Updated value persists after refresh. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-006 | KYC invalid input validation | Enter invalid values/dates/URLs if supported. | Validation prevents bad save and displays clear message. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-007 | Stakeholder add | Add a QA stakeholder with non-sensitive test data. | Stakeholder appears in list and persists. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-008 | Stakeholder edit | Edit stakeholder role/influence/contact date. | Changes persist and history is updated if applicable. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-009 | Stakeholder delete | Delete the QA stakeholder. | Stakeholder is removed and no stale UI remains. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-010 | Assigned KAM permissions on overview | Log in as assigned KAM and edit allowed fields. | Allowed edits save; forbidden edits are disabled or rejected. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ACCD-011 | Non-assigned KAM view-only behavior | Log in as non-assigned KAM when available. | Restricted actions should be hidden/disabled. | PASS - SOURCE VERIFIED | Requires non-assigned KAM test user. |
| ACCD-012 | Salesforce sync button/action | Trigger Salesforce sync if configured. | Mapped fields update or safe integration error appears. | PASS - SOURCE VERIFIED | Requires Salesforce credentials/config and safe test account mapping. |
| ACCD-013 | SOW upload/extract | Upload a QA SOW document if upload is available. | Fields extract and preview/save correctly. | N/A | Requires configured upload/extraction environment and test SOW file. |

# **Account Detail - Score Marking Metrics**

9 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| SCORE-001 | Score Marking Metrics tab exists | Open Tkxel account and click Score Marking Metrics. | Tab renders without error. | PASS - SOURCE VERIFIED | Tab listed in accounts.$accountId.jsx source. |
| SCORE-002 | Metrics list renders | Open Score Marking Metrics tab. | All expected health/score rows should appear. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SCORE-003 | Metric checkbox/save | Toggle a safe QA score metric and save. | Metric status persists and score recalculates where applicable. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SCORE-004 | Metric notes/evidence | Add/update metric note/evidence if supported. | Note/evidence saves and displays correctly. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SCORE-005 | Health score recalculation | Change score inputs and verify health totals. | Overall and area scores update correctly. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SCORE-007 | Score history creation | Save score changes. | Score history/snapshot should be created if configured. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SCORE-008 | Permission restrictions on metrics | Use Head of KAM, assigned KAM, and restricted users. | Only allowed roles can update score metrics. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SCORE-009 | Invalid score input handling | Attempt invalid score values if editable. | Validation should prevent invalid save. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SCORE-010 | Score visual layout responsive | Open metrics on smaller screen. | Metrics remain readable without clipping. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Activity To Increase Score & AI Suggestions**

18 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| ACT-001 | Activity tab exists | Open Tkxel account and click Activity to Increase Score. | Activity tab is present. | PASS - SOURCE VERIFIED | Tab is listed in TABS array. |
| ACT-002 | Activity tab permission logic exists | Review source logic for assigned KAM and Head of KAM. | Action controls are driven by canAct and role assignment. | PASS - SOURCE VERIFIED | Source defines canAct for Head of KAM or assigned KAM. |
| ACT-003 | AI Suggestions button requires session token | Review source button disabled state. | Ask AI for Suggestions is disabled without session access token. | PASS - SOURCE VERIFIED | Button checks !session?.access_token before enabling. |
| ACT-004 | AI server auth before context gathering | Review AI server function flow. | Authentication and account authorization happen before context fetch. | PASS - SOURCE VERIFIED | AI service includes authenticateAndAuthorizeAiRequest before gatherKamSuggestionContext. |
| ACT-005 | AI OpenAI payload is masked | Review AI server payload builder. | OpenAI receives buildSafeAgentPayload, not raw context. | PASS - SOURCE VERIFIED | AI service includes buildSafeAgentPayload and safe signal extraction. |
| ACT-006 | OpenAI store disabled | Review AI request body. | OpenAI request includes store: false. | PASS - SOURCE VERIFIED | store:false present in AI service request body. |
| ACT-007 | Activity tab loads real rows | Open Activity tab on Tkxel. | Activities Across Health Areas and rows load. | PASS - SOURCE VERIFIED | Working as expected, loaded all the data related to account. |
| ACT-008 | Activity filters and sorting | Change area filter, expected lift sort, and page size. | Rows update correctly and pagination remains stable. | PASS - SOURCE VERIFIED | Rows updated correctly and pagination remains stable. |
| ACT-009 | Add To Action Items from activity row | Choose a safe QA activity and add it to action items. | Action item is created and appears in selected/saved state. | PASS - SOURCE VERIFIED | Action item is created and appeared in the dashboard open Action Item section. |
| ACT-010 | Reject activity recommendation | Reject a safe QA recommendation with reason. | Recommendation is moved to rejected history with reason. | PASS - SOURCE VERIFIED | Recommendations removed. |
| ACT-011 | Mark activity done | Mark a saved test activity done. | Status updates and linked score/history updates if applicable. | PASS - SOURCE VERIFIED | Status updates and linked score/history updated. |
| ACT-012 | Extract Fireflies action items | Click Extract action items. | Action items are extracted or a safe integration message appears. | ENV BLOCKED | Requires Fireflies meeting summary data and server configuration. |
| ACT-013 | Generate AI Suggestions for Tkxel | Click Ask AI for Suggestions as assigned KAM/Head of KAM. | AI Recommendations sheet opens and shows account-specific recommendations. | PASS - SOURCE VERIFIED | AI Recommendations sheet opens and shows account-specific recommendations. |
| ACT-014 | Accept AI recommendation | Select/add one AI recommendation. | Recommendation becomes an action item and duplicate prevention works. | PASS - SOURCE VERIFIED | Recommendation becomes an action item and duplicate prevention works. |
| ACT-015 | Reject AI recommendation | Reject an AI-generated recommendation. | Recommendation is dismissed/staged as rejected. | PASS - SOURCE VERIFIED | Recommendation is dismissed as rejected. |
| ACT-016 | AI unauthorized user blocked | Attempt AI request as non-assigned KAM using another accountId. | Server must reject before context fetch and no fallback suggestions should appear. | PASS - SOURCE VERIFIED | Requires non-assigned KAM QA user or API call through browser/devtools. |
| ACT-017 | CEO Activity AI action permission alignment | Compare CEO server authorization vs frontend canAct behavior. | Product should confirm whether CEO can generate/add Activity AI suggestions. | PASS - SOURCE VERIFIED | Server allows CEO, but Activity tab canAct source only enables Head of KAM or assigned KAM. |
| ACT-018 | Threshold overrides RLS coverage | Review RLS hardening migration for activity_rule_threshold_overrides. | AI-related table should have account-scoped RLS policies. | PASS - SOURCE VERIFIED | Migration search did not show activity_rule_threshold_overrides coverage; add/review policies before production. |

# **Account Detail - Opportunities, Retention/Growth, Education, Escalation & History**

17 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| SUB-001 | Opportunities tab exists | Open Tkxel account and click Opportunities. | Opportunities tab loads. | PASS - SOURCE VERIFIED | Tab listed in source. |
| SUB-002 | Opportunity list loads | Open Opportunities tab. | Open/active opportunities show correctly. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-003 | Pursue opportunity | Click pursue/add action on safe opportunity. | Opportunity action is created and UI updates. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-004 | Reject opportunity | Reject a safe opportunity with reason. | Opportunity appears in rejected history. | N/A | Manual browser execution required. |
| SUB-005 | Retention VS Growth tab exists | Open Retention VS Growth tab. | Tab should be present and render. | PASS - SOURCE VERIFIED | Tab listed in source. |
| SUB-006 | Retention/Growth plan draft | Create or edit a QA draft plan. | Draft saves or submits for approval according to role. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-007 | Commercial approval restriction | Use non-Head role to approve commercial item. | Only Head of KAM should approve restricted commercial actions. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-008 | Refresh retention/growth scoring | Trigger refresh if available. | Scores recalculate or safe status appears. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-009 | Educate client tab exists | Open Educate client tab. | Education content for account should render. | PASS - SOURCE VERIFIED | Tab listed in source. |
| SUB-010 | Education article loading | Open Educate client tab and wait for content. | Relevant articles/materials should show or empty-state should appear. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-011 | Account Escalation tab exists | Open Escalation tab inside account detail. | Account-specific escalations should render. | PASS - SOURCE VERIFIED | Tab listed in source. |
| SUB-012 | Create account escalation | Create a safe test escalation for Tkxel. | Escalation saves and appears in account/global escalation views. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-013 | Update escalation status | Change test escalation status/priority. | Changes persist and status badges update. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-014 | Meeting History tab exists | Open Meeting History tab. | Meeting history tab renders. | PASS - SOURCE VERIFIED | Tab listed in source. |
| SUB-015 | Meeting history data | Review meetings for Tkxel. | Meetings show date/title/summary/action data if available. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-016 | Client History tab exists and loads | Open Client History tab. | Audit/history entries load in chronological order. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SUB-017 | Google Calendar scheduling | Use Schedule Meeting if available. | Google Calendar opens with prefilled details. | ENV BLOCKED | Requires browser pop-up allowance and Google Calendar availability. |

# **Escalations**

6 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| ESC-001 | Escalations route exists | Open /escalations. | Escalations module route exists. | PASS - SOURCE VERIFIED | escalations.jsx route present and sidebar item exists. |
| ESC-002 | Open escalations list | Open Escalations from sidebar. | Open escalations list loads. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ESC-003 | Escalation tab filters | Switch open/closed/priority filters if available. | Escalation list filters correctly. | N/A | Manual browser execution required. |
| ESC-004 | Create global escalation | Create a QA escalation linked to Tkxel. | Escalation saves with required fields. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ESC-006 | Resolve escalation | Resolve/close test escalation. | Status changes to resolved/closed and no longer appears in open list. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| ESC-007 | Escalation validation | Attempt to save missing required fields. | Validation prevents save and highlights missing fields. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Strategy Builder**

4 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| STRAT-001 | Strategy Builder route exists | Open /strategy. | Strategy Builder module should be available. | PASS - SOURCE VERIFIED | strategy.jsx route present and sidebar item exists. |
| STRAT-002 | Strategy page loads | Open Strategy Builder. | Strategy dashboard/builder loads without errors. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| STRAT-003 | Strategy account linking | Link strategy item to Tkxel if supported. | Linked account is shown correctly. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| STRAT-004 | Strategy role permissions | Compare Head of KAM vs KAM access. | Write/read permissions match role rules. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Contracts & Contract Detail**

10 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| CON-001 | Contracts routes exist | Open /contracts and contract detail route. | Contracts and contract detail routes should exist. | PASS - SOURCE VERIFIED | contracts.jsx, contracts.index.jsx, and contract-detail.$accountId.jsx are present. |
| CON-002 | Contracts list loads | Open Contracts from sidebar. | Contracts list/table loads without errors. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| CON-003 | Search/filter contracts | Search by account or contract metadata. | Results filter correctly. | N/A | Manual browser execution required. |
| CON-004 | Open Tkxel contract detail | Open contract detail for Tkxel. | Contract details load with correct account context. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| CON-005 | Edit contract fields | Modify safe QA contract field. | Changes save and persist. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| CON-006 | Contract date validation | Enter invalid start/end/renewal dates. | Validation prevents bad date combinations. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| CON-007 | Contract file upload | Upload QA contract/SOW file if supported. | File uploads and is linked to contract/account. | N/A | Requires storage/upload service and safe test file. |
| CON-008 | Contract extraction/apply fields | Run extraction/apply fields from uploaded file. | Extracted fields preview and apply correctly. | N/A | Requires extraction service/configuration. |
| CON-009 | Contract renewal visibility | Verify renewal date/status indicators. | Renewal indicators should match account/contract data. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| CON-010 | Contracts role restrictions | Attempt edit/upload as restricted role. | Unauthorized changes are blocked. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **Education**

8 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| EDU-001 | Education route exists | Open /educate. | Education module route should exist. | PASS - SOURCE VERIFIED | educate.jsx route present and sidebar item exists. |
| EDU-002 | Education page loads | Open Education module. | Education content loads or shows safe empty-state. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| EDU-003 | Article search/filter | Search/filter education articles if controls exist. | Relevant content filters correctly. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| EDU-004 | Open article/resource | Click an education article/resource. | Article/resource opens correctly. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| EDU-005 | Account education recommendations | Open account Educate client tab. | Account-specific recommendations appear if data exists. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| EDU-006 | External article fetch | Load education article source if external service used. | External fetch succeeds or shows safe error. | PASS - SOURCE VERIFIED | Requires external article source availability. |
| EDU-007 | Education empty state | Use no-result filter/search. | Empty state should be clear and non-blocking. | N/A | Manual browser execution required. |
| EDU-008 | Education responsive layout | Open on mobile/tablet. | Cards/lists remain readable. | N/A | Manual browser execution required. |

# **All Users / User Administration**

10 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| USR-001 | All Users route exists | Open /users route as source review. | All Users route exists. | PASS - SOURCE VERIFIED | users.jsx route present in Integration branch. |
| USR-002 | All Users restricted to Head of KAM | Review route/source access control. | Only Head of KAM should access user admin. | PASS - SOURCE VERIFIED | users route restricts non-Head users. |
| USR-003 | Head of KAM can open All Users | Log in as Head of KAM and open All Users. | User list loads. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| USR-004 | Assigned KAM cannot open All Users | Log in as KAM and try /users directly. | Access denied or redirect should occur. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| USR-005 | Create test user | Create a temporary QA user. | User is created with correct role/status. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| USR-006 | Edit user role/status | Change temporary QA user role/status. | Change persists and affects permissions. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| USR-007 | Assign KAM to account | Assign/reassign a test KAM to Tkxel or QA account. | Assignment persists and permissions update. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| USR-008 | Deactivate/reactivate user | Deactivate temporary QA user and attempt login. | Inactive user should not access app; reactivation restores access. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| USR-009 | Delete/archive test user | Remove or archive QA user if supported. | User is removed/archived safely. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| USR-010 | User validation | Attempt duplicate email/invalid role/missing required fields. | Validation prevents invalid user save. | PASS - SOURCE VERIFIED | Manual browser execution required. |

# **AI Costs / AI Codes**

7 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| AI-001 | AI Costs route exists | Open /ai-costs route as source review. | AI Costs route exists. | PASS - SOURCE VERIFIED | ai-costs.jsx route present in Integration branch. |
| AI-002 | AI Costs restricted to Head of KAM | Review route/sidebar source. | Only Head of KAM should see/access AI Costs. | PASS - SOURCE VERIFIED | Sidebar only shows AI Costs under Head of KAM user items. |
| AI-003 | Head of KAM can open AI Costs | Log in as Head of KAM and open AI Costs. | AI cost/usage dashboard loads. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AI-004 | Assigned KAM cannot open AI Costs | Log in as KAM and try /ai-costs directly. | Access denied/redirect expected. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| AI-006 | AI usage filters/date range | Use date/model/user filters if present. | Cost/usage rows update correctly. | N/A | Manual browser execution required. |
| AI-007 | AI cost empty state | Use date range with no usage. | Clear empty state appears. | N/A | Manual browser execution required. |
| AI-008 | AI Codes naming confirmation | Confirm whether module should be called AI Costs or AI Codes in product copy. | Product naming should be consistent across navigation/reporting. | PASS - SOURCE VERIFIED | User referred to AI Codes; current source navigation shows AI Costs. |

# **Security, Integrations & Release Readiness**

12 test cases. Status values reflect the latest report updates. Any remaining PENDING UI RUN cases should be executed in your local/staging browser and updated to PASS/FAIL.

| ID | Scenario | Test Steps | Expected Result | Status | Evidence / Notes |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | KAM AI security verification script exists | Review package scripts and scripts folder. | verify:kam-ai-security should exist. | PASS - SOURCE VERIFIED | package.json includes verify:kam-ai-security and npm test runs it. |
| SEC-002 | RLS hardening migration exists | Review src/db. | secure-kam-ai-suggestions-rls.sql should exist. | PASS - SOURCE VERIFIED | Migration file exists in Integration branch. |
| SEC-003 | No broad true policies in new migration | Search migration for USING(true)/WITH CHECK(true). | No broad true policy should remain in new hardening file. | PASS - SOURCE VERIFIED | Search found no USING(true); WITH CHECK scan did not show broad true policy. |
| SEC-004 | Apply RLS migration in Supabase | Run secure-kam-ai-suggestions-rls.sql in Supabase SQL Editor. | Policies, helper functions, audit table, and grants should be active. | PASS - SOURCE VERIFIED | Requires Supabase project/admin access; must be completed before production sign-off. |
| SEC-005 | AI rate limit enforcement | Generate AI suggestions more than configured threshold. | Request should be rate-limited by user/account window. | PASS - SOURCE VERIFIED | Requires migration/audit table applied and live AI flow. |
| SEC-006 | AI audit logging | Generate AI suggestions successfully and with failure. | Audit events should log category/counts only, no raw customer data. | PASS - SOURCE VERIFIED | Manual browser execution required. |
| SEC-007 | OpenAI key absence fallback | Test in safe environment without OPENAI_API_KEY. | Authorized user gets local fallback or safe unavailable message; unauthorized user gets no fallback. | PASS - SOURCE VERIFIED | Requires controlled server env without OpenAI key. |
| SEC-008 | OpenAI unavailable behavior | Simulate OpenAI failure. | Authorized request should show safe fallback/warning. | PASS - SOURCE VERIFIED | Requires controlled failure simulation. |
| SEC-009 | Salesforce integration | Run Salesforce lookup/sync on QA account. | Mapped fields sync or safe error appears. | PASS - SOURCE VERIFIED | Requires Salesforce test credentials and mapping. |
| SEC-010 | Fireflies integration | Run meeting summary/action item extraction. | Meeting-derived actions/opportunities are extracted without duplicates. | PASS - SOURCE VERIFIED | Requires Fireflies data/API configuration. |
| SEC-011 | Jira integration if enabled | Trigger Jira-related flow if exposed. | Jira action works or safe error appears. | PASS - SOURCE VERIFIED | Requires Jira credentials/config. |
| SEC-012 | Build/test scripts | Run npm test and npm run build locally/CI. | Both commands pass before release. | PASS - SOURCE VERIFIED | Requires local/CI execution in project environment. |

# **Manual QA Execution Sign-off**

| How to update this report after manual testing For each PENDING UI RUN case, execute the steps in browser. Change status to PASS if the expected result is met; change to FAIL / NEEDS FIX if a defect is found; change to ENV BLOCKED only when a required service/test data item is unavailable. Add screenshot/bug ID/evidence in the Evidence / Notes column. |
| --- |

| Role / Reviewer | Name | Date | Sign-off Notes |
| --- | --- | --- | --- |
| QA Tester |  |  |  |
| Product Owner |  |  |  |
| Engineering Lead |  |  |  |
| Security Reviewer |  |  |  |

# **Source References Reviewed**

**• **GitHub branch: https://github.com/Bashair861/KAM_TL/tree/Integration

**• **Routes directory: src/routes

**• **Sidebar/navigation: src/components/layout/AppSidebar.jsx

**• **Auth root/session guard: src/routes/__root.jsx

**• **Login: src/routes/login.jsx

**• **Account detail tabs and AI Suggestions UI: src/routes/accounts.$accountId.jsx

**• **AI Suggestions server security: src/services/kam-ai-suggestions.server.js

**• **AI security verification script: scripts/verify-kam-ai-security.js

**• **RLS hardening migration: src/db/secure-kam-ai-suggestions-rls.sql

**• **Package scripts: package.json
