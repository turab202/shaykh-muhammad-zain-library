"use client";

import { useState } from "react";
import { Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText } from "lucide-react";

interface PDFViewerPlaceholderProps {
  title: string;
  pdfUrl?: string;
  totalPages?: number;
}

/**
 * PDF viewer placeholder — shows a styled placeholder until a real PDF viewer
 * (e.g. react-pdf or an iframe embed) is integrated.
 * Provides download button if a PDF URL is available.
 */
export function PDFViewerPlaceholder({ title, pdfUrl, totalPages = 1 }: PDFViewerPlaceholderProps) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  return (
    <div className="bg-[var(--bg-surface)] dark:bg-[var(--bg-surface)] border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
        <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 cursor-pointer transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="font-mono">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 cursor-pointer transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
          <button onClick={() => setZoom((z) => Math.max(50, z - 25))} className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer transition-colors" aria-label="Zoom out"><ZoomOut className="w-4 h-4" aria-hidden="true" /></button>
          <span className="font-mono w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom((z) => Math.min(200, z + 25))} className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 cursor-pointer transition-colors" aria-label="Zoom in"><ZoomIn className="w-4 h-4" aria-hidden="true" /></button>

          {pdfUrl && (
            <a
              href={pdfUrl}
              download
              className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-900 text-amber-100 hover:bg-emerald-800 transition-colors ms-2 text-[11px] font-semibold"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Download
            </a>
          )}
        </div>
      </div>

      {/* Page area */}
      <div
        className="flex items-center justify-center p-8 min-h-[400px] bg-stone-100 dark:bg-stone-900/50"
        style={{ fontSize: `${zoom}%` }}
      >
        <div className="w-full max-w-lg bg-white dark:bg-stone-900 shadow-lg rounded p-8 text-center space-y-4">
          <FileText className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto" aria-hidden="true" />
          <div>
            <p className="font-serif font-bold text-stone-800 dark:text-stone-200 text-sm">{title}</p>
            <p className="text-xs text-stone-400 mt-1">Page {page} of {totalPages}</p>
          </div>
          {pdfUrl ? (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              PDF viewer integration coming soon.{" "}
              <a href={pdfUrl} download className="text-emerald-700 dark:text-emerald-400 hover:underline">
                Download PDF
              </a>{" "}
              to read offline.
            </p>
          ) : (
            <p className="text-xs text-stone-400">No PDF file attached to this book yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
