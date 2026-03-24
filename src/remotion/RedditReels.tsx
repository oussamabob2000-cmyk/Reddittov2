import React from 'react';
import { 
  AbsoluteFill, 
  Sequence, 
  useCurrentFrame, 
  interpolate,
  Easing,
  useVideoConfig,
  Img,
  Audio,
  Video
} from 'remotion';

export interface Comment {
  id: string;
  body: string;
  author: string;
  score: number;
}

export interface VideoData {
  title: string;
  subreddit: string;
  author: string;
  score: number;
  comments: Comment[];
}

export interface Props {
  data: VideoData;
  templateStyle?: string;
}

const TYPING_SPEED = 0.5; // 2 chars per frame (fast and engaging)

export const calculateDuration = (data: VideoData): number => {
  return calculateTotalDuration(data, TYPING_SPEED) + 60; // Add 60 frames for the CTA scene
};

// ==================== COMPONENTS ====================

// 1. المؤشر المؤقت (Cursor)
const Cursor: React.FC<{ blink?: boolean }> = ({ blink = true }) => {
  const frame = useCurrentFrame();
  const opacity = blink 
    ? interpolate(frame % 30, [0, 15, 30], [1, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  return (
    <span style={{
      display: 'inline-block',
      width: 4,
      height: '1.2em',
      backgroundColor: '#D7DADC',
      marginLeft: 4,
      opacity,
      verticalAlign: 'middle',
    }} />
  );
};

// 2. تأثير الكتابة حرف حرف
const TypewriterText: React.FC<{ 
  text: string; 
  startFrame: number; 
  speed?: number;
  style?: React.CSSProperties;
}> = ({ text, startFrame, speed = 1, style }) => {
  const frame = useCurrentFrame();
  
  const charsToShow = Math.max(0, Math.floor((frame - startFrame) / speed));
  const displayedText = text.slice(0, charsToShow);
  const isTyping = charsToShow < text.length;

  return (
    <span style={style}>
      {displayedText}
      {isTyping && <Cursor />}
    </span>
  );
};

// ==================== MAIN COMPOSITION ====================

export const RedditReels: React.FC<Props> = ({ data, templateStyle = 'clean' }) => {
  const { fps, width } = useVideoConfig();
  const scale = width / 1080;
  
  const TITLE_DURATION = data.title.length * TYPING_SPEED + 60; // Extra time to read
  
  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#0F0F0F', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1080,
        height: 1920,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}>
        {/* الخلفية */}
        {templateStyle === 'minecraft' && (
          <Video 
            src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" 
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
            muted 
            loop 
            crossOrigin="anonymous" 
            onError={(e) => console.error("Video playback error:", e)}
          />
        )}
        {templateStyle === 'gta' && (
          <Video 
            src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" 
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
            muted 
            loop 
            crossOrigin="anonymous" 
            onError={(e) => console.error("Video playback error:", e)}
          />
        )}
        {templateStyle === 'satisfying' && (
          <Video 
            src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4" 
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
            muted 
            loop 
            crossOrigin="anonymous" 
            onError={(e) => console.error("Video playback error:", e)}
          />
        )}
        {templateStyle === 'subway' && (
          <Video 
            src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" 
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
            muted 
            loop 
            crossOrigin="anonymous" 
            onError={(e) => console.error("Video playback error:", e)}
          />
        )}
        {templateStyle === 'neon' && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #090014 0%, #2a004f 100%)' }} />
        )}
        {templateStyle === 'clean' && (
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0F0F0F 100%)' }} />
        )}

        {/* ========== SCENE 1: كتابة المنشور ========== */}
        <Sequence from={0} durationInFrames={TITLE_DURATION}>
          <RedditPostCard 
            title={data.title}
            subreddit={data.subreddit}
            author={data.author}
            score={data.score}
            typingSpeed={TYPING_SPEED}
            isViralStyle={['minecraft', 'gta', 'satisfying', 'subway'].includes(templateStyle)}
          />
        </Sequence>

        {/* ========== SCENES 2-6: التعليقات ========== */}
        {data.comments.map((comment, index) => {
          const commentDuration = comment.body.length * TYPING_SPEED + 60;
          const startFrame = TITLE_DURATION + 
            data.comments.slice(0, index).reduce((acc, c) => 
              acc + c.body.length * TYPING_SPEED + 60, 0
            );
          
          return (
            <Sequence
              key={comment.id}
              from={startFrame}
              durationInFrames={commentDuration}
            >
              <RedditCommentCard
                comment={comment}
                typingSpeed={TYPING_SPEED}
                isViralStyle={['minecraft', 'gta', 'satisfying', 'subway'].includes(templateStyle)}
              />
            </Sequence>
          );
        })}

        {/* ========== FINAL CTA ========== */}
        <Sequence from={calculateTotalDuration(data, TYPING_SPEED)}>
          <CTAScene />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};

