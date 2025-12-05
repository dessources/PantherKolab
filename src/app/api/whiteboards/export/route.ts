import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";
import { whiteboardService } from "@/services/whiteboardService";
import { s3 } from "@/lib/s3/s3-client";
import { logDebug } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse the request body
    const body = await request.json();
    const { whiteboardId, dataUrl, format } = body;

    if (!whiteboardId || !dataUrl || !format) {
      return NextResponse.json(
        {
          success: false,
          error: "whiteboardId, dataUrl, and format are required",
        },
        { status: 400 }
      );
    }

    // 3. Verify permissions
    const whiteboard = await whiteboardService.getWhiteboard(whiteboardId);
    if (!whiteboard) {
      return NextResponse.json(
        { success: false, error: "Whiteboard not found" },
        { status: 404 }
      );
    }
    if (!whiteboard.participants.includes(authUser.userId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // 4. Prepare data for S3 upload
    // The dataURL is in the format: "data:<mime-type>;base64,<base64-data>"
    const [header, base64Data] = dataUrl.split(",");
    if (!header || !base64Data) {
        return NextResponse.json({ success: false, error: "Invalid dataUrl format" }, { status: 400 });
    }
    const mimeType = header.match(/:(.*?);/)?.[1];
    const buffer = Buffer.from(base64Data, "base64");

    const key = `whiteboards/${whiteboardId}_${Date.now()}.${format}`;
    const contentType = mimeType || `image/${format}`;

    logDebug(`Uploading whiteboard export for ${whiteboardId} to S3 as ${key}`);

    // 5. Upload to S3
    const s3Url = await s3.uploadToS3(key, buffer, contentType);

    // 6. Return the S3 URL
    return NextResponse.json({ success: true, url: s3Url });

  } catch (error) {
    logDebug("Error exporting whiteboard:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
