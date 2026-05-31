import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  tag: 'ok' | 'err' | 'info';
}

declare global {
  interface Window {
    pywebview?: {
      api: {
        selectFiles: () => Promise<string[]>;
        startUpload: (filePaths: string[]) => Promise<boolean>;
        clearState: () => Promise<void>;
        copyToClipboard: (text: string) => Promise<void>;
        getApiKey: () => Promise<string>;
        saveApiKey: (key: string) => Promise<boolean>;
      };
    };
    onUploadProgress?: (progress: number, label: string) => void;
    onLog?: (msg: string, tag: 'ok' | 'err' | 'info') => void;
    onBatchComplete?: (urls: string[], postLink?: string) => void;
    onUploadDone?: (ok: number, total: number, timeStr: string) => void;
  }
}

const BATCH_SIZE = 19;

// Helper to get filename from full path
const getFilename = (path: string) => {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1];
};

// Formats native file paths to valid local file:/// URLs
const getFileUrl = (path: string) => {
  const formatted = path.replace(/\\/g, '/');
  return `file:///${formatted}`;
};

export default function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [postLink, setPostLink] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  
  // Interactive Modal Zoom states
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Set up WebView bridges
  useEffect(() => {
    window.onUploadProgress = (prog: number, label: string) => {
      setProgress(prog);
      setProgressLabel(label);
    };

    window.onLog = (msg: string, tag: 'ok' | 'err' | 'info') => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          time: timeStr,
          msg,
          tag,
        },
      ]);
    };

    window.onBatchComplete = (urls: string[], currentPostLink?: string) => {
      if (urls && urls.length > 0) {
        setUploadedUrls((prev) => [...prev, ...urls]);
      }
      if (currentPostLink) {
        setPostLink(currentPostLink);
      }
    };

    window.onUploadDone = () => {
      setIsUploading(false);
    };

    // Load initial API key from backend if available
    const loadInitialApiKey = async () => {
      try {
        if (window.pywebview?.api?.getApiKey) {
          const key = await window.pywebview.api.getApiKey();
          if (key) setApiKey(key);
        } else {
          // Fallback simulation in dev mode
          setApiKey('');
        }
      } catch (err) {
        console.error("Failed to load API key", err);
      }
    };

    if (window.pywebview) {
      loadInitialApiKey();
    } else {
      window.addEventListener('pywebviewready', loadInitialApiKey);
    }

    // System initialized log
    addSystemLog('System ready. Previews and reordering loaded.', 'info');

    return () => {
      delete window.onUploadProgress;
      delete window.onLog;
      delete window.onBatchComplete;
      delete window.onUploadDone;
      window.removeEventListener('pywebviewready', loadInitialApiKey);
    };
  }, []);

  const addSystemLog = (msg: string, tag: 'ok' | 'err' | 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        msg,
        tag,
      },
    ]);
  };

  // Reordering controls
  const moveImage = (index: number, direction: 'prev' | 'next') => {
    if (isUploading) return;
    const newFiles = [...files];
    const targetIndex = direction === 'prev' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= files.length) return;
    
    // Swap array items
    const temp = newFiles[index];
    newFiles[index] = newFiles[targetIndex];
    newFiles[targetIndex] = temp;
    
    setFiles(newFiles);
    
    // Clear any previous batch upload outputs
    setUploadedUrls([]);
    setPostLink(null);
    setProgress(0);
    setProgressLabel('');
    
    addSystemLog(`Moved ${getFilename(temp)} to position ${targetIndex + 1}.`, 'info');
  };

  // Modal Zoom handlers
  const handleZoom = (type: 'in' | 'out' | 'reset') => {
    if (type === 'in') setZoomScale((prev) => Math.min(5, prev + 0.25));
    if (type === 'out') setZoomScale((prev) => Math.max(0.5, prev - 0.25));
    if (type === 'reset') setZoomScale(1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomScale((prev) => Math.min(5, Math.max(0.5, prev + delta)));
  };

  const handlePrevPreview = () => {
    if (previewIndex === null || previewIndex <= 0) return;
    setPreviewIndex(previewIndex - 1);
    setZoomScale(1);
  };

  const handleNextPreview = () => {
    if (previewIndex === null || previewIndex >= files.length - 1) return;
    setPreviewIndex(previewIndex + 1);
    setZoomScale(1);
  };

  // Backend Calls
  const handleSelectFiles = async () => {
    if (isUploading) return;
    try {
      if (window.pywebview?.api) {
        const selected = await window.pywebview.api.selectFiles();
        if (selected && selected.length > 0) {
          setFiles(selected);
          setUploadedUrls([]);
          setPostLink(null);
          setProgress(0);
          setProgressLabel('');
        }
      } else {
        // Fallback for simple web browser testing
        addSystemLog('Native API not found. Simulating file select...', 'info');
        const mockFiles = [
          'C:\\Images\\photo_01.jpg',
          'C:\\Images\\photo_02.jpg',
          'C:\\Images\\photo_03.png',
        ];
        setFiles(mockFiles);
        addSystemLog(`Loaded ${mockFiles.length} mock images.`, 'ok');
      }
    } catch (err: any) {
      addSystemLog(`File selection error: ${err.message || err}`, 'err');
    }
  };

  const handleStartUpload = async () => {
    if (files.length === 0 || isUploading) return;
    setIsUploading(true);
    setUploadedUrls([]);
    setPostLink(null);
    setProgress(0);
    setProgressLabel('Starting upload...');
    
    try {
      if (window.pywebview?.api) {
        // Pass files state from React to Python to preserve user sorting order!
        await window.pywebview.api.startUpload(files);
      } else {
        // Simulating upload on browser dev server
        addSystemLog('Native API not found. Running simulated upload...', 'info');
        let done = 0;
        const total = files.length;
        const interval = setInterval(() => {
          done += 1;
          const pct = Math.round((done / total) * 100);
          window.onUploadProgress?.(pct, `Uploading ${done}/${total} images...`);
          window.onLog?.(`Uploaded: image_${done}.jpg`, 'ok');
          window.onBatchComplete?.([`https://imgchest.com/i/mockurl${done}`], done === total ? 'https://imgchest.com/p/mockpost123' : undefined);
          
          if (done === total) {
            clearInterval(interval);
            setIsUploading(false);
            addSystemLog('Upload sequence finished.', 'ok');
          }
        }, 1000);
      }
    } catch (err: any) {
      addSystemLog(`Upload error: ${err.message || err}`, 'err');
      setIsUploading(false);
    }
  };

  const handleClear = async () => {
    if (isUploading) return;
    try {
      if (window.pywebview?.api) {
        await window.pywebview.api.clearState();
      }
      setFiles([]);
      setUploadedUrls([]);
      setPostLink(null);
      setProgress(0);
      setProgressLabel('');
      setLogs([]);
      setPreviewIndex(null);
      addSystemLog('Workspace cleared.', 'info');
    } catch (err: any) {
      addSystemLog(`Clear error: ${err.message || err}`, 'err');
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    if (!text) return;
    try {
      if (window.pywebview?.api) {
        await window.pywebview.api.copyToClipboard(text);
        addSystemLog(`${label} copied to clipboard successfully.`, 'ok');
      } else {
        await navigator.clipboard.writeText(text);
        addSystemLog(`${label} copied (Web Clipboard).`, 'ok');
      }
    } catch (err: any) {
      addSystemLog(`Copy failed: ${err.message || err}`, 'err');
    }
  };

  const handleSaveApiKey = async () => {
    if (isUploading) return;
    setIsSavingKey(true);
    try {
      if (window.pywebview?.api?.saveApiKey) {
        const success = await window.pywebview.api.saveApiKey(apiKey);
        if (success) {
          addSystemLog('API Key updated and saved permanently.', 'ok');
        } else {
          addSystemLog('Failed to save API Key.', 'err');
        }
      } else {
        addSystemLog('API Key saved permanently (Simulated).', 'ok');
      }
    } catch (err: any) {
      addSystemLog(`Error saving API Key: ${err.message || err}`, 'err');
    } finally {
      setIsSavingKey(false);
    }
  };

  // Group files into batch arrays of size 19
  const fileBatches: string[][] = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    fileBatches.push(files.slice(i, i + BATCH_SIZE));
  }

  return (
    <div className="app-container">
      <div className="app-bg-glow" />
      
      {/* Sidebar Control Panel */}
      <div className="sidebar">
        <div className="brand">
          <h1 className="brand-title">IMGCHEST Uploader</h1>
          <p className="brand-subtitle">High-Fidelity Batch Engine</p>
        </div>

        {/* API Key Configuration Card */}
        <div className="card">
          <h2 className="card-title">Configuration API</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <label className="input-label" htmlFor="api-key-input" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Clé API ImgChest
            </label>
            <div className="input-wrapper">
              <input
                id="api-key-input"
                type={showApiKey ? 'text' : 'password'}
                className="input-field"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Entrez votre clé API"
                disabled={isUploading || isSavingKey}
              />
              <button
                type="button"
                className="btn-toggle-visibility"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? "Masquer la clé" : "Afficher la clé"}
              >
                {showApiKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={handleSaveApiKey}
            disabled={isUploading || isSavingKey || !apiKey.trim()}
          >
            {isSavingKey ? 'Enregistrement...' : 'Enregistrer Permanent'}
          </button>
        </div>

        {/* Action controls card */}
        <div className="card">
          <h2 className="card-title">Operations</h2>
          <div className="btn-group" style={{ marginBottom: '12px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleSelectFiles}
              disabled={isUploading}
            >
              Select Images
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleClear}
              disabled={isUploading}
            >
              Clear
            </button>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            onClick={handleStartUpload}
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Start Upload'}
          </button>
        </div>

        {/* Stats card */}
        <div className="card">
          <h2 className="card-title">Staging Stats</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-val">{files.length}</span>
              <span className="stat-label">Total Images</span>
            </div>
            <div className="stat-item">
              <span className="stat-val">{fileBatches.length}</span>
              <span className="stat-label">Batches (1 Post)</span>
            </div>
          </div>
        </div>

        {/* Progress tracker panel */}
        {(isUploading || progress > 0) && (
          <div className="card progress-container">
            <div className="progress-header">
              <span className="progress-status">{progressLabel || 'Processing...'}</span>
              <span className="progress-percent">{progress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Live Logs Card */}
        <div className="card log-panel">
          <h2 className="card-title">Console Logs</h2>
          <div className="log-container">
            {logs.map((log) => (
              <div key={log.id} className="log-entry">
                <span className="log-time">{log.time}</span>
                <span className={`log-tag-${log.tag}`}>
                  {log.tag === 'ok' ? '✓' : log.tag === 'err' ? '✗' : 'ℹ'}
                </span>{' '}
                <span className="log-msg">{log.msg}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Main stage Area */}
      <div className="main-stage">
        {/* Stage Header */}
        <div className="stage-header">
          <h2 className="stage-title">
            Staged Queue
            <span className="stage-indicator">
              {files.length > 0 ? `${uploadedUrls.length} / ${files.length} Done` : 'Empty'}
            </span>
          </h2>
        </div>

        {/* Post links box if finished or in progress */}
        {postLink && (
          <div className="card link-box">
            <h3 className="card-title link-title" style={{ marginBottom: '4px' }}>
              Generated Album Post
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              All uploaded batches have been unified into a single hidden post:
            </p>
            <div className="link-value-container">
              <div className="link-value">{postLink}</div>
              <button 
                className="btn-link-action"
                onClick={() => handleCopyToClipboard(postLink, 'Album Post Link')}
              >
                Copy Post
              </button>
            </div>
          </div>
        )}

        {/* Generated Single Image links box */}
        {uploadedUrls.length > 0 && (
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Individual Album URLs</h3>
              <button 
                className="btn-link-action"
                style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                onClick={() => handleCopyToClipboard(uploadedUrls.join('\n'), 'Individual URLs')}
              >
                Copy All URLs
              </button>
            </div>
            <div className="log-container" style={{ height: '110px', background: 'rgba(5, 8, 16, 0.3)', borderRadius: '6px' }}>
              {uploadedUrls.map((url, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>[{String(i + 1).padStart(3, '0')}]</span>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, marginLeft: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Queue file list or Empty stage */}
        {files.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <div className="empty-icon-shape" />
            </div>
            <p className="empty-text">
              No images currently in staging area.<br />
              Click <strong>Select Images</strong> on the left panel to stage image files.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {fileBatches.map((batch, batchIndex) => {
              const startIdx = batchIndex * BATCH_SIZE;
              // Check if entire batch is completed
              const isBatchDone = uploadedUrls.length >= startIdx + batch.length;
              
              return (
                <div 
                  key={batchIndex} 
                  className={`batch-group ${isBatchDone ? 'completed' : ''}`}
                >
                  <div className="batch-header">
                    <h3 className="batch-title">Batch {batchIndex + 1}</h3>
                    <span className="batch-count">
                      {batch.length} files • Range [{startIdx + 1} - {startIdx + batch.length}]
                    </span>
                  </div>
                  <div className="images-grid">
                    {batch.map((filePath, idx) => {
                      const absoluteIndex = startIdx + idx;
                      const isUploaded = absoluteIndex < uploadedUrls.length;
                      
                      return (
                        <div 
                          key={filePath} 
                          className={`image-card ${isUploaded ? 'uploaded' : ''}`}
                        >
                          <span className="image-index">
                            {String(absoluteIndex + 1).padStart(3, '0')}
                          </span>
                          
                          {/* Clicking the thumbnail container opens detail zoom modal */}
                          <div 
                            className="image-thumbnail-container"
                            onClick={() => {
                              setPreviewIndex(absoluteIndex);
                              setZoomScale(1);
                            }}
                          >
                            <img 
                              src={getFileUrl(filePath)} 
                              className="image-thumbnail" 
                              alt="thumb" 
                            />
                          </div>

                          <div className="image-info">
                            <span className="image-name">{getFilename(filePath)}</span>
                            <span className="image-meta">Staged</span>
                          </div>

                          {/* Reordering actions (prev / next arrows) */}
                          {!isUploading && (
                            <div className="reorder-actions">
                              <button
                                className="btn-reorder"
                                title="Move Forward"
                                onClick={() => moveImage(absoluteIndex, 'prev')}
                                disabled={absoluteIndex === 0}
                              >
                                ▲
                              </button>
                              <button
                                className="btn-reorder"
                                title="Move Backward"
                                onClick={() => moveImage(absoluteIndex, 'next')}
                                disabled={absoluteIndex === files.length - 1}
                              >
                                ▼
                              </button>
                            </div>
                          )}

                          <div className="image-status-dot" style={{ marginLeft: isUploading ? 'auto' : '6px' }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Glassmorphic Detail Zoom Modal */}
      {previewIndex !== null && files[previewIndex] && (
        <div 
          className="modal-overlay" 
          onClick={() => setPreviewIndex(null)}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close button */}
            <div 
              className="modal-close" 
              onClick={() => setPreviewIndex(null)}
              title="Close Preview"
            >
              ✕
            </div>

            {/* Navigation buttons inside overlay */}
            <button 
              className="modal-nav-btn modal-nav-prev"
              onClick={handlePrevPreview}
              disabled={previewIndex === 0}
              title="Previous Image"
            >
              ◀
            </button>
            <button 
              className="modal-nav-btn modal-nav-next"
              onClick={handleNextPreview}
              disabled={previewIndex === files.length - 1}
              title="Next Image"
            >
              ▶
            </button>

            {/* Modal Image Display and wheel-based zooming */}
            <div className="modal-image-container" onWheel={handleWheel}>
              <img 
                src={getFileUrl(files[previewIndex])} 
                className="modal-image" 
                alt="Zoomed Stage"
                style={{ transform: `scale(${zoomScale})` }}
              />
            </div>

            {/* Modal Title and toolbar */}
            <span className="modal-title" title={files[previewIndex]}>
              [{String(previewIndex + 1).padStart(3, '0')} / {files.length}] - {getFilename(files[previewIndex])}
            </span>

            <div className="modal-toolbar">
              <button className="modal-btn" onClick={() => handleZoom('in')}>Zoom +</button>
              <button className="modal-btn" onClick={() => handleZoom('reset')}>1:1 ({Math.round(zoomScale * 100)}%)</button>
              <button className="modal-btn" onClick={() => handleZoom('out')}>Zoom -</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
