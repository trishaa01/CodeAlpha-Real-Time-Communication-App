import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, PhoneOff, 
  MessageSquare, Paperclip, Edit3, Users, Copy, Check
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { api, getTokens } from '../services/api';
import { VideoGrid } from '../components/VideoGrid';
import { Chat } from '../components/Chat';
import { FileShare } from '../components/FileShare';
import { Whiteboard } from '../components/Whiteboard';

const SIGNAL_SERVER_URL = 'http://localhost:5000'; // Node signaling server URL

interface PeerStream {
  socketId: string;
  userId: string;
  username: string;
  stream: MediaStream | null;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // User details
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('Workspace Room');
  
  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Connection states
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peers, setPeers] = useState<PeerStream[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Panels visibility
  const [showChat, setShowChat] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Refs for WebRTC coordination
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const pendingCandidatesRef = useRef<{ [socketId: string]: RTCIceCandidateInit[] }>({});
  const socketRef = useRef<Socket | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // 1. Check Authentication
    if (!getTokens()) {
      navigate('/auth');
      return;
    }

    const startRoom = async () => {
      try {
        // 2. Load User Profile and verify room
        const profile = await api.getProfile();
        setUserId(profile.id.toString());
        setUsername(profile.username);

        if (!roomId) throw new Error('No Room ID provided');
        const roomData = await api.verifyRoom(roomId);
        setRoomName(roomData.name);

        // 3. Request User Media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        // 4. Initialize Signaling Socket
        const newSocket = io(SIGNAL_SERVER_URL);
        setSocket(newSocket);
        socketRef.current = newSocket;

        // 5. Setup WebRTC & Socket Event Listeners
        setupSocketListeners(newSocket, profile.id.toString(), profile.username);

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to access camera/microphone or connect to server');
        setLoading(false);
      }
    };

    startRoom();

    // Clean up on component unmount
    return () => {
      // Clean up media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};

      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, navigate]);

  const setupSocketListeners = (socket: Socket, uId: string, uName: string) => {
    // Join Room
    socket.emit('join-room', { roomId, userId: uId, username: uName });

    // Handle existing users in the room
    socket.on('all-users-in-room', (otherUsers: { socketId: string; userId: string; username: string }[]) => {
      console.log('Existing users in room:', otherUsers);
      
      otherUsers.forEach((user) => {
        // Create offer to each existing peer
        const pc = createPeerConnection(user.socketId, user.userId, user.username);
        
        // Add local tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });
        }

        // Send offer
        pc.createOffer()
          .then((offer) => {
            return pc.setLocalDescription(offer);
          })
          .then(() => {
            socket.emit('send-signal', {
              targetSocketId: user.socketId,
              signalData: { sdp: pc.localDescription }
            });
          })
          .catch((err) => console.error('Error creating offer:', err));
      });
    });

    // Handle new user joining the room
    socket.on('user-joined', ({ socketId, userId: remoteUId, username: remoteUName }) => {
      console.log('User joined:', remoteUName);
      
      // Create connection shell for the newcomer (they will send us an offer)
      createPeerConnection(socketId, remoteUId, remoteUName);
      
      // Push peer stub to UI state
      setPeers((prev) => {
        if (prev.some(p => p.socketId === socketId)) return prev;
        return [...prev, { socketId, userId: remoteUId, username: remoteUName, stream: null }];
      });
    });

    // Handle incoming WebRTC signals
    socket.on('receive-signal', async ({ senderSocketId, signalData, senderUsername, senderUserId }) => {
      let pc = peerConnectionsRef.current[senderSocketId];
      if (!pc) {
        pc = createPeerConnection(senderSocketId, senderUserId, senderUsername);
      }

      if (signalData.sdp) {
        const desc = new RTCSessionDescription(signalData.sdp);
        
        if (desc.type === 'offer') {
          // Set remote description and send answer
          try {
            await pc.setRemoteDescription(desc);
            
            // Attach local tracks
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => {
                // Check if already added
                const senders = pc.getSenders();
                const exists = senders.some(s => s.track === track);
                if (!exists) {
                  pc.addTrack(track, localStreamRef.current!);
                }
              });
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            socket.emit('send-signal', {
              targetSocketId: senderSocketId,
              signalData: { sdp: pc.localDescription }
            });

            // Process any buffered candidate signals
            processPendingCandidates(senderSocketId, pc);
          } catch (err) {
            console.error('Error handling offer:', err);
          }
        } else if (desc.type === 'answer') {
          try {
            await pc.setRemoteDescription(desc);
            // Process buffered candidate signals
            processPendingCandidates(senderSocketId, pc);
          } catch (err) {
            console.error('Error setting remote description from answer:', err);
          }
        }
      } else if (signalData.candidate) {
        const candidate = new RTCIceCandidate(signalData.candidate);
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        } else {
          // Queue the candidate until description is set
          if (!pendingCandidatesRef.current[senderSocketId]) {
            pendingCandidatesRef.current[senderSocketId] = [];
          }
          pendingCandidatesRef.current[senderSocketId].push(signalData.candidate);
        }
      }
    });

    // Handle peer disconnecting
    socket.on('user-disconnected', ({ socketId, username: disconnectedUsername }) => {
      console.log('User disconnected:', disconnectedUsername);
      
      if (peerConnectionsRef.current[socketId]) {
        peerConnectionsRef.current[socketId].close();
        delete peerConnectionsRef.current[socketId];
      }
      
      if (pendingCandidatesRef.current[socketId]) {
        delete pendingCandidatesRef.current[socketId];
      }

      setPeers((prev) => prev.filter(p => p.socketId !== socketId));
    });
  };

  const createPeerConnection = (socketId: string, _remoteUId: string, remoteUName: string) => {
    if (peerConnectionsRef.current[socketId]) {
      return peerConnectionsRef.current[socketId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[socketId] = pc;

    // Send local candidates to the remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('send-signal', {
          targetSocketId: socketId,
          signalData: { candidate: event.candidate }
        });
      }
    };

    // Receive remote tracks
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteUName}:`, event.streams[0]);
      
      setPeers((prev) => {
        return prev.map((p) => {
          if (p.socketId === socketId) {
            return { ...p, stream: event.streams[0] };
          }
          return p;
        });
      });
    };

    return pc;
  };

  const processPendingCandidates = async (socketId: string, pc: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current[socketId];
    if (!candidates) return;

    for (const rawCandidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(rawCandidate));
      } catch (err) {
        console.error('Error adding buffered candidate:', err);
      }
    }
    delete pendingCandidatesRef.current[socketId];
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioMuted(!audioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoMuted(!videoMuted);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      
      // Revert to camera
      try {
        const freshCameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = freshCameraStream.getVideoTracks()[0];
        
        // Update local tracks in peer connections
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          }
        });

        // Update local stream state
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
          }
          localStreamRef.current.addTrack(videoTrack);
        }

        // Force react update
        setLocalStream(new MediaStream(localStreamRef.current!.getTracks()));
        setIsScreenSharing(false);
      } catch (e) {
        console.error('Error recovering camera track:', e);
      }
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        // Listen for user stopping screen share via native browser bar
        screenTrack.onended = () => {
          toggleScreenShare(); // Switch back to camera
        };

        // Replace track on all Peer Connections
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        // Update local stream tracks
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            localStreamRef.current.removeTrack(oldVideoTrack);
            oldVideoTrack.stop(); // Stop camera sensor
          }
          localStreamRef.current.addTrack(screenTrack);
        }

        // Force react update
        setLocalStream(new MediaStream(localStreamRef.current!.getTracks()));
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  };

  const handleLeaveCall = () => {
    navigate('/dashboard');
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <h2>Setting up your meeting environment...</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Please allow access to your camera and microphone</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-overlay">
        <div className="user-avatar" style={{ background: 'var(--danger)', marginBottom: '20px', width: '60px', height: '60px', borderRadius: '16px' }}>
          <PhoneOff size={28} />
        </div>
        <h2>Connection Error</h2>
        <p style={{ color: 'var(--danger)', marginTop: '8px', maxWidth: '400px', textAlign: 'center' }}>{error}</p>
        <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="room-container">
      {/* Background Glowing Orbs */}
      <div className="glow-orbs">
        <div className="orb orb-1" style={{ opacity: 0.08 }}></div>
        <div className="orb orb-2" style={{ opacity: 0.08 }}></div>
      </div>

      <div className="main-call-area">
        {/* Top Header Room Info */}
        <header className="room-bar">
          <div className="room-info">
            <h2 className="room-title">{roomName}</h2>
            <div className="room-id-badge" onClick={copyRoomId}>
              {roomId} {copied ? <Check size={12} style={{ color: 'var(--success)', marginLeft: '4px' }} /> : <Copy size={12} style={{ marginLeft: '4px' }} />}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {1 + peers.length} Connected
            </span>
          </div>
        </header>

        {/* Video Canvas Stage */}
        <div className="stage-container">
          {showWhiteboard ? (
            <Whiteboard socket={socket} onClose={() => setShowWhiteboard(false)} />
          ) : (
            <VideoGrid
              localStream={localStream}
              localUsername={username}
              localAudioMuted={audioMuted}
              localVideoMuted={videoMuted}
              peers={peers}
            />
          )}
        </div>

        {/* Bottom Control Bar */}
        <footer className="control-bar">
          <button 
            className={`control-circle-btn ${audioMuted ? 'off' : ''}`} 
            onClick={toggleMic}
            title={audioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {audioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button 
            className={`control-circle-btn ${videoMuted ? 'off' : ''}`} 
            onClick={toggleVideo}
            title={videoMuted ? 'Turn camera on' : 'Turn camera off'}
          >
            {videoMuted ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {!showWhiteboard && (
            <button 
              className={`control-circle-btn ${isScreenSharing ? 'active' : ''}`} 
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
            >
              <Monitor size={20} />
            </button>
          )}

          <div style={{ width: '1px', height: '35px', backgroundColor: 'var(--border-glass)' }}></div>

          <button 
            className={`control-circle-btn ${showWhiteboard ? 'active' : ''}`} 
            onClick={() => {
              setShowWhiteboard(!showWhiteboard);
              setShowChat(false);
              setShowFiles(false);
            }}
            title="Whiteboard"
          >
            <Edit3 size={20} />
          </button>

          <button 
            className={`control-circle-btn ${showChat ? 'active' : ''}`} 
            onClick={() => {
              setShowChat(!showChat);
              setShowFiles(false);
            }}
            title="Toggle chat drawer"
          >
            <MessageSquare size={20} />
          </button>

          <button 
            className={`control-circle-btn ${showFiles ? 'active' : ''}`} 
            onClick={() => {
              setShowFiles(!showFiles);
              setShowChat(false);
            }}
            title="Toggle files shared drawer"
          >
            <Paperclip size={20} />
          </button>

          <div style={{ width: '1px', height: '35px', backgroundColor: 'var(--border-glass)' }}></div>

          <button 
            className="control-circle-btn off" 
            onClick={handleLeaveCall}
            title="Leave room"
          >
            <PhoneOff size={20} />
          </button>
        </footer>
      </div>

      {/* Slide-out Drawers */}
      {showChat && (
        <Chat
          socket={socket}
          userId={userId}
          onClose={() => setShowChat(false)}
        />
      )}

      {showFiles && roomId && (
        <FileShare
          roomId={roomId}
          socket={socket}
          onClose={() => setShowFiles(false)}
        />
      )}
    </div>
  );
};
