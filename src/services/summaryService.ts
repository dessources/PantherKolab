import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  QueryCommand,
  PutCommand,
  GetCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDb } from "@/lib/dynamodb";
import { Message, TABLE_NAMES } from "@/types/database";
import { userService } from "./userService";
import type { UserProfile } from "@/types/UserProfile";

// Module-level cache for user profiles to avoid redundant fetches
const userProfileCache = new Map<string, UserProfile>();

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
  },
});

const MESSAGES_TABLE = TABLE_NAMES.MESSAGES;
const SUMMARIES_TABLE = "PantherKolab-Summaries"; // No -dev suffix!
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";
const TTL_DAYS = 7;

interface SummaryRequest {
  conversationId: string;
  startTime?: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  userId: string; // For authorization
}

interface SummaryResult {
  summary: string;
  messageCount: number;
  cached: boolean;
  generatedAt: string;
  conversationId: string;
}

interface MessageWithName extends Message {
  senderName: string;
}

/**
 * Enriches messages with sender names.
 * @param messages - An array of messages to enrich.
 * @returns An array of messages with sender names.
 */
async function _enrichMessagesWithUserNames(
  messages: Message[]
): Promise<MessageWithName[]> {
  // 1. Collect all unique user IDs from all messages
  const userIdsToFetch = new Set<string>();
  messages.forEach((msg) => {
    if (msg.senderId && !userProfileCache.has(msg.senderId)) {
      userIdsToFetch.add(msg.senderId);
    }
  });

  // 2. Batch fetch non-cached users
  if (userIdsToFetch.size > 0) {
    const usersToFetchArray = Array.from(userIdsToFetch);
    const userPromises = usersToFetchArray.map((id) => userService.getUser(id));
    const fetchedUsers = await Promise.all(userPromises);

    // 3. Update cache
    fetchedUsers.forEach((user) => {
      if (user) {
        userProfileCache.set(user.userId, user);
      }
    });
  }

  // 4. Enrich messages
  const enrichedMessages = messages.map((msg) => {
    const user = userProfileCache.get(msg.senderId);
    const senderName = user
      ? `${user.firstName} ${user.lastName}`
      : "Unknown User";
    return {
      ...msg,
      senderName,
    };
  });

  return enrichedMessages;
}

async function generateSummary(
  request: SummaryRequest
): Promise<SummaryResult> {
  const { conversationId, startTime, endTime } = request;
  const cacheKey = createCacheKey(conversationId, startTime, endTime);

  const cachedSummary = await getCachedSummary(cacheKey);
  if (cachedSummary) {
    return { ...cachedSummary, cached: true };
  }

  const messages = await fetchMessages(conversationId, startTime, endTime);
  if (messages.length === 0) {
    throw new Error("No messages found in the specified time range");
  }

  // Require at least 20 messages for summary generation
  if (messages.length <= 20) {
    throw new Error(
      `Insufficient messages for summary generation. Found ${messages.length} messages, but at least 21 are required.`
    );
  }

  const enrichedMessages = await _enrichMessagesWithUserNames(messages);

  const summaryText = await invokeClaude(enrichedMessages);

  const result: Omit<SummaryResult, "cached"> = {
    summary: summaryText,
    messageCount: messages.length,
    generatedAt: new Date().toISOString(),
    conversationId,
  };

  await cacheSummary(cacheKey, result);

  return { ...result, cached: false };
}

async function fetchMessages(
  conversationId: string,
  startTime?: string,
  endTime?: string
): Promise<Message[]> {
  const keyConditionExpression = "conversationId = :conversationId";
  const expressionAttributeValues: Record<string, unknown> = {
    ":conversationId": conversationId,
  };

  let filterExpression = "";
  if (startTime) {
    filterExpression += " AND #timestamp >= :startTime";
    expressionAttributeValues[":startTime"] = startTime;
  }
  if (endTime) {
    filterExpression += " AND #timestamp <= :endTime";
    expressionAttributeValues[":endTime"] = endTime;
  }

  // Remove leading ' AND '
  if (filterExpression.startsWith(" AND ")) {
    filterExpression = filterExpression.substring(5);
  }

  const command = new QueryCommand({
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: keyConditionExpression,
    FilterExpression: filterExpression || undefined,
    ExpressionAttributeNames: filterExpression
      ? { "#timestamp": "timestamp" }
      : undefined,
    ExpressionAttributeValues: expressionAttributeValues,
    ScanIndexForward: true, // Oldest messages first
  });

  const response = await dynamoDb.send(command);
  return (response.Items as Message[]) || [];
}

async function invokeClaude(messages: MessageWithName[]): Promise<string> {
  // Format messages for Claude
  const conversationText = messages
    .map((msg) => {
      const timestamp = new Date(msg.timestamp).toLocaleString();
      const sender = msg.senderName || "Unknown User";
      return `[${timestamp}] ${sender}: ${msg.content}`;
    })
    .join("\n");

  // Construct prompt
  const prompt = `You are an AI assistant helping students catch up on group chat discussions. Analyze the following conversation and create a concise summary. Focus on:
- Key decisions made by the group
- Action items and who's responsible for them
- Important deadlines or dates mentioned
- Main topics discussed
- Questions that need answers or unresolved issues

Format your response as clear, actionable bullet points. Use a friendly, student-oriented tone.

Conversation:
${conversationText}

Please provide your summary:`;

  // Prepare request body for Claude 3
  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.5,
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestBody),
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Claude 3 response format
    if (responseBody.content && responseBody.content[0]?.text) {
      return responseBody.content[0].text;
    }
    throw new Error("Unexpected response format from Claude");
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.error("[Summary] Bedrock invocation error:", error);
    throw new Error("Failed to generate summary with AI");
  }
}

async function getCachedSummary(
  summaryId: string
): Promise<Omit<SummaryResult, "cached"> | null> {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: SUMMARIES_TABLE,
      Key: { summaryId },
    })
  );

  if (!result.Item) {
    return null;
  }

  // Check TTL
  if (result.Item.ttl && result.Item.ttl < Math.floor(Date.now() / 1000)) {
    return null; // Expired
  }

  return result.Item as Omit<SummaryResult, "cached">;
}

async function cacheSummary(
  summaryId: string,
  summaryResult: Omit<SummaryResult, "cached">
): Promise<void> {
  try {
    const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;
    const item = {
      summaryId,
      ...summaryResult,
      ttl,
    };
    await dynamoDb.send(
      new PutCommand({
        TableName: SUMMARIES_TABLE,
        Item: item,
      })
    );
  } catch (error) {
    // Log error but don't block response
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.error("[Summary] Failed to cache summary:", error);
  }
}

function createCacheKey(
  conversationId: string,
  startTime?: string,
  endTime?: string
): string {
  if (!startTime && !endTime) {
    return `${conversationId}:all`;
  }
  const start = startTime || "all";
  const end = endTime || "latest";
  return `${conversationId}:${start}:${end}`;
}

export const summaryService = {
  generateSummary,
  fetchMessages,
  invokeClaude,
  getCachedSummary,
  cacheSummary,
  createCacheKey,
};
