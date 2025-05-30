
"use client";

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, StopCircle, DownloadCloud, ListFilter, AlertOctagon, FileArchive, Terminal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// REAL_IMPLEMENTATION_NOTE: These interfaces would ideally be shared with your backend
// or derived from a central type definition for server configurations.
interface SshExecutionStep {
  id: string;
  name: string;
  command: string;
  isEnabled: boolean;
  expectedOutputContains?: string; 
}
interface ServerConfigForExec {
  id: string;
  name: string;
  scenarioExecutionSshCommands?: SshExecutionStep[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SENT' | 'RECV' | 'SSH_CMD' | 'SSH_OUT' | 'SSH_FAIL';
  message: string;
  rawPacket?: string; // For RADIUS packets
  commandOutput?: string; // For SSH command outputs
}

const initialLogEntries: LogEntry[] = [
  { id: 'log1', timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: 'Execution console initialized. Waiting for scenario execution...' },
];

// REAL_IMPLEMENTATION_NOTE: This mockServerConfigs object simulates fetching server configurations.
// In a real application, this data would come from your persistent backend storage (e.g., SQLite via API calls).
const mockServerConfigs: Record<string, ServerConfigForExec> = {
  "server_3gpp": {
    id: "server_3gpp",
    name: "3GPP Test Server",
    scenarioExecutionSshCommands: [
      { id: "ssh1", name: "Connect to Jumpbox", command: "ssh user@jump.example.com -p 2222", isEnabled: true, expectedOutputContains: "Connected to jump.example.com" },
      { id: "ssh2", name: "SSH to Target RADIUS", command: "ssh admin@10.0.1.100", isEnabled: true, expectedOutputContains: "Authentication successful" },
      { id: "ssh3", name: "Source environment variables", command: "source /opt/radius/env.sh", isEnabled: true, expectedOutputContains: "Environment sourced" },
      { id: "ssh4", name: "Disabled SSH Step", command: "echo 'This step is disabled'", isEnabled: false },
      { id: "ssh5", name: "Step that might fail validation", command: "check_critical_service.sh", isEnabled: true, expectedOutputContains: "SERVICE_OK" },
    ]
  },
  "server_wifi": {
    id: "server_wifi",
    name: "WiFi Test Server",
    scenarioExecutionSshCommands: [] 
  }
};


export default function ExecutionConsolePage() {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogEntries);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null); 
  const [currentTargetServerId, setCurrentTargetServerId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // REAL_IMPLEMENTATION_NOTE: This useEffect hook simulates the entire scenario execution.
    // In a real system, this logic would be on a backend that:
    // 1. Receives a scenario execution request (scenario ID, target server ID).
    // 2. Fetches scenario details and server configuration (including SSH preamble).
    // 3. Establishes an SSH connection (executing preamble steps, checking expected outputs).
    // 4. If SSH preamble succeeds, iterates through scenario steps:
    //    - For RADIUS steps: Constructs and sends actual RADIUS packets using radclient/radtest.
    //    - For SQL steps: Executes actual SQL queries against the configured DB.
    //    - For API steps: Makes actual HTTP requests.
    //    - For Delay steps: Pauses execution.
    //    - For Log steps: Records messages.
    // 5. Sends log updates back to the frontend (e.g., via WebSockets or Server-Sent Events).
    // 6. Stores final results.

    let intervalId: NodeJS.Timeout;
    if (isRunning && currentScenario && currentTargetServerId) {
      // REAL_IMPLEMENTATION_NOTE: Fetch actual server config here.
      const serverConfig = mockServerConfigs[currentTargetServerId];
      let logQueue: LogEntry[] = [];
      let logIndex = 0;
      let preambleSuccessful = true;

      // --- Simulate SSH Preamble ---
      if (serverConfig?.scenarioExecutionSshCommands && serverConfig.scenarioExecutionSshCommands.length > 0) {
        logQueue.push({
            id: `log-preamble-start-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'INFO',
            message: `[SSH Preamble for ${serverConfig.name}] Starting preamble execution...`,
        });

        for (const step of serverConfig.scenarioExecutionSshCommands) {
          if (!preambleSuccessful) break; // Stop if a previous preamble step failed validation

          if (step.isEnabled) {
            logQueue.push({
              id: `log-ssh-cmd-${step.id}-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              level: 'SSH_CMD',
              message: `[SSH Preamble] Executing: ${step.command}`,
            });
            
            // REAL_IMPLEMENTATION_NOTE: This is where actual SSH command execution would occur.
            // The mockOutput would be the actual stdout/stderr from the command.
            let mockOutput = `SIMULATED_SSH_OUTPUT for: ${step.command}\n...`;
            if (step.command.includes("jump.example.com")) mockOutput = `SIMULATED_SSH_OUTPUT: Connected to jump.example.com. Authentication successful.`;
            else if (step.command.includes("admin@10.0.1.100")) mockOutput = `SIMULATED_SSH_OUTPUT: Logged in as admin on 10.0.1.100. Authentication successful.`;
            else if (step.command.includes("source /opt/radius/env.sh")) mockOutput = `SIMULATED_SSH_OUTPUT: Environment sourced. RADIUS_HOME=/opt/radius.`;
            else if (step.command.includes("check_critical_service.sh")) {
                // Simulate a case where expected output might not be met
                if (Math.random() > 0.5) { // 50% chance it's OK
                    mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_OK: Critical service is running.`;
                } else {
                    mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_FAIL: Critical service is down.`;
                }
            }


            if (step.expectedOutputContains) {
              if (mockOutput.includes(step.expectedOutputContains)) {
                logQueue.push({
                  id: `log-ssh-out-${step.id}-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  level: 'SSH_OUT',
                  message: `[SSH Preamble] Success: '${step.name}'`,
                  commandOutput: mockOutput
                });
              } else {
                logQueue.push({
                  id: `log-ssh-fail-${step.id}-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  level: 'SSH_FAIL',
                  message: `[SSH Preamble] FAILED: '${step.name}'. Expected output "${step.expectedOutputContains}" not found. Halting preamble.`,
                  commandOutput: mockOutput
                });
                preambleSuccessful = false; 
              }
            } else { // No expected output, assume success for simulation if command "runs"
              logQueue.push({
                id: `log-ssh-out-${step.id}-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                level: 'SSH_OUT',
                message: `[SSH Preamble] Output: Successfully executed '${step.name}' (no specific output validation).`,
                commandOutput: mockOutput
              });
            }
          } else {
             logQueue.push({
              id: `log-ssh-skip-${step.id}-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              level: 'INFO',
              message: `[SSH Preamble] Skipped (disabled): ${step.name}`,
            });
          }
        }
      }
      
      // --- Simulate RADIUS Scenario Steps (only if preamble was successful) ---
      if (preambleSuccessful) {
        // REAL_IMPLEMENTATION_NOTE: Fetch actual scenario steps here.
        // Then, for each step:
        // - If RADIUS: Construct packet from template, send using radclient, check reply against expected attributes.
        // - If SQL: Connect to DB (using DB config's SSH preamble if needed), run query, check result.
        // - If API: Make HTTP call, check response.
        // - etc.
        // Each real operation would generate its own logs.

        const mockLevels: LogEntry['level'][] = ['INFO', 'DEBUG', 'SENT', 'RECV', 'WARN', 'ERROR'];
        const mockMessages = [
          "Sending Access-Request to 127.0.0.1:1812",
          "User-Name = \"testuser\"",
          "NAS-IP-Address = 10.0.0.1",
          "Received Access-Accept from 127.0.0.1",
          "Framed-IP-Address = 192.168.1.100",
          "Session-Timeout = 3600",
          "SQL Validation: User 'testuser' found in database.",
          "Warning: Response latency > 500ms",
          "Error: Packet validation failed for attribute 'Vendor-Specific'",
          "Delaying for 1000ms..."
        ];

        for (let i = 0; i < 10; i++) { 
          const randomLevel = mockLevels[Math.floor(Math.random() * mockLevels.length)];
          const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
          let entry: LogEntry = {
            id: `log-radius-${logs.length + i + 1}-${Date.now()}`, // Ensure unique ID
            timestamp: new Date().toLocaleTimeString(),
            level: randomLevel,
            message: `${currentScenario}: ${randomMessage}`,
          };
          if (randomLevel === 'SENT' || randomLevel === 'RECV') {
            entry.rawPacket = `SIMULATED_PACKET_DATA: Code: ${randomLevel === 'SENT' ? 'Access-Request' : 'Access-Accept'}\n  Attr: User-Name = "sim_user"\n  ...`;
          }
          logQueue.push(entry);
        }
      } else { // Preamble failed
          logQueue.push({
            id: `log-radius-halt-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'ERROR',
            message: `RADIUS scenario '${currentScenario}' execution halted due to SSH preamble failure.`
          });
      }
      
      // --- Process Log Queue for Frontend Display ---
      // REAL_IMPLEMENTATION_NOTE: This interval simulates logs arriving from a backend.
      // A real system would use WebSockets or Server-Sent Events for live log streaming.
      intervalId = setInterval(() => {
        if (logIndex < logQueue.length) {
          setLogs(prevLogs => [...prevLogs, logQueue[logIndex]]);
          logIndex++;
        } else {
          clearInterval(intervalId);
           setLogs(prev => [...prev, { 
            id: `finish-${Date.now()}`, 
            timestamp: new Date().toLocaleTimeString(), 
            level: preambleSuccessful && !logQueue.some(l => l.level === 'ERROR' || l.level === 'SSH_FAIL') ? 'INFO' : 'ERROR', 
            message: `Scenario ${currentScenario} finished ${preambleSuccessful && !logQueue.some(l => l.level === 'ERROR' || l.level === 'SSH_FAIL') ? 'successfully (simulated)' : 'with errors (simulated)'}.` 
          }]);
          setIsRunning(false); // Stop the "running" state
          // setCurrentScenario(null); // Optionally reset scenario/server
          // setCurrentTargetServerId(null);
        }
      }, 700); 
    }
    return () => clearInterval(intervalId);
  // IMPORTANT: Added isRunning to dependency array. Re-evaluate other dependencies if needed.
  // logs.length was causing re-runs; replaced with more stable dependencies or careful handling.
  }, [isRunning, currentScenario, currentTargetServerId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);

  const handleStartExecution = (scenarioName: string, serverId: string) => {
    // REAL_IMPLEMENTATION_NOTE: In a real app, this would send a request to the backend
    // to start the scenario execution. The backend would then stream logs back.
    setCurrentScenario(scenarioName);
    setCurrentTargetServerId(serverId);
    setLogs([{ id: `start-${Date.now()}`, timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: `Starting scenario: ${scenarioName} on server ${mockServerConfigs[serverId]?.name || serverId}... (Simulation)` }]);
    setIsRunning(true); // This triggers the simulation useEffect
  };

  const handleStopExecution = () => {
    // REAL_IMPLEMENTATION_NOTE: This would send a request to the backend to abort the
    // currently running scenario execution.
    setIsRunning(false); // This will stop the simulation interval in useEffect
    setLogs(prev => [...prev, { id: `stop-${Date.now()}`, timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: `Execution of ${currentScenario} stopped by user (Simulation).` }]);
    // Optionally clear currentScenario and currentTargetServerId
    // setCurrentScenario(null);
    // setCurrentTargetServerId(null);
  };
  
  const getLogLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return 'text-red-500 dark:text-red-400';
      case 'WARN': return 'text-yellow-500 dark:text-yellow-400';
      case 'INFO': return 'text-blue-500 dark:text-blue-400';
      case 'SENT': return 'text-purple-500 dark:text-purple-400';
      case 'RECV': return 'text-teal-500 dark:text-teal-400';
      case 'DEBUG': return 'text-gray-500 dark:text-gray-400';
      case 'SSH_CMD': return 'text-cyan-600 dark:text-cyan-400 font-semibold';
      case 'SSH_OUT': return 'text-lime-600 dark:text-lime-400';
      case 'SSH_FAIL': return 'text-orange-500 dark:text-orange-400 font-semibold';
      default: return 'text-foreground';
    }
  };


  return (
    <div className="h-full flex flex-col space-y-8">
      <PageHeader
        title="Execution Console"
        description="View real-time logs and control ongoing test executions. (Note: All executions in this prototype are SIMULATED)"
      />

      {!isRunning && (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Start a Test Scenario (Simulated)</CardTitle>
                <CardDescription>Select a scenario and server to begin simulated execution.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => handleStartExecution('3GPP Full Auth Flow', 'server_3gpp')}>Start 3GPP (Server w/ SSH Preamble)</Button>
                <Button variant="outline" onClick={() => handleStartExecution('WiFi EAP Test', 'server_wifi')}>Start WiFi EAP (Server w/o SSH Preamble)</Button>
            </CardContent>
        </Card>
      )}

      <Card className="shadow-lg flex-grow flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle>Live Output {currentScenario && `- ${currentScenario}`} {currentTargetServerId && `on ${mockServerConfigs[currentTargetServerId]?.name}`} (Simulated)</CardTitle>
                <CardDescription>Real-time simulated logs. </CardDescription>
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="destructive" onClick={handleStopExecution}>
                  <StopCircle className="mr-2 h-4 w-4" /> Abort Execution
                </Button>
              ) : (
                 <Button disabled>
                  <Play className="mr-2 h-4 w-4" /> Start (from Scenarios)
                </Button>
              )}
              {/* REAL_IMPLEMENTATION_NOTE: PCAP saving would require backend processing of network traffic. */}
              <Button variant="outline" disabled><FileArchive className="mr-2 h-4 w-4" /> Save PCAP (N/A)</Button>
              <Button variant="outline"><DownloadCloud className="mr-2 h-4 w-4" /> Export Logs</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="font-mono text-xs space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex">
                  <span className="w-20 text-muted-foreground flex-shrink-0">{log.timestamp}</span>
                  <Badge 
                    variant="outline" 
                    className={cn("w-16 text-center justify-center mr-2 py-0.5 flex-shrink-0", 
                        log.level === 'ERROR' && 'border-red-500/50 text-red-600 bg-red-500/10 dark:border-red-400/50 dark:text-red-400 dark:bg-red-400/10',
                        log.level === 'WARN' && 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10 dark:border-yellow-400/50 dark:text-yellow-400 dark:bg-yellow-400/10',
                        log.level === 'INFO' && 'border-blue-500/50 text-blue-600 bg-blue-500/10 dark:border-blue-400/50 dark:text-blue-400 dark:bg-blue-400/10',
                        log.level === 'SENT' && 'border-purple-500/50 text-purple-600 bg-purple-500/10 dark:border-purple-400/50 dark:text-purple-400 dark:bg-purple-400/10',
                        log.level === 'RECV' && 'border-teal-500/50 text-teal-600 bg-teal-500/10 dark:border-teal-400/50 dark:text-teal-400 dark:bg-teal-400/10',
                        log.level === 'SSH_CMD' && 'border-cyan-500/50 text-cyan-700 bg-cyan-500/10 dark:border-cyan-400/50 dark:text-cyan-300 dark:bg-cyan-400/10',
                        log.level === 'SSH_OUT' && 'border-lime-500/50 text-lime-700 bg-lime-500/10 dark:border-lime-400/50 dark:text-lime-300 dark:bg-lime-400/10',
                        log.level === 'SSH_FAIL' && 'border-orange-500/50 text-orange-700 bg-orange-500/10 dark:border-orange-400/50 dark:text-orange-300 dark:bg-orange-400/10'
                    )}
                  >
                    {log.level}
                  </Badge>
                  <span className={cn("flex-1 whitespace-pre-wrap break-all", getLogLevelClass(log.level))}>{log.message}
                  {log.rawPacket && <pre className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground overflow-x-auto">{log.rawPacket}</pre>}
                  {log.commandOutput && <pre className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground overflow-x-auto">{log.commandOutput}</pre>}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

