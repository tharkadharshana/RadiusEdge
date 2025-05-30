
"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Play, StopCircle, DownloadCloud, FileArchive, Loader2, Terminal, Server, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ServerConfigForExec, LogEntry, LogLevel } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import type { TestResult } from '@/app/results/page';
import type { ServerConfig } from '@/app/settings/servers/page'; // Import full ServerConfig for fetching

// REAL_IMPLEMENTATION_NOTE: The mockServerConfigs object is used to SIMULATE fetching server configurations
// for SSH preamble steps. In a real application, when a scenario starts, it would:
// 1. Fetch the target ServerConfig from the backend using `currentTargetServerId`.
// 2. Extract `scenarioExecutionSshCommands` from that fetched config.
// 3. A backend execution engine would then perform live SSH using these commands.
// This mock is purely for frontend UI demonstration of the SSH preamble logging.
const mockServerConfigs: Record<string, ServerConfigForExec> = {
  "server_3gpp": {
    id: "server_3gpp",
    name: "3GPP Test Server (Mock)",
    scenarioExecutionSshCommands: [
      { id: "ssh1", name: "Connect to Jumpbox", command: "ssh user@jump.example.com -p 2222", isEnabled: true, expectedOutputContains: "Connected to jump.example.com" },
      { id: "ssh2", name: "SSH to Target RADIUS", command: "ssh admin@10.0.1.100", isEnabled: true, expectedOutputContains: "Authentication successful" },
      { id: "ssh3", name: "Source environment variables", command: "source /opt/radius/env.sh", isEnabled: true, expectedOutputContains: "Environment sourced" },
      { id: "ssh4", name: "Disabled SSH Step", command: "echo 'This step is disabled'", isEnabled: false, expectedOutputContains: "never_match_this"},
      { id: "ssh5", name: "Step that might fail validation", command: "check_critical_service.sh", isEnabled: true, expectedOutputContains: "SERVICE_OK" },
    ]
  },
  "server_wifi": {
    id: "server_wifi",
    name: "WiFi Test Server (Mock)",
    scenarioExecutionSshCommands: []
  }
};

const initialLogEntry: LogEntry = {
  id: 'init_log',
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'Execution console initialized. Select a scenario and server to begin, or one may be auto-started if launched from the dashboard.'
};


