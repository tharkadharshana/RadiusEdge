
"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Added import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon, Download, Filter, CheckCircle, XCircle, AlertTriangle, BarChartHorizontalBig, FileText, Image as ImageIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Pie, PieChart, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';


interface TestResult {
  id: string;
  scenarioName: string;
  status: 'Pass' | 'Fail' | 'Warning';
  timestamp: Date;
  latencyMs: number;
  server: string;
  details?: any; // For storing packet exchange, SQL results etc.
}

const initialResults: TestResult[] = [
  { id: 'res1', scenarioName: '3GPP Full Auth Flow', status: 'Pass', timestamp: new Date('2024-07-20T10:30:00Z'), latencyMs: 120, server: 'Prod-FR-01', details: { log: "Access-Accept received", sql: "User status updated" } },
  { id: 'res2', scenarioName: 'VoIP Call Accounting', status: 'Fail', timestamp: new Date('2024-07-20T11:15:00Z'), latencyMs: 55, server: 'Staging-FR-02', details: { log: "Timeout waiting for Acct-Response", sql: "No accounting record found" } },
  { id: 'res3', scenarioName: 'EAP-TLS Wifi Auth', status: 'Pass', timestamp: new Date('2024-07-19T14:00:00Z'), latencyMs: 250, server: 'Prod-FR-01', details: { log: "Access-Accept with EAP-Success", sql: "Session created" } },
  { id: 'res4', scenarioName: 'High-Load Concurrency Test', status: 'Warning', timestamp: new Date('2024-07-19T09:45:00Z'), latencyMs: 350, server: 'Prod-FR-01', details: { log: "5% packet drop", sql: "Minor discrepancies" } },
  { id: 'res5', scenarioName: '3GPP Full Auth Flow', status: 'Pass', timestamp: new Date('2024-07-18T16:20:00Z'), latencyMs: 110, server: 'Prod-FR-01', details: { log: "Access-Accept received", sql: "User status updated" } },
];

const statusColors = {
  Pass: 'hsl(var(--chart-3))', // Green
  Fail: 'hsl(var(--chart-4))', // Red
  Warning: 'hsl(var(--chart-2))', // Yellow/Orange
};

const latencyChartConfig = {
  latency: { label: "Latency (ms)", color: "hsl(var(--chart-1))" },
};

const statusChartConfig = {
  Pass: { label: "Pass", color: statusColors.Pass },
  Fail: { label: "Fail", color: statusColors.Fail },
  Warning: { label: "Warning", color: statusColors.Warning },
};


export default function ResultsPage() {
  const [results, setResults] = useState<TestResult[]>(initialResults);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredResults = results.filter(result => {
    const matchesDate = !dateRange || (dateRange.from && dateRange.to && result.timestamp >= dateRange.from && result.timestamp <= dateRange.to);
    const matchesStatus = statusFilter === 'all' || result.status.toLowerCase() === statusFilter;
    const matchesSearch = searchTerm === '' || result.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) || result.server.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesStatus && matchesSearch;
  });

  const latencyData = filteredResults.map(r => ({ name: r.id.slice(0,4), latency: r.latencyMs, fill: statusColors[r.status]  }));
  const statusCounts = filteredResults.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<TestResult['status'], number>);

  const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value, fill: statusColors[name as TestResult['status']] }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Results Dashboard"
        description="View and analyze your RADIUS test scenario results."
        actions={
          <div className="flex gap-2">
            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export All (CSV)</Button>
          </div>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary"/> Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="search-results">Search</Label>
            <Input id="search-results" placeholder="Scenario name, server..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChartHorizontalBig className="h-5 w-5 text-primary"/>Latency Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredResults.length > 0 ? (
              <ChartContainer config={latencyChartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" dataKey="latency" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={40}/>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="latency" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No data for latency chart with current filters.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary"/>Pass/Fail Status</CardTitle>
          </CardHeader>
          <CardContent>
             {filteredResults.length > 0 ? (
              <ChartContainer config={statusChartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label >
                             {statusChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
             ) : (
              <p className="text-muted-foreground text-center py-10">No data for status chart with current filters.</p>
             )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/>Test Runs</CardTitle>
          <CardDescription>Detailed list of test executions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency (ms)</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((result) => (
                <TableRow key={result.id} onClick={() => setSelectedResult(result)} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{result.scenarioName}</TableCell>
                  <TableCell>
                    <Badge variant={result.status === 'Pass' ? 'default' : result.status === 'Fail' ? 'destructive' : 'secondary'}
                           className={cn(
                               result.status === 'Pass' && 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700',
                               result.status === 'Fail' && 'bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700',
                               result.status === 'Warning' && 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-800/30 dark:text-yellow-300 dark:border-yellow-700'
                           )}>
                        {result.status === 'Pass' && <CheckCircle className="mr-1 h-3 w-3 inline-block" />}
                        {result.status === 'Fail' && <XCircle className="mr-1 h-3 w-3 inline-block" />}
                        {result.status === 'Warning' && <AlertTriangle className="mr-1 h-3 w-3 inline-block" />}
                        {result.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{result.latencyMs}</TableCell>
                  <TableCell>{result.server}</TableCell>
                  <TableCell>{format(result.timestamp, "Pp")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedResult(result)}>View Details</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No results found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-end">
            <p className="text-sm text-muted-foreground">Showing {filteredResults.length} of {results.length} results</p>
        </CardFooter>
      </Card>

      {selectedResult && (
         <Dialog open={!!selectedResult} onOpenChange={(isOpen) => !isOpen && setSelectedResult(null)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Test Result Details: {selectedResult.scenarioName}</DialogTitle>
                    <DialogDescription>
                        Executed on {format(selectedResult.timestamp, "PPP p")} on server {selectedResult.server}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    <p><strong>Status:</strong> <Badge variant={selectedResult.status === 'Pass' ? 'default' : selectedResult.status === 'Fail' ? 'destructive' : 'secondary'} className={cn(
                               selectedResult.status === 'Pass' && 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700',
                               selectedResult.status === 'Fail' && 'bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700',
                               selectedResult.status === 'Warning' && 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-800/30 dark:text-yellow-300 dark:border-yellow-700'
                           )}>{selectedResult.status}</Badge>
                    </p>
                    <p><strong>Latency:</strong> {selectedResult.latencyMs} ms</p>
                    
                    <h4 className="font-semibold mt-4">Packet Exchange Log:</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs max-h-60 overflow-y-auto">
                        {JSON.stringify(selectedResult.details?.log || "No packet log available.", null, 2)}
                    </pre>

                    <h4 className="font-semibold mt-2">SQL Query Results:</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs max-h-60 overflow-y-auto">
                        {JSON.stringify(selectedResult.details?.sql || "No SQL validation results.", null, 2)}
                    </pre>

                    {/* Placeholder for Scenario Execution Timeline */}
                    <h4 className="font-semibold mt-2">Execution Timeline:</h4>
                     <div className="border rounded-md p-3 text-sm text-muted-foreground">
                        Timeline visualization not implemented yet.
                        <br />Step 1: Send Access-Request (50ms)
                        <br />Step 2: Receive Access-Accept (70ms)
                        <br />Step 3: SQL Validation (30ms)
                    </div>
                </div>
                 <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline"><ImageIcon className="mr-2 h-4 w-4" /> Export PCAP (soon)</Button>
                    <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
                    <Button onClick={() => setSelectedResult(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

