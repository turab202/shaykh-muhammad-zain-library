"use client";

import React, { useState } from "react";
import { BookOpen, Download, ExternalLink, ChevronDown, ChevronUp, Maximize2 } from "lucide-react";

interface PdfViewerProps {
  pdfUrl: string;
  title: string;
  pdfSize?: string;
}

/**
 * Inline PDF viewer using the browser's native <iframe> PDF renderer.
 * Falls back gracefully on mobile where iframes don't render PDFs inline.
 */
export function PdfViewer({ pdfUrl, title, pdfSize }: PdfViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="h-1 bg-gradient-to-r from-amber-700 to-emerald-800" />

      <div className="p-4 sm:p-6">
        {/* Title + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                Book PDF
              </p>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate">
                {title}
              </p>
              {pdfSize && (
                <p className="text-xs text-stone-400 dark:text-stone-500">{pdfSize}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Open in new tab */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Open</span>
            </a>

            {/* Download */}
            <a
              href={pdfUrl}
              download={`${title}.pdf`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900 dark:bg-emerald-800 text-amber-100 text-xs font-medium hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download</span>
            </a>

            {/* Expand/collapse inline viewer */}
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
              title={isExpanded ? "Collapse viewer" : "Read inline"}
            >
              {isExpanded ? (
                <><ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /><span>Collapse</span></>
              ) : (
                <><Maximize2 className="w-3.5 h-3.5" aria-hidden="true" /><span>Read</span></>
              )}
            </button>
          </div>
        </div>

        {/* Inline PDF viewer — shown when expanded */}
        {isExpanded && (
          <div className="mt-2">
            {iframeError ? (
              /* Fallback for browsers/devices that can't render PDF in iframe */
              <div className="flex flex-col items-center justify-center py-12 px-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 text-center gap-4">
                <BookOpen className="w-12 h-12 text-stone-300 dark:text-stone-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    PDF preview not available in this browser
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                    Use the buttons above to open or download the PDF.
                  </p>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-900 text-amber-100 text-sm font-semibold hover:bg-emerald-800 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    Open PDF
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800">
                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                  title={`PDF: ${title}`}
                  className="w-full"
                  style={{ height: "80vh", minHeight: "500px" }}
                  onError={() => setIframeError(true)}
                  // Some browsers fire load even on error — check content type
                  onLoad={(e) => {
                    const frame = e.currentTarget;
                    try {
                      // If contentDocument is accessible but empty body → likely blocked
                      if (frame.contentDocument?.body?.innerHTML === "") {
                        setIframeError(true);
                      }
                    } catch {
                      // Cross-origin — that's fine, means PDF loaded from B2
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
