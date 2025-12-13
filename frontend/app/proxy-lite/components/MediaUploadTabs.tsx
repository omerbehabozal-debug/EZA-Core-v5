/**
 * Media Upload Tabs Component
 * Text / Audio / Image / Video input options
 */

"use client";

import { useState, useRef } from "react";
import { FileText, Mic, Camera, Video, Loader2 } from "lucide-react";
import { processAudio, processImage, processVideo } from "@/api/proxy_lite";
import { useAnalysisStore } from "../store/useAnalysisStore";

interface MediaUploadTabsProps {
  onTextExtracted?: (text: string) => void;
}

export default function MediaUploadTabs({ onTextExtracted }: MediaUploadTabsProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'image' | 'video'>('text');
  const [processing, setProcessing] = useState(false);
  const { setInputType } = useAnalysisStore();
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProcessing(true);
    setInputType('audio');
    
    try {
      const result = await processAudio(file);
      if (result?.text_from_audio) {
        onTextExtracted?.(result.text_from_audio);
      } else {
        alert(result?.error || "Ses işleme başarısız oldu");
      }
    } catch (error) {
      console.error('[MediaUpload] Audio processing error:', error);
      alert("Ses işleme hatası");
    } finally {
      setProcessing(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProcessing(true);
    setInputType('image');
    
    try {
      const result = await processImage(file);
      if (result?.text_from_image) {
        onTextExtracted?.(result.text_from_image);
      } else {
        alert(result?.error || "Görsel işleme başarısız oldu");
      }
    } catch (error) {
      console.error('[MediaUpload] Image processing error:', error);
      alert("Görsel işleme hatası");
    } finally {
      setProcessing(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProcessing(true);
    setInputType('video');
    
    try {
      const result = await processVideo(file);
      if (result?.text_from_video) {
        onTextExtracted?.(result.text_from_video);
      } else {
        alert(result?.error || "Video işleme başarısız oldu");
      }
    } catch (error) {
      console.error('[MediaUpload] Video processing error:', error);
      alert("Video işleme hatası");
    } finally {
      setProcessing(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('text');
            setInputType('text');
          }}
          className={`flex-1 py-2 px-4 rounded-[12px] text-sm font-medium transition-all ${
            activeTab === 'text'
              ? 'bg-[#007AFF] text-white'
              : 'bg-white text-[#3A3A3C] border border-[#E3E3E7]'
          }`}
        >
          <FileText size={16} className="inline mr-2" />
          Metin
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('audio');
            audioInputRef.current?.click();
          }}
          className={`flex-1 py-2 px-4 rounded-[12px] text-sm font-medium transition-all ${
            activeTab === 'audio'
              ? 'bg-[#007AFF] text-white'
              : 'bg-white text-[#3A3A3C] border border-[#E3E3E7]'
          }`}
          disabled={processing}
        >
          {processing && activeTab === 'audio' ? (
            <Loader2 size={16} className="inline mr-2 animate-spin" />
          ) : (
            <Mic size={16} className="inline mr-2" />
          )}
          Ses
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('image');
            imageInputRef.current?.click();
          }}
          className={`flex-1 py-2 px-4 rounded-[12px] text-sm font-medium transition-all ${
            activeTab === 'image'
              ? 'bg-[#007AFF] text-white'
              : 'bg-white text-[#3A3A3C] border border-[#E3E3E7]'
          }`}
          disabled={processing}
        >
          {processing && activeTab === 'image' ? (
            <Loader2 size={16} className="inline mr-2 animate-spin" />
          ) : (
            <Camera size={16} className="inline mr-2" />
          )}
          Görsel
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('video');
            videoInputRef.current?.click();
          }}
          className={`flex-1 py-2 px-4 rounded-[12px] text-sm font-medium transition-all ${
            activeTab === 'video'
              ? 'bg-[#007AFF] text-white'
              : 'bg-white text-[#3A3A3C] border border-[#E3E3E7]'
          }`}
          disabled={processing}
        >
          {processing && activeTab === 'video' ? (
            <Loader2 size={16} className="inline mr-2 animate-spin" />
          ) : (
            <Video size={16} className="inline mr-2" />
          )}
          Video
        </button>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioUpload}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />
    </div>
  );
}

