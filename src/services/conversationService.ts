import { dynamoDb } from '@/lib/dynamodb'
import { PutCommand, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { Conversation } from '@/types/database'

interface CreateConversationInput {
  type: 'DM' | 'GROUP'
  name?: string
  description?: string
  participants: string[]
  createdBy: string
  avatar?: string
}

export const conversationService = {
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString()
    
    const conversation: Conversation = {
      conversationId: crypto.randomUUID(),
      type: input.type,
      name: input.name || null,
      description: input.description || null,
      participants: input.participants,
      admins: input.type === 'GROUP' ? [input.createdBy] : [], // Creator is admin for groups
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      avatar: input.avatar || null,
    }

    console.log('Creating conversation:', conversation)

    await dynamoDb.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_CONVERSATIONS_TABLE,
        Item: conversation,
      })
    )
    console.log('Conversation successfully saved to DynamoDB')

    return conversation
  },

  async getConversation(conversationId: string): Promise<Conversation | null> {
    console.log('Fetching conversation with ID:', conversationId)

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_CONVERSATIONS_TABLE,
        Key: { conversationId },
      })
    )

    console.log('Fetched conversation:', result.Item)

    return (result.Item as Conversation) || null
  },

  async listConversations(userId: string): Promise<Conversation[]> {
    console.log('Listing conversations for userId:', userId)

    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: process.env.DYNAMODB_CONVERSATIONS_TABLE,
        FilterExpression: 'contains(participants, :userId)',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    )

    console.log('All items from scan:', result.Items)
    console.log('Total conversations found:', result.Items?.length || 0)

    return (result.Items as Conversation[]) || []
  },

  async updateLastMessage(conversationId: string, timestamp: string): Promise<void> {
    console.log('Updating last message for conversation:', conversationId, 'to', timestamp)

    await dynamoDb.send(
      new UpdateCommand({
        TableName: process.env.DYNAMODB_CONVERSATIONS_TABLE,
        Key: { conversationId },
        UpdateExpression: 'SET lastMessageAt = :timestamp, updatedAt = :now',
        ExpressionAttributeValues: {
          ':timestamp': timestamp,
          ':now': new Date().toISOString(),
        },
      })
    )

    console.log('Last message updated successfully')
  },
}
