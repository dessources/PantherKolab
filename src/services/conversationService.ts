import { dynamoDb } from "@/lib/dynamodb";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  TABLE_NAMES,
  type Conversation,
  type ConversationWithNames,
} from "@/types/database";
import { userService } from "./userService";
import type { UserProfile } from "@/types/UserProfile";

// Module-level cache for user profiles to avoid redundant fetches
const userProfileCache = new Map<string, UserProfile>();

interface CreateConversationInput {
  type: "DM" | "GROUP";
  name?: string;
  description?: string;
  participants: string[];
  createdBy: string;
  avatar?: string;
}

export const conversationService = {
  async createConversation(
    input: CreateConversationInput,
    conversationId?: string
  ): Promise<Conversation> {
    const now = new Date().toISOString();

    const conversation: Conversation = {
      conversationId: conversationId || crypto.randomUUID(),
      type: input.type,
      name: input.name || "anon",
      description: input.description || null,
      participants: input.participants,
      admins: input.type === "GROUP" ? [input.createdBy] : [], // Creator is admin for groups
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      avatar: input.avatar || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Creating conversation:", conversation);

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAMES.CONVERSATIONS,
        Item: conversation,
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Conversation successfully saved to DynamoDB");

    return conversation;
  },

  async getConversation(conversationId: string): Promise<Conversation | null> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Fetching conversation with ID:", conversationId);

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAMES.CONVERSATIONS,
        Key: { conversationId },
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Fetched conversation:", result.Item);

    return (result.Item as Conversation) || null;
  },

  async listConversations(userId: string): Promise<ConversationWithNames[]> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Listing conversations for userId:", userId);

    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLE_NAMES.CONVERSATIONS,
        FilterExpression: "contains(participants, :userId)",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
    );

    const conversations = (result.Items as Conversation[]) || [];

    const enrichedConversations = await this.enrichConversationsWithNames(
      conversations,
      userId
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(
      "Total conversations found:",
      enrichedConversations.length || 0
    );

    return enrichedConversations;
  },

  async enrichConversationsWithNames(
    conversations: Conversation[],
    currentUserId: string
  ): Promise<ConversationWithNames[]> {
    // 1. Collect all unique user IDs from all conversations
    const userIdsToFetch = new Set<string>();
    conversations.forEach((conv) => {
      conv.participants.forEach((id) => {
        if (!userProfileCache.has(id)) {
          userIdsToFetch.add(id);
        }
      });
    });

    // 2. Batch fetch non-cached users
    if (userIdsToFetch.size > 0) {
      const usersToFetchArray = Array.from(userIdsToFetch);
      const userPromises = usersToFetchArray.map((id) =>
        userService.getUser(id)
      );
      const fetchedUsers = await Promise.all(userPromises);

      // 3. Update cache
      fetchedUsers.forEach((user) => {
        if (user) {
          userProfileCache.set(user.userId, user);
        }
      });
    }

    // 4. Enrich conversations
    const enrichedConversations = conversations.map((conv) => {
      const participantNames: { [userId: string]: string } = {};
      conv.participants.forEach((id) => {
        const user = userProfileCache.get(id);
        participantNames[id] = user
          ? `${user.firstName} ${user.lastName}`
          : "Unknown User";
      });

      let enrichedName = conv.name;
      // For DMs, set the conversation name to the other user's name
      if (conv.type === "DM") {
        const otherUserId = conv.participants.find((p) => p !== currentUserId);
        if (otherUserId) {
          enrichedName = participantNames[otherUserId] || "Unknown User";
        }
      }

      return {
        ...conv,
        name: enrichedName,
        participantNames,
      };
    });

    return enrichedConversations;
  },

  async updateLastMessage(
    conversationId: string,
    timestamp: string
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(
      "Updating last message for conversation:",
      conversationId,
      "to",
      timestamp
    );

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.CONVERSATIONS,
        Key: { conversationId },
        UpdateExpression: "SET lastMessageAt = :timestamp, updatedAt = :now",
        ExpressionAttributeValues: {
          ":timestamp": timestamp,
          ":now": new Date().toISOString(),
        },
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Last message updated successfully");
  },

  async findOrCreateDM(
    userId1: string,
    userId2: string,
    userName: string
  ): Promise<Conversation> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Finding or creating DM between:", userId1, "and", userId2);

    // Create a deterministic conversationId for DMs
    const sortedIds = [userId1, userId2].sort();
    const dmConversationId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

    // 1. Try to get conversation directly
    const existingDM = await this.getConversation(dmConversationId);

    if (existingDM) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      process.env.NODE_ENV !== "production" && console.log("Found existing DM:", existingDM.conversationId);
      return existingDM;
    }

    // 2. Create new DM conversation if it doesn't exist
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log("Creating new DM conversation with deterministic ID");
    const newConversation = await this.createConversation(
      {
        type: "DM",
        name: userName, // Name of the other user
        participants: [userId1, userId2],
        createdBy: userId1,
      },
      dmConversationId // Pass the deterministic ID
    );

    return newConversation;
  },

  async createGroupConversation(
    name: string,
    participantIds: string[],
    createdBy: string
  ): Promise<Conversation> {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV !== "production" && console.log(`Creating group conversation "${name}" by ${createdBy}`);

    // Ensure the creator is included in the participants list
    const finalParticipants = Array.from(
      new Set([...participantIds, createdBy])
    );

    const newConversation = await this.createConversation({
      type: "GROUP",
      name: name,
      participants: finalParticipants,
      createdBy: createdBy,
    });

    return newConversation;
  },
};