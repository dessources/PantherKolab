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

export const whiteboardService = {
  /**
   * Create a new whiteboard
   */
  async createWhiteboard(
    input: CreateWhiteboardInput
  ): Promise<Whiteboard> {
    const now = new Date().toISOString();

    const whiteboard: Whiteboard = {
      whiteboardId: crypto.randomUUID(),
      conversationId: input.conversationId,
      name: input.name,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      snapshot: null, // Initial state is empty
      isActive: true,
      participants: [input.createdBy], // Creator is first participant
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Creating whiteboard:", whiteboard);

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Item: whiteboard,
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Whiteboard successfully saved to DynamoDB");

    return whiteboard;
  },

  /**
   * Get a whiteboard by ID
   */
  async getWhiteboard(whiteboardId: string): Promise<Whiteboard | null> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Fetching whiteboard with ID:", whiteboardId);

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Fetched whiteboard:", result.Item);

    return (result.Item as Whiteboard) || null;
  },

  /**
   * List all whiteboards for a conversation (using GSI)
   */
  async listWhiteboardsByConversation(
    conversationId: string
  ): Promise<Whiteboard[]> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Listing whiteboards for conversationId:", conversationId);

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

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log(`Found ${whiteboards.length} whiteboards for conversation`);

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

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Updating whiteboard snapshot:", whiteboardId);

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
        UpdateExpression: "SET snapshot = :snapshot, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":snapshot": snapshot,
          ":updatedAt": now,
        },
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Whiteboard snapshot updated successfully");
  },

  /**
   * Update whiteboard name
   */
  async updateWhiteboardName(
    whiteboardId: string,
    name: string
  ): Promise<void> {
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Updating whiteboard name:", whiteboardId, name);

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

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Whiteboard name updated successfully");
  },

  /**
   * Add a participant to the whiteboard
   */
  async addParticipant(whiteboardId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Adding participant to whiteboard:", whiteboardId, userId);

    // First check if user is already in participants
    const whiteboard = await this.getWhiteboard(whiteboardId);
    if (!whiteboard) {
      throw new Error("Whiteboard not found");
    }

    if (whiteboard.participants.includes(userId)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" &&
        console.log("User already in participants list");
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

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Participant added successfully");
  },

  /**
   * Remove a participant from the whiteboard
   */
  async removeParticipant(
    whiteboardId: string,
    userId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log(
        "Removing participant from whiteboard:",
        whiteboardId,
        userId
      );

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
        UpdateExpression: "SET participants = :participants, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":participants": updatedParticipants,
          ":updatedAt": now,
        },
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Participant removed successfully");
  },

  /**
   * Set whiteboard active status
   */
  async setActiveStatus(
    whiteboardId: string,
    isActive: boolean
  ): Promise<void> {
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Setting whiteboard active status:", whiteboardId, isActive);

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

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Whiteboard active status updated successfully");
  },

  /**
   * Delete a whiteboard
   */
  async deleteWhiteboard(whiteboardId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Deleting whiteboard:", whiteboardId);

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.WHITEBOARDS,
        Key: { whiteboardId },
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" &&
      console.log("Whiteboard deleted successfully");
  },
};
