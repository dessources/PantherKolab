/**
 * Dashboard API Route
 *
 * Returns ONLY real data from DynamoDB:
 * - User info (name, greeting)
 * - User stats (active calls count, unread messages count)
 * - Groups (user's study groups with class codes)
 * - Direct Messages (with real user names)
 * - Unread message counts (per conversation)
 * - Active call sessions
 * - Activity metrics
 */

import { NextResponse } from "next/server";
import { runWithAmplifyServerContext } from "@/lib/amplify/amplify-server-utils";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import { getDynamoDb } from "@/lib/dynamodb";
import { QueryCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "@/types/database";
import type { Conversation, Group, Call, Message } from "@/types/database";
import type { UserProfile } from "@/types/UserProfile";

export async function GET() {
  try {
    // Get authenticated user from AWS Cognito
    const currentUser = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => getCurrentUser(contextSpec),
    });

    const session = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec),
    });

    const userAttributes = session.tokens?.idToken?.payload;
    const userName = (userAttributes?.name as string) || currentUser.username;
    const userEmail = (userAttributes?.email as string) || "";
    const userId = currentUser.userId;

    const dynamoDb = getDynamoDb();

    // Fetch user's conversations
    let userConversations: Conversation[] = [];
    try {
      const conversationsResult = await dynamoDb.send(
        new ScanCommand({
          TableName: TABLE_NAMES.CONVERSATIONS,
          FilterExpression: "contains(participants, :userId)",
          ExpressionAttributeValues: {
            ":userId": userId,
          },
        })
      );
      userConversations = (conversationsResult.Items || []) as Conversation[];
    } catch (dbError) {
      console.error("Error fetching conversations:", dbError);
    }

    // Fetch group details
    const groupConversations = userConversations.filter((c) => c.type === "GROUP");
    const groupIds = groupConversations.map((c) => c.conversationId);

    let userGroups: Group[] = [];
    if (groupIds.length > 0) {
      try {
        const groupPromises = groupIds.map((id) =>
          dynamoDb.send(
            new QueryCommand({
              TableName: TABLE_NAMES.GROUPS,
              KeyConditionExpression: "groupId = :groupId",
              ExpressionAttributeValues: { ":groupId": id },
            })
          )
        );
        const groupResults = await Promise.all(groupPromises);
        userGroups = groupResults
          .flatMap((r) => r.Items || [])
          .filter(Boolean) as Group[];
      } catch (dbError) {
        console.error("Error fetching groups:", dbError);
      }
    }

    // Fetch active call sessions
    let activeCalls: Call[] = [];
    try {
      const activeCallsResult = await dynamoDb.send(
        new ScanCommand({
          TableName: TABLE_NAMES.CALLS,
          FilterExpression: "#status = :active AND contains(participants, :userId)",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":active": "ACTIVE",
            ":userId": userId,
          },
        })
      );
      activeCalls = (activeCallsResult.Items || []) as Call[];
    } catch (dbError) {
      console.error("Error fetching active calls:", dbError);
    }

    // Calculate unread message counts
    const unreadCounts = new Map<string, number>();
    try {
      for (const conv of userConversations) {
        const messagesResult = await dynamoDb.send(
          new QueryCommand({
            TableName: TABLE_NAMES.MESSAGES,
            KeyConditionExpression: "conversationId = :convId",
            ExpressionAttributeValues: {
              ":convId": conv.conversationId,
            },
          })
        );
        const messages = (messagesResult.Items || []) as Message[];
        const unreadCount = messages.filter(
          (msg) => !msg.readBy.includes(userId) && msg.senderId !== userId
        ).length;
        unreadCounts.set(conv.conversationId, unreadCount);
      }
    } catch (dbError) {
      console.error("Error fetching message counts:", dbError);
    }

    // Transform groups to dashboard format
    const dashboardGroups = groupConversations.map((conv) => {
      const groupData = userGroups.find((g) => g.groupId === conv.conversationId);
      return {
        id: conv.conversationId,
        name: conv.name || "Unnamed Group",
        code: groupData?.classCode || "N/A",
        unreadCount: unreadCounts.get(conv.conversationId) || 0,
        isClassGroup: groupData?.isClassGroup || false,
        memberCount: groupData?.memberCount || conv.participants.length,
      };
    });

    // Transform DMs to dashboard format
    const dmConversations = userConversations.filter((c) => c.type === "DM");
    const dmUserProfiles = new Map<string, UserProfile>();

    if (dmConversations.length > 0) {
      try {
        const userPromises = dmConversations.map(async (conv) => {
          const otherUserId = conv.participants.find((p) => p !== userId);
          if (otherUserId) {
            const userResult = await dynamoDb.send(
              new GetCommand({
                TableName: TABLE_NAMES.USERS,
                Key: { userId: otherUserId },
              })
            );
            if (userResult.Item) {
              dmUserProfiles.set(otherUserId, userResult.Item as UserProfile);
            }
          }
        });
        await Promise.all(userPromises);
      } catch (dbError) {
        console.error("Error fetching DM user profiles:", dbError);
      }
    }

    const dashboardDMs = dmConversations.map((conv) => {
      const otherUserId = conv.participants.find((p) => p !== userId);
      const otherUser = otherUserId ? dmUserProfiles.get(otherUserId) : null;
      const userName = otherUser
        ? `${otherUser.firstName} ${otherUser.lastName}`
        : "User";

      return {
        id: conv.conversationId,
        name: userName,
        unreadCount: unreadCounts.get(conv.conversationId) || 0,
        lastMessageAt: conv.lastMessageAt,
      };
    });

    // Transform active calls
    const dashboardActiveSessions = activeCalls.map((call) => ({
      id: call.sessionId,
      conversationId: call.conversationId,
      title: call.callType === "GROUP" ? "Group Call" : "Direct Call",
      participants: call.participants.filter((p) => p.status === "JOINED").length,
      startedAt: call.startedAt,
    }));

    // Calculate stats
    const totalUnreadMessages = Array.from(unreadCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const activeMeetings = activeCalls.length;

    // Return only real data
    const responseData = {
      user: {
        name: userName,
        email: userEmail,
        greeting: getGreeting(),
        stats: {
          meetings: activeMeetings,
          unreadMessages: totalUnreadMessages,
        },
      },
      groups: dashboardGroups,
      directMessages: dashboardDMs,
      activeSessions: dashboardActiveSessions,
      activity: {
        unreadMessages: {
          value: totalUnreadMessages,
          color: "#0066cc",
        },
        activeGroups: {
          value: groupConversations.length,
          color: "#ffb500",
        },
        studySessions: {
          value: activeMeetings,
          color: "#28a745",
        },
        collaborations: {
          value: userConversations.length,
          color: "#003366",
        },
      },
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data. Please log in." },
      { status: 401 }
    );
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
