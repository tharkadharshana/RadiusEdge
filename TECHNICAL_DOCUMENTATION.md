
# RadiusEdge - Technical Documentation

## 1. Introduction

RadiusEdge is a web-based platform designed for advanced RADIUS (Remote Authentication Dial-In User Service) testing and scenario management. It aims to provide network engineers, QA teams, and developers with a comprehensive suite of tools to design, execute, and analyze RADIUS test scenarios. This document provides a technical overview of the RadiusEdge application, its architecture, technology stack, and key components.

## 2. Technology Stack

- **Frontend Framework:** Next.js 15.x (App Router)
- **Language:** TypeScript
- **UI Library:** React 18.x
- **Component Library:** ShadCN UI (built on Radix UI and Tailwind CSS)
- **Styling:** Tailwind CSS
- **Generative AI & Backend Logic (Flows):** Genkit (using Google AI - Gemini models)
- **State Management (Client-side):** React Context API, `useState`, `useEffect` hooks
- **Forms:** Primarily handled with React state and ShadCN components. (React Hook Form is available in dependencies if more complex forms are needed).
- **Icons:** Lucide React
- **Charting:** Recharts
- **Date Manipulation:** `date-fns`
- **Utility Libraries:** `clsx`, `tailwind-merge` for class name composition.

## 3. Project Structure