// ========== SCENE COMPONENTS ==========

const RedditPostCard: React.FC<{
  title: string;
  subreddit: string;
  author: string;
  score: number;
  typingSpeed: number;
  isViralStyle?: boolean;
}> = ({ title, subreddit, author, score, typingSpeed, isViralStyle }) => {
  const frame = useCurrentFrame();
  
  // Animate the card appearing
  const scale = interpolate(frame, [0, 15], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.5))
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Animate upvote score
  const scoreProgress = Math.max(0, frame - (title.length * typingSpeed));
  const displayScore = Math.min(
    score,
    Math.floor(interpolate(scoreProgress, [0, 30], [0, score], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.ease)
    }))
  );

  const isUpvoted = scoreProgress > 30;

  return (
    <AbsoluteFill style={{ 
      alignItems: 'center', 
      justifyContent: isViralStyle ? 'flex-start' : 'center', 
      padding: 40,
      paddingTop: isViralStyle ? 200 : 40
    }}>
      {/* Pop sound when card appears */}
      <Sequence from={0} durationInFrames={30}>
        <Audio src="https://actions.google.com/sounds/v1/cartoon/swipe.ogg" volume={0.4} />
      </Sequence>
      
      {/* Typing sound */}
      <Sequence from={15} durationInFrames={Math.max(1, Math.floor(title.length * typingSpeed))}>
        <Audio src="https://actions.google.com/sounds/v1/office/keyboard_typing.ogg" volume={0.15} />
      </Sequence>

      {/* Upvote sound */}
      {isUpvoted && (
        <Sequence from={Math.floor(title.length * typingSpeed) + 30} durationInFrames={30}>
          <Audio src="https://actions.google.com/sounds/v1/ui/click.ogg" volume={0.6} />
        </Sequence>
      )}

      <div style={{
        width: '100%',
        maxWidth: 800,
        backgroundColor: 'rgba(26, 26, 27, 0.95)',
        borderRadius: 16,
        border: '1px solid #343536',
        padding: '24px 32px',
        transform: `scale(${scale})`,
        opacity,
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backdropFilter: 'blur(10px)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>r/</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#D7DADC', fontSize: 20, fontWeight: 700 }}>r/{subreddit}</span>
              <span style={{ color: '#818384', fontSize: 16 }}>•</span>
              <span style={{ color: '#818384', fontSize: 16 }}>Posted by u/{author}</span>
              <span style={{ color: '#818384', fontSize: 16 }}>5h ago</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 style={{ color: '#D7DADC', fontSize: 48, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
          <TypewriterText text={title} startFrame={15} speed={typingSpeed} />
        </h1>

        {/* Footer (Actions) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            backgroundColor: isUpvoted ? 'rgba(255, 69, 0, 0.1)' : '#272729', 
            padding: '8px 16px', borderRadius: 20,
            border: `1px solid ${isUpvoted ? '#FF4500' : 'transparent'}`,
            transition: 'all 0.2s ease'
          }}>
            <span style={{ color: isUpvoted ? '#FF4500' : '#818384', fontSize: 24, fontWeight: 'bold' }}>↑</span>
            <span style={{ color: isUpvoted ? '#FF4500' : '#D7DADC', fontSize: 20, fontWeight: 700 }}>{formatNumber(displayScore)}</span>
            <span style={{ color: '#818384', fontSize: 24, fontWeight: 'bold' }}>↓</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#272729', padding: '8px 16px', borderRadius: 20 }}>
            <span style={{ color: '#818384', fontSize: 20 }}>💬</span>
            <span style={{ color: '#D7DADC', fontSize: 20, fontWeight: 700 }}>142</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#272729', padding: '8px 16px', borderRadius: 20 }}>
            <span style={{ color: '#818384', fontSize: 20 }}>↗️</span>
            <span style={{ color: '#D7DADC', fontSize: 20, fontWeight: 700 }}>Share</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const RedditCommentCard: React.FC<{
  comment: Comment;
  typingSpeed: number;
  isViralStyle?: boolean;
}> = ({ comment, typingSpeed, isViralStyle }) => {
  const frame = useCurrentFrame();
  
  const scale = interpolate(frame, [0, 15], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.5))
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const scoreProgress = Math.max(0, frame - (comment.body.length * typingSpeed));
  const displayScore = Math.min(
    comment.score,
    Math.floor(interpolate(scoreProgress, [0, 30], [0, comment.score], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.ease)
    }))
  );

  const isUpvoted = scoreProgress > 30;

  return (
    <AbsoluteFill style={{ 
      alignItems: 'center', 
      justifyContent: isViralStyle ? 'flex-start' : 'center', 
      padding: 40,
      paddingTop: isViralStyle ? 200 : 40
    }}>
      {/* Sounds */}
      <Sequence from={0} durationInFrames={30}>
        <Audio src="https://actions.google.com/sounds/v1/cartoon/swipe.ogg" volume={0.4} />
      </Sequence>
      <Sequence from={15} durationInFrames={Math.max(1, Math.floor(comment.body.length * typingSpeed))}>
        <Audio src="https://actions.google.com/sounds/v1/office/keyboard_typing.ogg" volume={0.15} />
      </Sequence>
      {isUpvoted && (
        <Sequence from={Math.floor(comment.body.length * typingSpeed) + 30} durationInFrames={30}>
          <Audio src="https://actions.google.com/sounds/v1/ui/click.ogg" volume={0.6} />
        </Sequence>
      )}

      <div style={{
        width: '100%',
        maxWidth: 800,
        backgroundColor: 'rgba(26, 26, 27, 0.95)',
        borderRadius: 16,
        border: '1px solid #343536',
        padding: '24px 32px',
        transform: `scale(${scale})`,
        opacity,
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backdropFilter: 'blur(10px)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#0079D3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, color: 'white', fontWeight: 'bold' }}>{comment.author[0].toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#D7DADC', fontSize: 20, fontWeight: 700 }}>{comment.author}</span>
            <span style={{ color: '#818384', fontSize: 16 }}>•</span>
            <span style={{ color: '#818384', fontSize: 16 }}>2h ago</span>
          </div>
        </div>

        {/* Body */}
        <p style={{ color: '#D7DADC', fontSize: 40, lineHeight: 1.4, margin: 0 }}>
          <TypewriterText text={comment.body} startFrame={15} speed={typingSpeed} />
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: isUpvoted ? '#FF4500' : '#818384', fontSize: 24, fontWeight: 'bold' }}>↑</span>
            <span style={{ color: isUpvoted ? '#FF4500' : '#818384', fontSize: 20, fontWeight: 700 }}>{formatNumber(displayScore)}</span>
            <span style={{ color: '#818384', fontSize: 24, fontWeight: 'bold' }}>↓</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
            <span style={{ color: '#818384', fontSize: 20 }}>💬</span>
            <span style={{ color: '#818384', fontSize: 20, fontWeight: 700 }}>Reply</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #0F0F0F 100%)',
    }}>
      <Sequence from={0} durationInFrames={30}>
        <Audio src="https://actions.google.com/sounds/v1/cartoon/swipe.ogg" volume={0.4} />
      </Sequence>
      
      <div style={{
        textAlign: 'center',
        transform: `scale(${interpolate(frame, [0, 20], [0.8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) })})`,
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <h2 style={{
          fontSize: 64,
          fontWeight: 900,
          background: 'linear-gradient(135deg, #FF4500, #FF8717)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 20,
        }}>
          Which one
          <br />
          shocked you most?
        </h2>
        
        <div style={{
          display: 'flex',
          gap: 20,
          justifyContent: 'center',
          marginTop: 40,
        }}>
          <ActionButton icon="💬" text="Comment" delay={30} />
          <ActionButton icon="🔔" text="Subscribe" delay={40} color="#FF4500" />
          <ActionButton icon="❤️" text="Like" delay={50} color="#FF4444" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ActionButton: React.FC<{
  icon: string;
  text: string;
  delay: number;
  color?: string;
}> = ({ icon, text, delay, color = '#272729' }) => {
  const frame = useCurrentFrame();
  const progress = Math.max(0, frame - delay);
  
  return (
    <div style={{
      backgroundColor: color,
      color: 'white',
      padding: '16px 32px',
      borderRadius: 50,
      fontSize: 24,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      transform: `translateY(${interpolate(progress, [0, 15], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5)) })})`,
      opacity: interpolate(progress, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    }}>
      <span>{icon}</span>
      {text}
    </div>
  );
};

// ========== UTILS ==========

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function calculateTotalDuration(data: VideoData, typingSpeed: number): number {
  const titleDur = data.title.length * typingSpeed + 60;
  const commentsDur = data.comments.reduce((acc, c) => 
    acc + c.body.length * typingSpeed + 60, 0
  );
  return titleDur + commentsDur;
}
