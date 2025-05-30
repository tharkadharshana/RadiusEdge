
# RadiusEdge - User Guide

## 1. Welcome to RadiusEdge!

RadiusEdge is an advanced platform designed to simplify and enhance the way you test RADIUS (Remote Authentication Dial-In User Service) configurations and servers. Whether you're a network engineer, a quality assurance professional, or a developer working with RADIUS protocols, RadiusEdge provides a suite of tools to help you design, test, and analyze test scenarios with ease.

**Purpose:**
To provide a comprehensive, user-friendly environment for crafting detailed RADIUS test cases, executing them against configured servers (via simulation in this prototype), and understanding the outcomes, all powered by intelligent assistance and persistent storage via a local SQLite database.

**Target Users:**
- Network Engineers designing and troubleshooting RADIUS deployments.
- QA Teams validating RADIUS server functionality and performance.
- Developers integrating systems with RADIUS authentication or accounting.

*(Note: This version of RadiusEdge is a prototype. While the UI is prepared for live interactions and data (scenarios, packets, configurations, etc.) is saved persistently to a local SQLite database, the core execution flows for SSH, database queries, and RADIUS packet sending are currently **simulated by AI in this environment**. For live testing against your actual servers, you will need to replace these AI simulation calls with your own backend implementations.)*

## 2. Key Features

### 2.1. Dashboard
The Dashboard is your central landing page. It provides:
- **Quick Actions:** Easy access to the main sections of RadiusEdge like the AI Assistant, Scenario Builder, Packet Editor, and Results Dashboard.
- **Quick Start a Scenario:** Dynamically lists your recent scenarios for quick access to the Scenario Builder.
- **Execute Tests:** Allows selection of a configured server and navigates to the Execution Console to (conceptually) run a smoke test.
- **Recent Activity:** Shows a feed of recent activities like test results (from simulated runs), AI interactions, and scenario updates, fetched from the database.
- **System Status (Mocked):** Illustrative sections showing mock system health.

### 2.2. AI Assistant
Leverage Artificial Intelligence to help with common RADIUS tasks. Interactions are saved and a history is displayed.
- **Generate RADIUS Packet:**
    - **How:** Provide a vendor (e.g., Cisco, 3GPP), a packet type (e.g., Access-Request, Accounting-Start), and optional context (e.g., "user authenticating for VoIP").
    - **Output:** The AI will generate a sample RADIUS packet in a human-readable format along with an explanation of its attributes.
- **Explain RADIUS Attribute:**
    - **How:** Enter a RADIUS attribute name (e.g., `User-Name`, `Framed-IP-Address`) and an optional vendor.
    - **Output:** The AI will provide a detailed explanation of the attribute's purpose, usage, and common scenarios.

### 2.3. Scenario Builder
Design complex, multi-step test flows. Scenarios are saved to the database.
- **Creating Scenarios:** Define a name, description, and tags for organization.
- **Variables:** Create dynamic scenarios by defining variables (static values, random strings/numbers). Use these variables within your steps (e.g., `User-Name = ${username_variable}`).
- **Steps:** Build your scenario by adding various step types:
    - **RADIUS Packet:** Select a pre-defined packet (from the Packet Editor), define expected attributes in the reply (can paste raw attributes for AI parsing), and set timeout/retries.
    - **SQL Validation:** Define an SQL query to run against a configured external database and specify an expected column/value in the result.
    - **Delay:** Pause the scenario for a specified duration.
    - **API Call (Simulated):** Define an HTTP request (URL, method, headers, body) and a mock response body. *No actual HTTP request is made in this prototype.*
    - **Log Message:** Add custom messages to the (conceptual) execution log.
    - **Conditional Start/End (Visual):** Visually group steps under a condition (e.g., "If Access-Accept Received"). *Actual conditional execution is not implemented in this prototype.*
- **Import/Export:** Save your scenarios to a JSON file and import them back into the builder.

### 2.4. Packet Editor
Craft and manage individual RADIUS packets. Packets are saved to the database.
- **Creating Packets:** Define a name, description, and tags.
- **Attributes:** Add, edit, or remove attributes for each packet.
    - Attribute name suggestions are provided from active dictionaries.
    - Paste raw attribute text for AI parsing.
- **Library:** All created packets are listed and searchable.

### 2.5. Dictionaries Manager
Manage RADIUS dictionary metadata. Dictionary metadata and example attributes are saved to the database.
- **View Dictionaries:** See a list of imported dictionaries.
- **Import Dictionaries:**
    - Manually create metadata.
    - Paste dictionary file content for AI parsing of attributes (VENDOR, ATTRIBUTE, VALUE lines; no $INCLUDE support by AI).
    - Upload a single dictionary file for AI parsing.
    - Upload multiple files for bulk metadata creation (content not auto-parsed in bulk).
- **Manage Example Attributes:** For each dictionary, view, add, edit, or delete example attributes parsed or manually entered.
- **Active Status:** Enable or disable dictionaries for use in features like packet editor attribute suggestions. Bulk enable/disable options available.

### 2.6. Execution Console
View (simulated) logs of test scenario executions. Execution records and logs are saved to the database.
- **Start a Test Scenario:** Can be initiated from the Dashboard (for a smoke test) or by future "Run Scenario" buttons.
- **SSH Preamble Simulation:** If a target server has a "Scenario Execution SSH Preamble" configured, the console will first show logs *simulating* these SSH steps.
- **Packet Exchange Simulation:** Shows logs *simulating* RADIUS packets being sent and received.
- **Log Levels:** Logs are styled by type (INFO, ERROR, SENT, RECV, SSH_CMD, SSH_OUT, SSH_FAIL).
- **Controls (Conceptual):** Buttons for Abort (stops simulation and marks execution as Aborted), Save PCAP, Export Logs are placeholders for future functionality.

