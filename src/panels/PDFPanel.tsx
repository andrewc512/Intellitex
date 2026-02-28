import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { CompileStatus, CompileError } from "../compiler/types";

// Configure the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PDFPanelProps {
  compileState: CompileStatus;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}

function ErrorRow({ err }: { err: CompileError }) {
  const isError = err.type === "error";
  return (
    <div className="pdf-error-row">
      <span
        className="pdf-error-type"
        style={{ color: isError ? "var(--error)" : "var(--warning)" }}
      >
        {isError ? "error" : "warning"}
      </span>
      {err.line != null && (
        <span className="pdf-error-line">l.{err.line}</span>
      )}
      <span className="pdf-error-msg">{err.message}</span>
    </div>
  );
}

function getInitialScale(): number {
  const w = window.screen.width;
  if (w <= 1440) return 1.0;
  if (w >= 2560) return 1.2;
  return Math.round((1.0 + 0.35 * (w - 1440) / (2560 - 1440)) * 100) / 100;
}

export function PDFPanel({ compileState, onMoveLeft, onMoveRight }: PDFPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(getInitialScale);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorsCollapsed, setErrorsCollapsed] = useState(false);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTasksRef = useRef<Map<number, { cancel: () => void }>>(new Map());

  const pdfPath =
    compileState.status === "done" && compileState.result.success
      ? compileState.result.pdfPath
      : null;

  const errors =
    compileState.status === "done"
      ? compileState.result.errors.filter((e) => e.type === "error")
      : [];
  const warnings =
    compileState.status === "done"
      ? compileState.result.errors.filter((e) => e.type === "warning")
      : [];

  // Load PDF when path changes
  useEffect(() => {
    if (!pdfPath) {
      setPdf(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const buffer = await window.electronAPI.readPDF(pdfPath);
        if (cancelled) return;

        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) {
          pdfDoc.destroy();
          return;
        }

        setPdf(pdfDoc);
        setCurrentPage(1);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfPath]);

  // Cleanup PDF on unmount
  useEffect(() => {
    return () => {
      pdf?.destroy();
    };
  }, [pdf]);

  // Render pages
  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      if (!pdf) return;

      // Cancel any existing render task for this page
      const existingTask = renderTasksRef.current.get(pageNum);
      if (existingTask) {
        existingTask.cancel();
      }

      try {
        const page: PDFPageProxy = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale * window.devicePixelRatio });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / window.devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / window.devicePixelRatio}px`;

        const context = canvas.getContext("2d");
        if (!context) return;

        const renderTask = page.render({
          canvasContext: context,
          viewport,
          canvas,
        });

        renderTasksRef.current.set(pageNum, renderTask);

        await renderTask.promise;
        renderTasksRef.current.delete(pageNum);
      } catch (err) {
        // Ignore cancelled render errors
        if (err instanceof Error && err.message.includes("cancelled")) return;
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    },
    [pdf, scale]
  );

  // Re-render all pages when scale changes
  useEffect(() => {
    if (!pdf) return;

    canvasRefs.current.forEach((canvas, pageNum) => {
      renderPage(pageNum, canvas);
    });
  }, [pdf, scale, renderPage]);

  // Handle scroll to track current page
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !pdf) return;

    const container = containerRef.current;
    const containerHeight = container.clientHeight;

    let currentPageInView = 1;
    let minDistance = Infinity;

    canvasRefs.current.forEach((canvas, pageNum) => {
      const rect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const pageTop = rect.top - containerRect.top;
      const pageMid = pageTop + rect.height / 2;
      const viewMid = containerHeight / 2;
      const distance = Math.abs(pageMid - viewMid);

      if (distance < minDistance) {
        minDistance = distance;
        currentPageInView = pageNum;
      }
    });

    setCurrentPage(currentPageInView);
  }, [pdf]);

  const ZOOM_STEPS = [0.25, 0.5, 0.75, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0];

  const zoomIn = () => setScale((s) => {
    const next = ZOOM_STEPS.find((z) => z > s + 0.001);
    return next ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  });
  const zoomOut = () => setScale((s) => {
    const prev = [...ZOOM_STEPS].reverse().find((z) => z < s - 0.001);
    return prev ?? ZOOM_STEPS[0];
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = 1 + Math.min(Math.abs(delta), 100) * 0.002;
      setScale((s) => {
        const next = delta > 0 ? s * factor : s / factor;
        return Math.min(Math.max(next, 0.25), 3);
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const statusLabel = () => {
    if (compileState.status === "idle") return null;
    if (compileState.status === "compiling") return "Compiling…";
    const { success } = compileState.result;
    if (success) return `Done — ${errors.length} errors, ${warnings.length} warnings`;
    return `Failed — ${errors.length} errors, ${warnings.length} warnings`;
  };

  const statusColor = () => {
    if (compileState.status === "compiling") return "var(--text-tertiary)";
    if (compileState.status === "done")
      return compileState.result.success ? "var(--success)" : "var(--error)";
    return "var(--text-tertiary)";
  };

  const hasErrors = compileState.status === "done" && !compileState.result.success;
  const hasAnyDiagnostics = compileState.status === "done" && compileState.result.errors.length > 0;

  return (
    <div className="panel" role="region" aria-label="PDF Preview">
      <div className="panel-header">
        <svg className="panel-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="panel-header-title">Preview</span>

        {statusLabel() && (
          <span style={{ color: statusColor(), marginLeft: "auto", fontSize: 12 }}>
            {statusLabel()}
          </span>
        )}

        <div className="panel-header-controls">
          {onMoveLeft && (
            <button className="btn-icon" type="button" onClick={onMoveLeft} aria-label="Move panel left" title="Move left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          {onMoveRight && (
            <button className="btn-icon" type="button" onClick={onMoveRight} aria-label="Move panel right" title="Move right">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          )}
        </div>

        <div className="pdf-toolbar" role="toolbar" aria-label="PDF controls">
          {pdf && (
            <span className="pdf-page-indicator">
              {currentPage} / {pdf.numPages}
            </span>
          )}
          <button
            className="btn-icon"
            type="button"
            onClick={zoomOut}
            disabled={!pdf || scale <= 0.25}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
          <button
            className="btn-icon"
            type="button"
            onClick={zoomIn}
            disabled={!pdf || scale >= 3}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="pdf-body" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* PDF Viewer */}
        <div
          ref={containerRef}
          className="pdf-viewer"
          onScroll={handleScroll}
          style={{
            flex: (hasErrors && !errorsCollapsed) ? "0 0 60%" : 1,
            overflow: "auto",
            background: "var(--bg-base)",
          }}
        >
          {/* Idle state */}
          {compileState.status === "idle" && (
            <div className="pdf-placeholder">
              <svg className="pdf-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="13" y2="17" />
                <line x1="8" y1="9" x2="11" y2="9" />
              </svg>
              <p className="pdf-placeholder-text">
                Compile your document to see a live preview here
              </p>
              <span className="pdf-placeholder-hint">
                <kbd className="kbd">⌘</kbd>
                <kbd className="kbd">B</kbd>
                <span>to compile</span>
              </span>
            </div>
          )}

          {/* Compiling state */}
          {compileState.status === "compiling" && (
            <div className="pdf-placeholder">
              <div className="pdf-spinner" />
              <p className="pdf-placeholder-text">Compiling…</p>
            </div>
          )}

          {/* Loading PDF */}
          {loading && (
            <div className="pdf-placeholder">
              <div className="pdf-spinner" />
              <p className="pdf-placeholder-text">Loading PDF…</p>
            </div>
          )}

          {/* Error loading PDF */}
          {error && (
            <div className="pdf-placeholder">
              <p className="pdf-placeholder-text" style={{ color: "var(--error)" }}>
                {error}
              </p>
            </div>
          )}

          {/* Compilation failed */}
          {compileState.status === "done" && !compileState.result.success && !pdf && (
            <div className="pdf-placeholder">
              <svg className="pdf-placeholder-icon" style={{ color: "var(--error)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="pdf-placeholder-text" style={{ color: "var(--error)" }}>
                Compilation failed — see errors below
              </p>
            </div>
          )}

          {/* PDF Pages */}
          {pdf && !loading && !error && (
            <div className="pdf-pages">
              {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} className="pdf-page-wrapper">
                  <canvas
                    ref={(el) => {
                      if (el) {
                        canvasRefs.current.set(pageNum, el);
                        renderPage(pageNum, el);
                      } else {
                        canvasRefs.current.delete(pageNum);
                      }
                    }}
                    className="pdf-page-canvas"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error list */}
        {hasAnyDiagnostics && (
          <div className={`pdf-errors ${errorsCollapsed ? "pdf-errors--collapsed" : ""}`}>
            <button
              className="pdf-errors-header"
              type="button"
              onClick={() => setErrorsCollapsed((c) => !c)}
              aria-expanded={!errorsCollapsed}
              aria-controls="pdf-errors-list"
            >
              <svg
                className={`pdf-errors-chevron ${errorsCollapsed ? "" : "pdf-errors-chevron--open"}`}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>
                {errors.length > 0 && `${errors.length} error${errors.length !== 1 ? "s" : ""}`}
                {errors.length > 0 && warnings.length > 0 && "  ·  "}
                {warnings.length > 0 && `${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`}
              </span>
            </button>
            {!errorsCollapsed && (
              <div className="pdf-errors-list" id="pdf-errors-list">
                {compileState.result.errors.map((err, i) => (
                  <ErrorRow key={i} err={err} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
