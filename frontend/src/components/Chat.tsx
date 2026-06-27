import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { Socket } from 'socket.io-client';

export interface ChatMessage {
  senderSocketId: string;
  userId: string;
  username: string;
  text: string;
  time: string;
}

interface ChatProps {
  socket: Socket | null;
  userId: string;
  onClose: () => void;
}

export const Chat: React.FC<ChatProps> = ({ socket, userId, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for new messages from signaling server
    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('new-message', handleNewMessage);

    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !inputMsg.trim()) return;

    // Emit the message
    socket.emit('send-message', {
      messageText: inputMsg.trim(),
      time: new Date().toISOString(),
    });

    setInputMsg('');
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="side-drawer">
      <div className="drawer-header">
        <h3 className="drawer-title">
          <MessageSquare size={20} style={{ color: 'var(--primary)' }} />
          Group Chat
        </h3>
        <button className="tool-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => {
          const isMe = msg.userId === userId;
          return (
            <div
              key={index}
              className={`chat-bubble-container ${isMe ? 'me' : 'other'}`}
            >
              {!isMe && <span className="chat-bubble-sender">{msg.username}</span>}
              <div className="chat-bubble">{msg.text}</div>
              <span className="chat-bubble-time">{formatTime(msg.time)}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          className="input-field"
          placeholder="Type message..."
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
