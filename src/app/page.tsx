
"use client"; // Required for useState, useEffect

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FilePenLine, Bot, BarChart3, Settings, PlusCircle, PlayCircle, Server, Loader2, Rocket, Activity, CheckCircle, AlertTriangle, Waypoints } from 'lucide-react'; // Added Waypoints
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Scenario } from '@/app/scenarios/page'; // Assuming Scenario type is exported
import type { ServerConfig } from '@/app/settings/servers/page'; // Assuming ServerConfig type is exported

const featureCards = [
  { title: "Scenario Builder", description: "Design complex test flows.", icon: Waypoints, href: "/scenarios", actionText: "Open Builder" },
  { title: "Packet Editor", description: "Craft and inspect RADIUS packets.", icon: FilePenLine, href: "/packets", actionText: "Open Editor" },
  { title: "AI Assistant", description: "Generate and explain packets.", icon: Bot, href: "/ai-assistant", actionText: "Ask AI" },
  { title: "Results Dashboard", description: "Analyze test outcomes.", icon: BarChart3, href: "/results", actionText: "View Results" },
];

export default function DashboardPage() {
  const [scenarios, setScenarios] = useState<Pick<Scenario, 'id' | 'name'>[]>([]);
  const [servers, setServers] = useState<Pick<ServerConfig, 'id' | 'name'>[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
  const [isLoadingServers, setIsLoadingServers] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoadingScenarios(true);
      setIsLoadingServers(true);
      try {
        const scenariosRes = await fetch('/api/scenarios');
        if (scenariosRes.ok) {
          const scenariosData = await scenariosRes.json();
          setScenarios(scenariosData.map((s: Scenario) => ({ id: s.id, name: s.name })).slice(0, 3)); // Take first 3 for example
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
          const serversData = await serversRes.json();
          setServers(serversData.map((s: ServerConfig) => ({ id: s.id, name: s.name })));
        } else {
          console.error("Failed to fetch servers for dashboard");
        }
      } catch (error) {
        console.error("Error fetching servers:", error);
      } finally {
        setIsLoadingServers(false);
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
                    <Link href={`/scenarios?templateId=${scenario.id}`}> 
                    {/* Assuming scenarios page can handle opening a specific scenario for editing/running */}
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
                        <div className="p-2 text-sm text-muted-foreground">No servers configured.</div>
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
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> Recent Activity (Mock)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                { status: "Pass", text: "Test '3GPP Full Auth' completed.", time: "2m ago" },
                { status: "Fail", text: "Packet 'VoIP Auth' validation failed.", time: "15m ago" },
                { status: "Info", text: "Dictionary 'Cisco-VSAs' updated.", time: "1h ago" },
              ].map((item, idx) => (
                <li key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {item.status === "Pass" && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {item.status === "Fail" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    {item.status === "Info" && <Settings className="h-4 w-4 text-blue-500" />}
                    <span>{item.text}</span>
                  </div>
                  <span className="text-muted-foreground">{item.time}</span>
                </li>
              ))}
            </ul>
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
