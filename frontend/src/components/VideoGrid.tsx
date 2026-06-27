import React, { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';

interface PeerStream {
  socketId: string;
  userId: string;
  username: string;
  stream: MediaStream | null;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  localUsername: string;
  localAudioMuted: boolean;
  localVideoMuted: boolean;
  peers: PeerStream[];
}

// Single Video element wrapper to attach srcObject correctly in React
const VideoPlayer: React.FC<{
  stream: MediaStream | null;
  username: string;
  isLocal: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
}> = ({ stream, username, isLocal, audioMuted, videoMuted }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container">
      {videoMuted || !stream ? (
        <div 
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-glass-dark)',
            color: 'var(--text-muted)'
          }}
        >
          <div className="user-avatar" style={{ width: '80px', height: '80px', fontSize: '2.5rem', marginBottom: '10px' }}>
            {username.slice(0, 2).toUpperCase()}
          </div>
          <span>Camera Off</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video to prevent echo feedback
          className="video-element"
        />
      )}
      <div className="video-overlay-info">
        {audioMuted && <MicOff size={14} style={{ color: 'var(--danger)' }} />}
        <span>{username} {isLocal ? '(You)' : ''}</span>
      </div>
    </div>
  );
};

export const VideoGrid: React.FC<VideoGridProps> = ({
  localStream,
  localUsername,
  localAudioMuted,
  localVideoMuted,
  peers,
}) => {
  // Count total participants (local user + peers)
  const totalParticipants = 1 + peers.length;

  // Determine grid template columns based on participant count
  const getGridLayout = () => {
    if (totalParticipants === 1) return { gridTemplateColumns: '1fr' };
    if (totalParticipants === 2) return { gridTemplateColumns: '1fr 1fr' };
    if (totalParticipants <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    return { gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' };
  };

  return (
    <div className="video-grid" style={getGridLayout()}>
      {/* Local Video */}
      <VideoPlayer
        stream={localStream}
        username={localUsername}
        isLocal={true}
        audioMuted={localAudioMuted}
        videoMuted={localVideoMuted}
      />

      {/* Remote Peers Videos */}
      {peers.map((peer) => (
        <VideoPlayer
          key={peer.socketId}
          stream={peer.stream}
          username={peer.username}
          isLocal={false}
          audioMuted={peer.audioMuted || false}
          videoMuted={peer.videoMuted || false}
        />
      ))}
    </div>
  );
};
