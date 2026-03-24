import React from 'react';
import { toCanvas } from 'html-to-image';
import * as Mp4Muxer from 'mp4-muxer';
import { PlayerRef } from '@remotion/player';

export class WebCodecsRenderer {
  private container: HTMLElement;
  private playerRef: React.RefObject<PlayerRef | null>;
  private fps: number;
  private width: number;
  private height: number;
  private startFrame: number;
  private endFrame: number;
  private bitrate: number;
  private playbackRate: number;
  private cutSegments?: { start: number; end: number }[];
  private onProgress: (progress: number) => void;

  constructor(options: {
    container: HTMLElement;
    playerRef: React.RefObject<PlayerRef | null>;
    fps: number;
    width: number;
    height: number;
    startFrame: number;
    endFrame: number;
    bitrate: number;
    playbackRate?: number;
    cutSegments?: { start: number; end: number }[];
    onProgress: (progress: number) => void;
  }) {
    this.container = options.container;
    this.playerRef = options.playerRef;
    this.fps = options.fps;
    this.width = options.width;
    this.height = options.height;
    this.startFrame = options.startFrame;
    this.endFrame = options.endFrame;
    this.bitrate = options.bitrate;
    this.playbackRate = options.playbackRate || 1;
    this.cutSegments = options.cutSegments;
    this.onProgress = options.onProgress;
  }

  async render(): Promise<Blob> {
    if (!('VideoEncoder' in window)) {
      throw new Error('WebCodecs API is not supported in this browser.');
    }

    let totalFrames = 0;
    for (let f = this.startFrame; f < this.endFrame; f += this.playbackRate) {
      let isCut = false;
      if (this.cutSegments) {
        for (const cut of this.cutSegments) {
          if (f >= cut.start && f <= cut.end) {
            isCut = true;
            break;
          }
        }
      }
      if (!isCut) totalFrames++;
    }
    
    let muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: this.width,
        height: this.height,
      },
      fastStart: 'in-memory',
    });

    let encoderError: Error | null = null;

    let videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error('VideoEncoder error:', e);
        encoderError = e;
      },
    });

    // Determine appropriate AVC level based on resolution
    const pixels = this.width * this.height;
    let codecString = 'avc1.42001E'; // Baseline 3.0 (default/low res)
    if (pixels > 2073600) { // > 1080p
      codecString = 'avc1.640034'; // High 5.2 (4K)
    } else if (pixels > 921600) { // > 720p
      codecString = 'avc1.64002A'; // High 4.2 (1080p)
    } else {
      codecString = 'avc1.4D001F'; // Main 3.1 (720p)
    }

    let config: VideoEncoderConfig = {
      codec: codecString,
      width: this.width,
      height: this.height,
      bitrate: this.bitrate,
      framerate: this.fps,
      hardwareAcceleration: 'prefer-hardware',
    };

    let support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) {
      console.warn('Hardware acceleration not supported for this config, falling back to software...');
      config.hardwareAcceleration = 'prefer-software';
      support = await VideoEncoder.isConfigSupported(config);
      
      if (!support.supported) {
        console.warn('Software encoding not supported for high profile, falling back to Baseline...');
        config.codec = 'avc1.42001E'; // Fallback to Baseline
        support = await VideoEncoder.isConfigSupported(config);
        
        if (!support.supported) {
           // Final fallback: let the browser decide the codec string if possible, or throw
           throw new Error('VideoEncoder configuration is not supported by this device.');
        }
      }
    }

    videoEncoder.configure(config);

    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    let currentFrame = this.startFrame;
    let encodedFramesCount = 0;

    const renderFrame = async () => {
      if (currentFrame >= this.endFrame || encoderError) {
        return;
      }

      // Skip cut segments
      if (this.cutSegments) {
        let isCut = false;
        for (const cut of this.cutSegments) {
          if (currentFrame >= cut.start && currentFrame <= cut.end) {
            isCut = true;
            break;
          }
        }
        if (isCut) {
          currentFrame += this.playbackRate;
          return; // Skip this frame
        }
      }

      // 1. Seek the player
      if (this.playerRef.current) {
        this.playerRef.current.seekTo(Math.floor(currentFrame));
        // Wait a tiny bit for React/Remotion to update the DOM
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 2. Capture the DOM
      try {
        const scale = this.width / this.container.clientWidth;
        const frameCanvas = await toCanvas(this.container, {
          pixelRatio: scale,
          skipFonts: true,
          cacheBust: false,
        });
        
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.drawImage(frameCanvas, 0, 0);

        if (encoderError) throw encoderError;

        // 3. Create VideoFrame and encode
        const timestamp = (encodedFramesCount / this.fps) * 1_000_000;
        const videoFrame = new VideoFrame(canvas, { timestamp });
        
        // Keyframe every 2 seconds
        const keyFrame = encodedFramesCount % (this.fps * 2) === 0;
        videoEncoder.encode(videoFrame, { keyFrame });
        videoFrame.close();

        encodedFramesCount++;
        this.onProgress(encodedFramesCount / totalFrames);
        
        currentFrame += this.playbackRate;

        // Chunked encoding: wait for encoder queue to drain if it gets too large
        if (videoEncoder.encodeQueueSize > 5) {
          await new Promise(resolve => {
            const checkQueue = () => {
              if (encoderError || videoEncoder.encodeQueueSize <= 2) resolve(null);
              else setTimeout(checkQueue, 10);
            };
            checkQueue();
          });
        }
      } catch (err) {
        console.error('Error capturing frame:', err);
        throw err;
      }
    };

    // Render loop
    while (currentFrame < this.endFrame && !encoderError) {
      await renderFrame();
    }

    if (encoderError) {
      throw encoderError;
    }

    await videoEncoder.flush();
    videoEncoder.close();
    muxer.finalize();

    const buffer = (muxer.target as Mp4Muxer.ArrayBufferTarget).buffer;
    return new Blob([buffer], { type: 'video/mp4' });
  }
}
