from __future__ import annotations

import argparse
import html
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path


NAVY = "0B2545"
BLUE = "2E74B5"
TEAL = "0F766E"
SLATE = "475569"
MUTED = "64748B"
LIGHT_BLUE = "E8EEF5"
LIGHT_TEAL = "E6F4F1"
LIGHT_GRAY = "F8FAFC"
BORDER = "D7DBE2"
WHITE = "FFFFFF"
INK = "1F2937"
WARN = "7A5A00"
CRIT = "9B1C1C"
SUCCESS = "166534"

CONTENT_WIDTH_DXA = 9360
TABLE_INDENT_DXA = 120


def esc(value: object) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def rpr(
    *,
    bold: bool = False,
    italic: bool = False,
    color: str | None = None,
    size: int | None = None,
    font: str | None = None,
    caps: bool = False,
) -> str:
    parts: list[str] = []
    if bold:
        parts.append("<w:b/>")
    if italic:
        parts.append("<w:i/>")
    if caps:
        parts.append("<w:caps/>")
    if color:
        parts.append(f'<w:color w:val="{color}"/>')
    if size:
        parts.append(f'<w:sz w:val="{size * 2}"/><w:szCs w:val="{size * 2}"/>')
    if font:
        parts.append(
            f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:eastAsia="{font}" w:cs="{font}"/>'
        )
    return f"<w:rPr>{''.join(parts)}</w:rPr>" if parts else ""


def run(
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    color: str | None = None,
    size: int | None = None,
    font: str | None = None,
    caps: bool = False,
) -> str:
    return (
        "<w:r>"
        f"{rpr(bold=bold, italic=italic, color=color, size=size, font=font, caps=caps)}"
        f'<w:t xml:space="preserve">{esc(text)}</w:t>'
        "</w:r>"
    )


def paragraph(
    text: str = "",
    *,
    style: str | None = None,
    runs: list[str] | None = None,
    align: str | None = None,
    before: int | None = None,
    after: int | None = None,
    num_id: int | None = None,
    ilvl: int = 0,
    page_break_before: bool = False,
    keep_next: bool = False,
) -> str:
    ppr: list[str] = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if num_id is not None:
        ppr.append(f'<w:numPr><w:ilvl w:val="{ilvl}"/><w:numId w:val="{num_id}"/></w:numPr>')
    if align:
        ppr.append(f'<w:jc w:val="{align}"/>')
    spacing_attrs: list[str] = []
    if before is not None:
        spacing_attrs.append(f'w:before="{before}"')
    if after is not None:
        spacing_attrs.append(f'w:after="{after}"')
    if spacing_attrs:
        ppr.append(f"<w:spacing {' '.join(spacing_attrs)}/>")
    if keep_next:
        ppr.append("<w:keepNext/>")
    if page_break_before:
        ppr.append("<w:pageBreakBefore/>")
    ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
    body = "".join(runs) if runs is not None else run(text)
    return f"<w:p>{ppr_xml}{body}</w:p>"


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def h1(text: str) -> str:
    return paragraph(text, style="Heading1", keep_next=True)


def h2(text: str) -> str:
    return paragraph(text, style="Heading2", keep_next=True)


def h3(text: str) -> str:
    return paragraph(text, style="Heading3", keep_next=True)


def bullet(text: str) -> str:
    return paragraph(text, style="ListParagraph", num_id=1)


def numbered(text: str) -> str:
    return paragraph(text, style="ListParagraph", num_id=2)


def caption(text: str) -> str:
    return paragraph(text, style="Caption")


def cell_xml(
    text: str | list[str],
    width: int,
    *,
    fill: str | None = None,
    color: str | None = None,
    bold: bool = False,
    font: str = "Calibri",
    size: int = 9,
    align: str | None = None,
    style: str | None = None,
) -> str:
    shade = f'<w:shd w:fill="{fill}"/>' if fill else ""
    tc_pr = (
        "<w:tcPr>"
        f'<w:tcW w:w="{width}" w:type="dxa"/>'
        "<w:tcMar>"
        '<w:top w:w="90" w:type="dxa"/>'
        '<w:bottom w:w="90" w:type="dxa"/>'
        '<w:start w:w="140" w:type="dxa"/>'
        '<w:end w:w="140" w:type="dxa"/>'
        "</w:tcMar>"
        '<w:vAlign w:val="center"/>'
        f"{shade}"
        "</w:tcPr>"
    )
    lines = text if isinstance(text, list) else str(text).split("\n")
    paras = [
        paragraph(
            "",
            runs=[run(line, bold=bold, color=color or INK, size=size, font=font)],
            align=align,
            style=style,
            after=40,
        )
        for line in lines
    ]
    return f"<w:tc>{tc_pr}{''.join(paras)}</w:tc>"


