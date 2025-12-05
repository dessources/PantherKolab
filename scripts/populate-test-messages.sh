#!/bin/bash

# populate-test-messages.sh
# Populates the Messages table with test conversation data for AI summary testing
# Three team members discussing the PantherKolab project
# User d4e884c8-5011-70f3-e29a-5f29eb210c38 will NOT participate (silent observer for testing summary)

set -e

# Configuration
TABLE_NAME="PantherKolab-Messages-dev"
CONVERSATION_ID="ee4f1426-5f14-4f3d-b01a-216f8805306a"
REGION="us-east-1"

# Participant IDs (3 active team members)
USER_1="f4583438-6031-70c9-cb39-97c244d01d63"  # Active participant
USER_2="54d85408-b031-70bf-0120-38e63bb430c0"  # Active participant
USER_3="a1b2c3d4-e5f6-7890-abcd-ef1234567890"  # Active participant (new)
# USER_SILENT="d4e884c8-5011-70f3-e29a-5f29eb210c38"  # Silent observer - will NOT post

echo "Starting to populate Messages table with test conversation..."
echo "Table: $TABLE_NAME"
echo "Conversation ID: $CONVERSATION_ID"
echo "Region: $REGION"
echo ""

# Helper function to generate timestamp (incrementing from base)
BASE_TIMESTAMP="2025-12-03T14:00:00.000Z"
generate_timestamp() {
    local offset=$1
    # Calculate timestamp offset in seconds
    local epoch_base=$(date -d "$BASE_TIMESTAMP" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${BASE_TIMESTAMP:0:19}" +%s)
    local new_epoch=$((epoch_base + offset))
    date -u -d "@$new_epoch" +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u -j -f "%s" "$new_epoch" +"%Y-%m-%dT%H:%M:%S.000Z"
}

# Helper function to insert message
insert_message() {
    local message_id=$1
    local sender_id=$2
    local content=$3
    local offset=$4
    local timestamp=$(generate_timestamp $offset)

    aws dynamodb put-item \
        --table-name "$TABLE_NAME" \
        --region "$REGION" \
        --item "{
            \"conversationId\": {\"S\": \"$CONVERSATION_ID\"},
            \"timestamp\": {\"S\": \"$timestamp\"},
            \"messageId\": {\"S\": \"$message_id\"},
            \"senderId\": {\"S\": \"$sender_id\"},
            \"type\": {\"S\": \"TEXT\"},
            \"content\": {\"S\": \"$content\"},
            \"createdAt\": {\"S\": \"$timestamp\"},
            \"deleted\": {\"BOOL\": false},
            \"readBy\": {\"L\": []},
            \"reactions\": {\"M\": {}}
        }" \
        --return-consumed-capacity TOTAL > /dev/null

    echo "✓ Message $message_id inserted"
}

echo "Inserting 100 messages about PantherKolab project discussion..."
echo ""

# Conversation flow: 100 messages about the project
# Messages are realistic team discussion about features, bugs, and planning

insert_message "msg-001" "$USER_1" "Hey team! Just pushed the latest changes to the audio-video-calls branch" 0
insert_message "msg-002" "$USER_2" "Nice! I'll pull and test it out" 60
insert_message "msg-003" "$USER_3" "Great work! How's the call quality?" 120
insert_message "msg-004" "$USER_1" "Pretty solid. Using Amazon Chime SDK for the WebRTC implementation" 180
insert_message "msg-005" "$USER_2" "That's awesome. Any issues with the integration?" 240
insert_message "msg-006" "$USER_1" "A few edge cases with participant management but mostly stable" 300
insert_message "msg-007" "$USER_3" "Are we handling group calls too?" 360
insert_message "msg-008" "$USER_1" "Yes! Both direct and group calls are working" 420
insert_message "msg-009" "$USER_2" "That's a huge milestone 🎉" 480
insert_message "msg-010" "$USER_3" "Definitely! What's next on the roadmap?" 540

