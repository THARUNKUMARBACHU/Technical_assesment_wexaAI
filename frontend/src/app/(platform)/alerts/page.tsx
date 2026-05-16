"use client";

import { useState } from "react";
import { Bell, History } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertRulesTable } from "@/components/alerts/alert-rules-table";
import { AlertHistoryTable } from "@/components/alerts/alert-history-table";

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState("rules");

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Configure alert rules and review alert history.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => v != null && setActiveTab(String(v))}>
        <TabsList>
          <TabsTrigger value="rules">
            <Bell className="size-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <AlertRulesTable />
        </TabsContent>

        <TabsContent value="history">
          <AlertHistoryTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
