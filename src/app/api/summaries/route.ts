/**
 * API Route: /api/summaries
 *
 * POST - Generate AI summary for a conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/api-auth'
import { summaryService } from '@/services/summaryService'
import { conversationService } from '@/services/conversationService'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await getAuthenticatedUser()

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { conversationId, startTime, endTime } = body

    // Validate required fields
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      )
    }

    console.log(`[API] Generating summary for conversation ${conversationId} (user: ${auth.userId})`)

    // Verify user is a participant in the conversation
    const conversation = await conversationService.getConversation(conversationId)

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const isParticipant = conversation.participants.includes(auth.userId)

    if (!isParticipant) {
      console.warn(`[API] User ${auth.userId} attempted to access conversation ${conversationId} without permission`)
      return NextResponse.json(
        { success: false, error: 'You are not a participant in this conversation' },
        { status: 403 }
      )
    }

    // Generate summary
    const summary = await summaryService.generateSummary({
      conversationId,
      startTime,
      endTime,
      userId: auth.userId,
    })

    console.log(
      `[API] Summary generated successfully (${summary.messageCount} messages, cached: ${summary.cached})`
    )

    // Return success response
    return NextResponse.json({
      success: true,
      summary: summary.summary,
      messageCount: summary.messageCount,
      cached: summary.cached,
      generatedAt: summary.generatedAt,
    })
  } catch (error) {
    console.error('[API] Summary generation error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary'

    // Handle specific errors
    if (errorMessage.includes('No messages found')) {
      return NextResponse.json(
        { success: false, error: 'No messages found in the specified time range' },
        { status: 404 }
      )
    }

    if (errorMessage.includes('Insufficient messages')) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }

    if (errorMessage.includes('Failed to generate summary with AI')) {
      return NextResponse.json(
        { success: false, error: 'AI service is currently unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
