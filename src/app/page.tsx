
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListTree, FilePenLine, Bot, TerminalSquare, Rocket, Activity, CheckCircle, AlertTriangle, BarChart3, Settings, PlusCircle, PlayCircle, Server } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const featureCards = [
  { title: "Scenario Builder", description: "Design complex test flows.", icon: ListTree, href: "/scenarios", actionText: "Open Builder" },
  { title: "Packet Editor", description: "Craft and inspect RADIUS packets.", icon: FilePenLine, href: "/packets", actionText: "Open Editor" },
  { title: "AI Assistant", description: "Generate and explain packets.", icon: Bot, href: "/ai-assistant", actionText: "Ask AI" },
  { title: "Results Dashboard", description: "Analyze test outcomes.", icon: BarChart3, href: "/results", actionText: "View Results" },
];

const quickStartTemplates = [
  { id: "3gpp-auth", name: "3GPP Authentication" },
  { id: "wifi-eap", name: "Wi-Fi EAP-TTLS" },
  { id: "simple-acct", name: "Simple Accounting" },
];

export default function DashboardPage() {
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
            <CardDescription>Launch a pre-configured test scenario template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quickStartTemplates.map(template => (
               <Button key={template.id} variant="outline" className="w-full justify-start gap-2" asChild>
                 <Link href={`/scenarios?template=${template.id}`}>
                   <PlusCircle className="h-4 w-4" />
                   {template.name}
                 </Link>
               </Button>
            ))}
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
              <Select>
                <SelectTrigger id="server-select">
                  <SelectValue placeholder="Choose a server..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prod-fr-01">Production-FR-01</SelectItem>
                  <SelectItem value="staging-fr-02">Staging-FR-02</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
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
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> System Status</CardTitle>
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
