import { dynamoDb } from "@/lib/dynamodb";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  TABLE_NAMES,
  INDEX_NAMES,
  type Whiteboard,
  type CreateWhiteboardInput,
} from "@/types/database";
import { logDebug } from "@/lib/utils";
import { conversationService } from "./conversationService";

export const whiteboardService = {
  /**
   * Create a new whiteboard
   */
  async createWhiteboard(input: CreateWhiteboardInput): Promise<Whiteboard> {
    const now = new Date().toISOString();

    // Fetch conversation to get all participants
    const conversation = await conversationService.getConversation(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation with ID ${input.conversationId} not found.`);
    }

    const whiteboard: Whiteboard = {
      whiteboardId: crypto.randomUUID(),
      conversationId: input.conversationId,
      name: input.name,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      snapshot: null, // Initial state is empty
      isActive: true,
      participants: conversation.participants, // Use all participants from the conversation
    };

    const logWhiteboard = { ...whiteboard };
    if (logWhiteboard.snapshot) {
      logWhiteboard.snapshot = logWhiteboard.snapshot.substring(0, 100) + "...";
    }
    logDebug("Creating whiteboard:", logWhiteboard);

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Item: whiteboard,
      })
    );

    logDebug("Whiteboard successfully saved to DynamoDB");

    return whiteboard;
  },

  /**
   * Get a whiteboard by ID
   */
  async getWhiteboard(whiteboardId: string): Promise<Whiteboard | null> {
    logDebug("Fetching whiteboard with ID:", whiteboardId);

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
      })
    );

    if (result.Item) {
      const logItem = { ...(result.Item as Whiteboard) };
      if (logItem.snapshot) {
        logItem.snapshot = logItem.snapshot.substring(0, 100) + "...";
      }
      logDebug("Fetched whiteboard:", logItem);
    } else {
      logDebug("Whiteboard not found for ID:", whiteboardId);
    }

    return (result.Item as Whiteboard) || null;
  },

  /**
   * List all whiteboards for a conversation (using GSI)
   */
  async listWhiteboardsByConversation(
    conversationId: string
  ): Promise<Whiteboard[]> {
    logDebug("Listing whiteboards for conversationId:", conversationId);

    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        IndexName: INDEX_NAMES.WHITEBOARDS.CONVERSATION_ID,
        KeyConditionExpression: "conversationId = :conversationId",
        ExpressionAttributeValues: {
          ":conversationId": conversationId,
        },
      })
    );

    const whiteboards = (result.Items as Whiteboard[]) || [];

    const logWhiteboards = whiteboards.map(wb => {
      const logWb = { ...wb };
      if (logWb.snapshot) {
        logWb.snapshot = logWb.snapshot.substring(0, 100) + "...";
      }
      return logWb;
    });

    logDebug(`Found ${whiteboards.length} whiteboards for conversation:`, logWhiteboards);

    return whiteboards;
  },

  /**
   * Update whiteboard snapshot (tldraw state)
   */
  async updateWhiteboardSnapshot(
    whiteboardId: string,
    snapshot: string
  ): Promise<void> {
    const now = new Date().toISOString();

    logDebug("Updating whiteboard snapshot for ID:", whiteboardId, "Snapshot (truncated):", snapshot.substring(0, 100) + "...");

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
        UpdateExpression: "SET #snapshot = :snapshot, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#snapshot": "snapshot", // 'name' is a reserved word
        },
        ExpressionAttributeValues: {
          ":snapshot": snapshot,
          ":updatedAt": now,
        },
      })
    );

    logDebug("Whiteboard snapshot updated successfully for ID:", whiteboardId);
  },

  /**
   * Update whiteboard name
   */
  async updateWhiteboardName(
    whiteboardId: string,
    name: string
  ): Promise<void> {
    const now = new Date().toISOString();

    logDebug("Updating whiteboard name for ID:", whiteboardId, "Name:", name);

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
        UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#name": "name", // 'name' is a reserved word
        },
        ExpressionAttributeValues: {
          ":name": name,
          ":updatedAt": now,
        },
      })
    );

    logDebug("Whiteboard name updated successfully for ID:", whiteboardId);
  },

  /**
   * Add a participant to the whiteboard
   */
  async addParticipant(whiteboardId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();

    logDebug("Adding participant to whiteboard:", whiteboardId, "User ID:", userId);

    // First check if user is already in participants
    const whiteboard = await this.getWhiteboard(whiteboardId);
    if (!whiteboard) {
      throw new Error("Whiteboard not found");
    }

    if (whiteboard.participants.includes(userId)) {
      logDebug("User already in participants list for whiteboard:", whiteboardId, "User ID:", userId);
      return;
    }

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
        UpdateExpression:
          "SET participants = list_append(participants, :userId), updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":userId": [userId],
          ":updatedAt": now,
        },
      })
    );

    logDebug("Participant added successfully to whiteboard:", whiteboardId, "User ID:", userId);
  },

  /**
   * Remove a participant from the whiteboard
   */
  async removeParticipant(whiteboardId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();

    logDebug("Removing participant from whiteboard:", whiteboardId, "User ID:", userId);

    // Get current participants and filter out the user
    const whiteboard = await this.getWhiteboard(whiteboardId);
    if (!whiteboard) {
      throw new Error("Whiteboard not found");
    }

    const updatedParticipants = whiteboard.participants.filter(
      (id) => id !== userId
    );

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
        UpdateExpression:
          "SET participants = :participants, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":participants": updatedParticipants,
          ":updatedAt": now,
        },
      })
    );

    logDebug("Participant removed successfully from whiteboard:", whiteboardId, "User ID:", userId);
  },

  /**
   * Set whiteboard active status
   */
  async setActiveStatus(
    whiteboardId: string,
    isActive: boolean
  ): Promise<void> {
    const now = new Date().toISOString();

    logDebug("Setting whiteboard active status for ID:", whiteboardId, "isActive:", isActive);

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
        UpdateExpression: "SET isActive = :isActive, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":isActive": isActive,
          ":updatedAt": now,
        },
      })
    );

    logDebug("Whiteboard active status updated successfully for ID:", whiteboardId);
  },

  /**
   * Delete a whiteboard
   */
  async deleteWhiteboard(whiteboardId: string): Promise<void> {
    logDebug("Deleting whiteboard with ID:", whiteboardId);

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
      })
    );

    logDebug("Whiteboard deleted successfully with ID:", whiteboardId);
  },
};
