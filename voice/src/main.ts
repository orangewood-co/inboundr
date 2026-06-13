import {
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
  type JobContext,
} from "@livekit/agents";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { buildFallbackAgent, buildReceptionistAgent } from "./agent.js";
import {
  createCallRecord,
  fetchVoiceConfig,
  finalizeCallRecord,
  type TranscriptEntry,
} from "./backend.js";
import { env } from "./env.js";
import { startCallRecording } from "./recording.js";

interface ProcessUserData {
  vad: silero.VAD;
}

function createSession(ctx: JobContext<ProcessUserData>): voice.AgentSession {
  return new voice.AgentSession({
    stt: new inference.STT({
      model: env.sttModel,
      language: "multi",
    }),
    tts: new inference.TTS({
      model: env.ttsModel,
      voice: env.ttsVoice,
    }),
    turnDetection: new livekit.turnDetector.MultilingualModel(),
    vad: ctx.proc.userData.vad,
    voiceOptions: {
      preemptiveGeneration: true,
    },
  });
}

export default defineAgent<ProcessUserData>({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx) => {
    await ctx.connect();

    const participant = await ctx.waitForParticipant();
    const attributes = participant.attributes ?? {};
    const callerNumber = attributes["sip.phoneNumber"] ?? "";
    const dialedNumber = attributes["sip.trunkPhoneNumber"] || env.defaultNumber;

    const resolved = dialedNumber ? await fetchVoiceConfig(dialedNumber) : null;
    const session = createSession(ctx);

    if (!resolved || !resolved.config.enabled) {
      console.warn(
        `No active voice agent config for dialed number "${dialedNumber}"; using fallback agent`
      );
      await session.start({ agent: buildFallbackAgent(), room: ctx.room });
      const handle = session.generateReply({
        instructions:
          "Apologize that this number is not available right now and politely end the call.",
      });
      await handle.waitForPlayout();
      ctx.shutdown("unconfigured number");
      return;
    }

    const roomName = ctx.room.name ?? `call-${Date.now()}`;
    const transcript: TranscriptEntry[] = [];

    const recording = await startCallRecording({
      roomName,
      organizationId: resolved.organizationId,
    });

    const callId = await createCallRecord({
      organizationId: resolved.organizationId,
      callerNumber,
      dialedNumber,
      roomName,
      ...(recording ? { recordingKey: recording.recordingKey } : {}),
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (item.type !== "message") return;
      if (item.role !== "user" && item.role !== "assistant") return;
      const text = item.textContent;
      if (!text) return;
      transcript.push({ role: item.role, text, at: new Date().toISOString() });
    });

    // End the job promptly once the caller hangs up.
    session.on(voice.AgentSessionEventTypes.Close, () => {
      ctx.shutdown("session closed");
    });

    let finalized = false;
    ctx.addShutdownCallback(async () => {
      if (finalized || !callId) return;
      finalized = true;
      await finalizeCallRecord(callId, {
        transcript,
        status: "completed",
        ...(recording ? { recordingKey: recording.recordingKey } : {}),
      });
    });

    const agent = buildReceptionistAgent({
      organizationId: resolved.organizationId,
      organizationName: resolved.organizationName,
      config: resolved.config,
      callerNumber,
    });

    await session.start({ agent, room: ctx.room });

    const greeting = resolved.config.greeting.trim();
    if (greeting) {
      session.say(greeting);
    } else {
      session.generateReply({
        instructions: "Greet the caller warmly, state the business name, and ask how you can help.",
      });
    }
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: env.agentName,
  })
);
