import { dynamoDb } from "@/lib/dynamodb";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { publishEvent } from "@/lib/appsync-events";
import type { Message } from "@/types/database";

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

    // 2. Save to DynamoDB FIRST (so we don't lose data)
    await dynamoDb.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_MESSAGES_TABLE,
        Item: message,
      })
    );

    // 3. Publish to AppSync (real-time broadcast)
    await publishEvent({
      channel: `/conversations/${input.conversationId}`,
      event: {
        type: "MESSAGE_SENT",
        data: message,
      },
    });

    return message;
  },

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: process.env.DYNAMODB_MESSAGES_TABLE,
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
        TableName: process.env.DYNAMODB_MESSAGES_TABLE,
        Key: { conversationId, timestamp: messageId },
        UpdateExpression: "SET deleted = :true",
        ExpressionAttributeValues: {
          ":true": true,
        },
      })
    );

    // Publish delete event
    await publishEvent({
      channel: `/conversations/${conversationId}`,
      event: {
        type: "MESSAGE_DELETED",
        data: { messageId, conversationId },
      },
    });
  },

  async markAsRead(
    messageId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    // Get current message first
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: process.env.DYNAMODB_MESSAGES_TABLE,
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
        TableName: process.env.DYNAMODB_MESSAGES_TABLE,
        Key: { conversationId, timestamp: messageId },
        UpdateExpression: "SET readBy = :readBy",
        ExpressionAttributeValues: {
          ":readBy": readBy,
        },
      })
    );

    // Publish read event
    await publishEvent({
      channel: `/conversations/${conversationId}`,
      event: {
        type: "MESSAGE_READ",
        data: { messageId, conversationId, userId },
      },
    });
  },
};
