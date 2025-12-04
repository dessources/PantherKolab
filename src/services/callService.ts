import { dynamoDb } from "@/lib/dynamodb";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  type Call,
  type CallParticipant,
  type CreateCallInput,
  //CallType,
  type CallStatus,
  TABLE_NAMES,
} from "@/types/database";

const TABLE_NAME = TABLE_NAMES.CALLS;

export const callService = {
  /**
   * Create a new call record
   */
  async createCall(input: CreateCallInput): Promise<Call> {
    const now = new Date().toISOString();
    const sessionId = crypto.randomUUID();

    // Validate group calls have conversationId
    if (input.callType === "GROUP" && !input.conversationId) {
      throw new Error("Group calls require a conversationId");
    }

    // Create participant records
    const participants: CallParticipant[] = input.participantIds.map(
      (userId) => ({
        userId,
        attendeeId: null,
        joinedAt: null,
        leftAt: null,
        status: "RINGING" as const,
        becameCallOwner: null,
      })
    );

    const call: Call = {
      sessionId,
      timestamp: now, // ISO timestamp used as sort key
      chimeMeetingId: "", // Will be set when Chime meeting is created
      conversationId: input.conversationId || null,
      callType: input.callType,
      initiatedBy: input.initiatedBy,
      participants,
      status: "RINGING",
      startedAt: null,
      endedAt: null,
      createdAt: now,
      duration: null,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: call,
      })
    );

    return call;
  },

  /**
   * Get call by sessionId (queries for the most recent record)
   */
  async getCall(sessionId: string): Promise<Call | null> {
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "sessionId = :sessionId",
        ExpressionAttributeValues: {
          ":sessionId": sessionId,
        },
        ScanIndexForward: false, // Sort by timestamp descending (newest first)
        Limit: 1,
      })
    );

    return (result.Items?.[0] as Call) || null;
  },

  /**
   * Get call by exact sessionId and timestamp
   */
  async getCallByKey(
    sessionId: string,
    timestamp: string
  ): Promise<Call | null> {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { sessionId, timestamp },
      })
    );

    return (result.Item as Call) || null;
  },

  /**
   * Update call with Chime meeting ID
   */
  async updateChimeMeetingId(
    sessionId: string,
    chimeMeetingId: string
  ): Promise<void> {
    const call = await this.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId, timestamp: call.timestamp },
        UpdateExpression: "SET chimeMeetingId = :meetingId",
        ExpressionAttributeValues: {
          ":meetingId": chimeMeetingId,
        },
      })
    );
  },

  /**
   * Update call status
   */
  async updateCallStatus(sessionId: string, status: CallStatus): Promise<void> {
    const call = await this.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    const updates: Record<string, unknown> = { status };

    // Set timestamps based on status
    if (status === "ACTIVE" && !call.startedAt) {
      updates.startedAt = new Date().toISOString();
    } else if (
      status === "ENDED" ||
      status === "MISSED" ||
      status === "REJECTED"
    ) {
      updates.endedAt = new Date().toISOString();
    }

    const updateExpression = Object.keys(updates)
      .map((key, i) => `#attr${i} = :val${i}`)
      .join(", ");

    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    Object.keys(updates).forEach((key, i) => {
      expressionAttributeNames[`#attr${i}`] = key;
      expressionAttributeValues[`:val${i}`] = updates[key];
    });

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId, timestamp: call.timestamp },
        UpdateExpression: `SET ${updateExpression}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  },

  /**
   * Update participant status
   */
  async updateParticipantStatus(
    sessionId: string,
    userId: string,
    status: CallParticipant["status"],
    attendeeId?: string
  ): Promise<void> {
    const call = await this.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    const participantIndex = call.participants.findIndex(
      (p) => p.userId === userId
    );
    if (participantIndex === -1) {
      throw new Error("Participant not found in call");
    }

    const now = new Date().toISOString();
    const participant = call.participants[participantIndex];

    // Update participant status and timestamps
    participant.status = status;
    if (status === "JOINED") {
      participant.joinedAt = now;
      if (attendeeId) {
        participant.attendeeId = attendeeId;
      }
    } else if (status === "LEFT" || status === "REJECTED") {
      participant.leftAt = now;
    }

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId, timestamp: call.timestamp },
        UpdateExpression: "SET participants = :participants",
        ExpressionAttributeValues: {
          ":participants": call.participants,
        },
      })
    );
  },

  /**
   * End call and calculate duration
   */
  async endCall(sessionId: string): Promise<void> {
    const call = await this.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    const endedAt = new Date().toISOString();
    let duration: number | null = null;

    // Calculate duration if call was active
    if (call.startedAt) {
      const startTime = new Date(call.startedAt).getTime();
      const endTime = new Date(endedAt).getTime();
      duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds
    }

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId, timestamp: call.timestamp },
        UpdateExpression:
          "SET #status = :status, #endedAt = :endedAt, #duration = :duration",
        ExpressionAttributeNames: {
          "#status": "status",
          "#duration": "duration", // Added: duration is a reserved keyword
          "#endedAt": "endedAt",
        },
        ExpressionAttributeValues: {
          ":status": "ENDED",
          ":endedAt": endedAt,
          ":duration": duration,
        },
      })
    );
  },

  /**
   * Transfer call ownership to a new participant
   * Updates the previous owner's becameCallOwner.status to false
   * and sets the new owner's becameCallOwner with status true and timestamp
   */
  async transferCallOwnership(
    sessionId: string,
    previousOwnerId: string,
    newOwnerId: string
  ): Promise<void> {
    const call = await this.getCall(sessionId);
    if (!call) {
      throw new Error("Call not found");
    }

    const now = new Date().toISOString();

    // Update participants array
    const updatedParticipants = call.participants.map((p) => {
      if (p.userId === previousOwnerId && p.becameCallOwner?.status) {
        // Remove ownership from previous owner
        return {
          ...p,
          becameCallOwner: {
            status: false,
            timestamp: p.becameCallOwner.timestamp,
          },
        };
      }
      if (p.userId === newOwnerId) {
        // Assign ownership to new owner
        return {
          ...p,
          becameCallOwner: {
            status: true,
            timestamp: now,
          },
        };
      }
      return p;
    });

    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId, timestamp: call.timestamp },
        UpdateExpression: "SET participants = :participants",
        ExpressionAttributeValues: {
          ":participants": updatedParticipants,
        },
      })
    );
  },

  /**
   * Get active calls for a user
   */
  async getActiveCallsForUser(userId: string): Promise<Call[]> {
    // Note: This is a scan operation which is expensive
    // In production, consider using a GSI with userId as partition key
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          "contains(participants, :userId) AND (#status = :active OR #status = :ringing)",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":userId": userId,
          ":active": "ACTIVE",
          ":ringing": "RINGING",
        },
      })
    );

    return (result.Items as Call[]) || [];
  },
};
