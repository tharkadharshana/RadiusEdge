
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, StopCircle, DownloadCloud, FileArchive, Loader2, Terminal, Server, FileText, ListChecks } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ServerConfigForExec, LogEntry, LogLevel, Scenario, ScenarioStep, ScenarioVariable, SshExecutionStep, ServerConfig as FullServerConfig, RadiusPacket, ExpectedReplyAttribute, ApiHeader, SimulatedRadiusToolResult } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import type { TestResult } from '@/app/results/page';
import { sshService, radiusService, dbService, apiService } from '@/lib/services';

const initialLogEntry: LogEntry = {
  id: `init_log_${Date.now()}`,
  timestamp: new Date().toISOString(),
  level: 'INFO',
  message: 'Execution console initialized. Select a scenario and server to begin, or a packet/scenario might be auto-started if launched from another page.'
};


export default function ExecutionConsolePage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const router = useRouter(); 

  const [logs, setLogs] = useState<LogEntry[]>([initialLogEntry]);
  const [isRunning, setIsRunning] = useState(false);
  
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [currentServerConfig, setCurrentServerConfig] = useState<FullServerConfig | null>(null);
  const [currentPacketForRun, setCurrentPacketForRun] = useState<RadiusPacket | null>(null); 
  
  const [currentTestExecutionId, setCurrentTestExecutionId] = useState<string | null>(null);
  const [isInteractingWithApi, setIsInteractingWithApi] = useState(false);

  const [availableScenarios, setAvailableScenarios] = useState<Scenario[]>([]);
  const [availableServers, setAvailableServers] = useState<FullServerConfig[]>([]);
  const [selectedScenarioIdForDropdown, setSelectedScenarioIdForDropdown] = useState<string | null>(null);
  const [selectedServerIdForDropdown, setSelectedServerIdForDropdown] = useState<string | null>(null);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
  const [isLoadingServers, setIsLoadingServers] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const executionStateRef = useRef({ isRunning: false, currentTestExecutionId: '' }); 

  useEffect(() => {
    executionStateRef.current.isRunning = isRunning;
    executionStateRef.current.currentTestExecutionId = currentTestExecutionId || '';
  }, [isRunning, currentTestExecutionId]);

  const addLogEntryToBatchAndState = useCallback((
    logData: Omit<LogEntry, 'id' | 'testExecutionId' | 'timestamp'> & { timestamp?: string },
    batchRef: React.MutableRefObject<Omit<LogEntry, 'id' | 'testExecutionId'>[]>
  ) => {
    const newLogEntryBase = {
        timestamp: logData.timestamp || new Date().toISOString(),
        level: logData.level,
        message: logData.message,
        rawDetails: logData.rawDetails,
    };
    batchRef.current.push(newLogEntryBase);
    setLogs(prevLogs => [...prevLogs, { ...newLogEntryBase, id: `sim_log_${Date.now()}_${Math.random().toString(36).substring(2,9)}` }]);
  }, []);


  const saveLogsAndExecutionRecord = useCallback(async (
    logBatch: Omit<LogEntry, 'id' | 'testExecutionId'>[],
    executionId: string | null,
    finalStatus: 'Completed' | 'Failed' | 'Aborted',
    scenarioName?: string,
    serverName?: string
  ) => {
    if (!executionId) return;
    setIsInteractingWithApi(true);
    console.log(`FRONTEND_EXEC: Saving logs and updating execution record for ID: ${executionId}, Status: ${finalStatus}`);

    try {
      if (logBatch.length > 0) {
        const logSaveResponse = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testExecutionId: executionId, logs: logBatch }),
        });
        if (!logSaveResponse.ok) {
          const errorText = await logSaveResponse.text();
          console.error(`FRONTEND_EXEC: Failed to save logs: "${errorText}"`);
          toast({ title: "Log Save Error", description: `Failed to save logs. Server said: ${errorText.substring(0,100)}`, variant: "destructive"});
        } else {
          console.log("FRONTEND_EXEC: Logs saved successfully for execution ID:", executionId);
        }
      }

      let resultIdForExecution: string | undefined = undefined;
      if (scenarioName && serverName && (finalStatus === 'Completed' || finalStatus === 'Failed')) {
        const resultStatusMap = { 'Completed': 'Pass', 'Failed': 'Fail', 'Aborted': 'Warning' } as const;
        const currentStatus = finalStatus as 'Completed' | 'Failed'; // Narrow type for map

        const resultToPost: Omit<TestResult, 'id' | 'timestamp'> & { timestamp: string } = {
          scenarioName: scenarioName,
          status: resultStatusMap[currentStatus], 
          timestamp: new Date().toISOString(),
          latencyMs: Math.floor(Math.random() * (450 - 50 + 1)) + 50, // Simulated
          server: serverName,
          details: { executionId: executionId, simulatedLogCount: logBatch.length },
        };
        const postResultResponse = await fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resultToPost),
        });
        if (postResultResponse.ok) {
          const newTestResult = await postResultResponse.json();
          resultIdForExecution = newTestResult.id;
          console.log("FRONTEND_EXEC: Test result summary saved:", newTestResult);
        } else {
          const errorText = await postResultResponse.text();
          console.error(`FRONTEND_EXEC: Failed to save test result summary: "${errorText}"`);
           toast({ title: "Result Save Error", description: `Failed to save test result summary. Server said: ${errorText.substring(0,100)}`, variant: "destructive"});
        }
      }

      const executionUpdatePayload: { endTime: string; status: string; resultId?: string } = {
        endTime: new Date().toISOString(),
        status: finalStatus,
      };
      if (resultIdForExecution) executionUpdatePayload.resultId = resultIdForExecution;

      const execUpdateResponse = await fetch(`/api/executions/${executionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(executionUpdatePayload),
      });
      if (!execUpdateResponse.ok) {
         const errorText = await execUpdateResponse.text();
        console.error(`FRONTEND_EXEC: Failed to update execution record: "${errorText}"`);
        toast({ title: "Execution Update Error", description: `Failed to update execution record. Server said: ${errorText.substring(0,100)}`, variant: "destructive"});
      } else {
        const updatedExec = await execUpdateResponse.json();
        console.log("FRONTEND_EXEC: Execution record updated:", updatedExec);
      }

      toast({ title: `Execution ${finalStatus}`, description: `Scenario processing ${finalStatus.toLowerCase()}. Logs and results (if applicable) saved.` });
    } catch (error) {
      console.error("FRONTEND_EXEC: Error in saveLogsAndExecutionRecord:", error);
      toast({ title: "API Error", description: `Could not save all execution data to backend: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsInteractingWithApi(false);
    }
  }, [toast]);


  const resolveVariable = useCallback((value: string, scenarioVariables?: ScenarioVariable[]): string => {
    if (typeof value !== 'string' || !scenarioVariables) return String(value);
    return value.replace(/\${(.*?)}/g, (match, varName) => {
      const variable = scenarioVariables.find(v => v.name === varName);
      if (variable) {
        if (variable.type === 'random_string') return `rand_str_${Math.random().toString(36).substring(2, 8)}`;
        if (variable.type === 'random_number') return String(Math.floor(Math.random() * 10000));
        return variable.value;
      }
      return match; 
    });
  }, []);


  const startScenarioExecution = useCallback(async (scenario: Scenario, server: FullServerConfig) => {
    if (executionStateRef.current.isRunning || isInteractingWithApi) return;
    console.log(`FRONTEND_EXEC: Starting execution for Scenario: ${scenario.name}, Server: ${server.name}`);
    
    setIsInteractingWithApi(true);
    setLogs([{ id: `start-${Date.now()}`, timestamp: new Date().toISOString(), level: 'INFO', message: `Initializing scenario: "${scenario.name}" on server "${server.name}"...` }]);
    setCurrentScenario(scenario);
    setCurrentServerConfig(server);
    setCurrentPacketForRun(null); 

    try {
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: scenario.id, scenarioName: scenario.name, serverId: server.id, serverName: server.name }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to create test execution record." }));
        throw new Error(errorData.message);
      }
      const executionData = await response.json();
      setCurrentTestExecutionId(executionData.id);
      setIsRunning(true);
      toast({ title: "Execution Started", description: `Scenario "${scenario.name}" initiated. ID: ${executionData.id}.` });
    } catch (error) {
      console.error("FRONTEND_EXEC: Error starting execution:", error);
      toast({ title: "Start Failed", description: (error as Error).message, variant: "destructive" });
      setLogs([initialLogEntry]); 
    } finally {
      setIsInteractingWithApi(false);
    }
  }, [isInteractingWithApi, toast]);


  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingScenarios(true);
      setIsLoadingServers(true);
      let fetchedScenarios: Scenario[] = [];
      let fetchedServers: FullServerConfig[] = [];

      try {
        const scenariosRes = await fetch('/api/scenarios');
        if (scenariosRes.ok) fetchedScenarios = await scenariosRes.json();
        else console.error("Failed to fetch scenarios for execution console");
      } catch (e) { console.error("Error fetching scenarios", e); }
      setAvailableScenarios(fetchedScenarios);
      setIsLoadingScenarios(false);

      try {
        const serversRes = await fetch('/api/settings/servers');
        if (serversRes.ok) fetchedServers = await serversRes.json();
        else console.error("Failed to fetch servers for execution console");
      } catch (e) { console.error("Error fetching servers", e); }
      setAvailableServers(fetchedServers);
      setIsLoadingServers(false);

      
      const scenarioIdFromQuery = searchParams.get('scenarioId');
      const scenarioNameToRun = searchParams.get('scenarioName'); 
      const packetIdToRun = searchParams.get('packetId');         
      const packetNameToRun = searchParams.get('packetName');     
      const smokeTestScenario = searchParams.get('scenario');     
      const smokeTestServerId = searchParams.get('serverId');
      const smokeTestServerName = searchParams.get('serverName');

      if (executionStateRef.current.isRunning || currentTestExecutionId) return;

      if (packetIdToRun && packetNameToRun) {
        
        toast({ title: "Run Packet Mode", description: `Packet "${packetNameToRun}" ready. Select a server to run it.`});
        setLogs([initialLogEntry, { id: `packet-mode-${Date.now()}`, timestamp: new Date().toISOString(), level: 'INFO', message: `Run Packet Mode: "${packetNameToRun}" loaded. Please select a target server.` }]);
        
        setIsInteractingWithApi(true);
        try {
            const packetRes = await fetch(`/api/packets/${packetIdToRun}`);
            if (packetRes.ok) {
                const packetData = await packetRes.json();
                setCurrentPacketForRun(packetData);
                 
            } else {
                toast({ title: "Error", description: `Could not load packet details for "${packetNameToRun}".`, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: `Failed to fetch packet "${packetNameToRun}".`, variant: "destructive" });
        } finally {
            setIsInteractingWithApi(false);
        }

      } else if (scenarioIdFromQuery && scenarioNameToRun) {
        const scenario = fetchedScenarios.find(s => s.id === scenarioIdFromQuery);
        if (scenario) {
          setSelectedScenarioIdForDropdown(scenarioIdFromQuery);
          toast({ title: "Scenario Loaded", description: `Scenario "${scenario.name}" ready. Select a server to run it.`});
        } else {
          toast({ title: "Error", description: `Scenario "${scenarioNameToRun}" (ID: ${scenarioIdFromQuery}) not found.`, variant: "destructive" });
        }
      } else if (smokeTestScenario && smokeTestServerId && smokeTestServerName) {
        const server = fetchedServers.find(s => s.id === smokeTestServerId);
        if (server) {
          
          const tempSmokeScenario: Scenario = {
            id: 'smoke-test-scenario', name: smokeTestScenario, description: 'Automated smoke test',
            variables: [],
            steps: [{ id: 'smoke-step-1', type: 'log_message', name: 'Smoke Test Start', details: { message: `Starting smoke test for ${server.name}` } }],
            lastModified: new Date().toISOString(), tags: ['smoke-test']
          };
          startScenarioExecution(tempSmokeScenario, server);
        } else {
          toast({ title: "Error", description: `Server for smoke test (ID: ${smokeTestServerId}) not found.`, variant: "destructive" });
        }
      }
    };
    if (!isLoadingScenarios && !isLoadingServers) { // Only run if initial data load is complete
        fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingScenarios, isLoadingServers, searchParams]); 


  // Main Execution Loop Effect
  useEffect(() => {
    let simulationActive = true;
    const logBatchForSave: Omit<LogEntry, 'id' | 'testExecutionId'>[] = [];

    const execute = async () => {
      if (!isRunning || !currentScenario || !currentServerConfig || !executionStateRef.current.currentTestExecutionId) {
        return;
      }

      let overallSimulationStatus: 'Completed' | 'Failed' | 'Aborted' = 'Completed';
      const scenarioVariables = currentScenario.variables || [];
      const serverSshUser = currentServerConfig.sshUser || 'user';
      const serverSshHost = currentServerConfig.host || 'server_host';
      const currentUserAtHost = `${serverSshUser}@${serverSshHost}`;

      // 0. Establish SSH Connection for the server if needed for preambles
      if (currentServerConfig.scenarioExecutionSshCommands && currentServerConfig.scenarioExecutionSshCommands.length > 0) {
        addLogEntryToBatchAndState({ level: 'INFO', message: `Attempting to establish SSH connection to ${currentServerConfig.host} for preambles...` }, { current: logBatchForSave });
        try {
          await sshService.connect({
            host: currentServerConfig.host,
            port: currentServerConfig.sshPort,
            username: currentServerConfig.sshUser,
            password: currentServerConfig.password,
            privateKey: currentServerConfig.privateKey,
          });
          addLogEntryToBatchAndState({ level: 'INFO', message: `SSH connection to ${currentServerConfig.host} (simulated) successful for preamble execution.` }, { current: logBatchForSave });
        } catch (sshConnectError: any) {
          addLogEntryToBatchAndState({ level: 'ERROR', message: `Failed to establish SSH connection for preamble: ${sshConnectError.message}`, rawDetails: sshConnectError.stack }, { current: logBatchForSave });
          overallSimulationStatus = 'Failed';
          // No 'break' or 'return' here, proceed to saveLogsAndExecutionRecord
        }
      }


      // 1. Execute Server SSH Preamble (ScenarioExecutionSshCommands)
      if (overallSimulationStatus !== 'Failed' && currentServerConfig.scenarioExecutionSshCommands && currentServerConfig.scenarioExecutionSshCommands.length > 0) {
        addLogEntryToBatchAndState({ level: 'INFO', message: `[SCENARIO PREAMBLE for ${currentServerConfig.name}] Starting SSH preamble execution...` }, { current: logBatchForSave });
        for (const sshStep of currentServerConfig.scenarioExecutionSshCommands) {
          if (!simulationActive) { overallSimulationStatus = 'Aborted'; break; }
          if (sshStep.isEnabled) {
            const commandToRun = resolveVariable(sshStep.command, scenarioVariables);
            addLogEntryToBatchAndState({ level: 'SSH_CMD', message: `Executing on ${currentServerConfig.name}: ${commandToRun}`, rawDetails: `${currentUserAtHost}:~$ ${commandToRun}` }, { current: logBatchForSave });
            
            // SIMULATED: SSH Service Call
            const sshResult = await sshService.executeCommand(commandToRun);
            if (!simulationActive) { overallSimulationStatus = 'Aborted'; break; }

            let stepSuccess = sshResult.code === 0;
            let outputMessage = `SSH Preamble Step: "${sshStep.name}" executed.`;
            if (sshResult.stdout) addLogEntryToBatchAndState({level: 'SSH_OUT', message: `Output from "${sshStep.name}":`, rawDetails: sshResult.stdout}, {current: logBatchForSave});
            if (sshResult.stderr) addLogEntryToBatchAndState({level: 'SSH_FAIL', message: `Error output from "${sshStep.name}":`, rawDetails: sshResult.stderr}, {current: logBatchForSave});


            if (sshStep.expectedOutputContains) {
              const resolvedExpectedOutput = resolveVariable(sshStep.expectedOutputContains, scenarioVariables);
              if (sshResult.stdout.includes(resolvedExpectedOutput) || sshResult.stderr.includes(resolvedExpectedOutput)) {
                outputMessage += ` Expected output "${resolvedExpectedOutput}" found.`;
              } else {
                stepSuccess = false;
                outputMessage += ` FAILED. Expected output "${resolvedExpectedOutput}" NOT found.`;
              }
            }
             if (!stepSuccess) {
                overallSimulationStatus = 'Failed';
                addLogEntryToBatchAndState({ level: 'ERROR', message: `[SCENARIO PREAMBLE] ${outputMessage} Halting scenario.` }, { current: logBatchForSave });
                break; 
            } else {
                 addLogEntryToBatchAndState({ level: 'INFO', message: `[SCENARIO PREAMBLE] ${outputMessage}` }, { current: logBatchForSave });
            }
          } else {
            addLogEntryToBatchAndState({ level: 'INFO', message: `[SCENARIO PREAMBLE] Skipped (disabled): ${sshStep.name}` }, { current: logBatchForSave });
          }
        }
      }
      
      // 2. Execute Scenario Steps
      if (overallSimulationStatus !== 'Failed' && overallSimulationStatus !== 'Aborted') {
          for (const step of currentScenario.steps) {
            if (!simulationActive) { overallSimulationStatus = 'Aborted'; break; }
            if (!step.details) step.details = {}; 

            addLogEntryToBatchAndState({ level: 'INFO', message: `[STEP START] Executing: "${step.name}" (Type: ${step.type.toUpperCase()})` }, { current: logBatchForSave });

            try {
            switch (step.type) {
                case 'radius': {
                let packetToUse: RadiusPacket | undefined = undefined;
                if (step.details.packet_id) {
                    // SIMULATED: Fetch packet from API
                    addLogEntryToBatchAndState({ level: 'DEBUG', message: `Fetching packet template ID: ${step.details.packet_id}` }, { current: logBatchForSave });
                    const packetRes = await fetch(`/api/packets/${step.details.packet_id}`);
                    if (packetRes.ok) packetToUse = await packetRes.json();
                    else throw new Error(`Failed to fetch packet ID ${step.details.packet_id}. Status: ${packetRes.status}`);
                } else { 
                    packetToUse = {
                        id: 'adhoc-packet-' + Date.now(), name: 'AdHoc Packet from Scenario Step', description: '',
                        attributes: (step.details.expectedAttributes || []).map((attr: ExpectedReplyAttribute) => ({id: attr.id, name: attr.name, value: attr.value})),
                        lastModified: new Date().toISOString(), tags: [],
                        executionTool: 'radclient', 
                        toolOptions: {}
                    };
                     addLogEntryToBatchAndState({ level: 'DEBUG', message: `Using ad-hoc packet constructed from step details.` }, { current: logBatchForSave });
                }
                if (!packetToUse) throw new Error("Packet details not found or defined for RADIUS step.");

                const tool = packetToUse.executionTool || 'radclient';
                const toolOpts = packetToUse.toolOptions || {};
                
                
                let displayCommand = `${tool} `;
                const resolvedHost = resolveVariable(currentServerConfig.host, scenarioVariables);
                const resolvedAuthPort = currentServerConfig.radiusAuthPort; 
                const resolvedSecret = resolveVariable(currentServerConfig.defaultSecret || (toolOpts as any).secret || 'NOT_SET', scenarioVariables);

                if (tool === 'radclient') {
                    const radclientOpts = toolOpts as FullServerConfig['testSteps'][0]; // Using a similar structure for options for now
                    displayCommand += `${resolvedHost}:${resolvedAuthPort} `;
                    displayCommand += `${(toolOpts as any).type || 'auth'} ${'*'.repeat(resolvedSecret.length)}`;
                    packetToUse.attributes.forEach(attr => {
                        displayCommand += ` ${resolveVariable(attr.name, scenarioVariables)}="${resolveVariable(attr.value, scenarioVariables)}"`;
                    });
                } else { // radtest
                    const radtestOpts = toolOpts as FullServerConfig['testSteps'][0];
                    displayCommand += `${resolveVariable((toolOpts as any).user || 'testuser', scenarioVariables)} ${'*'.repeat((resolveVariable((toolOpts as any).password || 'testpass', scenarioVariables)).length)} `;
                    displayCommand += `${resolvedHost}:${resolvedAuthPort} ${'*'.repeat(resolvedSecret.length)}`;
                }
                addLogEntryToBatchAndState({ level: 'INFO', message: `Preparing to send RADIUS request:`, rawDetails: displayCommand }, { current: logBatchForSave });

                // SIMULATED: RADIUS Service Call
                const radiusResult: SimulatedRadiusToolResult = await radiusService.simulateExecuteTool(packetToUse, currentServerConfig, scenarioVariables);
                if (!simulationActive) { overallSimulationStatus = 'Aborted'; break; }

                if(radiusResult.simulatedSentPacket) addLogEntryToBatchAndState({level: 'SENT', message: "Simulated Packet Sent:", rawDetails: radiusResult.simulatedSentPacket}, {current: logBatchForSave});
                if(radiusResult.simulatedReceivedPacket) addLogEntryToBatchAndState({level: 'RECV', message: "Simulated Packet Received:", rawDetails: radiusResult.simulatedReceivedPacket}, {current: logBatchForSave});
                if(radiusResult.simulatedFullOutput) addLogEntryToBatchAndState({level: 'DEBUG', message: `Simulated ${tool} Full Output:`, rawDetails: radiusResult.simulatedFullOutput}, {current: logBatchForSave});
                
                if (radiusResult.code !== 0 || radiusResult.error) { 
                    throw new Error(radiusResult.error || `Simulated ${tool} command failed with code ${radiusResult.code}.`);
                }
                // TODO: Implement validation of received attributes against step.details.expectedAttributes
                break;
                }
                case 'sql': {
                const query = resolveVariable(step.details.query || '', scenarioVariables);
                addLogEntryToBatchAndState({ level: 'INFO', message: `Executing SQL Query:`, rawDetails: query }, { current: logBatchForSave });
                // SIMULATED: DB Service Call
                const dbResult = await dbService.executeQuery(query);
                if (!simulationActive) { overallSimulationStatus = 'Aborted'; break; }
                if (dbResult.error) throw dbResult.error;
                addLogEntryToBatchAndState({ level: 'DEBUG', message: `SQL Query Result:`, rawDetails: JSON.stringify(dbResult.rows, null, 2) }, { current: logBatchForSave });
                // TODO: Implement validation against step.details.expect_column/expect_value
                break;
                }
                case 'api_call': {
                const url = resolveVariable(step.details.url || '', scenarioVariables);
                const method = step.details.method || 'GET';
                const headers = (step.details.headers || []).reduce((acc: Record<string,string>, h: ApiHeader) => {
                    acc[resolveVariable(h.name, scenarioVariables)] = resolveVariable(h.value, scenarioVariables); return acc;
                }, {});
                const body = step.details.requestBody ? JSON.parse(resolveVariable(step.details.requestBody, scenarioVariables)) : undefined;
                addLogEntryToBatchAndState({level: 'INFO', message: `Making API Call: ${method} ${url}`, rawDetails: `Headers: ${JSON.stringify(headers, null, 2)}\nBody: ${JSON.stringify(body, null, 2)}` }, { current: logBatchForSave});
                // SIMULATED: API Service Call
                const apiResult = await apiService.makeRequest({url, method, headers, body});
                if (!simulationActive) { overallSimulationStatus = 'Aborted'; break; }
                if (apiResult.error) throw new Error(apiResult.error);
                addLogEntryToBatchAndState({level: 'DEBUG', message: `API Response (Status: ${apiResult.status}):`, rawDetails: JSON.stringify(apiResult.data, null, 2)}, {current: logBatchForSave});
                // TODO: Implement validation against expected status/response
                break;
                }
                case 'delay':
                const duration = parseInt(resolveVariable(String(step.details.duration_ms || 1000), scenarioVariables), 10);
                addLogEntryToBatchAndState({ level: 'INFO', message: `Delaying for ${duration}ms...` }, { current: logBatchForSave });
                await new Promise(resolve => setTimeout(resolve, duration));
                break;
                case 'log_message':
                addLogEntryToBatchAndState({ level: 'INFO', message: `LOG: ${resolveVariable(step.details.message || '', scenarioVariables)}` }, { current: logBatchForSave });
                break;
                case 'conditional_start':
                case 'loop_start':
                    addLogEntryToBatchAndState({ level: 'INFO', message: `Placeholder for ${step.type}: Condition "${step.details.condition || 'N/A'}" (Iterations: ${step.details.iterations || 'N/A'}) - Not fully implemented in client sim.` }, { current: logBatchForSave });
                    break;
                case 'conditional_end':
                case 'loop_end':
                    addLogEntryToBatchAndState({ level: 'INFO', message: `Placeholder for ${step.type}: End of block.` }, { current: logBatchForSave });
                    break;
                default:
                addLogEntryToBatchAndState({ level: 'WARN', message: `Step type "${(step as any).type}" not fully implemented in client simulation.` }, { current: logBatchForSave });
            }
            addLogEntryToBatchAndState({ level: 'INFO', message: `[STEP END] Finished: "${step.name}" successfully.` }, { current: logBatchForSave });
            } catch (stepError: any) {
            overallSimulationStatus = 'Failed';
            addLogEntryToBatchAndState({ level: 'ERROR', message: `[STEP FAIL] Error in step "${step.name}": ${stepError.message}`, rawDetails: stepError.stack }, { current: logBatchForSave });
            break; 
            }
        }
      }


      if (simulationActive) {
        const finalLogMessage = `Scenario "${currentScenario.name}" simulation finished with status: ${overallSimulationStatus}.`;
        addLogEntryToBatchAndState({ level: overallSimulationStatus === 'Completed' ? 'INFO' : 'ERROR', message: finalLogMessage }, { current: logBatchForSave });
      }
      
      await saveLogsAndExecutionRecord(logBatchForSave, executionStateRef.current.currentTestExecutionId, overallSimulationStatus, currentScenario.name, currentServerConfig.name);
      
      if (simulationActive) {
        setIsRunning(false); 
      }
    };

    let didConnectSsh = false;
    if (isRunning && currentScenario && currentServerConfig && executionStateRef.current.currentTestExecutionId) {
      execute().finally(async () => {
        // Ensure SSH disconnects if it was ever connected by this execution flow
        if (sshService.isConnected()) { // Check if it's connected, implying it was connected for preambles
          try {
            addLogEntryToBatchAndState({ level: 'INFO', message: "Attempting to disconnect SSH service (end of execution)..." }, { current: logBatchForSave });
            await sshService.disconnect();
            addLogEntryToBatchAndState({ level: 'INFO', message: "SSH service disconnected." }, { current: logBatchForSave });
          } catch (disconnectError: any) {
            addLogEntryToBatchAndState({ level: 'WARN', message: `Error disconnecting SSH: ${disconnectError.message}` }, { current: logBatchForSave });
          }
        }
        // Save any final logs from disconnect attempts (if new logs were added)
        if (logBatchForSave.length > 0 && executionStateRef.current.currentTestExecutionId) {
            // This might re-save some logs, or save new disconnect logs.
            // Be cautious if saveLogsAndExecutionRecord itself is complex or has side effects beyond just saving.
            // For simplicity here, assuming it's safe to call again if new logs were generated during cleanup.
            // await saveLogsAndExecutionRecord(logBatchForSave, executionStateRef.current.currentTestExecutionId, overallSimulationStatus, currentScenario.name, currentServerConfig.name);
        }
      });
    }

    return () => { 
      simulationActive = false;
      console.log("FRONTEND_EXEC: Simulation cleanup triggered for main execution effect.");
       if (sshService.isConnected()) {
            console.log("FRONTEND_EXEC: Attempting SSH disconnect during cleanup.");
            sshService.disconnect().catch(e => console.error("Error during cleanup disconnect:", e));
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, currentScenario, currentServerConfig, addLogEntryToBatchAndState, saveLogsAndExecutionRecord, resolveVariable]); 

  // Auto-scroll effect
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        const isNearBottom = scrollViewport.scrollHeight - scrollViewport.scrollTop - scrollViewport.clientHeight < 150;
        if (isNearBottom || logs.length < 20) { 
          requestAnimationFrame(() => {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
          });
        }
      }
    }
  }, [logs]);


  const stopExecution = async () => {
    if (!executionStateRef.current.isRunning && !executionStateRef.current.currentTestExecutionId) {
      toast({title: "Not Running", description: "No execution is currently active to stop.", variant:"default"});
      return;
    }
    const wasRunning = executionStateRef.current.isRunning;
    setIsRunning(false); 

    const scenarioNameForLog = currentScenario?.name || currentPacketForRun?.name || 'Unnamed Execution';
    const stopMessage = `Execution of "${scenarioNameForLog}" aborted by user.`;
    const localStopLog: Omit<LogEntry, 'id' | 'testExecutionId'> = { timestamp: new Date().toISOString(), level: 'WARN', message: stopMessage };
    
    
    const tempLogBatchForStop: Omit<LogEntry, 'id' | 'testExecutionId'>[] = [localStopLog];
    addLogEntryToBatchAndState(localStopLog, {current: []}); // Add to UI immediately

    if (executionStateRef.current.currentTestExecutionId) {
        if (wasRunning) { 
            await saveLogsAndExecutionRecord(tempLogBatchForStop, executionStateRef.current.currentTestExecutionId, 'Aborted', scenarioNameForLog, currentServerConfig?.name);
        }
    } else {
        
        setCurrentScenario(null);
        setCurrentServerConfig(null);
        setCurrentPacketForRun(null);
    }
    toast({ title: "Execution Aborted", description: `Scenario "${scenarioNameForLog}" processing stopped by user.` });
  };


  const handleExportLogs = () => {
    if (logs.length === 0 || (logs.length === 1 && logs[0].id.startsWith('init_log'))) {
        toast({ title: "No Logs", description: "No logs to export." });
        return;
    }
    const formattedLogs = logs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
        let logString = `[${time}] [${log.level}] ${log.message}`;
        if (log.rawDetails) {
            const detailsString = typeof log.rawDetails === 'string' ? log.rawDetails : JSON.stringify(log.rawDetails, null, 2);
            logString += `\n--- Details ---\n${detailsString}\n--- End Details ---`;
        }
        return logString;
    }).join('\n\n');
    const blob = new Blob([formattedLogs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const scenarioNameForFile = (currentScenario?.name || currentPacketForRun?.name || 'execution').replace(/\s+/g, '_');
    const serverNameForFile = (currentServerConfig?.name || 'server').replace(/\s+/g, '_');
    const timestampForFile = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    link.download = `radiusedge_logs_${scenarioNameForFile}_${serverNameForFile}_${timestampForFile}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Logs Exported", description: "Log file download initiated." });
  };

  const getLogLevelClass = (level: LogLevel): string => {
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

  const handleStartSelected = () => {
    if (currentPacketForRun && selectedServerIdForDropdown) { 
        const serverToRunOn = availableServers.find(s => s.id === selectedServerIdForDropdown);
        if (serverToRunOn) {
            
            const tempPacketScenario: Scenario = {
                id: `packet-run-${currentPacketForRun.id}`,
                name: `Run Packet: ${currentPacketForRun.name}`,
                description: `Single execution of packet: ${currentPacketForRun.name}`,
                variables: [],
                steps: [{
                    id: `packet-step-${currentPacketForRun.id}`,
                    type: 'radius',
                    name: `Send Packet: ${currentPacketForRun.name}`,
                    details: { packet_id: currentPacketForRun.id } 
                }],
                lastModified: new Date().toISOString(), tags: ['single-packet-run']
            };
            startScenarioExecution(tempPacketScenario, serverToRunOn);
        } else {
            toast({ title: "Error", description: "Selected server details not found.", variant: "destructive" });
        }
    } else if (selectedScenarioIdForDropdown && selectedServerIdForDropdown) { 
        const scenarioToRun = availableScenarios.find(s => s.id === selectedScenarioIdForDropdown);
        const serverToRunOn = availableServers.find(s => s.id === selectedServerIdForDropdown);

        if (scenarioToRun && serverToRunOn) {
        startScenarioExecution(scenarioToRun, serverToRunOn);
        } else {
        toast({ title: "Error", description: "Selected scenario or server details not found.", variant: "destructive" });
        }
    } else {
         toast({ title: "Selection Required", description: "Please select a scenario/packet and a server.", variant: "default" });
    }
  };
  
  const isStartButtonDisabled = () => {
    if (isRunning || isInteractingWithApi || isLoadingScenarios || isLoadingServers) return true;
    if (currentPacketForRun) return !selectedServerIdForDropdown; 
    return !selectedScenarioIdForDropdown || !selectedServerIdForDropdown; 
  };


  return (
    <div className="h-full flex flex-col space-y-8">
      <PageHeader
        title="Execution Console"
        description="View logs and control test executions. Commands and outputs are simulated based on your scenario/packet definitions."
      />

      <Card className="shadow-lg flex-grow flex flex-col min-h-0"> 
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-grow min-w-0"> 
              {isRunning || currentTestExecutionId ? (
                <>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    Live Output
                  </CardTitle>
                  <CardDescription className="mt-1 space-y-0.5 text-xs truncate">
                    {currentScenario?.name && <div className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-muted-foreground" /> Scenario: <strong className="truncate">{currentScenario.name}</strong></div>}
                    {currentServerConfig?.name && <div className="flex items-center gap-1.5"><Server className="h-3 w-3 text-muted-foreground" /> Server: <strong className="truncate">{currentServerConfig.name}</strong></div>}
                    {currentTestExecutionId && <div className="flex items-center gap-1.5 text-muted-foreground text-xs">Exec ID: {currentTestExecutionId}</div>}
                  </CardDescription>
                </>
              ) : (
                <>
                  <CardTitle>Start a Test</CardTitle>
                  <CardDescription>
                    {currentPacketForRun ? `Select a server to run packet: "${currentPacketForRun.name}".` : "Select a scenario and server to begin execution."}
                  </CardDescription>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
              {isRunning ? (
                <Button variant="destructive" onClick={stopExecution} disabled={isInteractingWithApi}>
                  {isInteractingWithApi && !isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
                  Abort Execution
                </Button>
              ) : ( <div className="w-0 h-0"></div> )}
              <Button variant="outline" onClick={handleExportLogs} disabled={(logs.length <= 1 && logs[0]?.id.startsWith('init_log')) || isInteractingWithApi}>
                <DownloadCloud className="mr-2 h-4 w-4" /> Export Logs
              </Button>
              <Button variant="outline" disabled>
                <FileArchive className="mr-2 h-4 w-4" /> Save PCAP
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {(!isRunning && !currentTestExecutionId) && (
          <div className="grid md:grid-cols-3 gap-4 p-4 border-b items-end">
            <div>
              <Label htmlFor="scenario-select-exec">Select Scenario</Label>
              <Select
                value={selectedScenarioIdForDropdown || ""}
                onValueChange={setSelectedScenarioIdForDropdown}
                disabled={isLoadingScenarios || isRunning || isInteractingWithApi || !!currentPacketForRun}
              >
                <SelectTrigger id="scenario-select-exec">
                  <SelectValue placeholder={currentPacketForRun ? `Packet: ${currentPacketForRun.name}` : "Choose a scenario..."} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingScenarios ? <SelectItem value="loading" disabled>Loading scenarios...</SelectItem> :
                    availableScenarios.length > 0 ? availableScenarios.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    )) : <SelectItem value="no-scenarios" disabled>No scenarios available</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="server-select-exec">Select Server</Label>
              <Select
                value={selectedServerIdForDropdown || ""}
                onValueChange={setSelectedServerIdForDropdown}
                disabled={isLoadingServers || isRunning || isInteractingWithApi}
              >
                <SelectTrigger id="server-select-exec">
                  <SelectValue placeholder="Choose a server..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingServers ? <SelectItem value="loading" disabled>Loading servers...</SelectItem> :
                    availableServers.length > 0 ? availableServers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    )) : <SelectItem value="no-servers" disabled>No servers configured</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleStartSelected}
              disabled={isStartButtonDisabled()}
            >
              {(isRunning || (isInteractingWithApi && !currentTestExecutionId)) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start Execution
            </Button>
          </div>
        )}

        <CardContent className="flex-grow overflow-hidden p-0"> 
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}> 
            <div className="font-mono text-xs space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start">
                  <span className="w-28 text-muted-foreground flex-shrink-0 pt-0.5">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}</span>
                  <Badge
                    variant="outline"
                    className={cn("w-16 text-center justify-center mr-2 py-0.5 flex-shrink-0 self-start mt-0.5",
                      log.level === 'ERROR' && 'border-red-500/50 text-red-600 bg-red-500/10 dark:border-red-400/50 dark:text-red-400 dark:bg-red-400/10',
                      log.level === 'WARN' && 'border-yellow-500/50 text-yellow-600 bg-yellow-500/10 dark:border-yellow-400/50 dark:text-yellow-400 dark:bg-yellow-400/10',
                      log.level === 'INFO' && 'border-blue-500/50 text-blue-600 bg-blue-500/10 dark:border-blue-400/50 dark:text-blue-400 dark:bg-blue-400/10',
                      log.level === 'SENT' && 'border-purple-500/50 text-purple-600 bg-purple-500/10 dark:border-purple-400/50 dark:text-purple-400 dark:bg-purple-400/10',
                      log.level === 'RECV' && 'border-teal-500/50 text-teal-600 bg-teal-500/10 dark:border-teal-400/50 dark:text-teal-400 dark:bg-teal-400/10',
                      log.level === 'DEBUG' && 'border-gray-500/50 text-gray-600 bg-gray-500/10 dark:border-gray-400/50 dark:text-gray-400 dark:bg-gray-400/10',
                      log.level === 'SSH_CMD' && 'border-cyan-500/50 text-cyan-700 bg-cyan-500/10 dark:border-cyan-400/50 dark:text-cyan-300 dark:bg-cyan-400/10',
                      log.level === 'SSH_OUT' && 'border-lime-500/50 text-lime-700 bg-lime-500/10 dark:border-lime-400/50 dark:text-lime-300 dark:bg-lime-400/10',
                      log.level === 'SSH_FAIL' && 'border-orange-500/50 text-orange-700 bg-orange-500/10 dark:border-orange-400/50 dark:text-orange-300 dark:bg-orange-400/10'
                    )}
                  >
                    {log.level}
                  </Badge>
                  <div className={cn("flex-1 whitespace-pre-wrap break-words", getLogLevelClass(log.level))}> 
                    <span dangerouslySetInnerHTML={{ __html: log.message.replace(/`(.*?)`/g, '<code class="bg-muted/80 dark:bg-muted/30 px-1 py-0.5 rounded text-foreground/80">$1</code>') }}></span>
                    {log.rawDetails && <pre className="mt-1 p-2 bg-muted/50 dark:bg-muted/20 rounded text-muted-foreground overflow-x-auto">{typeof log.rawDetails === 'string' ? log.rawDetails : JSON.stringify(log.rawDetails, null, 2)}</pre>}
                  </div>
                </div>
              ))}
               {logs.length === 1 && logs[0]?.id.startsWith('init_log') && !isRunning && !currentTestExecutionId && (
                <div className="text-center text-muted-foreground py-10">
                  Select a scenario/packet and server to start an execution.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        { (isRunning || currentTestExecutionId) && (
             <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex-shrink-0">
                {isRunning ? "Execution in progress..." : currentTestExecutionId ? `Execution finished. Status: ${logs.find(l => l.message.includes("simulation finished with status"))?.message.split("status: ")[1]?.split('.')[0] || "Concluded"}` : "Ready."}
             </CardFooter>
        )}
      </Card>
    </div>
  );
}
// END OF FILE - DO NOT ADD ANYTHING AFTER THIS LINE
    
