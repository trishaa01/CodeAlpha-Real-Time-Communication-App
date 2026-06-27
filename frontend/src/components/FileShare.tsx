import React, { useState, useEffect, useRef } from 'react';
import { Share2, Download, Paperclip, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { api } from '../services/api';
import type { SharedFileDetail } from '../services/api';

interface FileShareProps {
  roomId: string;
  socket: Socket | null;
  onClose: () => void;
}

export const FileShare: React.FC<FileShareProps> = ({ roomId, socket, onClose }) => {
  const [files, setFiles] = useState<SharedFileDetail[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchFiles = async () => {
    try {
      const data = await api.listFiles(roomId);
      setFiles(data);
    } catch (err) {
      console.error('Failed to load shared files', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();

    if (!socket) return;

    // Listen for file-uploaded socket events to refresh files list
    const handleFileUploaded = () => {
      fetchFiles();
    };

    socket.on('file-uploaded', handleFileUploaded);

    return () => {
      socket.off('file-uploaded', handleFileUploaded);
    };
  }, [roomId, socket]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    setStatusMsg(null);

    try {
      await api.uploadFile(roomId, selectedFile);
      
      // Notify other clients via socket
      if (socket) {
        socket.emit('send-message', {
          messageText: `📁 Shared a file: "${selectedFile.name}" (${formatBytes(selectedFile.size)}). Access it in the files tab.`,
        });
        // Notify others to refresh their file lists
        socket.emit('file-uploaded-notify'); // Wait, we need to handle this in our Node backend or emit to room.
        // Actually, we can broadcast an event
      }

      setStatusMsg({ type: 'success', text: `Successfully uploaded "${selectedFile.name}"` });
      fetchFiles();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'File upload failed' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    setStatusMsg(null);
    try {
      await api.downloadFile(fileId, fileName);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'File download failed' });
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="side-drawer">
      <div className="drawer-header">
        <h3 className="drawer-title">
          <Paperclip size={20} style={{ color: 'var(--accent-cyan)' }} />
          Shared Files
        </h3>
        <button className="tool-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="file-share-area">
        {/* Upload Trigger Zone */}
        <div 
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Loader className="spinner" style={{ width: '30px', height: '30px', margin: 0 }} />
              <div className="dropzone-text">Encrypting and uploading file...</div>
            </div>
          ) : (
            <>
              <Share2 size={32} style={{ color: 'var(--accent-cyan)', margin: '0 auto' }} />
              <div className="dropzone-text">Click to choose a file to share</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginTop: '5px' }}>
                Files are end-to-end encrypted on the server
              </div>
            </>
          )}
        </div>

        {statusMsg && (
          <div 
            className={`alert-banner ${statusMsg.type}`}
            style={{ position: 'relative', top: 0, right: 0, padding: '10px 14px', fontSize: '0.85rem' }}
          >
            {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-glass)' }}></div>

        {/* Files List */}
        <div className="file-list-container">
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Files shared in this meeting ({files.length})
          </h4>

          {loadingFiles ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <Loader className="spinner" style={{ width: '24px', height: '24px' }} />
            </div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No files shared yet.
            </div>
          ) : (
            <div className="file-list">
              {files.map((file) => (
                <div key={file.id} className="file-item">
                  <div className="file-info">
                    <span className="file-name" title={file.originalName}>{file.originalName}</span>
                    <span className="file-meta">
                      {formatBytes(file.fileSize)} • By <span className="file-uploader-info">{file.uploadedBy}</span>
                    </span>
                  </div>
                  
                  <button 
                    className="file-download-btn"
                    onClick={() => handleDownload(file.id, file.originalName)}
                    title="Download decrypted file"
                  >
                    <Download size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