def table_xml(
    rows: list[list[str]],
    widths: list[int],
    *,
    header: bool = True,
    header_fill: str = LIGHT_BLUE,
    header_color: str = NAVY,
    body_fill: str | None = None,
) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    tbl_pr = (
        "<w:tblPr>"
        f'<w:tblW w:w="{sum(widths)}" w:type="dxa"/>'
        f'<w:tblInd w:w="{TABLE_INDENT_DXA}" w:type="dxa"/>'
        "<w:tblLayout w:type=\"fixed\"/>"
        "<w:tblBorders>"
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        "</w:tblBorders>"
        "</w:tblPr>"
    )
    tr_xml: list[str] = []
    for idx, row in enumerate(rows):
        is_header = header and idx == 0
        tr_pr = "<w:trPr><w:tblHeader/></w:trPr>" if is_header else "<w:trPr/>"
        cells = []
        for col_idx, value in enumerate(row):
            cells.append(
                cell_xml(
                    value,
                    widths[col_idx],
                    fill=header_fill if is_header else body_fill,
                    color=header_color if is_header else INK,
                    bold=is_header,
                    size=9,
                )
            )
        tr_xml.append(f"<w:tr>{tr_pr}{''.join(cells)}</w:tr>")
    return f"<w:tbl>{tbl_pr}<w:tblGrid>{grid}</w:tblGrid>{''.join(tr_xml)}</w:tbl>"


def callout(title: str, body: str, *, fill: str = LIGHT_TEAL, accent: str = TEAL) -> str:
    content = [
        paragraph("", runs=[run(title, bold=True, color=accent, size=11)], after=40),
        paragraph("", runs=[run(body, color=INK, size=10)], after=40),
    ]
    tc = (
        "<w:tc><w:tcPr>"
        f'<w:tcW w:w="{CONTENT_WIDTH_DXA}" w:type="dxa"/>'
        "<w:tcMar>"
        '<w:top w:w="180" w:type="dxa"/>'
        '<w:bottom w:w="180" w:type="dxa"/>'
        '<w:start w:w="220" w:type="dxa"/>'
        '<w:end w:w="220" w:type="dxa"/>'
        "</w:tcMar>"
        f'<w:shd w:fill="{fill}"/>'
        "</w:tcPr>"
        f"{''.join(content)}</w:tc>"
    )
    return (
        "<w:tbl><w:tblPr>"
        f'<w:tblW w:w="{CONTENT_WIDTH_DXA}" w:type="dxa"/>'
        f'<w:tblInd w:w="{TABLE_INDENT_DXA}" w:type="dxa"/>'
        "<w:tblLayout w:type=\"fixed\"/>"
        "<w:tblBorders>"
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{accent}"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="{accent}"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{accent}"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="{accent}"/>'
        "</w:tblBorders></w:tblPr><w:tblGrid>"
        f'<w:gridCol w:w="{CONTENT_WIDTH_DXA}"/>'
        f"</w:tblGrid><w:tr>{tc}</w:tr></w:tbl>"
    )


def diagram(title: str, lines: list[str]) -> str:
    header = cell_xml(title, CONTENT_WIDTH_DXA, fill=NAVY, color=WHITE, bold=True, size=10)
    body_paras = [
        paragraph("", runs=[run(line, color=INK, size=8, font="Consolas")], after=20)
        for line in lines
    ]
    body = (
        "<w:tc><w:tcPr>"
        f'<w:tcW w:w="{CONTENT_WIDTH_DXA}" w:type="dxa"/>'
        "<w:tcMar>"
        '<w:top w:w="160" w:type="dxa"/>'
        '<w:bottom w:w="160" w:type="dxa"/>'
        '<w:start w:w="180" w:type="dxa"/>'
        '<w:end w:w="180" w:type="dxa"/>'
        "</w:tcMar>"
        f'<w:shd w:fill="{LIGHT_GRAY}"/>'
        "</w:tcPr>"
        f"{''.join(body_paras)}</w:tc>"
    )
    return (
        "<w:tbl><w:tblPr>"
        f'<w:tblW w:w="{CONTENT_WIDTH_DXA}" w:type="dxa"/>'
        f'<w:tblInd w:w="{TABLE_INDENT_DXA}" w:type="dxa"/>'
        "<w:tblLayout w:type=\"fixed\"/>"
        "<w:tblBorders>"
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
        "</w:tblBorders></w:tblPr><w:tblGrid>"
        f'<w:gridCol w:w="{CONTENT_WIDTH_DXA}"/>'
        f"</w:tblGrid><w:tr>{header}</w:tr><w:tr>{body}</w:tr></w:tbl>"
    )


