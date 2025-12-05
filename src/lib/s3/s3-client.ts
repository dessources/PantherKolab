import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logDebug } from "@/lib/utils";

const bucketName = process.env.S3_BUCKET_NAME || "pantherkolab-files-dev"; // Corrected bucket name
const region = process.env.AWS_REGION || "us-east-1";

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

logDebug(
  `S3 Client initialized for bucket: ${bucketName} in region: ${region}`
);

export const s3 = {
  /**
   * Uploads a file to S3.
   * @param key - The key (path/filename) for the object in S3.
   * @param body - The file content as a Buffer.
   * @param contentType - The MIME type of the file.
   * @returns The S3 object URL.
   */
  async uploadToS3(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);
    logDebug(`Successfully uploaded ${key} to ${bucketName}`);

    // Return the public URL
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  },

  /**
   * Generates a presigned URL for securely downloading a private object.
   * @param key - The key of the object in S3.
   * @param expiresIn - The duration in seconds for which the URL is valid.
   * @returns A presigned URL.
   */
  async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    logDebug(`Generated presigned URL for ${key}`);
    return url;
  },

  /**
   * Deletes an object from S3.
   * @param key - The key of the object to delete.
   */
  async deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
    logDebug(`Successfully deleted ${key} from ${bucketName}`);
  },
};
