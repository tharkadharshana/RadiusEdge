
# RadiusEdge - User Guide

## 1. Welcome to RadiusEdge!

RadiusEdge is an advanced platform designed to simplify and enhance the way you test RADIUS (Remote Authentication Dial-In User Service) configurations and servers. Whether you're a network engineer, a quality assurance professional, or a developer working with RADIUS protocols, RadiusEdge provides a suite of tools to help you design, test, and analyze test scenarios with ease.

**Purpose:**
To provide a comprehensive, user-friendly environment for crafting detailed RADIUS test cases, executing them against configured servers, and understanding the outcomes, all powered by intelligent assistance.

**Target Users:**
- Network Engineers designing and troubleshooting RADIUS deployments.
- QA Teams validating RADIUS server functionality and performance.
- Developers integrating systems with RADIUS authentication or accounting.

*(Note: This version of RadiusEdge is a prototype. While the UI has been prepared for live interactions, the underlying flows for SSH, database queries, and RADIUS packet sending are currently simulated by AI in this environment. Data is not saved persistently across sessions.)*

## 2. Key Features

### 2.1. Dashboard
The Dashboard is your central landing page. It provides:
- **Quick Actions:** Easy access to the main sections of RadiusEdge like the AI Assistant, Scenario Builder, Packet Editor, and Results Dashboard.
- **Quick Start (Conceptual):** Launch pre-defined scenario templates.
- **Execute Tests (Conceptual):** An interface to run tests against configured servers.
- **Recent Activity & System Status (Mocked):** Illustrative sections showing recent test activities and system health.

### 2.2. AI Assistant
Leverage Artificial Intelligence to help with common RADIUS tasks:
- **Generate RADIUS Packet:**
    - **How:** Provide a vendor (e.g., Cisco, 3GPP), a packet type (e.g., Access-Request, Accounting-Start), and optional context (e.g., "user authenticating for VoIP").
    - **Output:** The AI will generate a sample RADIUS packet in a human-readable format along with an explanation of its attributes.
- **Explain RADIUS Attribute:**
    - **How:** Enter a RADIUS attribute name (e.g., `User-Name`, `Framed-IP-Address`) and an optional vendor.
    - **Output:** The AI will provide a detailed explanation of the attribute's purpose, usage, and common scenarios.

### 2.3. Scenario Builder
This is where you design complex, multi-step test flows:
- **Creating Scenarios:** Define a name, description, and tags for organization.
- **Variables:**
    - Create dynamic scenarios by defining variables (static values, random strings/numbers).
    - Use these variables within your steps (e.g., `User-Name = ${username_variable}`).
- **Steps:** Build your scenario by adding various step types:
    - **RADIUS Packet:** Select a pre-defined packet (from the Packet Editor), define expected attributes in the reply, and set timeout/retries. You can paste raw attribute text and have the AI parse it.
    - **SQL Validation:** Define an SQL query to run against a configured database and specify an expected column/value in the result.
    - **Delay:** Pause the scenario for a specified duration.
    - **API Call:** Define an HTTP request (URL, method, headers, body) and a mock response body for testing integrations.
    - **Log Message:** Add custom messages to the execution log.
    - **Conditional Start/End (Visual):** Visually group steps under a condition (e.g., "If Access-Accept Received"). *Actual conditional execution is not implemented in this prototype.*
- **Import/Export:** Save your scenarios to a JSON file and import them back into the builder.

### 2.4. Packet Editor
Craft and manage individual RADIUS packets:
- **Creating Packets:** Define a name, description, and tags.
- **Attributes:** Add, edit, or remove attributes for each packet.
    - Specify attribute names (with mock autocomplete) and their values.
- **Library:** All created packets are listed and searchable.

### 2.5. Dictionaries Manager
(Currently features mocked data and interactions)
- **View Dictionaries:** See a list of standard and common vendor-specific RADIUS dictionaries (e.g., Standard, 3GPP, Cisco).
- **Inspect Attributes:** Browse attributes within a selected dictionary to understand their codes, types, and descriptions.
- **Active Status:** (Conceptual) Enable or disable dictionaries for use in packet creation or scenario validation.
- **Import (Conceptual):** A dialog placeholder for importing custom dictionary files.

### 2.6. Execution Console
- **View Logs:** When you run a scenario, this console displays a real-time log of events.
- **SSH Preamble Execution:** If a target server has an "Scenario Execution SSH Preamble" configured, the console will first show logs for these SSH steps.
- **Packet Exchange:** Shows logs for RADIUS packets being sent and received.
- **Log Levels:** Logs are styled by type (INFO, ERROR, SENT, RECV, SSH commands/output).
- **Controls (Conceptual):** Buttons for Abort, Save PCAP, Export Logs are placeholders for future functionality.

