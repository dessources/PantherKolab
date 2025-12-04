import { dynamoDb } from "@/lib/dynamodb";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES, type Message } from "@/types/database";

interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type?: "TEXT" | "IMAGE" | "FILE" | "AUDIO" | "VIDEO";
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: string;
}

export const messageService = {
  async sendMessage(input: CreateMessageInput): Promise<Message> {
    // 1. Create message object
    const message: Message = {
      conversationId: input.conversationId,
      timestamp: new Date().toISOString(),
      messageId: crypto.randomUUID(),
      senderId: input.senderId,
      type: input.type || "TEXT",
      content: input.content,
      mediaUrl: input.mediaUrl || null,
      fileName: input.fileName || null,
      fileSize: input.fileSize || null,
      readBy: [],
      reactions: {},
      duration: null,
      replyTo: input.replyTo || null,
      deleted: false,
      createdAt: new Date().toISOString(),
    };

    // Save to DynamoDB
    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAMES.MESSAGES,
        Item: message,
      })
    );

    // Note: Real-time publishing is handled by the API route using user-centric channels
    return message;
  },

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLE_NAMES.MESSAGES,
        KeyConditionExpression: "conversationId = :convId",
        ExpressionAttributeValues: {
          ":convId": conversationId,
        },
        ScanIndexForward: false, // Latest first
        Limit: limit,
      })
    );

    return (result.Items as Message[]) || [];
  },

  async deleteMessage(
    messageId: string,
    conversationId: string
  ): Promise<void> {
    // Soft delete
    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.MESSAGES,
        Key: { conversationId, timestamp: messageId },
        UpdateExpression: "SET deleted = :true",
        ExpressionAttributeValues: {
          ":true": true,
        },
      })
    );

    // Note: Real-time publishing is handled by the API route using user-centric channels
  },

  async markAsRead(
    messageId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    // Get current message first
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLE_NAMES.MESSAGES,
        KeyConditionExpression: "conversationId = :convId AND #ts = :msgId",
        ExpressionAttributeNames: {
          "#ts": "timestamp",
        },
        ExpressionAttributeValues: {
          ":convId": conversationId,
          ":msgId": messageId,
        },
      })
    );

    const message = result.Items?.[0] as Message;
    if (!message) return;

    // Add userId to readBy array if not already there
    const readBy = message.readBy || [];
    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }

    // Update message
    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.MESSAGES,
        Key: { conversationId, timestamp: messageId },
        UpdateExpression: "SET readBy = :readBy",
        ExpressionAttributeValues: {
          ":readBy": readBy,
        },
      })
    );

    // Note: Real-time publishing is handled by the API route using user-centric channels
  },
};
