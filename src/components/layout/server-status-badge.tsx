
"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export function ServerStatusBadge() {
  // Mock status, replace with actual server status logic
  const [isConnected, setIsConnected] = useState(true);
  const [serverAlias, setServerAlias] = useState("Prod-FR-01"); // Mock alias

  useEffect(() => {
    // Simulate status changes for demo
    const interval = setInterval(() => {
      // setIsConnected(prev => !prev);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={isConnected ? "default" : "destructive"} className="cursor-default flex items-center gap-1.5 py-1.5 px-3">
            {isConnected ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{serverAlias}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>RADIUS Server: {serverAlias}</p>
          <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
