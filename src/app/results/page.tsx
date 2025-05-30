
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { CalendarIcon, Download, Filter, CheckCircle, XCircle, AlertTriangle, BarChartHorizontalBig, FileText, Image as ImageIcon, Loader2, Trash2, ListOrdered } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Pie, PieChart, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogEntry, LogLevel } from '@/lib/types'; // Import LogEntry and LogLevel

export interface TestResult {
  id: string;
  scenarioName: string;
  status: 'Pass' | 'Fail' | 'Warning';
  timestamp: Date;
  latencyMs: number;
  server: string;
  details?: {
    executionId?: string;
    simulatedLogCount?: number;
    [key: string]: any; // Allow other details
  };
}


const statusColors = {
  Pass: 'hsl(var(--chart-3))',
  Fail: 'hsl(var(--chart-4))',
  Warning: 'hsl(var(--chart-2))',
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
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [fetchedExecutionLogs, setFetchedExecutionLogs] = useState<LogEntry[] | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/results');
      if (!response.ok) {
        throw new Error('Failed to fetch test results');
      }
      const data = await response.json();
      setResults(data.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details, // Ensure details is parsed
      })));
    } catch (error) {
      console.error("Error fetching results:", error);
      toast({
        title: "Fetch Error",
        description: (error as Error).message || "Could not fetch test results.",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchLogsForSelectedResult = async () => {
      if (selectedResult && selectedResult.details?.executionId) {
        setIsLoadingLogs(true);
        setFetchedExecutionLogs(null);
        try {
          const response = await fetch(`/api/logs/${selectedResult.details.executionId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch logs for execution ID: ${selectedResult.details.executionId}`);
          }
          const logsData = await response.json();
          setFetchedExecutionLogs(logsData);
        } catch (error) {
          console.error("Error fetching execution logs:", error);
          toast({
            title: "Log Fetch Error",
            description: (error as Error).message,
            variant: "destructive",
          });
          setFetchedExecutionLogs([]); // Set to empty array on error to indicate attempt was made
        } finally {
          setIsLoadingLogs(false);
        }
      } else {
        setFetchedExecutionLogs(null); // Clear logs if no executionId or no selected result
      }
    };

    fetchLogsForSelectedResult();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResult]);


  const filteredResults = useMemo(() => results.filter(result => {
    const matchesDate = !dateRange || (dateRange.from && dateRange.to && result.timestamp >= dateRange.from && result.timestamp <= dateRange.to) || (dateRange.from && !dateRange.to && result.timestamp >= dateRange.from);
    const matchesStatus = statusFilter === 'all' || result.status.toLowerCase() === statusFilter;
    const matchesSearch = searchTerm === '' || result.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) || result.server.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesStatus && matchesSearch;
  }), [results, dateRange, statusFilter, searchTerm]);

  const latencyData = useMemo(() => filteredResults.map(r => ({ name: r.id.slice(0,4), latency: r.latencyMs, fill: statusColors[r.status]  })), [filteredResults]);
  
  const statusCounts = useMemo(() => filteredResults.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<TestResult['status'], number>), [filteredResults]);

  const statusChartData = useMemo(() => Object.entries(statusCounts).map(([name, value]) => ({ name, value, fill: statusColors[name as TestResult['status']] })), [statusCounts]);

  const handleDeleteResult = async (resultId: string) => {
    if (!window.confirm("Are you sure you want to delete this test result? This might also remove associated execution data if linked directly.")) return;
    setIsDeleting(resultId);
    try {
      const response = await fetch(`/api/results/${resultId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete test result.");
      }
      setResults(prev => prev.filter(r => r.id !== resultId));
      toast({ title: "Result Deleted", description: "Test result successfully deleted." });
      if (selectedResult?.id === resultId) {
        setSelectedResult(null);
      }
    } catch (error) {
      console.error("Error deleting result:", error);
      toast({
        title: "Delete Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
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
    <div className="space-y-8">
      <PageHeader
        title="Results Dashboard"
        description="View and analyze your RADIUS test scenario results."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled><Download className="mr-2 h-4 w-4" /> Export All (CSV)</Button>
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
            <Input id="search-results" placeholder="Scenario name, server..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} disabled={isLoading} />
          </div>
          <div>
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
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
                  disabled={isLoading}
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
            {isLoading ? (
              <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading chart data...</div>
            ) : filteredResults.length > 0 ? (
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
              <p className="text-muted-foreground text-center py-10 h-[250px] flex items-center justify-center">No data for latency chart with current filters.</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary"/>Pass/Fail Status</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? (
                <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading chart data...</div>
             ) : filteredResults.length > 0 ? (
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
              <p className="text-muted-foreground text-center py-10 h-[250px] flex items-center justify-center">No data for status chart with current filters.</p>
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
          {isLoading ? (
             <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading test results...</p>
            </div>
          ) : (
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
                <TableRow key={result.id} className="hover:bg-muted/50">
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={!!isDeleting}>
                          <span className="sr-only">Open menu</span>
                          {isDeleting === result.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => setSelectedResult(result)} disabled={!!isDeleting}>
                           <ListOrdered className="mr-2 h-4 w-4" /> View Details & Logs
                         </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handleDeleteResult(result.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={!!isDeleting}>
                           <Trash2 className="mr-2 h-4 w-4" /> Delete Result
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filteredResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No results found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
        <CardFooter className="justify-end">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `Showing ${filteredResults.length} of ${results.length} results`}
            </p>
        </CardFooter>
      </Card>

      {selectedResult && (
         <Dialog open={!!selectedResult} onOpenChange={(isOpen) => { if (!isOpen) { setSelectedResult(null); setFetchedExecutionLogs(null); }}}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Test Result Details: {selectedResult.scenarioName}</DialogTitle>
                    <DialogDescription>
                        Executed on {format(selectedResult.timestamp, "PPP p")} on server {selectedResult.server}.
                        {selectedResult.details?.executionId && ` (Execution ID: ${selectedResult.details.executionId})`}
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
                    
                    <h4 className="font-semibold mt-4">Execution Logs:</h4>
                    {isLoadingLogs && (
                        <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="ml-2 text-muted-foreground">Loading logs...</span>
                        </div>
                    )}
                    {!isLoadingLogs && fetchedExecutionLogs && fetchedExecutionLogs.length > 0 && (
                        <ScrollArea className="h-[300px] border rounded-md bg-muted/30 dark:bg-muted/10">
                          <div className="font-mono text-xs p-2 space-y-1">
                            {fetchedExecutionLogs.map((log) => (
                              <div key={log.id} className="flex">
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
                                  {log.rawDetails && <pre className="mt-1 p-2 bg-muted/50 dark:bg-background/50 rounded text-muted-foreground overflow-x-auto">{log.rawDetails}</pre>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                    )}
                    {!isLoadingLogs && (!fetchedExecutionLogs || fetchedExecutionLogs.length === 0) && selectedResult.details?.executionId && (
                         <p className="text-sm text-muted-foreground">No execution logs found for this result, or logs could not be fetched.</p>
                    )}
                     {!isLoadingLogs && !selectedResult.details?.executionId && (
                        <p className="text-sm text-muted-foreground">No execution ID linked to this result to fetch logs.</p>
                    )}

                    <h4 className="font-semibold mt-2">Other Details (JSON):</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs max-h-60 overflow-y-auto">
                        {JSON.stringify(selectedResult.details, null, 2) || "No other details available."}
                    </pre>
                </div>
                 <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" disabled><ImageIcon className="mr-2 h-4 w-4" /> Export PCAP (soon)</Button>
                    <DialogClose asChild><Button variant="outline">Close Details</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