insert_message "msg-011" "$USER_1" "We need to work on the chat message search feature" 600
insert_message "msg-012" "$USER_2" "Good point. Right now we can only scroll through history" 660
insert_message "msg-013" "$USER_3" "I can take that on. Thinking ElasticSearch or just DynamoDB queries?" 720
insert_message "msg-014" "$USER_1" "DynamoDB GSI should work for now. Keep it simple" 780
insert_message "msg-015" "$USER_2" "Agreed. We can always upgrade later if needed" 840
insert_message "msg-016" "$USER_3" "Makes sense. I'll draft a design doc" 900
insert_message "msg-017" "$USER_1" "Perfect. Also noticed some UI bugs in the profile sidebar" 960
insert_message "msg-018" "$USER_2" "The one that slides from the left?" 1020
insert_message "msg-019" "$USER_1" "Yeah, the z-index isn't working right on mobile" 1080
insert_message "msg-020" "$USER_3" "I saw that too. Let me fix it" 1140

insert_message "msg-021" "$USER_2" "Thanks! Also, we should discuss the notification system" 1200
insert_message "msg-022" "$USER_1" "Right, we're using AppSync Events for real-time but no push notifications yet" 1260
insert_message "msg-023" "$USER_3" "SNS + FCM would work well for mobile push" 1320
insert_message "msg-024" "$USER_2" "And for desktop we could use web push API" 1380
insert_message "msg-025" "$USER_1" "Let's prioritize that for next sprint" 1440
insert_message "msg-026" "$USER_3" "Agreed. I'll add it to the backlog" 1500
insert_message "msg-027" "$USER_2" "Speaking of sprints, how are we doing on the timeline?" 1560
insert_message "msg-028" "$USER_1" "Pretty good. Chat and calls are mostly done" 1620
insert_message "msg-029" "$USER_3" "File sharing is still pending though" 1680
insert_message "msg-030" "$USER_2" "True. That's a critical feature for student collaboration" 1740

insert_message "msg-031" "$USER_1" "I'm thinking S3 for storage with presigned URLs" 1800
insert_message "msg-032" "$USER_3" "That would work. What about file size limits?" 1860
insert_message "msg-033" "$USER_2" "Maybe 50MB for free tier users, 200MB for premium?" 1920
insert_message "msg-034" "$USER_1" "Sounds reasonable. We can always adjust based on usage" 1980
insert_message "msg-035" "$USER_3" "What file types should we support?" 2040
insert_message "msg-036" "$USER_2" "PDF, images, documents, and maybe code files?" 2100
insert_message "msg-037" "$USER_1" "Let's whitelist common types and scan for malware" 2160
insert_message "msg-038" "$USER_3" "Good idea. AWS has some antivirus scanning options" 2220
insert_message "msg-039" "$USER_2" "I'll research that" 2280
insert_message "msg-040" "$USER_1" "Perfect. Moving on to the whiteboard feature..." 2340

insert_message "msg-041" "$USER_3" "Oh yeah! The virtual whiteboard for collaboration" 2400
insert_message "msg-042" "$USER_2" "That's going to be challenging but really cool" 2460
insert_message "msg-043" "$USER_1" "I was looking at Fabric.js or Excalidraw" 2520
insert_message "msg-044" "$USER_3" "Excalidraw is open source and has great real-time features" 2580
insert_message "msg-045" "$USER_2" "How would we handle the real-time sync?" 2640
insert_message "msg-046" "$USER_1" "AppSync Events again, sending delta updates" 2700
insert_message "msg-047" "$USER_3" "Makes sense. Keep the architecture consistent" 2760
insert_message "msg-048" "$USER_2" "What about saving the whiteboard state?" 2820
insert_message "msg-049" "$USER_1" "Store as JSON in DynamoDB, export as PNG/SVG for archiving" 2880
insert_message "msg-050" "$USER_3" "That's smart. Users can download their work" 2940

insert_message "msg-051" "$USER_2" "Btw, how's the authentication holding up?" 3000
insert_message "msg-052" "$USER_1" "Cognito is solid. No issues so far" 3060
insert_message "msg-053" "$USER_3" "Are we doing email verification?" 3120
insert_message "msg-054" "$USER_2" "Yeah, required for account activation" 3180
insert_message "msg-055" "$USER_1" "And we added MFA as optional for security-conscious users" 3240
insert_message "msg-056" "$USER_3" "Nice. What about password reset?" 3300
insert_message "msg-057" "$USER_2" "Cognito handles that automatically via email" 3360
insert_message "msg-058" "$USER_1" "We should add social login eventually" 3420
insert_message "msg-059" "$USER_3" "Google and maybe GitHub?" 3480
insert_message "msg-060" "$USER_2" "That would make onboarding easier for students" 3540

