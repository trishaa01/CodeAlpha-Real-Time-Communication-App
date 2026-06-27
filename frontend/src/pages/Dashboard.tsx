import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, Users, LogOut, ArrowRight, AlertTriangle } from 'lucide-react';
import { api, getTokens, removeTokens, getUser, removeUser } from '../services/api';

export const Dashboard: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [joinRoomId, setJoinRoomId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getTokens()) {
      navigate('/auth');
      return;
    }
    const cachedUser = getUser();
    if (cachedUser) {
      setUsername(cachedUser);
    } else {
      // Get from API
      api.getProfile()
        .then(profile => {
          setUsername(profile.username);
        })
        .catch(() => {
          handleLogout();
        });
    }
  }, [navigate]);

  const handleLogout = () => {
    removeTokens();
    removeUser();
    navigate('/auth');
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const name = roomName.trim() || `${username}'s Workspace`;
      const room = await api.createRoom(name);
      navigate(`/room/${room.roomId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const roomId = joinRoomId.trim();
    if (!roomId) {
      setError('Please enter a room code.');
      setLoading(false);
      return;
    }

    try {
      const room = await api.verifyRoom(roomId);
      navigate(`/room/${room.roomId}`);
    } catch (err: any) {
      setError('Room not found or invalid room code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Background Glowing Orbs */}
      <div className="glow-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="user-avatar" style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
            <Video size={22} />
          </div>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}>NexLink</span>
        </div>
        
        <div className="user-profile">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Welcome, {username}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Workspace Account</div>
          </div>
          <div className="user-avatar">{username.slice(0, 2).toUpperCase()}</div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} title="Log out">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="alert-banner error" style={{ position: 'relative', top: 0, right: 0, margin: '0 auto 30px auto', maxWidth: '1000px', width: '100%' }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      <main className="dashboard-grid">
        {/* Create Room Card */}
        <div className="dashboard-card glass-panel">
          <div>
            <h2 className="card-title">
              <Plus size={24} style={{ color: 'var(--primary)' }} />
              Host a Meeting
            </h2>
            <p className="card-desc">
              Create a new secure collaboration session. You will be the host and can share the meeting code to invite others.
            </p>
          </div>
          
          <form onSubmit={handleCreateRoom}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Meeting Name (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Weekly Standup"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              Create Room <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Join Room Card */}
        <div className="dashboard-card glass-panel">
          <div>
            <h2 className="card-title">
              <Users size={24} style={{ color: 'var(--accent-cyan)' }} />
              Join a Meeting
            </h2>
            <p className="card-desc">
              Enter an existing meeting ID or room code (format: xxx-xxxx-xxx) to participate in a voice/video session.
            </p>
          </div>

          <form onSubmit={handleJoinRoom}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Room Code</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. abc-defg-hij"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-cyan" style={{ width: '100%' }} disabled={loading}>
              Join Room <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
