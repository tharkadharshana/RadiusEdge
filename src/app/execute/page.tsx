
"use client";

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, StopCircle, DownloadCloud, FileArchive, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SshExecutionStep, ServerConfigForExec, LogEntry, LogLevel } from '@/lib/types'; // Assuming types are moved
import { useToast } from '@/hooks/use-toast';


// REAL_IMPLEMENTATION_NOTE: This mockServerConfigs object simulates fetching server configurations.
// In a real application, this data would come from your persistent backend storage (e.g., SQLite via API calls).
const mockServerConfigs: Record<string, ServerConfigForExec> = {
  "server_3gpp": {
    id: "server_3gpp",
    name: "3GPP Test Server (Mock)",
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
    name: "WiFi Test Server (Mock)",
    scenarioExecutionSshCommands: []
  }
};

// Initial log entry when the page loads
const initialLogEntry: LogEntry = {
  id: 'init_log',
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'Execution console initialized. Waiting for scenario execution...'
};


export default function ExecutionConsolePage() {
  const [logs, setLogs] = useState<LogEntry[]>([initialLogEntry]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [currentTargetServerId, setCurrentTargetServerId] = useState<string | null>(null);
  const [currentTestExecutionId, setCurrentTestExecutionId] = useState<string | null>(null);
  const [isInteractingWithApi, setIsInteractingWithApi] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Simulation Logic (useEffect)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    let simulatedLogBatch: LogEntry[] = [];

    if (isRunning && currentScenario && currentTargetServerId && currentTestExecutionId) {
      const serverConfig = mockServerConfigs[currentTargetServerId];
      let logIndex = 0;
      let preambleSuccessful = true;
      let haltExecution = false;

      // --- Simulate SSH Preamble ---
      if (serverConfig?.scenarioExecutionSshCommands && serverConfig.scenarioExecutionSshCommands.length > 0) {
        simulatedLogBatch.push({
          id: `log-preamble-start-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `[SSH Preamble for ${serverConfig.name}] Starting preamble execution...`,
        });

        for (const step of serverConfig.scenarioExecutionSshCommands) {
          if (haltExecution) break;

          if (step.isEnabled) {
            simulatedLogBatch.push({
              id: `log-ssh-cmd-${step.id}-${Date.now()}`,
              timestamp: new Date().toISOString(),
              level: 'SSH_CMD',
              message: `[SSH Preamble] Executing: ${step.command}`,
            });

            let mockOutput = `SIMULATED_SSH_OUTPUT for: ${step.command}\n...`;
            if (step.command.includes("jump.example.com")) mockOutput = `SIMULATED_SSH_OUTPUT: Connected to jump.example.com. Authentication successful.`;
            else if (step.command.includes("admin@10.0.1.100")) mockOutput = `SIMULATED_SSH_OUTPUT: Logged in as admin on 10.0.1.100. Authentication successful.`;
            else if (step.command.includes("source /opt/radius/env.sh")) mockOutput = `SIMULATED_SSH_OUTPUT: Environment sourced. RADIUS_HOME=/opt/radius.`;
            else if (step.command.includes("check_critical_service.sh")) {
              if (Math.random() > 0.5) mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_OK: Critical service is running.`;
              else mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_FAIL: Critical service is down.`;
            }

            if (step.expectedOutputContains) {
              if (mockOutput.includes(step.expectedOutputContains)) {
                simulatedLogBatch.push({
                  id: `log-ssh-out-${step.id}-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  level: 'SSH_OUT',
                  message: `[SSH Preamble] Success: '${step.name}'`,
                  rawDetails: mockOutput
                });
              } else {
                simulatedLogBatch.push({
                  id: `log-ssh-fail-${step.id}-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  level: 'SSH_FAIL',
                  message: `[SSH Preamble] FAILED: '${step.name}'. Expected output "${step.expectedOutputContains}" not found. Halting preamble.`,
                  rawDetails: mockOutput
                });
                preambleSuccessful = false;
                haltExecution = true;
              }
            } else {
              simulatedLogBatch.push({
                id: `log-ssh-out-${step.id}-${Date.now()}`,
                timestamp: new Date().toISOString(),
                level: 'SSH_OUT',
                message: `[SSH Preamble] Output: Successfully executed '${step.name}' (no specific output validation).`,
                rawDetails: mockOutput
              });
            }
          } else {
            simulatedLogBatch.push({
              id: `log-ssh-skip-${step.id}-${Date.now()}`,
              timestamp: new Date().toISOString(),
              level: 'INFO',
              message: `[SSH Preamble] Skipped (disabled): ${step.name}`,
            });
          }
        }
      }

      // --- Simulate RADIUS Scenario Steps (only if preamble was successful) ---
      if (preambleSuccessful && !haltExecution) {
        const mockLevels: LogLevel[] = ['INFO', 'DEBUG', 'SENT', 'RECV', 'WARN', 'ERROR'];
        const mockMessages = [
          "Sending Access-Request to 127.0.0.1:1812", "User-Name = \"testuser\"",
          "NAS-IP-Address = 10.0.0.1", "Received Access-Accept from 127.0.0.1",
          "Framed-IP-Address = 192.168.1.100", "Session-Timeout = 3600",
          "SQL Validation: User 'testuser' found in database.", "Warning: Response latency > 500ms",
          "Error: Packet validation failed for attribute 'Vendor-Specific'", "Delaying for 1000ms..."
        ];

        for (let i = 0; i < 10; i++) {
          const randomLevel = mockLevels[Math.floor(Math.random() * mockLevels.length)];
          const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
          let entry: LogEntry = {
            id: `log-radius-${logIndex + i + 1}-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: randomLevel,
            message: `${currentScenario}: ${randomMessage}`,
          };
          if (randomLevel === 'SENT' || randomLevel === 'RECV') {
            entry.rawDetails = `SIMULATED_PACKET_DATA: Code: ${randomLevel === 'SENT' ? 'Access-Request' : 'Access-Accept'}\n  Attr: User-Name = "sim_user"\n  ...`;
          }
          simulatedLogBatch.push(entry);
        }
      } else if (!preambleSuccessful) {
        simulatedLogBatch.push({
          id: `log-radius-halt-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message: `RADIUS scenario '${currentScenario}' execution halted due to SSH preamble failure.`
        });
      }
      
      // Update UI optimistically with all simulated logs
      setLogs(prevLogs => [...prevLogs, ...simulatedLogBatch.slice(logIndex)]);
      logIndex = simulatedLogBatch.length;

      // End of simulation processing
      const finalStatus = preambleSuccessful && !simulatedLogBatch.some(l => l.level === 'ERROR' || l.level === 'SSH_FAIL') ? 'Completed' : 'Failed';
      const finalLogMessage = `Scenario ${currentScenario} finished ${finalStatus === 'Completed' ? 'successfully' : 'with errors'} (simulated).`;
      
      simulatedLogBatch.push({
        id: `finish-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: finalStatus === 'Completed' ? 'INFO' : 'ERROR',
        message: finalLogMessage
      });
      setLogs(prevLogs => [...prevLogs, simulatedLogBatch[simulatedLogBatch.length -1]]); // Add final status log

      // Asynchronous backend operations
      (async () => {
        setIsInteractingWithApi(true);
        try {
          if (simulatedLogBatch.length > 0) {
            const logsToSave = simulatedLogBatch.map(log => ({
                timestamp: log.timestamp,
                level: log.level,
                message: log.message,
                rawDetails: log.rawDetails || null
            }));

            await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testExecutionId: currentTestExecutionId, logs: logsToSave }),
            });
            // No explicit success toast for logs to avoid clutter, errors handled below
          }

          await fetch(`/api/executions/${currentTestExecutionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endTime: new Date().toISOString(), status: finalStatus }),
          });
          toast({ title: "Execution Complete", description: `Scenario ${currentScenario} marked as ${finalStatus}. Logs saved.` });

        } catch (error) {
          console.error("Error saving execution details or logs:", error);
          toast({ title: "API Error", description: "Could not save execution details or logs to backend.", variant: "destructive" });
        } finally {
          setIsRunning(false); // Stop the "running" state
          setIsInteractingWithApi(false);
        }
      })();
      
    } // End of if(isRunning)
    return () => {
      if (intervalId) clearInterval(intervalId); // Should not be needed with current async structure
    };
  }, [isRunning, currentScenario, currentTargetServerId, currentTestExecutionId, toast]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);

  const handleStartExecution = async (scenarioName: string, serverId: string) => {
    const server = mockServerConfigs[serverId];
    if (!server) {
      toast({ title: "Error", description: "Selected mock server configuration not found.", variant: "destructive" });
      return;
    }

    setIsInteractingWithApi(true);
    setLogs([ { id: `start-${Date.now()}`, timestamp: new Date().toISOString(), level: 'INFO', message: `Starting scenario: ${scenarioName} on server ${server.name}...` } ]);

    try {
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioName, serverId: server.id, serverName: server.name }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create test execution record.");
      }
      const executionData = await response.json();
      setCurrentTestExecutionId(executionData.id);
      setCurrentScenario(scenarioName);
      setCurrentTargetServerId(serverId);
      setIsRunning(true); // This triggers the simulation useEffect
      toast({ title: "Execution Started", description: `Scenario ${scenarioName} initiated.` });
    } catch (error) {
      console.error("Error starting execution:", error);
      toast({ title: "Start Failed", description: (error as Error).message, variant: "destructive" });
      setLogs([initialLogEntry]); // Reset logs
    } finally {
      setIsInteractingWithApi(false);
    }
  };

  const handleStopExecution = async () => {
    // REAL_IMPLEMENTATION_NOTE: This would send a request to the backend to abort the
    // currently running scenario execution. Backend would update status to 'Aborted'.
    setIsRunning(false); // This will stop the simulation interval in useEffect
    setLogs(prev => [...prev, { id: `stop-${Date.now()}`, timestamp: new Date().toISOString(), level: 'WARN', message: `Execution of ${currentScenario} stopped by user (Simulation).` }]);
    
    if (currentTestExecutionId) {
      setIsInteractingWithApi(true);
      try {
        await fetch(`/api/executions/${currentTestExecutionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endTime: new Date().toISOString(), status: 'Aborted' }),
        });
        toast({ title: "Execution Aborted", description: `Scenario ${currentScenario} marked as Aborted.` });
      } catch (error) {
        console.error("Error updating execution status to Aborted:", error);
        toast({ title: "API Error", description: "Could not update execution status to Aborted.", variant: "destructive" });
      } finally {
        setCurrentTestExecutionId(null); // Reset for next run
        setCurrentScenario(null);
        setCurrentTargetServerId(null);
        setIsInteractingWithApi(false);
      }
    }
  };

  const getLogLevelClass = (level: LogLevel) => {
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
        description="View logs and control test executions."
      />

      {!isRunning && !isInteractingWithApi && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Start a Test Scenario</CardTitle>
            <CardDescription>Select a scenario and server to begin execution.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => handleStartExecution('3GPP Full Auth Flow', 'server_3gpp')} disabled={isInteractingWithApi}>
                {isInteractingWithApi && currentScenario === '3GPP Full Auth Flow' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Start 3GPP (Server w/ SSH Preamble)
            </Button>
            <Button variant="outline" onClick={() => handleStartExecution('WiFi EAP Test', 'server_wifi')} disabled={isInteractingWithApi}>
                {isInteractingWithApi && currentScenario === 'WiFi EAP Test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Start WiFi EAP (Server w/o SSH Preamble)
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg flex-grow flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle>Live Output {currentScenario && `- ${currentScenario}`} {currentTargetServerId && mockServerConfigs[currentTargetServerId] && `on ${mockServerConfigs[currentTargetServerId].name}`}</CardTitle>
              <CardDescription>Real-time logs from the execution.</CardDescription>
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="destructive" onClick={handleStopExecution} disabled={isInteractingWithApi}>
                  {isInteractingWithApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
                  Abort Execution
                </Button>
              ) : (
                <Button disabled>
                  <Play className="mr-2 h-4 w-4" /> Start (from Scenarios)
                </Button>
              )}
              <Button variant="outline" disabled><FileArchive className="mr-2 h-4 w-4" /> Save PCAP (N/A)</Button>
              <Button variant="outline" disabled><DownloadCloud className="mr-2 h-4 w-4" /> Export Logs</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="font-mono text-xs space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex">
                  <span className="w-24 text-muted-foreground flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</span>
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
                    {log.rawDetails && <pre className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground overflow-x-auto">{log.rawDetails}</pre>}
                  </span>
                </div>
              ))}
               {logs.length === 0 && !isRunning && (
                <div className="text-center text-muted-foreground py-10">
                  No logs to display. Start a scenario to see output.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
