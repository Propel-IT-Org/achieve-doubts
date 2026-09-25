/**
 * Voice-note recording.
 *
 * Records Opus in WebM — the only audio format the server accepts (backend
 * upload.util.ts). Opus at 24 kbps is clear for speech at roughly 180 KB a
 * minute, and every major browser records it (Safari since 18.4).
 */

/** Keep in step with `audioSeconds` in the backend's interaction schemas. */
export const VOICE_NOTE_MAX_SECONDS = 15 * 60;

const MIME_TYPE = "audio/webm;codecs=opus";
const BITS_PER_SECOND = 24_000;

export function canRecordVoiceNotes(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported(MIME_TYPE)
  );
}

export type VoiceNote = { file: File; seconds: number };

/**
 * Starts recording from the microphone. Recording stops by itself at the
 * length limit; call `stop()` to finish and get the note for `uploadVoiceNote()`.
 */
export async function startVoiceNote() {
  if (!canRecordVoiceNotes()) {
    throw new Error("Recording voice notes needs a newer browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const recorder = new MediaRecorder(stream, {
    mimeType: MIME_TYPE,
    audioBitsPerSecond: BITS_PER_SECOND,
  });

  const chunks: Blob[] = [];
  const startedAt = Date.now();
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => {
      // Release the microphone, however recording ended.
      for (const track of stream.getTracks()) track.stop();
      resolve();
    };
  });

  recorder.start();
  const limit = setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, VOICE_NOTE_MAX_SECONDS * 1000);

  const finish = async () => {
    clearTimeout(limit);
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
  };

  return {
    async stop(): Promise<VoiceNote> {
      await finish();
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      return {
        // Plain `audio/webm`: the exact type the presign endpoint accepts.
        file: new File(chunks, `voice-note-${Date.now()}.webm`, {
          type: "audio/webm",
        }),
        seconds: Math.min(VOICE_NOTE_MAX_SECONDS, Math.max(1, seconds)),
      };
    },
    async cancel(): Promise<void> {
      await finish();
      chunks.length = 0;
    },
  };
}