export default function ExecutionConsolePage() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<LogEntry[]>([initialLogEntry]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [currentTargetServerId, setCurrentTargetServerId] = useState<string | null>(null);
  const [currentTargetServerName, setCurrentTargetServerName] = useState<string | null>(null);
  const [currentTestExecutionId, setCurrentTestExecutionId] = useState<string | null>(null);
  const [isInteractingWithApi, setIsInteractingWithApi] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleStartExecution = async (scenarioName: string, serverId: string, serverName: string) => {
    if (isRunning || isInteractingWithApi) return;

    console.log(`FRONTEND_EXEC: Starting execution for Scenario: ${scenarioName}, ServerID: ${serverId}, ServerName: ${serverName}`);
    setIsInteractingWithApi(true);
    setLogs([ { id: `start-${Date.now()}`, timestamp: new Date().toISOString(), level: 'INFO', message: `Initializing scenario: ${scenarioName} on server ${serverName}...` } ]);

    try {
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioName, serverId, serverName }), // serverName is for display convenience
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to create test execution record."}));
        console.error("FRONTEND_EXEC: API error creating execution record:", errorData);
        throw new Error(errorData.message || "Failed to create test execution record.");
      }
      const executionData = await response.json();
      console.log("FRONTEND_EXEC: Execution record created:", executionData);
      setCurrentTestExecutionId(executionData.id);
      setCurrentScenario(scenarioName);
      setCurrentTargetServerId(serverId);
      setCurrentTargetServerName(serverName); // Store server name for logging and result summary
      setIsRunning(true);
      toast({ title: "Execution Started", description: `Scenario ${scenarioName} initiated. ID: ${executionData.id}.` });
    } catch (error) {
      console.error("FRONTEND_EXEC: Error starting execution:", error);
      toast({ title: "Start Failed", description: (error as Error).message, variant: "destructive" });
      setLogs([initialLogEntry]);
    } finally {
      setIsInteractingWithApi(false);
    }
  };


  useEffect(() => {
    const scenarioFromQuery = searchParams.get('scenario');
    const serverIdFromQuery = searchParams.get('serverId');
    const serverNameFromQuery = searchParams.get('serverName');

    if (scenarioFromQuery && serverIdFromQuery && serverNameFromQuery && !isRunning && !currentTestExecutionId) {
      handleStartExecution(scenarioFromQuery, serverIdFromQuery, serverNameFromQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // isRunning and currentTestExecutionId dependency was removed to allow re-trigger if query params change for a new test


  useEffect(() => {
    // REAL_IMPLEMENTATION_NOTE: This entire useEffect block simulates a test execution.
    // In a live system, this would be replaced by:
    // 1. A call to a backend API to start the scenario execution (e.g., POST /api/scenario-runner/start).
    // 2. The backend API would trigger a Scenario Execution Engine.
    // 3. The Scenario Execution Engine would:
    //    - Fetch the ServerConfig (to get SSH preamble commands).
    //    - Execute SSH preamble commands (live).
    //    - Fetch the ScenarioDefinition and PacketDefinitions.
    //    - Iterate through scenario steps:
    //      - For RADIUS steps: Use a RADIUS client library or radclient/radtest to send live packets.
    //      - For SQL steps: Connect to the configured external DB and run queries.
    //      - For API steps: Make live HTTP calls.
    //      - For Delay steps: Perform actual delays.
    //    - Log each action to the database via /api/logs.
    //    - Update the execution status via /api/executions/[id].
    //    - Create a result record via /api/results.
    // 4. The frontend would ideally receive real-time log updates (e.g., via WebSockets or Server-Sent Events)
    //    or periodically poll for logs if real-time is not implemented.

    let simulationActive = true;
    let simulatedLogBatch: Omit<LogEntry, 'id' | 'testExecutionId'>[] = [];

    const addLogEntryToBatch = (logData: Omit<LogEntry, 'id' | 'testExecutionId' | 'timestamp'> & { timestamp?: string }) => {
        if (!simulationActive) return;
        const newLogEntry = {
            timestamp: logData.timestamp || new Date().toISOString(),
            level: logData.level,
            message: logData.message,
            rawDetails: logData.rawDetails,
        };
        simulatedLogBatch.push(newLogEntry);
        // Optimistically update UI
        setLogs(prevLogs => [...prevLogs, { ...newLogEntry, id: `sim_log_${Date.now()}_${Math.random().toString(36).substring(2,9)}` }]);
    };


    if (isRunning && currentScenario && currentTargetServerId && currentTestExecutionId) {
      // Fetch the server config for SSH preamble (simulated here)
      // REAL_IMPLEMENTATION_NOTE: In a real system, you'd fetch this from your backend /api/settings/servers/[id]
      const serverConfig = mockServerConfigs[currentTargetServerId]; // Using mock for SSH preamble simulation

      let preambleSuccessful = true;
      let haltExecution = false;
      let overallSimulationStatus: 'Completed' | 'Failed' | 'Aborted' = 'Completed';

      const executeSimulatedSteps = async () => {
        // Simulate SSH Preamble
        if (serverConfig?.scenarioExecutionSshCommands && serverConfig.scenarioExecutionSshCommands.length > 0) {
          addLogEntryToBatch({
            level: 'INFO',
            message: `[SSH Preamble for ${serverConfig.name}] Starting SSH preamble execution...`,
          });

          for (const step of serverConfig.scenarioExecutionSshCommands) {
            if (!simulationActive || haltExecution) break;

            if (step.isEnabled) {
              addLogEntryToBatch({
                level: 'SSH_CMD',
                message: `Executing on ${serverConfig.name}: ${step.command}`,
                rawDetails: `${currentTargetServerName || 'server'}:~$ ${step.command}`
              });

              await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
              if (!simulationActive) break;

              // REAL_IMPLEMENTATION_NOTE: For actual SSH, this output would come from the remote server.
              let mockOutput = `SIMULATED_SSH_OUTPUT for: ${step.command}\n...`;
              if (step.command.includes("jump.example.com")) mockOutput = `SIMULATED_SSH_OUTPUT: Connected to jump.example.com. Authentication successful.`;
              else if (step.command.includes("admin@10.0.1.100")) mockOutput = `SIMULATED_SSH_OUTPUT: Logged in as admin on 10.0.1.100. Authentication successful.`;
              else if (step.command.includes("source /opt/radius/env.sh")) mockOutput = `SIMULATED_SSH_OUTPUT: Environment sourced. RADIUS_HOME=/opt/radius.`;
              else if (step.command.includes("check_critical_service.sh")) {
                if (Math.random() > 0.2) mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_OK: Critical service is running.`;
                else mockOutput = `SIMULATED_SSH_OUTPUT: SERVICE_FAIL: Critical service is down.`;
              }
              
              addLogEntryToBatch({ level: 'SSH_OUT', message: `Output from ${serverConfig.name}:`, rawDetails: mockOutput });

              if (step.expectedOutputContains) {
                if (mockOutput.includes(step.expectedOutputContains)) {
                  addLogEntryToBatch({ level: 'INFO', message: `[SSH Preamble] Success: '${step.name}' met expected output.` });
                } else {
                  addLogEntryToBatch({ level: 'SSH_FAIL', message: `[SSH Preamble] FAILED: '${step.name}'. Expected output "${step.expectedOutputContains}" not found. Halting scenario.` });
                  preambleSuccessful = false;
                  haltExecution = true;
                  overallSimulationStatus = 'Failed';
                }
              } else {
                 // Simulate success/failure for steps without explicit expected output
                 let simulatedSuccess = true;
                 // Example: a step might be known to fail sometimes if a certain keyword appears
                 if (step.command.includes("check_critical_service.sh") && mockOutput.includes("SERVICE_FAIL")) {
                     simulatedSuccess = false;
                 }
                 if (!simulatedSuccess) {
                    addLogEntryToBatch({ level: 'SSH_FAIL', message: `[SSH Preamble] FAILED: '${step.name}' due to simulated error.` });
                    preambleSuccessful = false;
                    haltExecution = true;
                    overallSimulationStatus = 'Failed';
                 }
              }
            } else {
              addLogEntryToBatch({ level: 'INFO', message: `[SSH Preamble] Skipped (disabled): ${step.name}` });
            }
          }
        }

        // Simulate RADIUS Packet Exchange (if preamble was successful)
        if (preambleSuccessful && !haltExecution) {
          // REAL_IMPLEMENTATION_NOTE: In a real system, you would fetch the specific packet definition
          // from /api/packets/[packet_id] (packet_id would come from the current scenario step).
          // Then, use its `executionTool` and `toolOptions` to construct and run the
          // actual radclient/radtest command or use a RADIUS library.

          const useRadclient = Math.random() > 0.5; // Simulate choice of tool
          const toolName = useRadclient ? "radclient" : "radtest";
          let mockToolOptionsLog = `Simulating packet send using ${toolName}.`;
          if (useRadclient) {
            mockToolOptionsLog += ` Target: ${serverConfig?.name || currentTargetServerName}, Type: auth (simulated).`;
          } else {
            mockToolOptionsLog += ` User: testuser@${serverConfig?.name || currentTargetServerName} (simulated).`;
          }
          if (Math.random() > 0.7) { 
            mockToolOptionsLog += " Debug (-x) enabled (simulated).";
          }
          addLogEntryToBatch({ level: 'INFO', message: mockToolOptionsLog });


          const mockLevels: LogLevel[] = ['SENT', 'RECV', 'DEBUG', 'INFO'];
          const mockMessages = [
            "User-Name = \"testuser\"",
            "NAS-IP-Address = 10.0.0.1",
            "Framed-IP-Address = 192.168.1.100", "Session-Timeout = 3600",
            "SQL Validation (mock): User 'testuser' found in database.", // Placeholder for future SQL step simulation
            "Delaying for 500ms..." // Placeholder for future Delay step simulation
          ];
          
          for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
            if (!simulationActive || haltExecution) break;
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
            if (!simulationActive) break;

            const randomLevel = mockLevels[Math.floor(Math.random() * mockLevels.length)];
            const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
            let entry: Omit<LogEntry, 'id' | 'testExecutionId' | 'timestamp'> = {
              timestamp: new Date().toISOString(), level: randomLevel, message: `${currentScenario}: ${randomMessage}`,
            };
            if (randomLevel === 'SENT' || randomLevel === 'RECV') {
              entry.rawDetails = `SIMULATED_PACKET_DATA: Code: ${randomLevel === 'SENT' ? 'Access-Request' : 'Access-Accept'}\n  Attr: User-Name = "sim_user_${Math.random().toString(36).substring(7)}"\n  ... (more attributes) ...`;
            }
            addLogEntryToBatch(entry);
          }
          if (Math.random() < 0.1 && simulationActive && !haltExecution) { // Only fail here if not already failed
              addLogEntryToBatch({ level: 'ERROR', message: `${currentScenario}: Simulated packet validation failed for attribute 'Vendor-Specific'` });
              overallSimulationStatus = 'Failed';
          }
        } else if (!preambleSuccessful) {
          addLogEntryToBatch({ level: 'ERROR', message: `RADIUS scenario '${currentScenario}' execution halted due to SSH preamble failure.` });
          overallSimulationStatus = 'Failed';
        }
        
        if (!simulationActive) return; // Check again before final logging and API calls

        const finalLogMessage = `Scenario ${currentScenario} simulation finished with status: ${overallSimulationStatus}.`;
        addLogEntryToBatch({ level: overallSimulationStatus === 'Completed' ? 'INFO' : 'ERROR', message: finalLogMessage });
        
        
        // Persist logs and update execution status
        setIsInteractingWithApi(true);
        try {
          if (simulatedLogBatch.length > 0 && currentTestExecutionId) {
            const logSaveResponse = await fetch('/api/logs', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testExecutionId: currentTestExecutionId, logs: simulatedLogBatch }),
            });
            if (!logSaveResponse.ok) console.error("FRONTEND_EXEC: Failed to save logs:", await logSaveResponse.text());
            else console.log("FRONTEND_EXEC: Logs saved successfully.");
          }

          let resultIdForExecution: string | undefined = undefined;
          // Post Test Result
          if (currentTestExecutionId && currentScenario && currentTargetServerName) {
            const resultStatusMap: Record<typeof overallSimulationStatus, TestResult['status']> = {
              'Completed': 'Pass', 'Failed': 'Fail', 'Aborted': 'Warning',
            };
            const resultToPost: Omit<TestResult, 'id' | 'timestamp'> & { timestamp: string } = {
              scenarioName: currentScenario, status: resultStatusMap[overallSimulationStatus],
              timestamp: new Date().toISOString(), latencyMs: Math.floor(Math.random() * (450 - 50 + 1)) + 50, // Mock latency
              server: currentTargetServerName,
              details: { executionId: currentTestExecutionId, simulatedLogCount: simulatedLogBatch.length },
            };
            const postResultResponse = await fetch('/api/results', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resultToPost),
            });
            if (postResultResponse.ok) {
              const newTestResult = await postResultResponse.json();
              resultIdForExecution = newTestResult.id;
              console.log("FRONTEND_EXEC: Test result summary saved:", newTestResult);
            } else console.error("FRONTEND_EXEC: Failed to save test result summary:", await postResultResponse.text());
          }

          // Update Execution Record
          if (currentTestExecutionId) {
            const executionUpdatePayload: { endTime: string; status: string; resultId?: string } = {
                endTime: new Date().toISOString(), status: overallSimulationStatus,
            };
            if (resultIdForExecution) executionUpdatePayload.resultId = resultIdForExecution;
            const execUpdateResponse = await fetch(`/api/executions/${currentTestExecutionId}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(executionUpdatePayload),
            });
             if (!execUpdateResponse.ok) console.error("FRONTEND_EXEC: Failed to update execution record:", await execUpdateResponse.text());
             else console.log("FRONTEND_EXEC: Execution record updated:", await execUpdateResponse.json());
          }
          if (simulationActive) toast({ title: "Execution Complete", description: `Scenario ${currentScenario} processing finished. Status: ${overallSimulationStatus}. Logs saved.` });

        } catch (error) {
          if (simulationActive) {
            console.error("FRONTEND_EXEC: Error saving execution details, logs, or results:", error);
            toast({ title: "API Error", description: "Could not save all execution data to backend.", variant: "destructive" });
          }
        } finally {
          if (simulationActive) { // Check if still active before resetting state
            setIsRunning(false);
            setIsInteractingWithApi(false);
            // Do not clear currentTestExecutionId here, allow user to see logs until they start another or leave page
          }
        }
      };

      executeSimulatedSteps();
    }
    return () => { 
      console.log("FRONTEND_EXEC: Simulation cleanup called.");
      simulationActive = false; 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, currentScenario, currentTargetServerId, currentTestExecutionId, toast]); // Removed currentTargetServerName as it's derived/set with serverId


  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);


  const stopExecution = async () => {
    const stoppedScenario = currentScenario; // Capture current scenario before state changes
    setIsRunning(false); // This will trigger the cleanup in the simulation useEffect
    const stopMessage = `Execution of ${stoppedScenario || 'scenario'} stopped by user.`;

    // Add local log entry immediately
    const localStopLog: LogEntry = { id: `stop-${Date.now()}`, timestamp: new Date().toISOString(), level: 'WARN', message: stopMessage };
    setLogs(prev => [...prev, localStopLog]);

    if (currentTestExecutionId) {
      setIsInteractingWithApi(true);
      try {
         // Attempt to save the "stopped by user" log to backend
         await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  testExecutionId: currentTestExecutionId,
                  logs: [{ timestamp: new Date().toISOString(), level: 'WARN' as LogLevel, message: stopMessage }]
              }),
        });
        console.log("FRONTEND_EXEC: 'Stopped by user' log sent to backend.");

        // Update execution status to Aborted
        await fetch(`/api/executions/${currentTestExecutionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endTime: new Date().toISOString(), status: 'Aborted' }),
        });
        toast({ title: "Execution Aborted", description: `Scenario ${stoppedScenario || ''} marked as Aborted.` });
        console.log("FRONTEND_EXEC: Execution record marked as Aborted for ID:", currentTestExecutionId);
      } catch (error) {
        console.error("FRONTEND_EXEC: Error updating execution status to Aborted:", error);
        toast({ title: "API Error", description: "Could not update execution status to Aborted.", variant: "destructive" });
      } finally {
        // setCurrentTestExecutionId(null); // Keep it to allow viewing current logs
        // setCurrentScenario(null);
        // setCurrentTargetServerId(null);
        // setCurrentTargetServerName(null);
        setIsInteractingWithApi(false);
      }
    } else {
        // If no currentTestExecutionId, just clear local scenario state
        setCurrentScenario(null);
        setCurrentTargetServerId(null);
        setCurrentTargetServerName(null);
    }
  };

  const handleExportLogs = () => {
    if (logs.length <= 1 && logs[0].id === 'init_log') {
        toast({ title: "No Logs", description: "No logs to export." });
        return;
    }

    const formattedLogs = logs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
        let logString = `[${time}] [${log.level}] ${log.message}`;
        if (log.rawDetails) {
            // Ensure rawDetails is stringified if it's an object/array
            const detailsString = typeof log.rawDetails === 'string' ? log.rawDetails : JSON.stringify(log.rawDetails, null, 2);
            logString += `\n--- Details ---\n${detailsString}\n--- End Details ---`;
        }
        return logString;
    }).join('\n\n');

    const blob = new Blob([formattedLogs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const scenarioNameForFile = currentScenario ? currentScenario.replace(/\s+/g, '_') : 'execution';
    const serverNameForFile = currentTargetServerName ? currentTargetServerName.replace(/\s+/g, '_') : 'server';
    const timestampForFile = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    link.download = `radiusedge_logs_${scenarioNameForFile}_${serverNameForFile}_${timestampForFile}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Logs Exported", description: "Log file download initiated." });
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

  const autoStartScenario = searchParams.get('scenario');

  return (
    <div className="h-full flex flex-col space-y-8">
      <PageHeader
        title="Execution Console"
        description="View logs and control test executions."
      />

      <Card className="shadow-lg flex-grow flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-grow">
              {isRunning || currentTestExecutionId ? (
                <>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    Live Output
                  </CardTitle>
                  <CardDescription className="mt-1 space-y-0.5 text-xs">
                    {currentScenario && <div className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-muted-foreground" /> Scenario: <strong>{currentScenario}</strong></div>}
                    {currentTargetServerName && <div className="flex items-center gap-1.5"><Server className="h-3 w-3 text-muted-foreground" /> Server: <strong>{currentTargetServerName}</strong></div>}
                    {currentTestExecutionId && <div className="flex items-center gap-1.5 text-muted-foreground">Execution ID: {currentTestExecutionId}</div>}
                  </CardDescription>
                </>
              ) : (
                <>
                  <CardTitle>Start a Test Scenario</CardTitle>
                  <CardDescription>Select a scenario and server to begin execution.</CardDescription>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
              {isRunning ? (
                <Button variant="destructive" onClick={stopExecution} disabled={isInteractingWithApi}>
                  {isInteractingWithApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
                  Abort Execution
                </Button>
              ) : (
                <Button disabled={true} className={cn("opacity-0 pointer-events-none", { "hidden": isRunning || currentTestExecutionId || autoStartScenario })}>
                    <Play className="mr-2 h-4 w-4" /> Start
                </Button>
              )}
              <Button variant="outline" onClick={handleExportLogs} disabled={(logs.length <= 1 && logs[0]?.id === 'init_log') || isInteractingWithApi}>
                <DownloadCloud className="mr-2 h-4 w-4" /> Export Logs
              </Button>
              <Button variant="outline" disabled> {/* Conceptual */}
                <FileArchive className="mr-2 h-4 w-4" /> Save PCAP
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isRunning && !currentTestExecutionId && !autoStartScenario && (
          <CardContent className="py-6 flex flex-wrap gap-2 justify-center border-b">
             {/* REAL_IMPLEMENTATION_NOTE: These buttons are for starting SIMULATED tests. 
                 In a live system, you'd likely select a scenario and server from dropdowns
                 or a dedicated "Run Scenario" page.
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
        )}

        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="font-mono text-xs space-y-1">
              {logs.map((log, index) => (
                <div key={`${log.id}-${index}`} className="flex items-start">
                  <span className="w-28 text-muted-foreground flex-shrink-0 pt-0.5">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</span>
                  <Badge
                    variant="outline"
                    className={cn("w-16 text-center justify-center mr-2 py-0.5 flex-shrink-0 self-start mt-0.5",
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
                  <div className={cn("flex-1 whitespace-pre-wrap break-all", getLogLevelClass(log.level))}>
                    {/* Use dangerouslySetInnerHTML for simple keyword highlighting, ensure input is controlled if using real user input */}
                    <span dangerouslySetInnerHTML={{ __html: log.message.replace(/`(.*?)`/g, '<code class="bg-muted/80 dark:bg-muted/30 px-1 py-0.5 rounded text-foreground/80">$1</code>') }}></span>
                    {log.rawDetails && <pre className="mt-1 p-2 bg-muted/50 dark:bg-muted/20 rounded text-muted-foreground overflow-x-auto">{typeof log.rawDetails === 'string' ? log.rawDetails : JSON.stringify(log.rawDetails, null, 2)}</pre>}
                  </div>
                </div>
              ))}
               {logs.length <=1 && logs[0]?.id === 'init_log' && !isRunning && !currentTestExecutionId && (
                <div className="text-center text-muted-foreground py-10">
                  No active execution. Start a scenario to see output.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        { (isRunning || currentTestExecutionId) && (
             <CardFooter className="text-xs text-muted-foreground border-t pt-3">
                {isRunning ? "Execution in progress..." : currentTestExecutionId ? `Execution finished. Status: ${logs.find(l => l.message.includes("simulation finished with status"))?.message.split("status: ")[1]?.split('.')[0] || "Unknown"}` : "Ready."}
             </CardFooter>
        )}
      </Card>
    </div>
  );
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
    
