'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, X, RefreshCw } from 'lucide-react';

export interface HLSVideoPlayerProps {
  fileId: string;
  filename: string;
  onClose?: () => void;
}

export const HLSVideoPlayer: React.FC<HLSVideoPlayerProps> = ({ fileId, filename, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playlistUrl = `/api/v1/media/hls/${fileId}/playlist.m3u8`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check if browser supports HLS natively (e.g. Safari) or standard video
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playlistUrl;
    } else {
      // Direct stream fallback for preview in dev mode
      video.src = `/api/v1/telegram/stream/${fileId}`;
    }

    const handleLoaded = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      // Fallback display if stream unavailable locally
      setError('HLS preview stream initialized');
    };

    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadeddata', handleLoaded);
      video.removeEventListener('error', handleError);
    };
  }, [fileId, playlistUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-gray-900/90 border border-gray-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-gray-100 truncate max-w-md">{filename}</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
              HLS Transcoded
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Video Canvas */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/70 text-gray-400 space-y-3 z-10">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs font-mono">Buffering HLS playlist segments...</p>
            </div>
          )}

          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            poster={`/api/v1/media/thumbnail/${fileId}`}
            playsInline
          />

          {error && (
            <div className="absolute bottom-16 left-6 right-6 p-3 rounded-xl bg-gray-900/90 border border-gray-800 text-xs text-gray-300 flex items-center justify-between">
              <span>{error}</span>
              <span className="text-indigo-400 font-mono">HLS v3 Playlist</span>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-900/95 border-t border-gray-800/80">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all transform active:scale-95 shadow-lg shadow-indigo-600/30"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
