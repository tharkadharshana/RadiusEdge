
"use client";

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, StopCircle, DownloadCloud, ListFilter, AlertOctagon, FileArchive, Terminal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  rawPacket?: string; 
}

const initialLogEntries: LogEntry[] = [
  { id: 'log1', timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: 'Execution console initialized. Waiting for scenario execution...' },
];

const mockServerConfigs: Record<string, ServerConfigForExec> = {
  "server_3gpp": {
    id: "server_3gpp",
    name: "3GPP Test Server",
    scenarioExecutionSshCommands: [
      { id: "ssh1", name: "Connect to Jumpbox", command: "ssh user@jump.example.com -p 2222", isEnabled: true, expectedOutputContains: "Connected to jump.example.com" },
      { id: "ssh2", name: "SSH to Target RADIUS", command: "ssh admin@10.0.1.100", isEnabled: true, expectedOutputContains: "Authentication successful" },
      { id: "ssh3", name: "Source environment variables", command: "source /opt/radius/env.sh", isEnabled: true, expectedOutputContains: "Environment sourced" },
      { id: "ssh4", name: "Disabled SSH Step", command: "echo 'This step is disabled'", isEnabled: false },
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
    let intervalId: NodeJS.Timeout;
    if (isRunning && currentScenario && currentTargetServerId) {
      const serverConfig = mockServerConfigs[currentTargetServerId];
      let logQueue: LogEntry[] = [];
      let logIndex = 0;
      let preambleSuccessful = true;

      if (serverConfig?.scenarioExecutionSshCommands) {
        for (const step of serverConfig.scenarioExecutionSshCommands) {
          if (!preambleSuccessful) break;

          if (step.isEnabled) {
            logQueue.push({
              id: `log-ssh-cmd-${step.id}-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              level: 'SSH_CMD',
              message: `[SSH Preamble for ${serverConfig.name}] Executing: ${step.command}`,
            });
            
            let mockOutput = `Output for: ${step.command}\nConnection established...\nEnvironment prepared.`;
            if (step.command.includes("jump.example.com")) mockOutput = `Connected to jump.example.com. Authentication successful.`;
            if (step.command.includes("admin@10.0.1.100")) mockOutput = `Logged in as admin on 10.0.1.100. Authentication successful.`;
            if (step.command.includes("source /opt/radius/env.sh")) mockOutput = `Environment sourced. RADIUS_HOME=/opt/radius.`;


            if (step.expectedOutputContains) {
              if (mockOutput.includes(step.expectedOutputContains)) {
                logQueue.push({
                  id: `log-ssh-out-${step.id}-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  level: 'SSH_OUT',
                  message: `[SSH Preamble for ${serverConfig.name}] Output for '${step.name}': Success`,
                  rawPacket: mockOutput
                });
              } else {
                logQueue.push({
                  id: `log-ssh-fail-${step.id}-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  level: 'SSH_FAIL',
                  message: `[SSH Preamble for ${serverConfig.name}] FAILED: '${step.name}'. Expected output "${step.expectedOutputContains}" not found.`,
                  rawPacket: mockOutput
                });
                preambleSuccessful = false; 
              }
            } else {
              logQueue.push({
                id: `log-ssh-out-${step.id}-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                level: 'SSH_OUT',
                message: `[SSH Preamble for ${serverConfig.name}] Output: Successfully executed '${step.name}'`,
                rawPacket: mockOutput
              });
            }
          } else {
             logQueue.push({
              id: `log-ssh-skip-${step.id}-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              level: 'INFO',
              message: `[SSH Preamble for ${serverConfig.name}] Skipped (disabled): ${step.name}`,
            });
          }
        }
      }
      
      if (preambleSuccessful) {
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
          logQueue.push({
            id: `log-radius-${logs.length + i + 1}`,
            timestamp: new Date().toLocaleTimeString(),
            level: randomLevel,
            message: `${currentScenario}: ${randomMessage}`,
            rawPacket: (randomLevel === 'SENT' || randomLevel === 'RECV') ? `Packet data for ${randomMessage.substring(0,20)}...` : undefined
          });
        }
      } else {
          logQueue.push({
            id: `log-radius-halt-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'ERROR',
            message: `RADIUS scenario execution halted due to SSH preamble failure.`
          });
      }
      
      intervalId = setInterval(() => {
        if (logIndex < logQueue.length) {
          setLogs(prevLogs => [...prevLogs, logQueue[logIndex]]);
          logIndex++;
        } else {
          clearInterval(intervalId);
           setLogs(prev => [...prev, { 
            id: 'finish', 
            timestamp: new Date().toLocaleTimeString(), 
            level: 'INFO', 
            message: `Scenario ${currentScenario} finished ${preambleSuccessful ? 'successfully' : 'with errors'}.` 
          }]);
        }
      }, 700); 
    }
    return () => clearInterval(intervalId);
  }, [isRunning, currentScenario, currentTargetServerId, logs.length]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);

  const handleStartExecution = (scenarioName: string, serverId: string) => {
    setCurrentScenario(scenarioName);
    setCurrentTargetServerId(serverId);
    setIsRunning(true);
    setLogs([{ id: 'start', timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: `Starting scenario: ${scenarioName} on server ${mockServerConfigs[serverId]?.name || serverId}...` }]);
  };

  const handleStopExecution = () => {
    setIsRunning(false);
    setLogs(prev => [...prev, { id: 'stop', timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: `Execution of ${currentScenario} stopped by user.` }]);
    setCurrentScenario(null);
    setCurrentTargetServerId(null);
  };
  
  const getLogLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return 'text-red-500 dark:text-red-400';
      case 'WARN': return 'text-yellow-500 dark:text-yellow-400';
      case 'INFO': return 'text-blue-500 dark:text-blue-400';
      case 'SENT': return 'text-purple-500 dark:text-purple-400';
      case 'RECV': return 'text-teal-500 dark:text-teal-400';
      case 'DEBUG': return 'text-gray-500 dark:text-gray-400';
      case 'SSH_CMD': return 'text-cyan-600 dark:text-cyan-400';
      case 'SSH_OUT': return 'text-lime-600 dark:text-lime-400';
      case 'SSH_FAIL': return 'text-orange-500 dark:text-orange-400';
      default: return 'text-foreground';
    }
  };


  return (
    <div className="h-full flex flex-col space-y-8">
      <PageHeader
        title="Execution Console"
        description="View real-time logs and control ongoing test executions."
      />

      {!isRunning && (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Start a Test Scenario</CardTitle>
                <CardDescription>Select a scenario and server to begin execution. This is a trigger for demo purposes.</CardDescription>
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
                <CardTitle>Live Output {currentScenario && `- ${currentScenario}`} {currentTargetServerId && `on ${mockServerConfigs[currentTargetServerId]?.name}`}</CardTitle>
                <CardDescription>Real-time logs from the radclient wrapper and validation engine.</CardDescription>
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
              <Button variant="outline" disabled={!isRunning}><FileArchive className="mr-2 h-4 w-4" /> Save PCAP</Button>
              <Button variant="outline"><DownloadCloud className="mr-2 h-4 w-4" /> Export Logs</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
            <div className="font-mono text-xs space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex">
                  <span className="w-20 text-muted-foreground">{log.timestamp}</span>
                  <Badge 
                    variant="outline" 
                    className={cn("w-16 text-center justify-center mr-2 py-0.5", 
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
                  <span className={cn("flex-1 whitespace-pre-wrap", getLogLevelClass(log.level))}>{log.message}
                  {log.rawPacket && <pre className="mt-1 p-2 bg-muted/50 rounded text-muted-foreground overflow-x-auto">{log.rawPacket}</pre>}
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
