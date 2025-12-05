/**
 * SummaryButton Component
 *
 * Displays a button to generate AI-powered conversation summaries.
 * Shows loading state, error handling, and formatted summary display.
 */

'use client'

import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, X } from 'lucide-react'

interface SummaryButtonProps {
  conversationId: string
  onSummaryGenerated?: (summary: string) => void
}

interface SummaryMetadata {
  messageCount: number
  cached: boolean
  generatedAt: string
}

export function SummaryButton({ conversationId, onSummaryGenerated }: SummaryButtonProps) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<SummaryMetadata | null>(null)

  const generateSummary = async () => {
    setLoading(true)
    setError(null)
    setSummary(null)
    setMetadata(null)

    try {
      const response = await fetch('/api/summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          // Optional: Add time range filters here
          // startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
          // endTime: new Date().toISOString(),
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate summary')
      }

      setSummary(data.summary)
      setMetadata({
        messageCount: data.messageCount,
        cached: data.cached,
        generatedAt: data.generatedAt,
      })

      // Call optional callback
      if (onSummaryGenerated) {
        onSummaryGenerated(data.summary)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      console.error('[SummaryButton] Error generating summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const closeSummary = () => {
    setSummary(null)
    setMetadata(null)
    setError(null)
  }

  return (
    <div className="w-full">
      {/* Generate Button */}
      {!summary && !loading && !error && (
        <button
          onClick={generateSummary}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#00376f] text-white rounded-lg hover:bg-[#0052A3] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate AI Summary</span>
        </button>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-blue-900">Generating summary with Claude AI...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-start justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Failed to generate summary</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={closeSummary}
            className="text-red-600 hover:text-red-800 transition-colors"
            aria-label="Close error"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Summary Display */}
      {summary && metadata && !loading && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/50 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">AI Summary</h3>
              {metadata.cached && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  Cached
                </span>
              )}
            </div>
            <button
              onClick={closeSummary}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close summary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Summary Content */}
          <div className="p-4">
            <div className="prose prose-sm max-w-none">
              <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{summary}</div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-blue-200 text-xs text-gray-600">
              <span>{metadata.messageCount} messages analyzed</span>
              <span>•</span>
              <span>Generated {new Date(metadata.generatedAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-3 bg-white/50 border-t border-blue-200 flex gap-2">
            <button
              onClick={generateSummary}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
