
"use client"; 

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FilePenLine, Bot, BarChart3, Settings, PlusCircle, PlayCircle, Server, Loader2, Rocket, Activity, CheckCircle, AlertTriangle, Waypoints, Wand2, ListChecks, FilePlus2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Scenario } from '@/app/scenarios/page';
import type { ServerConfig } from '@/app/settings/servers/page';
import type { TestResult } from '@/app/results/page';
import type { AiInteraction } from '@/app/api/ai-interactions/route';
import { formatDistanceToNowStrict } from 'date-fns';

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
  const [scenarios, setScenarios] = useState<Pick<Scenario, 'id' | 'name'>[]>([]);
  const [servers, setServers] = useState<Pick<ServerConfig, 'id' | 'name'>[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
  const [isLoadingServers, setIsLoadingServers] = useState(true);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoadingScenarios(true);
      setIsLoadingServers(true);
      setIsLoadingActivities(true);

      try {
        const scenariosRes = await fetch('/api/scenarios?limit=3'); // Assuming API supports limit
        if (scenariosRes.ok) {
          const scenariosData: Scenario[] = await scenariosRes.json();
          setScenarios(scenariosData.map((s: Scenario) => ({ id: s.id, name: s.name })).slice(0, 3));
        } else {
          console.error("Failed to fetch scenarios for dashboard");
        }
      } catch (error) {
        console.error("Error fetching scenarios:", error);
      } finally {
        setIsLoadingScenarios(false);
      }

      try {
        const serversRes = await fetch('/api/settings/servers');
        if (serversRes.ok) {
          const serversData: ServerConfig[] = await serversRes.json();
          setServers(serversData.map((s: ServerConfig) => ({ id: s.id, name: s.name })));
        } else {
          console.error("Failed to fetch servers for dashboard");
        }
      } catch (error) {
        console.error("Error fetching servers:", error);
      } finally {
        setIsLoadingServers(false);
      }

      // Fetch Recent Activities
      try {
        const activities: ActivityItem[] = [];

        // Fetch latest Test Results
        const resultsRes = await fetch('/api/results?limit=2'); // Assuming API supports limit
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
              href: `/results?resultId=${r.id}` // Conceptual link
            });
          });
        }

        // Fetch latest AI Interactions
        const aiInteractionsRes = await fetch('/api/ai-interactions?limit=2'); // Assuming API supports limit
        if (aiInteractionsRes.ok) {
          const aiData: AiInteraction[] = await aiInteractionsRes.json();
          aiData.slice(0, 2).forEach(ai => {
            let interactionText = "AI interaction logged.";
            try {
                const userInput = JSON.parse(ai.userInput as string); // Cast to string
                if (ai.interactionType === 'generate_packet') {
                    interactionText = `AI generated packet: ${userInput.packetType} for ${userInput.vendor}.`;
                } else if (ai.interactionType === 'explain_attribute') {
                    interactionText = `AI explained attribute: ${userInput.attributeName}.`;
                }
            } catch (e) { /* ignore parsing error, use default text */ }
            
            activities.push({
              id: `ai-${ai.id}`,
              type: 'AI Interaction',
              text: interactionText,
              timestamp: new Date(ai.timestamp),
              icon: Wand2,
              status: 'Info',
              href: `/ai-assistant#interaction-${ai.id}` // Conceptual link
            });
          });
        }
        
        // Fetch latest Scenario modification
        const scenariosActivityRes = await fetch('/api/scenarios?limit=1&sortBy=lastModified'); // Assuming API supports limit and sort
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
                    href: `/scenarios?scenarioId=${s.id}` // Conceptual link
                });
            }
        }


        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecentActivities(activities.slice(0, 4)); // Show top 4 combined activities

      } catch (error) {
        console.error("Error fetching recent activities:", error);
      } finally {
        setIsLoadingActivities(false);
      }
    };
    fetchDashboardData();
  }, []);

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
                    <PlusCircle className="h-4 w-4" />
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
                <Select>
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
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoadingServers || servers.length === 0}>
              <PlayCircle className="mr-2 h-4 w-4" /> Run Smoke Test (Conceptual)
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
