"use client";

import { useEditor } from "tldraw";

import { useState } from "react";

import { logDebug } from "@/lib/utils";

import jsPDF from "jspdf";

import { toast } from "sonner";

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

// Helper to convert a blob to a data URL

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result as string);

    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });
}

export function ExportDialog({ whiteboardId, onClose }: ExportDialogProps) {
  const editor = useEditor();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: "svg" | "png" | "pdf") => {
    if (!editor) return;

    const shapeIds = Array.from(editor.getCurrentPageShapeIds());
    if (shapeIds.length === 0) {
      toast.error("There's nothing on the canvas to export.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let dataUrl: string;
      const filename = `whiteboard-export-${whiteboardId}.${format}`;

      if (format === "png") {
        const blob = await editor.toImage(shapeIds, {
          format: "png",
          scale: 2, // Higher resolution
          background: true,
          padding: 32,
        });
        if (!blob) throw new Error("Failed to generate PNG.");
        dataUrl = await blobToDataUrl(blob.blob);
        downloadDataUrl(dataUrl, filename);
      } else {
        // For SVG and PDF, we start with the SVG
        const blob = await editor.toImage(shapeIds, {
          format: "svg",
          background: true,
          padding: 32,
        });
        if (!blob) throw new Error("Failed to generate SVG.");

        const svgString = await blob.blob.text();
        const svgElement = new DOMParser().parseFromString(
          svgString,
          "image/svg+xml"
        ).documentElement;

        if (format === "svg") {
          dataUrl = await blobToDataUrl(blob.blob);
          downloadDataUrl(dataUrl, filename);
        } else {
          // PDF
          const doc = new jsPDF({
            orientation: "landscape",
            unit: "px",
            format: [svgElement.clientWidth, svgElement.clientHeight],
          });
          await doc.html(svgElement);
          dataUrl = doc.output("datauristring");
          downloadDataUrl(dataUrl, filename);
        }
      }

      // Upload to S3 (excluding direct SVG download)
      if (format !== "svg") {
        const response = await fetch("/api/whiteboards/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            whiteboardId,
            format,
            dataUrl,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to upload exported file to S3.");
        }

        const result = await response.json();
        logDebug("Export uploaded to S3:", result.url);
      }

      onClose();
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "An unknown error occurred during export.";
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
        <button
          onClick={onClose}
          style={{ marginTop: "1rem" }}
          disabled={isLoading}
        >
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
