/**
 * Full Internal Proxy Portal - Main Page
 */

'use client';

import { useState } from 'react';
import InternalProxyLayout from '@/components/proxy/InternalProxyLayout';
import InternalProxySidebar from '@/components/proxy/InternalProxySidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import OverviewTab from '@/components/proxy/tabs/OverviewTab';
import InputRoutingTab from '@/components/proxy/tabs/InputRoutingTab';
import ModelsOutputsTab from '@/components/proxy/tabs/ModelsOutputsTab';
import SafetyAnalysisTab from '@/components/proxy/tabs/SafetyAnalysisTab';
import ContextGraphTab from '@/components/proxy/tabs/ContextGraphTab';
import TimingsLogsTab from '@/components/proxy/tabs/TimingsLogsTab';
import RawJsonTab from '@/components/proxy/tabs/RawJsonTab';
import {
  runInternalProxy,
  getInternalProxySession,
  FullPipelineDebugResponse,
} from '@/api/internal_proxy';

export default function ProxyPage() {
  const [currentSession, setCurrentSession] = useState<FullPipelineDebugResponse | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunPipeline = async (text: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await runInternalProxy({ text });
      setCurrentSession(result);
      setSelectedSessionId(result.request_id);
    } catch (err: any) {
      setError(err.message || 'Failed to run pipeline');
      console.error('Pipeline error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionSelect = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getInternalProxySession(sessionId);
      setCurrentSession(result);
      setSelectedSessionId(sessionId);
    } catch (err: any) {
      setError(err.message || 'Failed to load session');
      console.error('Session load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <InternalProxyLayout
      currentRiskLevel={currentSession?.flags?.risk_level}
    >
      <div className="flex h-full">
          {/* Left Sidebar */}
          <InternalProxySidebar
            onSessionSelect={handleSessionSelect}
            onRunPipeline={handleRunPipeline}
            selectedSessionId={selectedSessionId}
          />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {error && (
            <div className="bg-red-50 border-b border-red-200 px-6 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isLoading && !currentSession && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Running pipeline...</p>
              </div>
            </div>
          )}

          {!isLoading && !currentSession && !error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 text-lg mb-2">No session selected</p>
                <p className="text-gray-400 text-sm">
                  Enter text in the sidebar to run a debug pipeline, or select a session from history.
                </p>
              </div>
            </div>
          )}

          {currentSession && (
            <div className="flex-1 overflow-y-auto p-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="input-routing">Input & Routing</TabsTrigger>
                  <TabsTrigger value="models-outputs">Models & Outputs</TabsTrigger>
                  <TabsTrigger value="safety-analysis">Safety Analysis</TabsTrigger>
                  <TabsTrigger value="context-graph">Context Graph</TabsTrigger>
                  <TabsTrigger value="timings-logs">Timings & Logs</TabsTrigger>
                  <TabsTrigger value="raw-json">Raw JSON</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <OverviewTab data={currentSession} />
                </TabsContent>

                <TabsContent value="input-routing">
                  <InputRoutingTab data={currentSession} />
                </TabsContent>

                <TabsContent value="models-outputs">
                  <ModelsOutputsTab data={currentSession} />
                </TabsContent>

                <TabsContent value="safety-analysis">
                  <SafetyAnalysisTab data={currentSession} />
                </TabsContent>

                <TabsContent value="context-graph">
                  <ContextGraphTab data={currentSession} />
                </TabsContent>

                <TabsContent value="timings-logs">
                  <TimingsLogsTab data={currentSession} />
                </TabsContent>

                <TabsContent value="raw-json">
                  <RawJsonTab data={currentSession} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </InternalProxyLayout>
  );
}

