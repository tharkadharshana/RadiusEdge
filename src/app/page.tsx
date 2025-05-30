
"use client"; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FilePenLine, Bot, BarChart3, Settings, PlusCircle, PlayCircle, Server, Loader2, Rocket, Activity, CheckCircle, AlertTriangle, Waypoints, Wand2, ListChecks, FilePlus2, XCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Scenario } from '@/app/scenarios/page';
import type { ServerConfig } from '@/app/settings/servers/page';
import type { TestResult } from '@/app/results/page';
import type { AiInteraction } from '@/app/api/ai-interactions/route';
import { formatDistanceToNowStrict } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

const featureCards = [
  { title: "Scenario Builder", description: "Design complex test flows.", icon: Waypoints, href: "/scenarios", actionText: "Open Builder" },
  { title: "Packet Editor", description: "Craft and inspect RADIUS packets.", icon: FilePenLine, href: "/packets", actionText: "Open Editor" },
  { title: "AI Assistant", description: "Generate and explain packets.", icon: Bot, href: "/ai-assistant", actionText: "Ask AI" },
  { title: "Results Dashboard", description: "Analyze test outcomes.", icon: BarChart3, href: "/results", actionText: "View Results" },
];

interface ActivityItem {
  id: string;
  type: 'Test Result' | 'AI Interaction' | 'Scenario Update';
  text: string;
  timestamp: Date;
  icon: React.ElementType;
  href?: string;
  status?: 'Pass' | 'Fail' | 'Warning' | 'Info';
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<Pick<Scenario, 'id' | 'name'>[]>([]);
  const [servers, setServers] = useState<Pick<ServerConfig, 'id' | 'name'>[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
  const [isLoadingServers, setIsLoadingServers] = useState(true);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedServerName, setSelectedServerName] = useState<string | null>(null);


  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoadingScenarios(true);
      setIsLoadingServers(true);
      setIsLoadingActivities(true);

      try {
        const scenariosRes = await fetch('/api/scenarios?limit=3&sortBy=lastModified'); 
        if (scenariosRes.ok) {
          const scenariosData: Scenario[] = await scenariosRes.json();
          setScenarios(scenariosData.map((s: Scenario) => ({ id: s.id, name: s.name })).slice(0, 3));
        } else {
          let errorMsg = "Failed to fetch scenarios for dashboard";
          try {
            const errorData = await scenariosRes.json();
            errorMsg = errorData.error || errorData.message || errorMsg;
          } catch (e) { /* ignore parsing error */ }
          console.error(errorMsg);
          toast({ title: "Dashboard Error", description: "Could not load recent scenarios.", variant: "destructive"});
        }
      } catch (error) {
        console.error("Error fetching scenarios:", error);
        toast({ title: "Dashboard Error", description: "Could not load recent scenarios.", variant: "destructive"});
      } finally {
        setIsLoadingScenarios(false);
      }

      try {
        const serversRes = await fetch('/api/settings/servers');
        if (serversRes.ok) {
          const serversData: ServerConfig[] = await serversRes.json();
          setServers(serversData.map((s: ServerConfig) => ({ id: s.id, name: s.name })));
        } else {
          let errorMsg = "Failed to fetch servers for dashboard";
          try {
            const errorData = await serversRes.json();
            errorMsg = errorData.error || errorData.message || errorMsg;
          } catch (e) { /* ignore parsing error */ }
          console.error(errorMsg);
          toast({ title: "Dashboard Error", description: "Could not load server list.", variant: "destructive"});
        }
      } catch (error) {
        console.error("Error fetching servers:", error);
        toast({ title: "Dashboard Error", description: "Could not load server list.", variant: "destructive"});
      } finally {
        setIsLoadingServers(false);
      }

