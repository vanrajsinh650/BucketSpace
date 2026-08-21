'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, X } from 'lucide-react';

export interface HLSVideoPlayerProps {
  fileId: string;
  filename: string;
  onClose?: () => void;
}

export const HLSVideoPlayer: React.FC<HLSVideoPlayerProps> = ({ fileId, filename, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const apiBase =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : '';

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback error or blocked by browser policy:', err);
          setIsPlaying(false);
        });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl">
        <div className="px-4 py-2.5 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <span className="text-white truncate font-medium">{filename}</span>
          {onClose && (
            <button onClick={onClose} className="p-1 text-[#666] hover:text-white rounded">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="aspect-video bg-black flex items-center justify-center relative group">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            src={`${apiBase}/api/v1/telegram/stream/${encodeURIComponent(fileId)}`}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center btn-press"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