def cover_page() -> list[str]:
    rows = [
        [
            "AETHER KAM",
            "General Project Document\nInternal KAM Portal Technical and Functional Reference",
        ],
        [
            "Prepared",
            "June 7, 2026\nSource: project codebase, PROJECT_CONTEXT.txt, PROJECT_DOCS.txt",
        ],
        [
            "Audience",
            "Project owners, developers, reviewers, deployment maintainers, and future AI sessions",
        ],
    ]
    table = table_xml(rows, [1900, 7460], header=False, body_fill=LIGHT_GRAY)
    return [
        paragraph("INTERNAL PROJECT REFERENCE", runs=[run("INTERNAL PROJECT REFERENCE", bold=True, color=TEAL, size=10, caps=True)], after=160),
        paragraph("Aether KAM", style="CoverTitle"),
        paragraph(
            "Key Account Management portal for enterprise client relationship, health, contract, risk, and growth workflows.",
            style="CoverSubtitle",
        ),
        paragraph(
            "",
            runs=[
                run("Design system: ", bold=True, color=NAVY, size=10),
                run("deep navy, professional blue, restrained teal, slate neutrals, and light blue-gray table fills.", color=SLATE, size=10),
            ],
            after=280,
        ),
        table,
        paragraph("", after=280),
        callout(
            "Document Purpose",
            "This document consolidates product purpose, architecture, source structure, data model, core workflows, integrations, setup, deployment, and current maintenance notes into one polished reference.",
        ),
        page_break(),
    ]


