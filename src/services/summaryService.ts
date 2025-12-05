/**
 * Summary Service - AI-Powered Conversation Summaries
 *
 * Uses AWS Bedrock (Claude 3 Haiku) to generate intelligent summaries
 * of conversation messages with caching support.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { QueryCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { dynamoDb } from '@/lib/dynamodb'
import type { Message } from '@/types/database'

// Constants
const MESSAGES_TABLE = process.env.DYNAMODB_MESSAGES_TABLE || 'PantherKolab-Messages-dev'
const SUMMARIES_TABLE = 'PantherKolab-Summaries' // No -dev suffix per Jaem's setup
const MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0'
const TTL_DAYS = 7

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// TypeScript Interfaces
export interface SummaryRequest {
  conversationId: string
  startTime?: string // ISO timestamp
  endTime?: string // ISO timestamp
  userId: string // For authorization
}

export interface SummaryResult {
  summary: string
  messageCount: number
  cached: boolean
  generatedAt: string
  conversationId: string
}

interface CachedSummary {
  summaryId: string
  conversationId: string
  summary: string
  messageCount: number
  generatedAt: string
  ttl: number
}

/**
 * Generate conversation summary (main method)
 */
async function generateSummary(request: SummaryRequest): Promise<SummaryResult> {
  const { conversationId, startTime, endTime } = request

  console.log(`[Summary] Generating summary for conversation ${conversationId}`)

  // Create cache key
  const cacheKey = createCacheKey(conversationId, startTime, endTime)

  // Check for cached summary
  const cached = await getCachedSummary(cacheKey)
  if (cached) {
    console.log(`[Summary] Cache hit for ${cacheKey}`)
    return {
      summary: cached.summary,
      messageCount: cached.messageCount,
      cached: true,
      generatedAt: cached.generatedAt,
      conversationId,
    }
  }

  console.log(`[Summary] Cache miss for ${cacheKey}, generating new summary`)

  // Fetch messages from DynamoDB
  const messages = await fetchMessages(conversationId, startTime, endTime)

  if (messages.length === 0) {
    throw new Error('No messages found in the specified time range')
  }

  console.log(`[Summary] Fetched ${messages.length} messages`)

  // Generate summary using Claude
  const summary = await invokeClaude(messages)

  const result: SummaryResult = {
    summary,
    messageCount: messages.length,
    cached: false,
    generatedAt: new Date().toISOString(),
    conversationId,
  }

  // Cache the result (fire and forget - don't block on cache failures)
  cacheSummary(cacheKey, result).catch((error) => {
    console.error('[Summary] Failed to cache summary:', error)
  })

  return result
}

/**
 * Fetch messages from DynamoDB
 */
async function fetchMessages(
  conversationId: string,
  startTime?: string,
  endTime?: string
): Promise<Message[]> {
  console.log(`[Summary] Fetching messages for conversation ${conversationId}`)

  interface QueryParams {
    TableName: string
    KeyConditionExpression: string
    ExpressionAttributeValues: Record<string, string>
    ExpressionAttributeNames?: Record<string, string>
    ScanIndexForward: boolean
  }

  const params: QueryParams = {
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: 'conversationId = :conversationId',
    ExpressionAttributeValues: {
      ':conversationId': conversationId,
    },
    ScanIndexForward: true, // Oldest first
  }

  // Add time range filters if provided
  if (startTime && endTime) {
    params.KeyConditionExpression += ' AND #timestamp BETWEEN :startTime AND :endTime'
    params.ExpressionAttributeNames = { '#timestamp': 'timestamp' }
    params.ExpressionAttributeValues[':startTime'] = startTime
    params.ExpressionAttributeValues[':endTime'] = endTime
  } else if (startTime) {
    params.KeyConditionExpression += ' AND #timestamp >= :startTime'
    params.ExpressionAttributeNames = { '#timestamp': 'timestamp' }
    params.ExpressionAttributeValues[':startTime'] = startTime
  } else if (endTime) {
    params.KeyConditionExpression += ' AND #timestamp <= :endTime'
    params.ExpressionAttributeNames = { '#timestamp': 'timestamp' }
    params.ExpressionAttributeValues[':endTime'] = endTime
  }

  const result = await dynamoDb.send(new QueryCommand(params))

  // Filter out deleted messages
  const messages = (result.Items || []) as Message[]
  return messages.filter((msg) => !msg.deleted && msg.type === 'TEXT')
}

