import React, { useRef, useState, useEffect } from 'react';
import { Palette, Trash, RefreshCw } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface WhiteboardProps {
  socket: Socket | null;
  onClose: () => void;
}

interface StrokeData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ socket, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  
  // Track previous coordinates for drawing continuous lines
  const prevCoordRef = useRef<{ x: number; y: number } | null>(null);

  const colors = [
    '#000000', // Black
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
  ];

  // Set up canvas sizes and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      // Save content before resize
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      // Resize
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      // Draw background
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Restore content scaled
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial background paint
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Listen to remote drawings
  useEffect(() => {
    if (!socket) return;

    const handleReceiveStroke = (data: StrokeData) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Map normalized coordinates back to pixels
      const x0 = data.x0 * canvas.width;
      const y0 = data.y0 * canvas.height;
      const x1 = data.x1 * canvas.width;
      const y1 = data.y1 * canvas.height;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = data.color;
      ctx.lineWidth = data.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    const handleClearWhiteboard = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    socket.on('receive-stroke', handleReceiveStroke);
    socket.on('clear-whiteboard', handleClearWhiteboard);

    return () => {
      socket.off('receive-stroke', handleReceiveStroke);
      socket.off('clear-whiteboard', handleClearWhiteboard);
    };
  }, [socket]);

  const draw = (x0: number, y0: number, x1: number, y1: number, strokeColor: string, strokeWidth: number, emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (emit && socket) {
      // Send normalized coordinates (0 to 1) to handle different resolutions on other peers
      socket.emit('draw-stroke', {
        x0: x0 / canvas.width,
        y0: y0 / canvas.height,
        x1: x1 / canvas.width,
        y1: y1 / canvas.height,
        color: strokeColor,
        width: strokeWidth,
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set drawing state
    setIsDrawing(true);
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    prevCoordRef.current = { x, y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !prevCoordRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const drawColor = isEraser ? '#ffffff' : color;
    const drawWidth = isEraser ? 20 : brushWidth;

    draw(prevCoordRef.current.x, prevCoordRef.current.y, x, y, drawColor, drawWidth);

    prevCoordRef.current = { x, y };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    prevCoordRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (socket) {
      socket.emit('clear-whiteboard');
    }
  };

  return (
    <div className="whiteboard-stage glass-panel">
      <div className="whiteboard-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Palette size={20} style={{ color: 'var(--accent-purple)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>Whiteboard Workspace</span>
        </div>

        <div className="whiteboard-tools">
          {/* Colors */}
          <div className="tool-group">
            {colors.map((c) => (
              <div
                key={c}
                className={`color-dot ${color === c && !isEraser ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
              />
            ))}
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-glass)' }}></div>

          {/* Tools */}
          <div className="tool-group">
            <button
              className={`tool-btn ${isEraser ? 'active' : ''}`}
              onClick={() => setIsEraser(true)}
              title="Eraser"
            >
              <Trash size={18} />
            </button>

            <button
              className="tool-btn"
              onClick={clearCanvas}
              title="Clear Canvas"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-glass)' }}></div>

          {/* Width */}
          <div className="tool-group">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Brush: {brushWidth}px</span>
            <input
              type="range"
              min="1"
              max="20"
              className="brush-slider"
              value={brushWidth}
              onChange={(e) => setBrushWidth(parseInt(e.target.value))}
              disabled={isEraser}
            />
          </div>
        </div>

        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={onClose}>
          Close Board
        </button>
      </div>

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>
    </div>
  );
};
