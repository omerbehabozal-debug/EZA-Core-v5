/**
 * Multimodal Debug Tab
 * Video/Audio/Image analysis interface
 */

'use client';

import React, { useState } from 'react';
import { uploadMultimodalFile, MultimodalAnalysisResult } from '@/api/multimodal';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function MultimodalTab() {
  const [videoResult, setVideoResult] = useState<MultimodalAnalysisResult | null>(null);
  const [audioResult, setAudioResult] = useState<MultimodalAnalysisResult | null>(null);
  const [imageResult, setImageResult] = useState<MultimodalAnalysisResult | null>(null);
  const [loadingKind, setLoadingKind] = useState<'video' | 'audio' | 'image' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (kind: 'video' | 'audio' | 'image', file: File | null) => {
    if (!file) return;
    setError(null);
    setLoadingKind(kind);
    try {
      const result = await uploadMultimodalFile(kind, file);
      if (kind === 'video') setVideoResult(result);
      if (kind === 'audio') setAudioResult(result);
      if (kind === 'image') setImageResult(result);
    } catch (e: any) {
      setError(e?.message || `Error analyzing ${kind}`);
    } finally {
      setLoadingKind(null);
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      case 'critical': return 'danger';
      default: return 'default';
    }
  };

  const renderResult = (result: MultimodalAnalysisResult | null, type: 'video' | 'audio' | 'image') => {
    if (!result) {
      return (
        <div className="text-center py-8 text-gray-500">
          No {type} analysis result yet. Upload a file to analyze.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Global Risk:</span>
              <Badge variant={getRiskBadgeVariant(result.global_risk_level)}>
                {result.global_risk_level.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Overall Score:</span>
              <span className="text-lg font-semibold">{result.eza_multimodal_score.overall_score.toFixed(1)}</span>
            </div>
            {result.filename && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Filename:</span>
                <span className="text-sm font-mono">{result.filename}</span>
              </div>
            )}
            {result.duration_sec && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Duration:</span>
                <span className="text-sm">{result.duration_sec.toFixed(1)}s</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {result.eza_multimodal_score.text_score !== null && (
                <div>
                  <span className="text-sm text-gray-600">Text Score:</span>
                  <span className="ml-2 font-semibold">{result.eza_multimodal_score.text_score?.toFixed(1)}</span>
                </div>
              )}
              {result.eza_multimodal_score.visual_score !== null && (
                <div>
                  <span className="text-sm text-gray-600">Visual Score:</span>
                  <span className="ml-2 font-semibold">{result.eza_multimodal_score.visual_score?.toFixed(1)}</span>
                </div>
              )}
              {result.eza_multimodal_score.audio_score !== null && (
                <div>
                  <span className="text-sm text-gray-600">Audio Score:</span>
                  <span className="ml-2 font-semibold">{result.eza_multimodal_score.audio_score?.toFixed(1)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recommended Actions */}
        {result.recommended_actions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1">
                {result.recommended_actions.map((action, idx) => (
                  <li key={idx} className="text-sm text-gray-700">{action}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Video-specific: Frames */}
        {type === 'video' && result.video_frames.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Video Frames ({result.video_frames.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.video_frames.map((frame) => (
                  <div key={frame.index} className="flex items-center gap-4 p-2 border border-gray-200 rounded">
                    <span className="text-xs text-gray-500 w-20">Frame {frame.index}</span>
                    <span className="text-xs text-gray-500 w-24">{frame.timestamp_sec.toFixed(1)}s</span>
                    <Badge variant={getRiskBadgeVariant(frame.risk_level)} className="text-xs">
                      {frame.risk_level}
                    </Badge>
                    {frame.labels.length > 0 && (
                      <div className="flex gap-1">
                        {frame.labels.map((label, idx) => (
                          <Badge key={idx} variant="info" className="text-xs">{label}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ASR Segments */}
        {result.asr_segments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Speech Recognition ({result.asr_segments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.asr_segments.map((segment, idx) => (
                  <div key={idx} className="p-2 border border-gray-200 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">
                        {segment.start_sec.toFixed(1)}s - {segment.end_sec.toFixed(1)}s
                      </span>
                      <Badge variant={getRiskBadgeVariant(segment.risk_level)} className="text-xs">
                        {segment.risk_level}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700">{segment.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* OCR Segments */}
        {result.ocr_segments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>OCR Text ({result.ocr_segments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.ocr_segments.map((segment, idx) => (
                  <div key={idx} className="p-2 border border-gray-200 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">{segment.timestamp_sec.toFixed(1)}s</span>
                      <Badge variant={getRiskBadgeVariant(segment.risk_level)} className="text-xs">
                        {segment.risk_level}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700">{segment.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audio Emotions */}
        {result.audio_emotions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Audio Emotions ({result.audio_emotions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.audio_emotions.map((emotion, idx) => (
                  <div key={idx} className="p-2 border border-gray-200 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">
                        {emotion.start_sec.toFixed(1)}s - {emotion.end_sec.toFixed(1)}s
                      </span>
                      <Badge variant={getRiskBadgeVariant(emotion.risk_level)} className="text-xs">
                        {emotion.risk_level}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{emotion.emotion}</span>
                      <span className="text-xs text-gray-500">Intensity: {emotion.intensity.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Context Graph Summary */}
        {(result.context_nodes.length > 0 || result.context_edges.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Context Graph</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                <p>Nodes: {result.context_nodes.length}</p>
                <p>Edges: {result.context_edges.length}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Upload Section */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Analyze Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload('video', file);
              }}
              disabled={loadingKind !== null}
            />
            <Button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload('video', file);
                };
                input.click();
              }}
              disabled={loadingKind !== null}
              className="w-full"
            >
              {loadingKind === 'video' ? 'Analyzing...' : 'Run Video Analysis'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analyze Audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload('audio', file);
              }}
              disabled={loadingKind !== null}
            />
            <Button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/*';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload('audio', file);
                };
                input.click();
              }}
              disabled={loadingKind !== null}
              className="w-full"
            >
              {loadingKind === 'audio' ? 'Analyzing...' : 'Run Audio Analysis'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analyze Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload('image', file);
              }}
              disabled={loadingKind !== null}
            />
            <Button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload('image', file);
                };
                input.click();
              }}
              disabled={loadingKind !== null}
              className="w-full"
            >
              {loadingKind === 'image' ? 'Analyzing...' : 'Run Image Analysis'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results Tabs */}
      {(videoResult || audioResult || imageResult) && (
        <Tabs defaultValue={videoResult ? 'video' : audioResult ? 'audio' : 'image'} className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="video">Video Results</TabsTrigger>
            <TabsTrigger value="audio">Audio Results</TabsTrigger>
            <TabsTrigger value="image">Image Results</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="video" className="mt-0">
              {renderResult(videoResult, 'video')}
            </TabsContent>

            <TabsContent value="audio" className="mt-0">
              {renderResult(audioResult, 'audio')}
            </TabsContent>

            <TabsContent value="image" className="mt-0">
              {renderResult(imageResult, 'image')}
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}