/**
 * Invoke Claude 3 Haiku via AWS Bedrock
 */
async function invokeClaude(messages: Message[]): Promise<string> {
  console.log(`[Summary] Invoking Claude with ${messages.length} messages`)

  // Format messages for Claude
  const conversationText = messages
    .map((msg) => {
      const timestamp = new Date(msg.timestamp).toLocaleString()
      const sender = msg.senderId // You could enhance this with actual user names
      return `[${timestamp}] User ${sender}: ${msg.content}`
    })
    .join('\n')

  // Construct prompt
  const prompt = `You are an AI assistant helping students catch up on group chat discussions.

Analyze the following conversation and create a concise summary. Focus on:
- Key decisions made by the group
- Action items and who's responsible for them
- Important deadlines or dates mentioned
- Main topics discussed
- Questions that need answers or unresolved issues

Format your response as clear, actionable bullet points. Use a friendly, student-oriented tone.

Conversation:
${conversationText}

Please provide your summary:`

  // Prepare request body for Claude 3
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.5,
  }

  // Convert request body to Uint8Array for Bedrock
  const encoder = new TextEncoder()
  const bodyBytes = encoder.encode(JSON.stringify(requestBody))

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: bodyBytes,
  })

  try {
    const response = await bedrockClient.send(command)

    // Decode the response body
    if (!response.body) {
      throw new Error('No response body from Bedrock')
    }

    const responseText = new TextDecoder().decode(response.body)
    console.log('[Summary] Raw Bedrock response:', responseText.substring(0, 200))

    const responseBody = JSON.parse(responseText)

    console.log('[Summary] Claude response received')

    // Claude 3 response format
    if (responseBody.content && responseBody.content[0]?.text) {
      return responseBody.content[0].text
    }

    throw new Error('Unexpected response format from Claude')
  } catch (error) {
    console.error('[Summary] Bedrock invocation error:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to generate summary with AI: ${error.message}`)
    }
    throw new Error('Failed to generate summary with AI')
  }
}

/**
 * Get cached summary from DynamoDB
 */
async function getCachedSummary(summaryId: string): Promise<CachedSummary | null> {
  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: SUMMARIES_TABLE,
        Key: { summaryId },
      })
    )

    if (!result.Item) {
      return null
    }

    // Check if TTL has expired (belt and suspenders - DynamoDB should auto-delete)
    const cachedSummary = result.Item as CachedSummary
    const now = Math.floor(Date.now() / 1000)

    if (cachedSummary.ttl && cachedSummary.ttl < now) {
      console.log('[Summary] Cached summary expired')
      return null
    }

    return cachedSummary
  } catch (error) {
    console.error('[Summary] Error fetching cached summary:', error)
    return null
  }
}

/**
 * Cache summary in DynamoDB with TTL
 */
async function cacheSummary(summaryId: string, result: SummaryResult): Promise<void> {
  // Calculate TTL (7 days from now in Unix seconds)
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60

  const cachedSummary: CachedSummary = {
    summaryId,
    conversationId: result.conversationId,
    summary: result.summary,
    messageCount: result.messageCount,
    generatedAt: result.generatedAt,
    ttl,
  }

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: SUMMARIES_TABLE,
        Item: cachedSummary,
      })
    )

    console.log(`[Summary] Cached summary ${summaryId} with TTL ${new Date(ttl * 1000).toISOString()}`)
  } catch (error) {
    // Don't throw - caching is optional
    console.error('[Summary] Failed to cache summary:', error)
  }
}

/**
 * Create cache key from conversation ID and time range
 */
function createCacheKey(conversationId: string, startTime?: string, endTime?: string): string {
  if (!startTime && !endTime) {
    return `${conversationId}:all`
  }

  if (startTime && endTime) {
    return `${conversationId}:${startTime}:${endTime}`
  }

  if (startTime) {
    return `${conversationId}:${startTime}:latest`
  }

  return `${conversationId}:earliest:${endTime}`
}

// Export service
export const summaryService = {
  generateSummary,
  fetchMessages,
  invokeClaude,
  getCachedSummary,
  cacheSummary,
  createCacheKey,
}
