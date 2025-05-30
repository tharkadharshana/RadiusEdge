
"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation'; // Import useSearchParams
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, StopCircle, DownloadCloud, FileArchive, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SshExecutionStep, ServerConfigForExec, LogEntry, LogLevel } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';


// REAL_IMPLEMENTATION_NOTE: This mockServerConfigs object simulates fetching server configurations.
// In a real application, this data would come from your persistent backend storage (e.g., SQLite via API calls).
// For now, we define it here to allow the simulation to pick up `scenarioExecutionSshCommands`.
// It should ideally contain entries for any server that might be smoke-tested from the dashboard.
const mockServerConfigs: Record<string, ServerConfigForExec> = {
  "server_3gpp": { // Example ID, ensure it matches IDs from your server_configs table if you want to test with it
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
  "server_wifi": { // Example ID
    id: "server_wifi",
    name: "WiFi Test Server (Mock)",
    scenarioExecutionSshCommands: [] // No preamble for this server
  }
  // Add other server configs here if needed for smoke tests, matching their actual IDs
};

// Initial log entry when the page loads
const initialLogEntry: LogEntry = {
  id: 'init_log',
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'Execution console initialized. Select a scenario and server to begin, or one may be auto-started.'
};


export default function ExecutionConsolePage() {
  const searchParams = useSearchParams(); // For reading query parameters
  const [logs, setLogs] = useState<LogEntry[]>([initialLogEntry]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [currentTargetServerId, setCurrentTargetServerId] = useState<string | null>(null);
  const [currentTargetServerName, setCurrentTargetServerName] = useState<string | null>(null);
  const [currentTestExecutionId, setCurrentTestExecutionId] = useState<string | null>(null);
  const [isInteractingWithApi, setIsInteractingWithApi] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Effect to auto-start execution based on query parameters
  useEffect(() => {
    const scenarioFromQuery = searchParams.get('scenario');
    const serverIdFromQuery = searchParams.get('serverId');
    const serverNameFromQuery = searchParams.get('serverName');

    if (scenarioFromQuery && serverIdFromQuery && serverNameFromQuery && !isRunning && !currentTestExecutionId) {
      // Ensure we don't re-trigger if already running or if an execution ID is already set
      handleStartExecution(scenarioFromQuery, serverIdFromQuery, serverNameFromQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Re-run if searchParams change


  // Simulation Logic (useEffect)
  useEffect(() => {
    let simulationActive = true; 
    let simulatedLogBatch: Omit<LogEntry, 'id' | 'testExecutionId'>[] = [];

    if (isRunning && currentScenario && currentTargetServerId && currentTestExecutionId) {
      // REAL_IMPLEMENTATION_NOTE: This whole `if (isRunning)` block simulates test execution.
      // In a real system, a backend test engine would run tests and push logs (e.g., via WebSockets or long polling).
      // The frontend would primarily be for displaying these logs and test status.
      
      // Fetch or use the server config for preamble details. Using mockServerConfigs for now.
      // In a real app, you might fetch this config from /api/settings/servers/[currentTargetServerId]
      const serverConfig = mockServerConfigs[currentTargetServerId]; 
      let preambleSuccessful = true;
      let haltExecution = false;
      let overallSimulationStatus: 'Completed' | 'Failed' | 'Aborted' = 'Completed';

      const executeSimulatedSteps = async () => {
        if (serverConfig?.scenarioExecutionSshCommands && serverConfig.scenarioExecutionSshCommands.length > 0) {
          addLogEntry({
            level: 'INFO',
            message: `[SSH Preamble for ${serverConfig.name}] Starting preamble execution...`,
          });

          for (const step of serverConfig.scenarioExecutionSshCommands) {
            if (!simulationActive || haltExecution) break;

            if (step.isEnabled) {
              addLogEntry({
                level: 'SSH_CMD',
                message: `[SSH Preamble] Simulating: ${step.command}`,
              });

              await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); // Shorter delay for simulation
              if (!simulationActive) break;

              let mockOutput = `SIMULATED_SSH_OUTPUT for: ${step.command}\n...`;
              if (step.command.includes("jump.example.com")) mockOutput = `SIMULATED_SSH_OUTPUT: Connected to jump.example.com. Authentication successful.`;
              else if (step.command.includes("admin@10.0.1.100")) mockOutput = `SIMULATED_SSH_OUTPUT: Logged in as admin on 10.0.1.100. Authentication successful.`;
              else if (step.command.includes("source /opt/radius/env.sh")) mockOutput = `SIMULATED_SSH_OUTPUT: Environment sourced. RADIUS_HOME=/opt/radius.`;
              else if (step.command.includes("check_critical_service.sh")) {
                if (Math.random() > 0.2) mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_OK: Critical service is running.`;
                else mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_FAIL: Critical service is down.`;
              }

              if (step.expectedOutputContains) {
                if (mockOutput.includes(step.expectedOutputContains)) {
                  addLogEntry({ level: 'SSH_OUT', message: `[SSH Preamble] Success: '${step.name}'`, rawDetails: mockOutput });
                } else {
                  addLogEntry({ level: 'SSH_FAIL', message: `[SSH Preamble] FAILED: '${step.name}'. Expected output "${step.expectedOutputContains}" not found. Halting preamble.`, rawDetails: mockOutput });
                  preambleSuccessful = false;
                  haltExecution = true;
                  overallSimulationStatus = 'Failed';
                }
              } else {
                addLogEntry({ level: 'SSH_OUT', message: `[SSH Preamble] Output: Successfully simulated '${step.name}' (no specific output validation).`, rawDetails: mockOutput });
              }
            } else {
              addLogEntry({ level: 'INFO', message: `[SSH Preamble] Skipped (disabled): ${step.name}` });
            }
          }
        }

        if (preambleSuccessful && !haltExecution) {
          const mockLevels: LogLevel[] = ['INFO', 'DEBUG', 'SENT', 'RECV', 'WARN'];
          const mockMessages = [
            "Sending Access-Request to 127.0.0.1:1812", "User-Name = \"testuser\"",
            "NAS-IP-Address = 10.0.0.1", "Received Access-Accept from 127.0.0.1",
            "Framed-IP-Address = 192.168.1.100", "Session-Timeout = 3600",
            "SQL Validation: User 'testuser' found in database.",
            "Delaying for 1000ms..."
          ];
          
          for (let i = 0; i < 5 + Math.floor(Math.random() * 5); i++) {
            if (!simulationActive) break;
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
            if (!simulationActive) break;

            const randomLevel = mockLevels[Math.floor(Math.random() * mockLevels.length)];
            const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
            let entry: Omit<LogEntry, 'id' | 'testExecutionId'> = {
              timestamp: new Date().toISOString(), level: randomLevel, message: `${currentScenario}: ${randomMessage}`,
            };
            if (randomLevel === 'SENT' || randomLevel === 'RECV') {
              entry.rawDetails = `SIMULATED_PACKET_DATA: Code: ${randomLevel === 'SENT' ? 'Access-Request' : 'Access-Accept'}\n  Attr: User-Name = "sim_user_${Math.random().toString(36).substring(7)}"\n  ...`;
            }
            addLogEntry(entry);
          }
          if (Math.random() < 0.1) { 
              addLogEntry({ level: 'ERROR', message: `${currentScenario}: Simulated packet validation failed for attribute 'Vendor-Specific'` });
              overallSimulationStatus = 'Failed';
          }
        } else if (!preambleSuccessful) {
          addLogEntry({ level: 'ERROR', message: `RADIUS scenario '${currentScenario}' execution halted due to SSH preamble failure.` });
          overallSimulationStatus = 'Failed';
        }
        
        const finalLogMessage = `Scenario ${currentScenario} simulation finished with status: ${overallSimulationStatus}.`;
        addLogEntry({ level: overallSimulationStatus === 'Completed' ? 'INFO' : 'ERROR', message: finalLogMessage });
        
        if (!simulationActive) return; // Check before API calls
        setIsInteractingWithApi(true);
        try {
          if (simulatedLogBatch.length > 0 && currentTestExecutionId) {
            const logSaveResponse = await fetch('/api/logs', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testExecutionId: currentTestExecutionId, logs: simulatedLogBatch }),
            });
            if (!logSaveResponse.ok) console.error("Failed to save logs:", await logSaveResponse.text());
          }

          let resultIdForExecution: string | undefined = undefined;
          if (currentTestExecutionId && currentScenario && currentTargetServerName) {
            const resultStatusMap: Record<typeof overallSimulationStatus, 'Pass' | 'Fail' | 'Warning'> = {
              'Completed': 'Pass', 'Failed': 'Fail', 'Aborted': 'Warning',
            };
            const resultToPost = {
              scenarioName: currentScenario, status: resultStatusMap[overallSimulationStatus],
              timestamp: new Date().toISOString(), latencyMs: Math.floor(Math.random() * (450 - 50 + 1)) + 50,
              server: currentTargetServerName,
              details: JSON.stringify({ executionId: currentTestExecutionId, simulatedLogCount: simulatedLogBatch.length }),
            };
            const postResultResponse = await fetch('/api/results', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resultToPost),
            });
            if (postResultResponse.ok) {
              const newTestResult = await postResultResponse.json();
              resultIdForExecution = newTestResult.id;
            } else console.error("Failed to save test result summary:", await postResultResponse.text());
          }

          if (currentTestExecutionId) {
            const executionUpdatePayload: { endTime: string; status: string; resultId?: string } = {
                endTime: new Date().toISOString(), status: overallSimulationStatus,
            };
            if (resultIdForExecution) executionUpdatePayload.resultId = resultIdForExecution;
            const execUpdateResponse = await fetch(`/api/executions/${currentTestExecutionId}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(executionUpdatePayload),
            });
             if (!execUpdateResponse.ok) console.error("Failed to update execution record:", await execUpdateResponse.text());
          }
          if (simulationActive) toast({ title: "Execution Complete", description: `Scenario ${currentScenario} processing finished. Status: ${overallSimulationStatus}. Logs saved.` });

        } catch (error) {
          if (simulationActive) {
            console.error("Error saving execution details, logs, or results:", error);
            toast({ title: "API Error", description: "Could not save all execution data to backend.", variant: "destructive" });
          }
        } finally {
          if (simulationActive) {
            setIsRunning(false); 
            setIsInteractingWithApi(false);
          }
        }
      }; // end of executeSimulatedSteps

      executeSimulatedSteps();
      
    } 
    return () => { simulationActive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, currentScenario, currentTargetServerId, currentTestExecutionId, currentTargetServerName, toast]);


  // Helper function to add log entries to UI and batch
  function addLogEntry(logData: Omit<LogEntry, 'id' | 'testExecutionId' | 'timestamp'> & { timestamp?: string }) {
      const newLog: LogEntry = {
          id: `sim_log_${Date.now()}_${Math.random()}`, 
          timestamp: logData.timestamp || new Date().toISOString(),
          ...logData
      } as LogEntry;
      setLogs(prevLogs => [...prevLogs, newLog]);
      // Note: simulatedLogBatch is now managed inside the useEffect's async function
      // If this needs to be accessed outside, it would need to be a ref or state.
  }


  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);

  const handleStartExecution = async (scenarioName: string, serverId: string, serverName: string) => {
    // This function is now also called by the useEffect for query params
    if (isRunning || isInteractingWithApi) return; // Prevent multiple starts

    setIsInteractingWithApi(true);
    setLogs([ { id: `start-${Date.now()}`, timestamp: new Date().toISOString(), level: 'INFO', message: `Starting scenario: ${scenarioName} on server ${serverName}...` } ]);

    try {
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioName, serverId, serverName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create test execution record.");
      }
      const executionData = await response.json();
      setCurrentTestExecutionId(executionData.id);
      setCurrentScenario(scenarioName);
      setCurrentTargetServerId(serverId);
      setCurrentTargetServerName(serverName); 
      setIsRunning(true); 
      toast({ title: "Execution Started", description: `Scenario ${scenarioName} initiated with ID: ${executionData.id}.` });
    } catch (error) {
      console.error("Error starting execution:", error);
      toast({ title: "Start Failed", description: (error as Error).message, variant: "destructive" });
      setLogs([initialLogEntry]); 
    } finally {
      setIsInteractingWithApi(false);
    }
  };

  const handleStopExecution = async () => {
    const stoppedScenario = currentScenario; // Capture before resetting
    setIsRunning(false); 
    const stopMessage = `Execution of ${stoppedScenario || 'scenario'} stopped by user.`;
    
    setLogs(prev => [...prev, { id: `stop-${Date.now()}`, timestamp: new Date().toISOString(), level: 'WARN', message: stopMessage }]);
    
    if (currentTestExecutionId) {
      setIsInteractingWithApi(true);
      try {
         await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  testExecutionId: currentTestExecutionId, 
                  logs: [{ timestamp: new Date().toISOString(), level: 'WARN', message: stopMessage }] 
              }),
        });

        await fetch(`/api/executions/${currentTestExecutionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endTime: new Date().toISOString(), status: 'Aborted' }),
        });
        toast({ title: "Execution Aborted", description: `Scenario ${stoppedScenario || ''} marked as Aborted.` });
      } catch (error) {
        console.error("Error updating execution status to Aborted:", error);
        toast({ title: "API Error", description: "Could not update execution status to Aborted.", variant: "destructive" });
      } finally {
        setCurrentTestExecutionId(null); 
        setCurrentScenario(null);
        setCurrentTargetServerId(null);
        setCurrentTargetServerName(null);
        setIsInteractingWithApi(false);
      }
    } else {
        setCurrentScenario(null);
        setCurrentTargetServerId(null);
        setCurrentTargetServerName(null);
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
        description="View logs and control test executions. All executions are simulated."
      />

      {!isRunning && !isInteractingWithApi && !(searchParams.get('scenario') && searchParams.get('serverId')) && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Start a Test Scenario</CardTitle>
            <CardDescription>Select a scenario and server to begin execution.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {/* REAL_IMPLEMENTATION_NOTE: Buttons to start scenarios. 
                In a real app, these might come from a list of saved scenarios.
                The serverId here is hardcoded to match mockServerConfigs.
            */}
            <Button onClick={() => handleStartExecution('3GPP Full Auth Flow', 'server_3gpp', '3GPP Test Server (Mock)')} disabled={isInteractingWithApi}>
                {isInteractingWithApi && currentScenario === '3GPP Full Auth Flow' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Start 3GPP (Server w/ SSH Preamble)
            </Button>
            <Button variant="outline" onClick={() => handleStartExecution('WiFi EAP Test', 'server_wifi', 'WiFi Test Server (Mock)')} disabled={isInteractingWithApi}>
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
              <CardTitle>Live Output {currentScenario && `- ${currentScenario}`} {currentTargetServerName && `on ${currentTargetServerName}`}</CardTitle>
              <CardDescription>Real-time (simulated) logs from the execution. {currentTestExecutionId && `(ID: ${currentTestExecutionId})`}</CardDescription>
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="destructive" onClick={handleStopExecution} disabled={isInteractingWithApi}>
                  {isInteractingWithApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
                  Abort Execution
                </Button>
              ) : (
                <Button disabled>
                  <Play className="mr-2 h-4 w-4" /> Start (select above or trigger from Dashboard)
                </Button>
              )}
              <Button variant="outline" disabled><FileArchive className="mr-2 h-4 w-4" /> Save PCAP</Button>
              <Button variant="outline" disabled><DownloadCloud className="mr-2 h-4 w-4" /> Export Logs</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="font-mono text-xs space-y-1">
              {logs.map((log, index) => ( 
                <div key={`${log.id}-${index}`} className="flex">
                  <span className="w-28 text-muted-foreground flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</span>
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
               {logs.length <= 1 && !isRunning && ( // Check if only initialLogEntry is present
                <div className="text-center text-muted-foreground py-10">
                  No active execution. Start a scenario to see output or trigger from dashboard.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

