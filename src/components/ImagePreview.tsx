import { useState, useEffect, useCallback } from "react";

interface ImagePreviewProps {
  filePath: string;
  projectRoot: string;
}

function relativeTo(from: string, to: string): string {
  const fromParts = from.split("/");
  const toParts = to.split("/");
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }
  return toParts.slice(common).join("/");
}

export function ImagePreview({ filePath, projectRoot }: ImagePreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const filename = filePath.split("/").pop()!;
  const relPath = relativeTo(projectRoot, filePath);

  useEffect(() => {
    setDataUrl(null);
    setError(null);
    setZoom(100);
    setNaturalSize(null);

    window.electronAPI.readImage(filePath).then((result) => {
      if ("error" in result) setError(result.error ?? "Unknown error");
      else setDataUrl(result.dataUrl);
    });
  }, [filePath]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  return (
    <div className="imgpreview">
      <div className="imgpreview-toolbar">
        <span className="imgpreview-filename" title={filePath}>{filename}</span>
        {naturalSize && (
          <span className="imgpreview-dimensions">{naturalSize.w} &times; {naturalSize.h}</span>
        )}
        <span className="imgpreview-path" title={relPath}>{relPath}</span>
        <div className="imgpreview-spacer" />
        <div className="imgpreview-zoom-controls">
          <button type="button" className="btn-icon" onClick={() => setZoom((z) => Math.max(25, z - 25))} aria-label="Zoom out" title="Zoom out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="imgpreview-zoom-level">{zoom}%</span>
          <button type="button" className="btn-icon" onClick={() => setZoom((z) => Math.min(400, z + 25))} aria-label="Zoom in" title="Zoom in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button type="button" className="btn-icon" onClick={() => setZoom(100)} aria-label="Reset zoom" title="Reset zoom">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        </div>
      </div>
      <div className="imgpreview-body">
        {error && (
          <div className="imgpreview-error">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {!dataUrl && !error && (
          <div className="imgpreview-loading">
            <div className="pdf-spinner" />
          </div>
        )}
        {dataUrl && (
          <div className="imgpreview-canvas">
            <img
              src={dataUrl}
              alt={filename}
              className="imgpreview-img"
              style={{ width: `${zoom}%`, maxWidth: `${zoom}%` }}
              onLoad={handleImageLoad}
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
