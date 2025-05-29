
"use client";

import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, StopCircle, DownloadCloud, ListFilter, AlertOctagon, FileArchive } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SENT' | 'RECV';
  message: string;
  rawPacket?: string; // For SENT/RECV
}

const initialLogEntries: LogEntry[] = [
  { id: 'log1', timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: 'Execution console initialized. Waiting for scenario execution...' },
];

export default function ExecutionConsolePage() {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogEntries);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null); // Name of running scenario
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Mock log generation
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isRunning && currentScenario) {
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
      
      intervalId = setInterval(() => {
        const randomLevel = mockLevels[Math.floor(Math.random() * mockLevels.length)];
        const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
        const newLog: LogEntry = {
          id: `log${logs.length + 1}`,
          timestamp: new Date().toLocaleTimeString(),
          level: randomLevel,
          message: `${currentScenario}: ${randomMessage}`,
          rawPacket: (randomLevel === 'SENT' || randomLevel === 'RECV') ? `Packet data for ${randomMessage.substring(0,20)}...` : undefined
        };
        setLogs(prevLogs => [...prevLogs, newLog]);
      }, 1500);
    }
    return () => clearInterval(intervalId);
  }, [isRunning, logs.length, currentScenario]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);

  const handleStartExecution = (scenarioName: string) => {
    setCurrentScenario(scenarioName);
    setIsRunning(true);
    setLogs([{ id: 'start', timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: `Starting scenario: ${scenarioName}...` }]);
  };

  const handleStopExecution = () => {
    setIsRunning(false);
    setLogs(prev => [...prev, { id: 'stop', timestamp: new Date().toLocaleTimeString(), level: 'INFO', message: `Execution of ${currentScenario} stopped by user.` }]);
    setCurrentScenario(null);
  };
  
  const getLogLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return 'text-red-500 dark:text-red-400';
      case 'WARN': return 'text-yellow-500 dark:text-yellow-400';
      case 'INFO': return 'text-blue-500 dark:text-blue-400';
      case 'SENT': return 'text-purple-500 dark:text-purple-400';
      case 'RECV': return 'text-teal-500 dark:text-teal-400';
      case 'DEBUG': return 'text-gray-500 dark:text-gray-400';
      default: return 'text-foreground';
    }
  };


  return (
    <div className="h-full flex flex-col space-y-8">
      <PageHeader
        title="Execution Console"
        description="View real-time logs and control ongoing test executions."
      />

      {/* Mock Scenario Starter - In real app this would be triggered from Scenario page or dashboard */}
      {!isRunning && (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Start a Test Scenario</CardTitle>
                <CardDescription>Select a scenario to begin execution. This is a mock trigger for demo purposes.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
                <Button onClick={() => handleStartExecution('3GPP Full Auth Flow')}>Start 3GPP Auth</Button>
                <Button variant="outline" onClick={() => handleStartExecution('WiFi EAP Test')}>Start WiFi EAP Test</Button>
            </CardContent>
        </Card>
      )}

      <Card className="shadow-lg flex-grow flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle>Live Output {currentScenario && `- ${currentScenario}`}</CardTitle>
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
                        log.level === 'RECV' && 'border-teal-500/50 text-teal-600 bg-teal-500/10 dark:border-teal-400/50 dark:text-teal-400 dark:bg-teal-400/10'
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