insert_message "msg-061" "$USER_1" "Definitely on the roadmap. Now about the AI summary feature..." 3600
insert_message "msg-062" "$USER_3" "Oh that's the one using AWS Bedrock right?" 3660
insert_message "msg-063" "$USER_2" "Yeah! Super useful for catching up on long conversations" 3720
insert_message "msg-064" "$USER_1" "Exactly. Users can get a summary of what they missed" 3780
insert_message "msg-065" "$USER_3" "Which model are we using?" 3840
insert_message "msg-066" "$USER_2" "Claude 3.5 Sonnet from Bedrock" 3900
insert_message "msg-067" "$USER_1" "Great balance of quality and cost" 3960
insert_message "msg-068" "$USER_3" "How do we handle the context window?" 4020
insert_message "msg-069" "$USER_2" "Fetch the last 100 messages and send to the model" 4080
insert_message "msg-070" "$USER_1" "With prompt engineering to focus on key points and action items" 4140

insert_message "msg-071" "$USER_3" "That's really smart. Students will love that" 4200
insert_message "msg-072" "$USER_2" "Especially for group project chats" 4260
insert_message "msg-073" "$USER_1" "Exactly the use case we're targeting" 4320
insert_message "msg-074" "$USER_3" "What about rate limiting on the AI calls?" 4380
insert_message "msg-075" "$USER_2" "Good question. Those API calls aren't free" 4440
insert_message "msg-076" "$USER_1" "Maybe 10 summaries per day for free users?" 4500
insert_message "msg-077" "$USER_3" "And unlimited for premium?" 4560
insert_message "msg-078" "$USER_2" "That could work as a monetization strategy" 4620
insert_message "msg-079" "$USER_1" "Let's track usage and adjust limits based on data" 4680
insert_message "msg-080" "$USER_3" "Sounds like a plan" 4740

insert_message "msg-081" "$USER_2" "Quick question about the database schema" 4800
insert_message "msg-082" "$USER_1" "What about it?" 4860
insert_message "msg-083" "$USER_3" "I'm curious too" 4920
insert_message "msg-084" "$USER_2" "Are we using single-table design or multiple tables?" 4980
insert_message "msg-085" "$USER_1" "Multiple tables for now. Users, Conversations, Messages, Calls" 5040
insert_message "msg-086" "$USER_3" "Easier to reason about for a team project" 5100
insert_message "msg-087" "$USER_2" "Makes sense. We can always refactor later if needed" 5160
insert_message "msg-088" "$USER_1" "Right. Premature optimization is the root of all evil" 5220
insert_message "msg-089" "$USER_3" "😄 Classic Knuth quote" 5280
insert_message "msg-090" "$USER_2" "We're building solid foundations though" 5340

insert_message "msg-091" "$USER_1" "Definitely. The real-time messaging is super responsive" 5400
insert_message "msg-092" "$USER_3" "AppSync Events was a great choice" 5460
insert_message "msg-093" "$USER_2" "Way better than polling or long-polling" 5520
insert_message "msg-094" "$USER_1" "And WebSocket connections scale really well" 5580
insert_message "msg-095" "$USER_3" "Have we done any load testing?" 5640
insert_message "msg-096" "$USER_2" "Not yet but we should before launch" 5700
insert_message "msg-097" "$USER_1" "I'll set up some basic stress tests" 5760
insert_message "msg-098" "$USER_3" "Thanks! We should test with 100+ concurrent users" 5820
insert_message "msg-099" "$USER_2" "That would simulate a decent campus rollout" 5880
insert_message "msg-100" "$USER_1" "Agreed. Let's aim to have everything tested by end of week 🚀" 5940

echo ""
echo "✅ Successfully inserted 100 messages!"
echo ""
echo "Summary:"
echo "- Conversation ID: $CONVERSATION_ID"
echo "- Participants: 3 active users (User 4 is silent observer for testing)"
echo "- Message count: 100"
echo "- Topic: PantherKolab project discussion"
echo ""
echo "User d4e884c8-5011-70f3-e29a-5f29eb210c38 can now log in and test the AI summary feature!"