### 2.7. Results Dashboard
(Currently uses mocked data for display)
- **Visualize Outcomes:** See charts and tables summarizing test results.
- **Filtering:** Filter results by scenario name, server, status (Pass/Fail/Warning), and date range.
- **Charts:**
    - Latency Distribution.
    - Pass/Fail/Warning status counts.
- **Test Runs Table:** A detailed list of executed tests, allowing you to click for more details.
- **Result Details Dialog:** Shows detailed information for a selected test run, including packet logs and SQL validation results.

### 2.8. Settings
Configure the RadiusEdge environment:
- **Server Configuration:**
    - **Define Servers:** Add and manage target RADIUS servers.
    - **Connection Details:** Hostname, RADIUS ports, default shared secret, and NAS-specific secrets.
    - **SSH Details:** SSH port, user, and authentication method (key/password).
    - **Connection Test Sequence:** Define a customizable list of commands (e.g., SSH checks, `radclient` availability, config validation, service status) to test server readiness. Each step can have an "Expected Output Contains" to define success.
    - **Scenario Execution SSH Preamble:** Define a sequence of SSH commands (e.g., for jump hosts) that are run before scenarios target this server.
    - **Test Connection Button:** Triggers a flow to test the "Connection Test Sequence" and updates the server's status.
- **Database Validation Setup:**
    - **Define DB Connections:** Add and manage database connections used for validating data after RADIUS interactions.
    - **Connection Details:** DB type, host, port, credentials, database name.
    - **Scenario SSH Preamble (for scenarios):** Define SSH steps that would be needed before a scenario interacts with this DB.
    - **Validation Sequence:** Define custom SQL queries or SSH commands (on the DB host) to run as part of a direct DB validation test. Each step can have an "Expected Output Contains".
    - **Test Connection & Validation Button:** Triggers a flow to test a direct DB connection and the "Validation Sequence".
- **User Management (Mocked):**
    - Lists team members and their roles.
    - Dialog to (conceptually) invite or edit users.

## 3. Getting Started (Conceptual Workflow with Live Backend)

1.  **Navigate the UI:** Use the sidebar to access different sections.
2.  **Configure a Server:** Go to `Settings > Server Configuration` and add a new server. Fill in its details and the test steps. Test the connection (this will attempt to connect and run checks).
3.  **Configure a Database (Optional):** Go to `Settings > Database Validation Setup` to define a DB connection for SQL validation steps in your scenarios. Test this connection.
4.  **Create a Packet (Optional):** Go to the `Packet Editor` to craft a specific RADIUS packet if needed.
5.  **Build a Scenario:** Go to the `Scenario Builder`.
    - Create a new scenario.
    - Define variables if needed.
    - Add steps:
        - A RADIUS step targeting your configured server and using a packet. Define expected attributes in the reply.
        - Perhaps an SQL validation step using your configured DB connection.
        - Add delays or other step types as needed.
6.  **Execute:** Go to the `Execution Console` (or trigger from the scenario itself, conceptually). Observe the live logs as commands are run and packets are exchanged.
7.  **View Results:** Go to the `Results Dashboard` to see the outcomes of your tests.

## 4. Tips for Effective Use

- **Use Descriptive Names:** Clearly name your scenarios, packets, server configs, and variables.
- **Leverage the AI Assistant:** Use it to quickly generate packet structures or understand attributes.
- **Utilize Variables:** Define variables in scenarios for dynamic test data.
- **Pasting Attributes:** Use the "Parse from Text" feature in the Scenario Builder (for RADIUS step expected replies) to quickly add attributes.
- **Use "Expected Output Contains":** For Server and DB test steps, define expected substrings in the output to ensure commands ran as intended.

## 5. Limitations of this Prototype Environment
- **AI Flows for Execution:** In this Firebase Studio environment, the core execution logic (SSH, RADIUS, SQL) is still handled by AI flows that *simulate* these actions. You will need to replace these with your own backend implementations for live testing.
- **No Persistent Storage:** Data you create (scenarios, packets, configurations) is stored in the browser's memory for the current session and will be lost when you refresh the page or close the browser unless you implement a backend database.
- **Conceptual UI Elements:** Some buttons or features (e.g., "Save PCAP", "Notifications", full drag-and-drop reordering for steps) are visual placeholders for functionality that would exist in a complete application.
- **AI Reliability:** AI-generated content (packets, explanations) should be reviewed for accuracy.
- **Basic Error Handling:** While some error messages and toasts are present, comprehensive error handling for all situations is not implemented.

## 6. Support & Feedback (Conceptual)

For a production version of RadiusEdge, dedicated support channels and feedback mechanisms would be available. For this prototype, your interactions and feedback during its development are highly valued!

We hope this guide helps you explore the capabilities of the RadiusEdge application!