def build_body() -> list[str]:
    body: list[str] = []
    body.extend(cover_page())

    body.append(h1("Document Index"))
    body.append(paragraph("Use this index as the entry point for navigating the project document.", style="Lead"))
    body.append(
        table_xml(
            [
                ["Section", "Purpose", "Best Reader"],
                ["1. Executive Summary", "Project mission, current status, and value proposition.", "Stakeholders, reviewers"],
                ["2. Product Scope", "Users, roles, and primary functional surfaces.", "Product owners, KAM leads"],
                ["3. Architecture", "Frontend, backend, data, integrations, and diagrams.", "Developers, maintainers"],
                ["4. Source Code Map", "Routes, services, DB scripts, and component organization.", "Developers, future AI sessions"],
                ["5. Functional Modules", "Detailed functionality by application area.", "QA, product, developers"],
                ["6. Data Model", "Tables, persistence rules, audit history, and RLS notes.", "Backend maintainers"],
                ["7. Integrations", "Salesforce, AI, SOW, Charter, Fireflies, Jira, Calendar.", "Integration owners"],
                ["8. Operations", "Environment variables, setup, build, deployment.", "DevOps, maintainers"],
                ["9. Roadmap and Risks", "Known gaps, dependency notes, hardening priorities.", "Project owners"],
                ["Appendices", "Inventory, scripts, migration list, terminology.", "All readers"],
            ],
            [1700, 5140, 2520],
        )
    )
    body.append(page_break())

    body.append(h1("1. Executive Summary"))
    body.append(
        paragraph(
            "Aether KAM is an internal Key Account Management portal for an IT services company. It helps KAM teams manage enterprise relationships, track account health, handle contracts, surface risks, coordinate escalations, and identify retention or growth opportunities.",
            style="Lead",
        )
    )
    body.append(
        callout(
            "Current State",
            "The project began as a static JavaScript prototype and is now a Supabase-backed React/TanStack Start application with authentication, role-aware account access, KYC writeback, KPI editing, account history, user administration, Salesforce sync, AI summaries, SOW extraction, Charter sheet auto-fill, and several automation-oriented service layers.",
            fill=LIGHT_BLUE,
            accent=BLUE,
        )
    )
    body.append(h2("Project Objectives"))
    for item in [
        "Provide a single Client 360 view for every key account.",
        "Let KAM users update KYC, assignment, score, activity, contract, and summary data with traceability.",
        "Reduce manual account research through Salesforce, SOW, Charter sheet, LinkedIn, website, Fireflies, Jira, and AI workflows.",
        "Keep access controlled by user role and assigned account ownership.",
        "Keep the architecture understandable enough for future development and portfolio review.",
    ]:
        body.append(bullet(item))
    body.append(h2("High-Level Product Capabilities"))
    body.append(
        table_xml(
            [
                ["Capability", "What it does", "Implementation anchor"],
                ["Portfolio dashboard", "Shows account, health, task, notification, and score-oriented views.", "src/routes/index.jsx, portfolio services"],
                ["Accounts portfolio", "Lists accounts, supports KAM assignment and Head of KAM account creation.", "src/routes/accounts.index.jsx"],
                ["Client 360", "Nine-tab detail surface for KYC, scores, activity, growth, education, escalations, meetings, and history.", "src/routes/accounts.$accountId.jsx"],
                ["Supabase persistence", "Stores accounts, stakeholders, scores, contracts, activity, history, notifications, and more.", "src/services/db.js, src/db/*.sql"],
                ["External sync and AI", "Salesforce mapping, SOW extraction, Charter auto-fill, AI summaries, Fireflies/Jira/Calendar workflows.", "src/services/*.js"],
            ],
            [2200, 4820, 2340],
        )
    )

    body.append(h1("2. Product Scope and Users"))
    body.append(h2("Primary Users"))
    body.append(
        table_xml(
            [
                ["Role", "Access Scope", "Write Access", "Typical Responsibilities"],
                ["CEO", "All accounts", "No", "Read executive account health, risks, contract state, and escalations."],
                ["Head of KAM", "All accounts", "Yes", "Manage users, assign KAMs, create accounts, review portfolio, and edit account records."],
                ["KAM", "Assigned accounts", "Yes", "Maintain KYC, scores, activities, risks, summaries, and customer relationship workflows."],
            ],
            [1600, 1800, 1400, 4560],
        )
    )
    body.append(h2("Application Route Map"))
    body.append(
        table_xml(
            [
                ["Route", "File", "Purpose"],
                ["/", "src/routes/index.jsx", "Dashboard and portfolio overview."],
                ["/login", "src/routes/login.jsx", "Supabase email/password sign-in."],
                ["/set-password", "src/routes/set-password.jsx", "Invite/recovery password setup flow."],
                ["/users", "src/routes/users.jsx", "Head of KAM user management."],
                ["/accounts", "src/routes/accounts.index.jsx", "Portfolio list, KAM assignment, new account modal."],
                ["/accounts/:id", "src/routes/accounts.$accountId.jsx", "Client 360 account detail with nine tabs."],
                ["/contracts", "src/routes/contracts.jsx", "Contract detail table and renewal/compliance view."],
                ["/strategy", "src/routes/strategy.jsx", "Strategy builder area, still partly static."],
                ["/escalations", "src/routes/escalations.jsx", "Escalation list and account-related escalation visibility."],
                ["/educate", "src/routes/educate.jsx", "Education content and relationship improvement area."],
                ["/calendar/callback", "src/routes/calendar.callback.jsx", "Calendar integration OAuth callback route."],
            ],
            [1600, 3000, 4760],
        )
    )
    body.append(h2("Client 360 Tab Inventory"))
    for item in [
        "Overview: KYC fields, Project Charter Auto-fill, Salesforce sync, KAM assignment, Account Details, LinkedIn and website summaries.",
        "Score Marking Matrices: eight health blocks and KPI editor with weighted scoring.",
        "Activity to Increase Score: activity-score model, action items, AI suggestions, and related operations.",
        "Opportunities: growth opportunities for the selected account.",
        "Retention VS Growth: delivered, in-flight, white-space, and not-applicable service posture.",
        "Educate client: education history and relationship-improvement support.",
        "Escalation: account-level escalation visibility and action context.",
        "Meeting History: Fireflies meeting summaries and action states.",
        "Client History: account_history audit trail for important changes.",
    ]:
        body.append(bullet(item))

    body.append(h1("3. Technical Architecture"))
    body.append(
        diagram(
            "Diagram 1. System Context",
            [
                "+----------------------+        +------------------------------+",
                "| Authenticated User   |        | External Systems             |",
                "| CEO / Head / KAM     |        | Salesforce, AI, Fireflies,   |",
                "+----------+-----------+        | Jira, Calendar, Education    |",
                "           |                    +---------------+--------------+",
                "           v                                    ^",
                "+----------+------------------------------------+--------------+",
                "| React 19 + TanStack Router/Start application                 |",
                "| Routes, client views, server functions, mutations, loaders    |",
                "+----------+-----------------------------+--------------------+",
                "           |                             |",
                "           v                             v",
                "+----------+-----------+        +--------+---------------------+",
                "| Supabase Auth       |        | Supabase PostgreSQL          |",
                "| session + profile   |        | accounts, scores, history,   |",
                "+---------------------+        | contracts, activities, etc.  |",
                "                               +------------------------------+",
            ],
        )
    )
    body.append(h2("Frontend Architecture"))
    for item in [
        "React 19 and JavaScript ES modules power the UI.",
        "TanStack Router provides file-based routes and account detail loaders.",
        "TanStack Query handles fetch/mutation state, cache invalidation, loading, and pending states.",
        "Tailwind CSS v4 and Radix UI primitives provide the UI foundation.",
        "Lucide React icons are used for navigation, commands, status, and upload/sync actions.",
    ]:
        body.append(bullet(item))
    body.append(h2("Backend and Data Architecture"))
    for item in [
        "Supabase is the primary backend for PostgreSQL data and authentication.",
        "src/services/db.js centralizes database reads, writes, mappers, and mutation helpers.",
        "TanStack Start server functions isolate sensitive integrations such as user admin, Salesforce, AI summaries, SOW parsing, and sync actions.",
        "RLS policies and UI permission gates work together to constrain account visibility and write behavior.",
        "account_history provides a user-facing audit record for important account changes.",
    ]:
        body.append(bullet(item))
    body.append(
        diagram(
            "Diagram 2. Core Mutation Pattern",
            [
                "User action in route/component",
                "  -> useMutation mutationFn",
                "     -> db.js or server function",
                "        -> Supabase write / external API call",
                "        -> optional logAccountChanges(account_id, diffs, edited_by)",
                "     -> queryClient.invalidateQueries(...)",
                "     -> router.invalidate() when loader data must refresh",
                "  -> UI success/error state and save bar feedback",
            ],
        )
    )

    body.append(h1("4. Source Code Map"))
    body.append(h2("Repository Structure"))
    body.append(
        table_xml(
            [
                ["Path", "Role in project"],
                ["src/routes", "File-based application routes and page-level UI."],
                ["src/services", "Data access, integrations, AI/server functions, and feature-specific model builders."],
                ["src/db", "Schema, migrations, RLS policies, seed scripts, and setup SQL."],
                ["src/context", "Authentication context and app-level session/profile state."],
                ["src/components", "Layout, shared cards, and shadcn/Radix UI primitive wrappers."],
                ["src/data", "Legacy/static reference data, role permissions, formatting helpers."],
                ["src/lib", "Supabase client, utility helpers, and error support."],
                ["PROJECT_CONTEXT.txt", "Copy-paste context file for future development sessions."],
                ["PROJECT_DOCS.txt", "Technical reference for setup, database, architecture, and feature details."],
            ],
            [2200, 7160],
        )
    )
    body.append(h2("Key Service Areas"))
    body.append(
        table_xml(
            [
                ["Service file", "Responsibility"],
                ["db.js", "Central Supabase data layer and most application mutations."],
                ["auth.js / AuthContext.jsx", "Sign-in, sign-out, session state, profile loading, inactive-user handling."],
                ["salesforce.js / salesforce-sync.js", "Salesforce lookup, field mapping, and Supabase sync."],
                ["sow-upload.js", "Server-side SOW extraction and account/contract field application."],
                ["linkedin-summary.js / website-summary.js", "Server-side AI summaries for account research."],
                ["activity-* services", "Activity score matrix, activity tab model, AI suggestions, governance, snapshots."],
                ["fireflies-* services", "Meeting summaries, action agents, fallback agents, webhook/event support."],
                ["jira.js / jiraInsights.js", "Jira integration and insight helpers."],
                ["calendar.js", "Calendar connection and callback support."],
                ["notifications.js / notification-read.js", "Notification generation and read-state persistence."],
                ["user-admin.js", "Server-only Supabase Auth invite flow for managed users."],
            ],
            [3000, 6360],
        )
    )

    body.append(h1("5. Functional Modules"))
    body.append(h2("Accounts and KYC"))
    for item in [
        "KYC editable state is initialized from one DB column per field to avoid field-doubling on save.",
        "Save KYC writes DB-backed fields through updateAccountKyc() and logs diffs through account_history.",
        "Project Charter Auto-fill reads .xlsx files in the browser with JSZip and applies selected values to local KYC state before Save KYC.",
        "Salesforce sync opens a field-mapping modal and writes selected mapped account/stakeholder fields.",
        "SOW upload extracts supported contract/account fields and writes them through server-side helpers.",
    ]:
        body.append(bullet(item))
    body.append(h2("KPI and Health Scoring"))
    for item in [
        "Eight health areas are represented: relationship, project, white_space, contract, csat, risk, resource, financial.",
        "KPI editor supports weighted checkbox scoring and saves full section state into health_scores.kpi_data.",
        "New accounts get default scoring rows and fallback KPI sections when metric rows are missing.",
        "Derived metric bars can be calculated from kpi_data when health_metrics rows are absent.",
    ]:
        body.append(bullet(item))
    body.append(h2("User Management"))
    for item in [
        "Head of KAM can manage users through /users.",
        "createManagedAuthUser() uses a server function and the Supabase service role key to invite users.",
        "Invited users land on /set-password and use supabase.auth.updateUser({ password }).",
        "profiles.is_active controls whether a user can continue using the app.",
    ]:
        body.append(bullet(item))
    body.append(h2("Account History and Auditability"))
    body.append(
        paragraph(
            "The account_history table records field-level changes by account, edited_by display name, old value, new value, and timestamp. It is used by KYC save, KAM assignment, KPI score save, Salesforce sync, SOW field application, summary generation, and selected automation workflows.",
        )
    )

    body.append(h1("6. Data Model and Persistence"))
    body.append(
        table_xml(
            [
                ["Domain", "Tables / fields", "Notes"],
                ["Identity", "profiles", "Stores app users, role, email, initials, active status."],
                ["Accounts", "accounts, stakeholders", "Core client account record and contact graph."],
                ["Health", "health_scores, health_metrics", "Scores and KPI details, with kpi_data jsonb."],
                ["Contracts", "contract_details, accounts renewal/duration fields", "Contract type, value, duration, renewal, SWOT/resource data."],
                ["Work", "activities, tasks, activity rule tables", "Account work items, scoring actions, suggestions, evidence."],
                ["Growth", "retention_growth, opportunities, retention_growth_drafts", "Service posture, opportunities, drafts, scoring."],
                ["Education", "education_log", "Client education sessions and content support."],
                ["Escalation", "escalations, escalation_action_items", "Escalation status, priority, SLA, actions."],
                ["Notifications", "notifications plus read-state helpers", "In-app notification records and role/automation triggers."],
                ["Audit", "account_history", "Human-readable change history per account; account_id is TEXT."],
            ],
            [1800, 3320, 4240],
        )
    )
    body.append(
        callout(
            "Important Type Rule",
            "accounts.id is TEXT, not UUID. Any table that references accounts.id, including account_history.account_id, must use TEXT. This is a recurring implementation constraint.",
            fill="FFF7ED",
            accent=WARN,
        )
    )
    body.append(
        diagram(
            "Diagram 3. Account-Centered Data Model",
            [
                "profiles",
                "   | assigned_kam_id",
                "   v",
                "accounts (TEXT id)",
                "   |-- stakeholders",
                "   |-- health_scores -- health_metrics",
                "   |-- contract_details",
                "   |-- activities / tasks / activity evidence",
                "   |-- retention_growth / opportunities / drafts",
                "   |-- education_log",
                "   |-- escalations -- escalation_action_items",
                "   |-- fireflies meeting history / action states",
                "   |-- notifications",
                "   |-- account_history",
            ],
        )
    )

    body.append(h1("7. Integrations and Automation"))
    body.append(h2("Salesforce Integration"))
    for item in [
        "Uses OAuth Client Credentials flow for the Agentforce/OrgFarm Salesforce org.",
        "lookupSalesforceAccountBundle searches by account name and returns account plus related contacts.",
        "SalesforceMappingModal lets users review each field before sync.",
        "syncSalesforceMappedFieldsServer uses service-role writes with column whitelists for accounts and stakeholders.",
        "Synced fields are logged to account_history and update local UI state immediately.",
    ]:
        body.append(bullet(item))
    body.append(h2("Project Charter Sheet Upload"))
    body.append(
        diagram(
            "Diagram 4. Charter Sheet Auto-fill Flow",
            [
                "User chooses .xlsx file",
                "  -> isXlsxFile() validates extension/MIME",
                "  -> JSZip reads sharedStrings.xml and sheetN.xml in browser",
                "  -> label/alias/nearby-cell extraction validates field values",
                "  -> CharterMappingDialog opens with Yes/Local/No value/No match rows",
                "  -> Apply Selected updates local KYC state only",
                "  -> Save KYC persists DB-backed rows and logs account_history",
            ],
        )
    )
    body.append(h2("SOW Upload"))
    for item in [
        "Upload size is capped at 12 MB.",
        "extractSowFields runs server-side extraction from uploaded content.",
        "applySowFields updates supported account and contract fields.",
        "Changed fields are summarized and logged to account_history.",
    ]:
        body.append(bullet(item))
    body.append(h2("AI Summaries and Meeting Intelligence"))
    for item in [
        "LinkedIn summary and website summary workflows call server-side AI helpers and save generated text plus updated timestamps.",
        "Fireflies services support meeting summaries, action extraction, fallback agents, opportunity sync, and event logging.",
        "Activity AI suggestions, staged recommendations, evidence submission, and review workflows exist in db.js and related services.",
    ]:
        body.append(bullet(item))

    body.append(h1("8. Operations, Environment, and Deployment"))
    body.append(h2("Environment Variables"))
    body.append(
        table_xml(
            [
                ["Variable", "Visibility", "Purpose"],
                ["VITE_SUPABASE_URL", "Browser-safe", "Supabase project URL used by src/lib/supabase.js."],
                ["VITE_SUPABASE_ANON_KEY", "Browser-safe", "Supabase anon/publishable key."],
                ["SUPABASE_SERVICE_ROLE_KEY", "Server-only", "Seed scripts, user invites, privileged sync/write flows."],
                ["SALESFORCE_INSTANCE_URL", "Server-only", "Salesforce REST API instance base URL."],
                ["SALESFORCE_LOGIN_URL", "Server-only", "OAuth token endpoint base URL."],
                ["SALESFORCE_CLIENT_ID", "Server-only", "Connected App consumer key."],
                ["SALESFORCE_CLIENT_SECRET", "Server-only", "Connected App consumer secret."],
                ["GEMINI_API_KEY", "Server-only", "Gemini-powered AI workflows where configured."],
                ["OPENAI_API_KEY / OPENAI_MODEL", "Server-only", "OpenAI-powered summary and assistant workflows where configured."],
            ],
            [2700, 1800, 4860],
        )
    )
    body.append(
        callout(
            "Secret Handling Rule",
            "Never put service role keys, Salesforce secrets, Gemini keys, or OpenAI keys in variables with the VITE_ prefix. VITE_ values are exposed to the browser bundle.",
            fill="FEE2E2",
            accent=CRIT,
        )
    )
    body.append(h2("Common Commands"))
    body.append(
        table_xml(
            [
                ["Command", "Use"],
                ["bun install", "Install dependencies."],
                ["bun run dev", "Start Vite dev server."],
                ["bun run build", "Create production build."],
                ["bun run preview", "Preview production build locally."],
                ["bun run seed", "Run src/db/seed.js against configured Supabase project."],
                ["bun run lint", "Run ESLint."],
                ["bun run format", "Run Prettier."],
            ],
            [2600, 6760],
        )
    )
    body.append(h2("Deployment Target"))
    body.append(
        paragraph(
            "The intended deployment target is Cloudflare Pages through the Cloudflare Vite plugin. Production setup requires the same server-only environment variables in the Cloudflare dashboard, plus Supabase Auth redirect URL configuration for /set-password.",
        )
    )

    body.append(h1("9. Quality, Risks, and Roadmap"))
    body.append(h2("Current Strengths"))
    for item in [
        "Clear separation between route UI and data/service helpers.",
        "Role-aware visibility and edit gating are consistently referenced.",
        "Audit trail exists for the most important account changes.",
        "Field mapping and upload workflows require review before persistence.",
        "Context and docs files are maintained as working memory for future sessions.",
    ]:
        body.append(bullet(item))
    body.append(h2("Maintenance Notes"))
    for item in [
        "JSZip is imported directly by accounts.$accountId.jsx and is present in lockfiles; keep it as an available app dependency during dependency cleanup.",
        "Strategy remains partly static and should be revisited when the persistence model is finalized.",
        "Some work-management areas are actively evolving; verify current write behavior in source before promising full CRUD coverage.",
        "Salesforce Client Credentials flow requires the Connected App to keep Enable Client Credentials Flow checked and a Run As user configured.",
        "Rendering/visual QA of this document requires LibreOffice or another DOCX renderer on the machine.",
    ]:
        body.append(bullet(item))
    body.append(h2("Recommended Next Hardening Steps"))
    for item in [
        "Add focused tests for Charter extraction, Salesforce row mapping, KYC save diffs, and role-scoped account queries.",
        "Add per-page error boundaries and loading skeletons for high-traffic routes.",
        "Clarify which account-detail tabs are fully writable, partially writable, or read-only in the UI.",
        "Promote direct dependencies used by source files into package.json where needed.",
        "Add deployment checklist and environment validation to reduce production misconfiguration risk.",
    ]:
        body.append(numbered(item))

    body.append(page_break())
    body.append(h1("Appendix A. Database Migration Inventory"))
    body.append(
        paragraph(
            "The project contains schema.sql plus many additive and fix migrations. Important categories include user management, KAM assignment, account history, KPI data, contract fields, Salesforce sync fields, AI insights, activity scoring governance, Fireflies security/history, notifications, tasks, retention/growth drafts, and RLS fixes.",
        )
    )
    body.append(
        table_xml(
            [
                ["Migration group", "Representative files"],
                ["Core setup", "schema.sql, reset.sql, enable-rls.sql, grant-read.sql, setup-auth.sql, seed.js"],
                ["Accounts and KAM", "add-kam-assignment.sql, add-account-insert-policy.sql, add-account-delete-policy.sql, add-account-history.sql"],
                ["Contracts and summaries", "add-account-contract-fields.sql, add-contract-details-write-policy.sql, add-linkedin-summary*.sql, add-account-website-summary.sql"],
                ["Scoring and activity", "add-kpi-data.sql, add-health-scores-insert-policy.sql, add-activity-scoring-governance.sql, add-activity-ai-suggestions.sql"],
                ["Integrations", "add-salesforce-account-object-sync-fields.sql, add-fireflies-*.sql, add-calendar-connections.sql, add-ai-insights.sql"],
                ["Notifications and tasks", "add-role-notifications.sql, add-notification-automation-triggers.sql, add-tasks.sql, fix-notification-read-persistence.sql"],
            ],
            [2300, 7060],
        )
    )
    body.append(h1("Appendix B. Source-of-Truth Files"))
    body.append(
        table_xml(
            [
                ["File", "Why it matters"],
                ["PROJECT_CONTEXT.txt", "Human-readable current project memory and phase history."],
                ["PROJECT_DOCS.txt", "Technical reference for setup, architecture, schema, Salesforce, Charter, and docs notes."],
                ["src/services/db.js", "Largest functional data layer and query/mutation inventory."],
                ["src/routes/accounts.$accountId.jsx", "Largest route and Client 360 workflow hub."],
                ["src/db/schema.sql", "Base database schema."],
                ["package.json", "Build scripts and dependency declaration."],
                [".env.local", "Local secret/config file. Never commit or paste secrets into docs."],
            ],
            [2500, 6860],
        )
    )
    body.append(h1("Appendix C. Visual Style Tokens Used in This Document"))
    body.append(
        table_xml(
            [
                ["Token", "Hex", "Use"],
                ["Deep navy", "#0B2545", "Cover/title accents, diagram headers."],
                ["Professional blue", "#2E74B5", "Heading hierarchy and table accents."],
                ["Restrained teal", "#0F766E", "Positive/process callouts and secondary accents."],
                ["Slate neutral", "#475569", "Muted metadata and explanatory text."],
                ["Light blue-gray", "#E8EEF5", "Table headers and reference surfaces."],
                ["Soft gray", "#F8FAFC", "Diagram and table body fill."],
                ["Warning gold", "#7A5A00", "Risk and maintenance notes."],
                ["Critical red", "#9B1C1C", "Secret-handling and production-risk callouts."],
            ],
            [2200, 1400, 5760],
        )
    )
    return body