```
radius-edge/
├── .env                      # Environment variables (currently empty)
├── apphosting.yaml           # Firebase App Hosting configuration
├── components.json           # ShadCN UI configuration
├── next.config.ts            # Next.js configuration
├── package.json              # Project dependencies and scripts
├── README.md                 # General project README
├── src/
│   ├── ai/
│   │   ├── dev.ts            # Genkit development server entry point
│   │   ├── flows/            # Genkit AI flows
│   │   │   ├── explain-radius-attribute.ts
│   │   │   ├── generate-radius-packet.ts
│   │   │   ├── parse-radius-attributes-flow.ts
│   │   │   ├── test-db-validation-flow.ts
│   │   │   └── test-server-connection-flow.ts
│   │   └── genkit.ts         # Genkit AI instance initialization
│   ├── app/                  # Next.js App Router pages and layouts
│   │   ├── (main_app_routes)/ # Route groups for different sections
│   │   │   ├── ai-assistant/page.tsx
│   │   │   ├── dictionaries/page.tsx
│   │   │   ├── execute/page.tsx
│   │   │   ├── packets/page.tsx
│   │   │   ├── results/page.tsx
│   │   │   ├── scenarios/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── database/page.tsx
│   │   │   │   ├── servers/page.tsx
│   │   │   │   └── users/page.tsx
│   │   │   └── page.tsx        # Dashboard page
│   │   ├── globals.css       # Global styles and ShadCN theme variables
│   │   └── layout.tsx        # Root layout
│   ├── components/
│   │   ├── layout/           # Layout specific components (sidebar, header, theme)
│   │   ├── shared/           # Reusable components across multiple pages (e.g., PageHeader)
│   │   └── ui/               # ShadCN UI components (Button, Card, Dialog, etc.)
│   ├── hooks/
│   │   ├── use-mobile.tsx    # Hook to detect mobile viewport
│   │   └── use-toast.ts      # Hook for displaying toast notifications
│   └── lib/
│       └── utils.ts          # Utility functions (e.g., `cn` for class names)
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

## 4. Core Components & Pages

### 4.1. Layout (`src/app/layout.tsx`, `src/components/layout/`)
- **`RootLayout (layout.tsx)`:** Sets up the HTML structure, includes global CSS, `ThemeProvider`, `SidebarProvider`, and `Toaster`.
- **`AppSidebar (app-sidebar.tsx)`:** Provides main navigation. Uses ShadCN's `Sidebar` component. Dynamically highlights active links based on the current pathname.
- **`AppHeader (app-header.tsx)`:** Contains the sidebar trigger, server status badge, notifications button (conceptual), and theme toggle.
- **`ThemeProvider (theme-provider.tsx)`:** Uses `next-themes` to manage light/dark mode.
- **`Logo (logo.tsx)`:** SVG logo component.
- **`ServerStatusBadge (server-status-badge.tsx)`:** Displays a mock server connection status.
- **`ThemeToggle (theme-toggle.tsx)`:** Allows users to switch between light, dark, and system themes.

### 4.2. Dashboard (`src/app/page.tsx`)
- Displays an overview of the application.
- Features "Quick Actions" cards linking to major sections.
- Includes "Quick Start a Scenario" and "Execute Tests" (conceptual) sections with placeholder server selection.
- Shows mock "Recent Activity" and "System Status" for illustrative purposes.

### 4.3. AI Assistant (`src/app/ai-assistant/page.tsx`)
- **Functionality:** Allows users to generate RADIUS packets and get explanations for RADIUS attributes using AI.
- **UI:**
    - Two main cards: "Generate RADIUS Packet" and "Explain RADIUS Attribute".
    - Input fields for vendor, packet type, context (for generation), attribute name, and attribute vendor (for explanation).
    - Buttons to trigger AI flows, with loading indicators.
    - Displays generated packet data, explanations, or attribute explanations in bordered sections.
- **Backend Interaction:**
    - Calls `generateRadiusPacket` Genkit flow.
    - Calls `explainRadiusAttribute` Genkit flow.
- **Error Handling:** Uses `useToast` for feedback on success or failure.

### 4.4. Scenario Builder (`src/app/scenarios/page.tsx`)
- **Functionality:** Design complex, multi-step RADIUS test scenarios.
- **Data Structures:**
    - `Scenario`: Contains `id`, `name`, `description`, `variables`, `steps`, `lastModified`, `tags`.
    - `ScenarioVariable`: `id`, `name`, `type` ('static', 'random_string', 'random_number', 'list'), `value`.
    - `ScenarioStep`: `id`, `type` (e.g., 'radius', 'sql', 'delay', 'api_call', 'log_message', 'conditional_start', 'conditional_end'), `name`, `details` (type-specific configuration).
        - RADIUS step details: `packet_id`, `expectedAttributes` (array of `{id, name, value}`), `timeout`, `retries`.
        - SQL step details: `query`, `expect_column`, `expect_value`, `connection`.
        - API Call step details: `url`, `method`, `headers` (array), `requestBody`, `mockResponseBody`.
- **UI:**
    - Main table lists existing scenarios with search functionality.
    - "Create New Scenario" button.
    - **Scenario Editor Dialog:**
        - Left Panel: Scenario properties (name, description, tags) and variables management (add, remove, edit).
        - Right Panel: Scenario steps management.
            - Fixed header with "Add Step" dropdown (RADIUS, SQL, Delay, API Call, Log Message, Conditional Start/End).
            - Scrollable list of steps. Each step is a card with:
                - Icon representing step type.
                - Editable name.
                - Type-specific configuration inputs (e.g., packet selection, query input, API call details, attribute parsing from text).
        - Import/Export functionality using JSON files.
- **Backend Interaction:**
    - Calls `parseRadiusAttributesFromString` flow for pasting and parsing expected reply attributes in RADIUS steps.
- **State Management:** Uses `useState` for scenarios list, editing scenario, search term, etc.
- **Limitations Noted in UI:** Conditional logic is visual only; step reordering (drag-and-drop) is not implemented.

### 4.5. Packet Editor (`src/app/packets/page.tsx`)
- **Functionality:** Manage a library of individual RADIUS packets.
- **Data Structures:**
    - `RadiusPacket`: `id`, `name`, `description`, `attributes` (array of `{id, name, value}`), `lastModified`, `tags`.
- **UI:**
    - Main table lists existing packets with search functionality.
    - "Create New Packet" button.
    - **Packet Editor Dialog:**
        - Inputs for packet name, description, tags.
        - Section to manage attributes:
            - List of attributes with inputs for name and value.
            - Autocomplete suggestions for attribute names (mocked dictionary).
            - Add/Remove attribute buttons.
- **State Management:** `useState` for packets list, editing packet, search term.

### 4.6. Dictionaries (`src/app/dictionaries/page.tsx`)
- **Functionality:** (Currently Mocked) Manage RADIUS dictionaries (standard, vendor-specific, custom).
- **Data Structures:**
    - `Dictionary` (mocked): `id`, `name`, `source`, `attributes` (count), `vendorCodes` (count), `isActive`, `lastUpdated`.
    - `Attribute` (mocked example): `id`, `name`, `code`, `type`, `vendor`, `description`, `examples`.
- **UI:**
    - Table lists available dictionaries.
    - "Import Dictionary" dialog (conceptual).
    - Switch to toggle dictionary active status (mocked).
    - Dialog to view attributes within a selected dictionary (mocked).
    - Dialog to view details of a specific attribute (mocked).

### 4.7. Execution Console (`src/app/execute/page.tsx`)
- **Functionality:** View real-time logs of test scenario executions.
- **UI:**
    - "Start a Test Scenario" buttons (mock triggers).
    - Main card displays live output.
    - Controls for (conceptual) Abort, Save PCAP, Export Logs.
    - Log entries are color-coded by level (INFO, ERROR, SENT, RECV, SSH_CMD, SSH_OUT, SSH_FAIL).
    - Displays SSH preamble steps from server configuration before RADIUS packet logs.
- **Simulation Logic:**
    - `useEffect` hook simulates log generation when `isRunning` is true.
    - Fetches mock server configurations (defined in-file) to simulate SSH preambles.
    - Simulates success/failure of SSH preamble steps based on `expectedOutputContains`.
    - If preamble succeeds (or isn't present), simulates RADIUS packet exchange logs.
- **State Management:** `useState` for logs, running state, current scenario.

### 4.8. Results Dashboard (`src/app/results/page.tsx`)
- **Functionality:** (Mocked Data) View and analyze test scenario results.
- **Data Structures:**
    - `TestResult` (mocked): `id`, `scenarioName`, `status` ('Pass', 'Fail', 'Warning'), `timestamp`, `latencyMs`, `server`, `details`.
- **UI:**
    - Filtering options: Search term, status, date range (using `react-day-picker`).
    - Charts (using `recharts` and ShadCN `ChartContainer`):
        - Latency Distribution (Bar Chart).
        - Pass/Fail Status (Pie Chart).
    - Table listing test runs with details.
    - Dialog to view detailed information for a selected result (packet log, SQL results - mocked).
- **State Management:** `useState` for results, filters, selected result.

### 4.9. Settings
#### 4.9.1. Server Configuration (`src/app/settings/servers/page.tsx`)
- **Functionality:** Configure target RADIUS servers for testing.
- **Data Structures:**
    - `ServerConfig`: `id`, `name`, `type` ('freeradius', 'custom', 'other'), `host`, `sshPort`, `sshUser`, `authMethod` ('key', 'password'), `privateKey`, `password`, `radiusAuthPort`, `radiusAcctPort`, `defaultSecret`, `nasSpecificSecrets`, `status`, `testSteps`, `scenarioExecutionSshCommands`.
    - `TestStepConfig`: `id`, `name`, `command`, `isEnabled`, `isMandatory`, `type` ('default', 'custom'), `expectedOutputContains`.
    - `SshExecutionStep`: `id`, `name`, `command`, `isEnabled`, `expectedOutputContains`.
- **UI:**
    - Table lists configured servers.
    - "Add Server" button.
    - **Server Edit Dialog:**
        - Basic server details (name, type, host).
        - SSH Details: port, user, auth method (key/password with inputs for key/password), and **Scenario Execution SSH Preamble** (list of configurable SSH steps for use during scenario execution, with `expectedOutputContains`).
        - RADIUS Ports & Secrets: Auth/Acct ports, default secret, NAS-specific secrets.
        - **Connection Test Sequence:** List of customizable test steps (name, command, enabled, mandatory, type, `expectedOutputContains`).
    - "Test Connection" button triggers AI flow.
    - Dialog to display step-by-step test results.
- **Backend Interaction:** Calls `testServerConnection` flow.

#### 4.9.2. Database Validation Setup (`src/app/settings/database/page.tsx`)
- **Functionality:** Configure database connections for validation of test results.
- **Data Structures:**
    - `DbConnectionConfig`: `id`, `name`, `type` ('mysql', 'postgresql', etc.), `host`, `port`, `username`, `password`, `databaseName`, `status`, `sshPreambleSteps` (for scenarios), `validationSteps`.
    - `DbSshPreambleStepConfig`: `id`, `name`, `command`, `isEnabled`, `expectedOutputContains`.
    - `DbValidationStepConfig`: `id`, `name`, `type` ('sql', 'ssh'), `commandOrQuery`, `isEnabled`, `isMandatory`, `expectedOutputContains`.
- **UI:**
    - Table lists configured DB connections.
    - "Add DB Connection" button.
    - **DB Config Editor Dialog:**
        - Basic connection details.
        - **Scenario SSH Preamble (for scenarios using this DB):** List of configurable SSH steps.
        - **Validation Sequence (for 'Test Connection & Validation'):** List of SQL or SSH steps for direct DB testing.
    - "Test Connection & Validation" button triggers AI flow.
    - Dialog to display step-by-step test results.
- **Backend Interaction:** Calls `testDbValidation` flow.

#### 4.9.3. User Management (`src/app/settings/users/page.tsx`)
- **Functionality:** (Currently Mocked) Manage users and their roles.
- **Data Structures:**
    - `User` (mocked): `id`, `email`, `name`, `role`, `lastLogin`, `status`.
- **UI:**
    - Table lists users.
    - "Invite User" button.
    - Dialog to add/edit user details and role.

## 5. AI Flows (`src/ai/flows/`)

All AI flows are defined in `.ts` files within this directory and are marked with `'use server';`. They generally follow a pattern:
1.  Define input and output Zod schemas.
2.  Export TypeScript types inferred from these schemas.
3.  Define an `ai.definePrompt(...)` with input/output schemas and a Handlebars template for the prompt, or implement custom logic.
4.  Define an `ai.defineFlow(...)` that takes the input schema, calls the prompt (or other logic), and returns data matching the output schema.
5.  Export an `async` wrapper function that calls the flow. This wrapper is what client components import and use.

- **`explain-radius-attribute.ts`:**
    - Input: `attributeName`, `vendor` (optional).
    - Output: `explanation` string.
    - Purpose: Provides a detailed explanation of a given RADIUS attribute.
- **`generate-radius-packet.ts`:**
    - Input: `vendor`, `packetType`, `context` (optional).
    - Output: `packetData` (human-readable), `explanation`.
    - Purpose: Generates a sample RADIUS packet based on inputs.
- **`parse-radius-attributes-flow.ts`:**
    - Input: `rawAttributesText`.
    - Output: `parsedAttributes` (array of `{name, value}`).
    - Purpose: Parses a block of text representing RADIUS attributes into a structured list.
- **`test-db-validation-flow.ts`:**
    - Input: DB connection details, validation steps (SQL/SSH).
    - Output: Overall status, DB connection status, results of validation steps.
    - Purpose: Simulates testing a DB connection and a sequence of validation steps (SQL queries or SSH commands on the DB host).
- **`test-server-connection-flow.ts`:**
    * Input: Server details, sequence of test steps (commands with `expectedOutputContains`).
    * Output: Overall status, results for each test step.
    * Purpose: Simulates testing a RADIUS server connection and setup based on a customizable sequence of steps. Halts on first critical failure.

## 6. Styling
- **Tailwind CSS:** Used for all utility-first styling. Configuration in `tailwind.config.ts`.
- **ShadCN UI Theme:** CSS HSL variables defined in `src/app/globals.css` for light and dark themes. These variables control the base colors, accents, card appearance, etc.
- **`cn` utility (`src/lib/utils.ts`):** Merges Tailwind classes with `clsx` for conditional class application.

## 7. Key Libraries & Utilities
- **`lucide-react`:** For icons used throughout the application.
- **`date-fns`:** Used for formatting dates/times (e.g., in Results Dashboard).
- **`recharts`:** Powers the charts in the Results Dashboard.
- **`@radix-ui/*`:** Primitive components underlying ShadCN UI, providing accessibility and core functionality for dialogs, dropdowns, etc.
- **`genkit`, `@genkit-ai/googleai`:** Core for AI flow definitions and interaction with Google AI models.
- **`zod`:** Used for schema definition and validation in Genkit flows.
- **`useToast` (`src/hooks/use-toast.ts`):** Custom hook for managing and displaying toast notifications.

## 8. Development & Build
- **Development Server:** `npm run dev` (starts Next.js dev server, typically on port 9002 as per `package.json`).
- **Genkit Development:** `npm run genkit:dev` or `npm run genkit:watch` to run the Genkit development server for inspecting flows.
- **Build:** `npm run build`
- **Start Production:** `npm run start`
- **Linting/Typechecking:** `npm run lint`, `npm run typecheck`

## 9. Important Considerations
- **No Persistent Storage (Current Prototype):** All data (scenarios, packets, server configs, results) is currently stored in React component state and will be lost on page refresh or application restart. A database backend (e.g., SQLite, Firestore, PostgreSQL) would be needed for persistence.
- **AI Flows for Simulation (Current Prototype):** Many backend interactions (SSH, RADIUS packet exchange, SQL queries) are currently simulated by AI flows for prototyping purposes. For a production system, these would be replaced with actual backend implementations.
- **No User Authentication/Authorization:** The application is currently open. A production system would require user accounts, roles, and permissions.
- **Conceptual Features:** Some UI elements (e.g., "Save PCAP", "Notifications", some import/export buttons) are placeholders for functionality that would exist in a complete application.
- **Error Handling:** Basic error handling with toasts is present, but comprehensive error management for all edge cases would need further development.

## 10. Future Enhancements (Conceptual)
- Implement a real backend service for:
    - Persistent storage of all user data (e.g., using SQLite or another database).
    - Secure execution of live SSH commands and `radclient`/`radtest`.
    - Actual RADIUS packet sending/receiving.
    - Live database interactions.
- Full user authentication and multi-tenancy.
- Advanced Scenario Builder features:
    - Drag-and-drop step reordering.
    - True conditional logic (if/then/else branching).
    - Data extraction from one step's output to use as input for another.
    - Looping constructs with dynamic conditions.
    - Node-based visual scenario builder.
- More sophisticated AI agents for test data generation, result analysis, and anomaly detection.
- Integration with CI/CD pipelines for automated testing.
- Comprehensive reporting and analytics.
- Team collaboration features.