### 2.7. Results Dashboard
View and analyze (simulated) test scenario results. Results are fetched from the database.
- **Visualize Outcomes:** See charts and tables summarizing test results.
- **Filtering:** Filter results by scenario name, server, status (Pass/Fail/Warning), and date range.
- **Charts:** Latency Distribution, Pass/Fail/Warning status counts.
- **Test Runs Table:** A detailed list of executed tests.
- **Result Details Dialog:** Shows detailed information for a selected test run, including (simulated) execution logs fetched from the database.

### 2.8. Settings
Configure the RadiusEdge environment. Configurations are saved to the database.
- **Server Configuration:**
    - **Define Servers:** Add and manage target RADIUS servers.
    - **Connection Details:** Hostname, RADIUS ports, default shared secret, and NAS-specific secrets.
    - **SSH Details:** SSH port, user, and authentication method (key/password).
    - **Scenario Execution SSH Preamble (Simulated):** Define a sequence of SSH commands (e.g., for jump hosts) that are *simulated* before scenarios target this server. Each step can have an "Expected Output Contains" for the simulation.
    - **Connection Test Sequence (Simulated):** Define a customizable list of commands (e.g., SSH checks, `radclient` availability, config validation, service status) to test server readiness. Each step can have an "Expected Output Contains".
    - **Test Connection Button:** Triggers an AI flow that *simulates* the "Connection Test Sequence" and updates the server's status.
- **Database Validation Setup:**
    - **Define DB Connections:** Add and manage external database connections used for validating data.
    - **Connection Details:** DB type, host, port, credentials, database name.
    - **Scenario SSH Preamble (Simulated):** Define SSH steps that are *simulated* before a scenario interacts with this external DB via this connection.
    - **Validation Sequence (Simulated):** Define custom SQL queries or SSH commands (on the DB host) to run as part of a direct DB validation test. Each step can have an "Expected Output Contains".
    - **Test Connection & Validation Button:** Triggers an AI flow that *simulates* a direct DB connection and the "Validation Sequence".
- **User Management:**
    - Lists team members and their roles.
    - Invite or edit users. User data is saved to the database. (No actual login/authentication in this prototype).

## 3. Getting Started (Conceptual Workflow with Live Backend)

1.  **Navigate the UI:** Use the sidebar to access different sections.
2.  **Configure a Server:** Go to `Settings > Server Configuration` and add a new server. Fill in its details and the test steps. Use "Test Connection" to see a *simulation* of the readiness checks.
3.  **Configure a Database (Optional):** Go to `Settings > Database Validation Setup` to define a DB connection for SQL validation steps. Use "Test Connection & Validation" to see a *simulation* of direct DB interaction.
4.  **Create a Packet (Optional):** Go to the `Packet Editor` to craft specific RADIUS packets.
5.  **Build a Scenario:** Go to the `Scenario Builder`.
    - Create a new scenario.
    - Define variables if needed.
    - Add steps:
        - A RADIUS step targeting your configured server and using a packet. Define expected attributes in the reply.
        - Perhaps an SQL validation step using your configured DB connection.
        - Add delays, API call simulations, or log messages as needed.
6.  **Execute (Simulated):** Go to the `Execution Console` (or trigger from the dashboard). Start a scenario. Observe the *simulated* logs as commands are "run" and packets are "exchanged". Execution records and logs are saved to the database.
7.  **View Results:** Go to the `Results Dashboard` to see the outcomes of your (simulated) tests, fetched from the database.

## 4. Tips for Effective Use

- **Use Descriptive Names:** Clearly name your scenarios, packets, server configs, and variables.
- **Leverage the AI Assistant:** Use it to quickly generate packet structures or understand attributes.
- **Utilize Variables:** Define variables in scenarios for dynamic test data (used during simulation).
- **Pasting Attributes:** Use the "Parse from Text" feature in Scenario Builder (RADIUS step) and Packet Editor to quickly add attributes.
- **Use "Expected Output Contains":** For Server and DB test steps (and SSH Preamble steps), define expected substrings in the (simulated) output to influence the simulation's success/failure reporting.

## 5. Limitations of this Prototype Environment
- **AI Flows for Execution Simulation:** In this Firebase Studio environment, the core execution logic (SSH, RADIUS, SQL queries for "Test Connection" and "Scenario Execution") is **simulated by AI flows**. You will need to replace these with your own backend implementations for live testing against real servers. Refer to the `TECHNICAL_DOCUMENTATION.md` for guidance on this transition.
- **Persistent Storage via SQLite:** Data you create (scenarios, packets, configurations, users, dictionary metadata, AI interactions, execution records, logs, results) is stored in a local `radiusedge.db` SQLite database file.
- **Conceptual UI Elements:** Some buttons or features (e.g., "Save PCAP", full drag-and-drop reordering for steps) are visual placeholders for functionality that would exist in a complete application.
- **AI Reliability:** AI-generated content (packets, explanations, dictionary parsing) should be reviewed for accuracy. The AI dictionary parser does not support `$INCLUDE` directives.
- **No User Authentication:** User management is for record-keeping; there is no live login or permission enforcement.
- **Basic Error Handling:** While some error messages and toasts are present, comprehensive error handling for all situations is not implemented.

## 6. Support & Feedback (Conceptual)

For a production version of RadiusEdge, dedicated support channels and feedback mechanisms would be available. For this prototype, your interactions and feedback during its development are highly valued!

We hope this guide helps you explore the capabilities of the RadiusEdge application!
