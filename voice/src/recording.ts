import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "livekit-server-sdk";
import { env, recordingEnv } from "./env.js";

export interface RecordingHandle {
  egressId: string;
  recordingKey: string;
}

/**
 * Starts an audio-only room composite egress that uploads the call audio to S3.
 * Returns null when recording is not configured, so calls still work without it.
 */
export async function startCallRecording(input: {
  roomName: string;
  organizationId: string;
}): Promise<RecordingHandle | null> {
  const recording = recordingEnv();
  if (!recording) return null;
  if (!env.livekitUrl || !env.livekitApiKey || !env.livekitApiSecret) return null;

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const recordingKey = `voice-recordings/${input.organizationId}/${year}/${month}/${input.roomName}.ogg`;

  try {
    const client = new EgressClient(env.livekitUrl, env.livekitApiKey, env.livekitApiSecret);
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.OGG,
      filepath: recordingKey,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: recording.accessKey,
          secret: recording.secret,
          region: recording.region,
          bucket: recording.bucket,
        }),
      },
    });

    const info = await client.startRoomCompositeEgress(
      input.roomName,
      { file: fileOutput },
      { audioOnly: true }
    );

    return { egressId: info.egressId, recordingKey };
  } catch (err) {
    console.error("Failed to start call recording egress:", err);
    return null;
  }
}
