import { NextResponse } from 'next/server'
import { messageService } from '@/services/messageService'
import { conversationService } from '@/services/conversationService'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const message = await messageService.sendMessage({
      conversationId: body.conversationId,
      senderId: body.senderId,
      content: body.content,
      type: body.type || 'TEXT',
    })

    await conversationService.updateLastMessage(
      body.conversationId,
      message.timestamp
    )

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}