import React, { useState, useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { RedditReels, VideoData, calculateDuration } from './remotion/RedditReels';
import { Link2, Play, Download, Loader2, Film, CheckCircle2, Save, Share2, Settings2, Scissors, Zap } from 'lucide-react';
import { db } from './lib/db';
import { WebCodecsRenderer } from './lib/webcodecs-bridge';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export default function App() {
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [error, setError] = useState('');
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [exportComplete, setExportComplete] = useState(false);
  const [quality, setQuality] = useState('1080p');
  const [fps, setFps] = useState(30);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quickExport, setQuickExport] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [templateStyle, setTemplateStyle] = useState('clean');
  const [savedVideoUri, setSavedVideoUri] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);

  const getDimensions = () => {
    switch (quality) {
      case '720p': return { w: 720, h: 1280, bitrate: 12_000_000 };
      case '1080p': return { w: 1080, h: 1920, bitrate: 25_000_000 };
      case '1440p': return { w: 1440, h: 2560, bitrate: 40_000_000 };
      case '2160p': return { w: 2160, h: 3840, bitrate: 60_000_000 };
      default: return { w: 1080, h: 1920, bitrate: 25_000_000 };
    }
  };

  useEffect(() => {
    // Request notification permissions on mount
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions();
    }
  }, []);

  const handleGenerate = async () => {
    if (!url.includes('reddit.com')) {
      setError('Please enter a valid Reddit URL');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    setExportComplete(false);
    setSavedVideoUri(null);
    
    // Simulate fetching data (in production: call real API)
    setTimeout(() => {
      setVideoData({
        title: "What's the strangest thing you've encountered?",
        subreddit: "AskReddit",
        author: "curious_user",
        score: 15400,
        comments: [
          { id: '1', body: "I once found a wallet with $500 and returned it. The owner gave me $50 as thanks!", author: "honest_dude", score: 8500 },
          { id: '2', body: "Saw a guy walking his pet alligator in downtown Chicago.", author: "florida_man", score: 6200 },
          { id: '3', body: "My neighbor has been living in their treehouse for 3 years.", author: "treehugger", score: 4800 },
          { id: '4', body: "Found a time capsule from 1920 in my backyard.", author: "history_buff", score: 3200 },
          { id: '5', body: "A squirrel knocked on my door asking for nuts. True story.", author: "nuts_about_squirrels", score: 2100 }
        ]
      });
      setIsGenerating(false);
    }, 2000);
  };

  const handleExport = async () => {
    if (!videoData || !containerRef.current) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportComplete(false);
    setExportStatus('Initializing Local Renderer...');

    try {
      // 1. Save project to local DB
      const projectId = await db.projects.add({
        title: videoData.title,
        subreddit: videoData.subreddit,
        author: videoData.author,
        score: videoData.score,
        comments: videoData.comments,
        templateStyle,
        createdAt: new Date(),
        status: 'rendering'
      });

      // 2. Render video locally using WebCodecs Bridge
      const { w: compWidth, h: compHeight, bitrate } = getDimensions();
      const totalFrames = calculateDuration(videoData);
      
      let startFrame = Math.floor((trimStart / 100) * totalFrames);
      let endFrame = Math.floor((trimEnd / 100) * totalFrames);
      
      if (quickExport) {
        startFrame = 0;
        endFrame = Math.min(totalFrames, fps * 30); // First 30 seconds
      }

      const renderer = new WebCodecsRenderer({
        container: containerRef.current,
        playerRef,
        fps,
        width: compWidth,
        height: compHeight,
        startFrame,
        endFrame,
        bitrate,
        playbackRate,
        cutSegments: [], // Example: [{ start: 30, end: 60 }] to cut frames 30-60
        onProgress: (progress) => {
          setExportProgress(progress * 100);
          setExportStatus(`Rendering video...`);
        }
      });

      const videoBlob = await renderer.render();
      setExportStatus('Saving video to device...');

      // 3. Save to device filesystem
      let savedUri = '';
      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        await new Promise((resolve) => {
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            const fileName = `reddit_video_highres_${Date.now()}.mp4`;
            
            const result = await Filesystem.writeFile({
              path: fileName,
              data: base64data,
              directory: Directory.Documents,
            });
            savedUri = result.uri;
            setSavedVideoUri(savedUri);
            resolve(null);
          };
        });

        // Send local notification
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "Video Rendered Successfully!",
              body: "Your Reddit Reel is ready to be shared.",
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 1000) },
              actionTypeId: "",
              extra: null
            }
          ]
        });
      } else {
        // Fallback for web
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reddit_video_highres_${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        setSavedVideoUri('web-downloaded');
      }

      // 4. Update DB status
      await db.projects.update(projectId, {
        status: 'completed',
        videoUrl: savedUri
      });

      setExportProgress(100);
      setExportStatus('Video Exported Successfully!');
      setExportComplete(true);
    } catch (err: any) {
      console.error(err);
      setError('Failed to render video: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (savedVideoUri && Capacitor.isNativePlatform()) {
      await Share.share({
        title: 'My Reddit Reel',
        text: 'Check out this Reddit Reel I made!',
        url: savedVideoUri,
        dialogTitle: 'Share with buddies',
      });
    }
  };

  // Determine composition dimensions based on quality
  const { w: compWidth, h: compHeight } = getDimensions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                Reddit Reels Studio
              </h1>
              <p className="text-xs text-gray-400">Powered by Remotion & Capacitor</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Panel - Controls */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white">
                Turn Reddit Posts into <span className="text-orange-500">Viral Reels</span>
              </h2>
              <p className="text-gray-400 text-lg">
                Paste a Reddit post URL and we'll automatically generate a short-form video locally on your device.
              </p>
            </div>

            {/* Input Section */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
              <label className="block text-sm font-medium text-gray-300">
                Reddit Post URL
              </label>
              <div className="relative">
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.reddit.com/r/AskReddit/comments/..."
                  className="w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !url}
                className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/20"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Fetching Reddit Data...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Generate Preview
                  </>
                )}
              </button>
            </div>

            {/* Settings Panel */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-2xl p-6 space-y-6">
              <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-orange-500" /> Video Settings
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold">Quality</label>
                  <select 
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (FHD)</option>
                    <option value="1440p">1440p (2K)</option>
                    <option value="2160p">2160p (4K)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold">Frame Rate</label>
                  <select 
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value={24}>24 FPS (Cinematic)</option>
                    <option value={30}>30 FPS (Standard)</option>
                    <option value={60}>60 FPS (Smooth)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold">Style</label>
                  <select 
                    value={templateStyle}
                    onChange={(e) => setTemplateStyle(e.target.value)}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="clean">Clean Dark</option>
                    <option value="minecraft">Minecraft Parkour (Vibe)</option>
                    <option value="gta">GTA V Driving (Vibe)</option>
                    <option value="satisfying">Satisfying Slime (Vibe)</option>
                    <option value="subway">Subway Surfers (Vibe)</option>
                    <option value="neon">Neon Cyberpunk</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase font-semibold">Speed</label>
                  <select 
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value={0.5}>0.5x (Slow)</option>
                    <option value={1}>1x (Normal)</option>
                    <option value={1.5}>1.5x (Fast)</option>
                    <option value={2}>2x (Very Fast)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 space-y-4">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-orange-500" /> Trimming
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Start: {trimStart}%</span>
                      <span>End: {trimEnd}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max={trimEnd - 5} 
                        value={trimStart} 
                        onChange={(e) => setTrimStart(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                      <input 
                        type="range" 
                        min={trimStart + 5} 
                        max="100" 
                        value={trimEnd} 
                        onChange={(e) => setTrimEnd(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-600 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={quickExport}
                      onChange={(e) => setQuickExport(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200 flex items-center gap-1">
                        <Zap className="w-4 h-4 text-yellow-500" /> Quick Export (30s)
                      </span>
                      <span className="text-xs text-gray-500">Only render the first 30 seconds for a quick preview.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Stats */}
            {videoData && (
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Comments" value={videoData.comments.length} />
                <StatCard label="Upvotes" value={formatNumber(videoData.score)} />
                <StatCard label="Est. Views" value="10K+" />
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-200">Preview</h3>
                <span className="text-xs px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full font-medium border border-orange-500/30">
                  {quality === '4k' ? '4K (2160x3840)' : '1080p (1080x1920)'}
                </span>
              </div>

              {/* Phone Frame */}
              <div className="relative mx-auto w-[300px] h-[600px] bg-black rounded-[3rem] border-8 border-gray-800 shadow-2xl overflow-hidden">
                {/* Status Bar */}
                <div className="absolute top-2 left-0 right-0 flex justify-center z-20">
                  <div className="w-20 h-6 bg-black rounded-full" />
                </div>
                
                {/* Screen Content */}
                <div className="w-full h-full bg-[#0F0F0F] overflow-hidden relative">
                  <div className="w-full h-full" ref={containerRef}>
                    {videoData ? (
                      <Player
                        ref={playerRef}
                        component={RedditReels}
                        inputProps={{ data: videoData, templateStyle }}
                        durationInFrames={calculateDuration(videoData)}
                        fps={fps}
                        compositionWidth={compWidth}
                        compositionHeight={compHeight}
                        style={{ width: '100%', height: '100%' }}
                        controls
                        autoPlay
                        loop
                        playbackRate={playbackRate}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-6 text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                          <span className="text-2xl">⌨️</span>
                        </div>
                        <p className="text-sm font-medium">Typewriter Effect</p>
                        <p className="text-xs text-gray-600 mt-2">Enter a Reddit URL to see the magic</p>
                      </div>
                    )}
                  </div>

                  {videoData && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white text-xs px-2 py-1 rounded-full animate-pulse z-10 pointer-events-none">
                      LIVE PREVIEW
                    </div>
                  )}

                  {/* Export Overlay */}
                  {(isExporting || exportComplete) && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
                      {isExporting ? (
                        <>
                          <div className="relative w-20 h-20 mb-6">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                              <circle
                                className="text-gray-700 stroke-current"
                                strokeWidth="8"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                              ></circle>
                              <circle
                                className="text-orange-500 stroke-current transition-all duration-200 ease-out"
                                strokeWidth="8"
                                strokeLinecap="round"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                strokeDasharray={`${2 * Math.PI * 40}`}
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - exportProgress / 100)}`}
                              ></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-lg font-bold text-white">{Math.round(exportProgress)}%</span>
                            </div>
                          </div>
                          <h4 className="text-lg font-bold text-white mb-2">Rendering Video</h4>
                          <p className="text-sm text-gray-400">{exportStatus}</p>
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                          </div>
                          <h4 className="text-xl font-bold text-white mb-2">Video Rendered!</h4>
                          <p className="text-sm text-gray-400 mb-6">Your video has been saved locally.</p>
                          <div className="flex gap-3">
                            {savedVideoUri && Capacitor.isNativePlatform() && (
                              <button 
                                onClick={handleShare}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                              >
                                <Share2 className="w-4 h-4" /> Share
                              </button>
                            )}
                            <button 
                              onClick={() => setExportComplete(false)}
                              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-600 rounded-full" />
              </div>

              {/* Export Button */}
              {videoData && (
                <div className="mt-6 space-y-3">
                  <button 
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full py-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors group"
                  >
                    {isExporting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    )}
                    {isExporting ? 'Rendering...' : `Render & Save Video`}
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 uppercase mt-1">{label}</div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