      // Fetch Recent Activities
      try {
        const activities: ActivityItem[] = [];
        const resultsRes = await fetch('/api/results?limit=2');
        if (resultsRes.ok) {
          const resultsData: TestResult[] = await resultsRes.json();
          resultsData.slice(0, 2).forEach(r => {
            activities.push({
              id: `result-${r.id}`,
              type: 'Test Result',
              text: `Test '${r.scenarioName}' ${r.status.toLowerCase()}.`,
              timestamp: new Date(r.timestamp),
              icon: r.status === 'Pass' ? CheckCircle : r.status === 'Fail' ? XCircle : AlertTriangle,
              status: r.status,
              href: `/results#result-${r.id}` 
            });
          });
        } else { console.error("Failed to fetch recent test results for dashboard activity."); }


        const aiInteractionsRes = await fetch('/api/ai-interactions?limit=2');
        if (aiInteractionsRes.ok) {
          const aiData: AiInteraction[] = await aiInteractionsRes.json();
          aiData.slice(0, 2).forEach(ai => {
            let interactionText = "AI interaction logged.";
            try {
                const userInput = JSON.parse(ai.userInput as string);
                if (ai.interactionType === 'generate_packet') {
                    interactionText = `AI generated packet: ${userInput.packetType || 'N/A'} for ${userInput.vendor || 'N/A'}.`;
                } else if (ai.interactionType === 'explain_attribute') {
                    interactionText = `AI explained attribute: ${userInput.attributeName || 'N/A'}.`;
                }
            } catch (e) { /* ignore parsing error, use default text */ }
            
            activities.push({
              id: `ai-${ai.id}`,
              type: 'AI Interaction',
              text: interactionText,
              timestamp: new Date(ai.timestamp),
              icon: Wand2,
              status: 'Info',
              href: `/ai-assistant#interaction-${ai.id}` 
            });
          });
        } else { console.error("Failed to fetch recent AI interactions for dashboard activity."); }
        
        const scenariosActivityRes = await fetch('/api/scenarios?limit=1&sortBy=lastModified'); 
        if (scenariosActivityRes.ok) {
            const scenariosData: Scenario[] = await scenariosActivityRes.json();
            if (scenariosData.length > 0) {
                const s = scenariosData[0];
                 activities.push({
                    id: `scenario-${s.id}`,
                    type: 'Scenario Update',
                    text: `Scenario '${s.name}' updated.`,
                    timestamp: new Date(s.lastModified),
                    icon: FilePlus2,
                    status: 'Info',
                    href: `/scenarios#scenario-${s.id}` 
                });
            }
        } else { console.error("Failed to fetch recent scenario updates for dashboard activity."); }


        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecentActivities(activities.slice(0, 4)); 

      } catch (error) {
        console.error("Error fetching recent activities:", error);
        toast({ title: "Dashboard Error", description: "Could not load recent activities.", variant: "destructive"});
      } finally {
        setIsLoadingActivities(false);
      }
    };
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleServerSelect = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      setSelectedServerId(server.id);
      setSelectedServerName(server.name);
    } else {
      setSelectedServerId(null);
      setSelectedServerName(null);
    }
  };

  const handleRunSmokeTest = () => {
    if (selectedServerId && selectedServerName) {
      const scenarioName = "SMOKE_TEST_SCENARIO";
      router.push(`/execute?scenario=${encodeURIComponent(scenarioName)}&serverId=${selectedServerId}&serverName=${encodeURIComponent(selectedServerName)}`);
    } else {
      toast({ title: "Select Server", description: "Please select a server to run the smoke test.", variant: "default" });
    }
  };


  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Welcome to RadiusEdge! Get started with your RADIUS testing." />

      <section>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Quick Actions</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card) => (
            <Card key={card.title} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{card.title}</CardTitle>
                <card.icon className="h-6 w-6 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href={card.href}><card.icon className="mr-2 h-4 w-4" />{card.actionText}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> Quick Start a Scenario</CardTitle>
            <CardDescription>Launch a pre-configured test scenario template from your library.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingScenarios ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">Loading scenarios...</p>
              </div>
            ) : scenarios.length > 0 ? (
                scenarios.map(scenario => (
                <Button key={scenario.id} variant="outline" className="w-full justify-start gap-2" asChild>
                    <Link href={`/scenarios?open=${scenario.id}`}> 
                    <ListChecks className="h-4 w-4" />
                    {scenario.name}
                    </Link>
                </Button>
                ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No scenarios found. <Link href="/scenarios" className="text-primary hover:underline">Create one?</Link></p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-primary" /> Execute Tests</CardTitle>
            <CardDescription>Run tests against your configured RADIUS servers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="server-select" className="text-sm font-medium text-muted-foreground">Select Server</label>
              {isLoadingServers ? (
                 <div className="flex items-center justify-center h-10 border rounded-md">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                 </div>
              ) : (
                <Select onValueChange={handleServerSelect} value={selectedServerId || undefined}>
                    <SelectTrigger id="server-select">
                    <SelectValue placeholder="Choose a server..." />
                    </SelectTrigger>
                    <SelectContent>
                    {servers.length > 0 ? servers.map(server => (
                        <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                    )) : (
                        <div className="p-2 text-sm text-muted-foreground">No servers configured. <Link href="/settings/servers" className="text-primary hover:underline">Add one?</Link></div>
                    )}
                    </SelectContent>
                </Select>
              )}
            </div>
            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" 
              disabled={isLoadingServers || servers.length === 0 || !selectedServerId}
              onClick={handleRunSmokeTest}
            >
              <PlayCircle className="mr-2 h-4 w-4" /> Run Smoke Test
            </Button>
             <Button variant="link" className="w-full" asChild>
              <Link href="/execute">Open Execution Console</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingActivities ? (
                <div className="flex items-center justify-center h-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="ml-2 text-muted-foreground">Loading activities...</p>
                </div>
            ) : recentActivities.length > 0 ? (
                <ul className="space-y-3">
                {recentActivities.map((item) => {
                    const Icon = item.icon;
                    const timeAgo = formatDistanceToNowStrict(item.timestamp, { addSuffix: true });
                    let iconColor = "text-blue-500";
                    if (item.status === 'Pass') iconColor = "text-green-500";
                    else if (item.status === 'Fail') iconColor = "text-red-500";
                    else if (item.status === 'Warning') iconColor = "text-yellow-500";

                    const content = (
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Icon className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
                                <span className="truncate" title={item.text}>{item.text}</span>
                            </div>
                            <span className="text-muted-foreground whitespace-nowrap flex-shrink-0 ml-2">{timeAgo}</span>
                        </div>
                    );
                    
                    return (
                        <li key={item.id}>
                        {item.href ? (
                            <Link href={item.href} className="hover:bg-muted/50 block p-1 -m-1 rounded-md">
                                {content}
                            </Link>
                        ) : (
                            <div className="p-1">{content}</div>
                        )}
                        </li>
                    );
                })}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity to display.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> System Status (Mock)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>RADIUS Server (Prod-FR-01):</span>
              <span className="text-green-500 font-medium flex items-center gap-1"><CheckCircle className="h-4 w-4" />Connected</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>SQL Validator (MainDB):</span>
              <span className="text-green-500 font-medium flex items-center gap-1"><CheckCircle className="h-4 w-4" />Healthy</span>
            </div>
             <div className="flex items-center justify-between text-sm">
              <span>AI Assistant API:</span>
              <span className="text-green-500 font-medium flex items-center gap-1"><CheckCircle className="h-4 w-4" />Operational</span>
            </div>
            <Separator />
             <Button variant="outline" className="w-full" asChild>
              <Link href="/settings/servers">Manage Connections</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