def styles_xml() -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:color w:val="{INK}"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="{INK}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CoverTitle"><w:name w:val="Cover Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="72"/><w:color w:val="{NAVY}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CoverSubtitle"><w:name w:val="Cover Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="300" w:line="320" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="28"/><w:color w:val="{SLATE}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Lead"><w:name w:val="Lead"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="180" w:line="320" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="24"/><w:color w:val="{SLATE}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/><w:spacing w:before="360" w:after="200"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="32"/><w:color w:val="{BLUE}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/><w:spacing w:before="280" w:after="140"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="26"/><w:color w:val="{BLUE}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="2"/><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="24"/><w:color w:val="{NAVY}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/><w:color w:val="{INK}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="{MUTED}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="Footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="18"/><w:color w:val="{MUTED}"/></w:rPr></w:style>
</w:styles>'''


def numbering_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>'''


def document_xml(body_parts: list[str]) -> str:
    sect_pr = '''<w:sectPr>
  <w:headerReference w:type="default" r:id="rId1"/>
  <w:footerReference w:type="default" r:id="rId2"/>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
  <w:cols w:space="720"/>
  <w:docGrid w:linePitch="360"/>
</w:sectPr>'''
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {''.join(body_parts)}
    {sect_pr}
  </w:body>
</w:document>'''


def header_xml() -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:pStyle w:val="Footer"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="6" w:color="{BORDER}"/></w:pBdr></w:pPr>
    {run("Aether KAM General Project Document", bold=True, color=NAVY, size=9)}
    {run("  |  Internal Technical Reference", color=MUTED, size=9)}
  </w:p>
</w:hdr>'''


