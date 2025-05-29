# **App Name**: RadiusEdge

## Core Features:

- Scenario Builder: Visually build RADIUS test scenarios using a drag-and-drop interface, defining access requests, expected replies, and conditional flow steps. Enables looped actions, timed events, and scenario branching for advanced simulations.
- Packet Editor: Visually edit RADIUS packets with auto-completion and validation, leveraging a fully integrated RADIUS dictionary. Supports Vendor-Specific Attributes (VSAs), FreeRADIUS-style attributes, and dynamic field generation.
- Simulator Engine: Simulate RADIUS flows using an internal wrapper around radclient. Features randomized field testing, response timeout control, and retry logic. Includes benchmarking mode to simulate concurrent requests, reporting latency, throughput, and failure rates.
- Validation Layer: Run SQL queries against external databases to validate insertions, updates, and clean-up actions after each RADIUS transaction. Compare returned results with predefined expected outputs to determine pass/fail status.
- RADIUS Dictionary Manager: Import and manage FreeRADIUS dictionaries including custom VSAs. Visually inspect attributes, types, and vendor codes. Enable/disable dictionaries per scenario to test different NAS/AAA devices.
- Results Dashboard: View test results, including pass/fail status, latency breakdown, packet exchange logs, and SQL query results. Export results in PDF, CSV, or JSON format. Includes charts such as latency histogram and pass rate over time.
- AI Packet Assistant: Generate realistic RADIUS test packets based on selected vendors or device types using a generative AI tool.  Auto-fill required fields using AI, based on known patterns from 3GPP, Cisco, Juniper, Huawei, etc.  Explain what each attribute does and why it's needed for the scenario.

## Style Guidelines:

- Primary color: Light, desaturated blue (#89B3D6) to evoke a sense of trust and stability, aligning with the reliability required in network testing environments.
- Background color: Very light gray (#F2F4F7) provides a clean, neutral backdrop that reduces eye strain and allows the interface elements to stand out, enhancing usability.
- Accent color: Desaturated Yellow (#D6AE89) complements the primary blue, drawing attention to interactive elements and status indicators without overwhelming the user interface.
- Employ a clean, sans-serif font to ensure optimal readability and clarity, particularly important for code snippets and configuration details within the application.
- Incorporate consistent and professional icons to visually represent core functions, such as packet editing, test execution, and report generation, improving the user's ability to quickly navigate and understand the application's features.
- Organize the application using a card-based layout to segment test scenarios, packets, results, and logs, providing a structured and intuitive arrangement of information that enhances the overall user experience.
- Implement subtle animations to provide feedback and guide the user through the interface. For example, when opening new panels, data changing, loading.