"use client";

import { useEditor } from "tldraw";
import { useState } from "react";
import { logDebug } from "@/lib/utils";
import jsPDF from 'jspdf';

interface ExportDialogProps {
  whiteboardId: string;
  onClose: () => void;
}

// Helper to trigger file download in the browser
function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ExportDialog({ whiteboardId, onClose }: ExportDialogProps) {
  const editor = useEditor();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: "svg" | "png" | "pdf") => {
    if (!editor) return;

    setIsLoading(true);
    setError(null);

    try {
      const svg = await editor.getSvg({
        scale: 1,
        background: true,
        padding: 32,
      });

      if (!svg) {
        throw new Error("Failed to generate SVG from whiteboard content.");
      }

      let dataUrl: string;
      const mimeType = format === 'svg' ? 'image/svg+xml' : (format === 'png' ? 'image/png' : 'application/pdf');
      const filename = `whiteboard-export-${whiteboardId}.${format}`;

      if (format === "svg") {
        const blob = new Blob([svg.outerHTML], { type: mimeType });
        dataUrl = URL.createObjectURL(blob);
        downloadDataUrl(dataUrl, filename); // SVG can be downloaded directly
        URL.revokeObjectURL(dataUrl);

      } else if (format === "png") {
        const image = new Image();
        const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        await new Promise<void>((resolve, reject) => {
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }
                ctx.drawImage(image, 0, 0);
                dataUrl = canvas.toDataURL('image/png');
                URL.revokeObjectURL(url);
                resolve();
            };
            image.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };
            image.src = url;
        });

      } else if (format === 'pdf') {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [svg.width.baseVal.value, svg.height.baseVal.value]
        });
        doc.html(svg.outerHTML, {
          callback: function (doc) {
            dataUrl = doc.output('datauristring');
          },
          x: 0,
          y: 0,
          width: svg.width.baseVal.value,
          height: svg.height.baseVal.value,
        });
      }

      // @ts-ignore
      if (format !== 'svg') {
        const response = await fetch("/api/whiteboards/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whiteboardId,
            format,
            // @ts-ignore
            dataUrl,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to upload exported file to S3.");
        }

        const result = await response.json();
        logDebug("Export uploaded to S3:", result.url);
        // We could use the S3 url, but for simplicity, we'll download the locally generated dataUrl
        // @ts-ignore
        downloadDataUrl(dataUrl, filename);
      }

      onClose();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An unknown error occurred during export.";
      setError(errorMsg);
      console.error("Export failed:", err);
    } finally {
      setIsLoading(false);
    }
  };
  

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3>Export Whiteboard</h3>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <div style={styles.buttonGroup}>
          <button onClick={() => handleExport("svg")} disabled={isLoading}>
            {isLoading ? "Exporting..." : "Export to SVG"}
          </button>
          <button onClick={() => handleExport("png")} disabled={isLoading}>
            {isLoading ? "Exporting..." : "Export to PNG"}
          </button>
          <button onClick={() => handleExport("pdf")} disabled={isLoading}>
            {isLoading ? "Exporting..." : "Export to PDF"}
          </button>
        </div>
        <button onClick={onClose} style={{ marginTop: "1rem" }} disabled={isLoading}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Basic styling for the modal
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "8px",
    minWidth: "300px",
    textAlign: "center",
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
};