def footer_xml() -> str:
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr>
    {run("Page ", color=MUTED, size=9)}
    <w:fldSimple w:instr="PAGE">{run("1", color=MUTED, size=9)}</w:fldSimple>
  </w:p>
</w:ftr>'''


def content_types_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''


def root_rels_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''


def document_rels_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>'''


def core_xml() -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Aether KAM General Project Document</dc:title>
  <dc:subject>Project architecture, functionality, data model, integrations, and operations</dc:subject>
  <dc:creator>Codex</dc:creator>
  <cp:keywords>Aether KAM; React; TanStack; Supabase; Salesforce; KYC; Project Charter</cp:keywords>
  <dc:description>Detailed general project documentation generated from the project codebase and context files.</dc:description>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>'''


def app_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex OOXML Builder</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>Aether</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0</AppVersion>
</Properties>'''


def build_docx(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    parts = {
        "[Content_Types].xml": content_types_xml(),
        "_rels/.rels": root_rels_xml(),
        "docProps/core.xml": core_xml(),
        "docProps/app.xml": app_xml(),
        "word/document.xml": document_xml(build_body()),
        "word/styles.xml": styles_xml(),
        "word/numbering.xml": numbering_xml(),
        "word/header1.xml": header_xml(),
        "word/footer1.xml": footer_xml(),
        "word/_rels/document.xml.rels": document_rels_xml(),
    }
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as docx:
        for name, xml in parts.items():
            docx.writestr(name, xml)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="deliverables/Aether_KAM_General_Project_Document.docx")
    args = parser.parse_args()
    build_docx(Path(args.output))
    print(os.path.abspath(args.output))


if __name__ == "__main__":
    main()
