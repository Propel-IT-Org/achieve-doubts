import { useEffect, useRef, useState } from "react";
import { ImageIcon, Mic, Plus, Square, X } from "lucide-react";
import { canRecordVoiceNotes, startVoiceNote } from "~/lib/audio";
import { clock } from "~/lib/format";
import { uploadImage, uploadVoiceNote } from "~/lib/mutations";
import { useImageCropper } from "./image-crop";

type Recorder = Awaited<ReturnType<typeof startVoiceNote>>;

/** What a composer sends alongside its text. */
export type MediaPayload = {
  imageUrl?: string;
  audioUrl?: string;
  audioSeconds?: number;
};

/**
 * The image and voice note a composer is about to send. Both upload
 * straight to storage as soon as they're added — an image once it has been
 * cropped (components/image-crop.tsx) and compressed (lib/image.ts) — so
 * sending the message only posts their URLs.
 *
 * The composer renders `cropDialog`; AttachGrid and AttachRow do it for you.
 */
export function useMediaAttachments(onError: (message: string) => void) {
  const [image, setImage] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ url: string; seconds: number } | null>(null);
  const [uploading, setUploading] = useState<"image" | "audio" | null>(null);
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const cropper = useImageCropper();

  // A composer unmounted mid-recording must release the microphone.
  useEffect(() => () => void recorder.current?.cancel(), []);

  const fail = (err: unknown, fallback: string) =>
    onError(err instanceof Error ? err.message : fallback);

  const addImage = async (file: File) => {
    let cropped: HTMLCanvasElement | null;
    try {
      cropped = await cropper.crop(file);
    } catch (err) {
      fail(err, "That file couldn't be opened as an image.");
      return;
    }
    if (!cropped) return;

    setUploading("image");
    try {
      setImage(await uploadImage(cropped));
    } catch (err) {
      fail(err, "The image couldn't be uploaded.");
    } finally {
      setUploading(null);
    }
  };

  const startRecording = async () => {
    try {
      recorder.current = await startVoiceNote();
      setRecordingSince(Date.now());
    } catch (err) {
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      fail(
        denied ? new Error("Allow microphone access to record a voice note.") : err,
        "Recording couldn't start.",
      );
    }
  };

  const stopRecording = async () => {
    const current = recorder.current;
    recorder.current = null;
    setRecordingSince(null);
    if (!current) return;
    setUploading("audio");
    try {
      const note = await current.stop();
      setAudio({ url: await uploadVoiceNote(note.file), seconds: note.seconds });
    } catch (err) {
      fail(err, "The voice note couldn't be uploaded.");
    } finally {
      setUploading(null);
    }
  };

  const cancelRecording = async () => {
    const current = recorder.current;
    recorder.current = null;
    setRecordingSince(null);
    await current?.cancel();
  };

  const payload = (): MediaPayload => ({
    imageUrl: image ?? undefined,
    audioUrl: audio?.url,
    audioSeconds: audio?.seconds,
  });

  return {
    image,
    audio,
    uploading,
    recordingSince,
    /** Still cropping, uploading or recording: sending now would drop it. */
    busy: cropper.cropping || uploading !== null || recordingSince !== null,
    cropDialog: cropper.dialog,
    hasMedia: Boolean(image || audio),
    addImage,
    removeImage: () => setImage(null),
    removeAudio: () => setAudio(null),
    startRecording,
    stopRecording,
    cancelRecording,
    payload,
    reset: () => {
      setImage(null);
      setAudio(null);
    },
  };
}

export type MediaAttachments = ReturnType<typeof useMediaAttachments>;

/** Seconds since `since`, ticking once a second. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  return <>{clock((now - since) / 1000)}</>;
}

function ImagePicker({ media, label }: { media: MediaAttachments; label: React.ReactNode }) {
  return (
    <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }} aria-disabled={media.busy}>
      {label}
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={media.busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void media.addImage(file);
        }}
      />
    </label>
  );
}

function RecordingControls({ media }: { media: MediaAttachments }) {
  if (media.recordingSince === null) return null;
  return (
    <span className="attach-chip" role="status">
      <Mic size={14} aria-hidden="true" />
      Recording <Elapsed since={media.recordingSince} />
      <button type="button" onClick={() => void media.stopRecording()}>
        <Square size={11} aria-hidden="true" /> Stop
      </button>
      <button type="button" onClick={() => void media.cancelRecording()}>
        Cancel
      </button>
    </span>
  );
}

/**
 * The solution composer's layout (prototype): a labelled box each for the
 * image and the audio note.
 */
export function AttachGrid({ media }: { media: MediaAttachments }) {
  const canRecord = canRecordVoiceNotes();

  return (
    <div className="att-grid">
      {media.cropDialog}
      <div className="att">
        <span className="att-lbl">
          <ImageIcon size={16} aria-hidden="true" />
          Image
        </span>
        {media.image ? (
          <>
            <span className="att-state">Image attached</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={media.removeImage}>
              <X size={14} />
              Remove
            </button>
          </>
        ) : media.uploading === "image" ? (
          <span className="att-state">Uploading…</span>
        ) : (
          <ImagePicker
            media={media}
            label={
              <>
                <Plus size={14} />
                Add image
              </>
            }
          />
        )}
      </div>

      <div className="att">
        <span className="att-lbl">
          <Mic size={16} aria-hidden="true" />
          Audio
        </span>
        {media.audio ? (
          <>
            <span className="att-state">Audio attached, {clock(media.audio.seconds)}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={media.removeAudio}>
              <X size={14} />
              Remove
            </button>
          </>
        ) : media.uploading === "audio" ? (
          <span className="att-state">Uploading…</span>
        ) : media.recordingSince !== null ? (
          <RecordingControls media={media} />
        ) : canRecord ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={media.busy}
            onClick={() => void media.startRecording()}
          >
            <Mic size={14} />
            Record audio
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>
            Recording needs a newer browser.
          </span>
        )}
      </div>
    </div>
  );
}

/** Follow-ups' and comments' compact controls (prototype AttachControls). */
export function AttachRow({ media }: { media: MediaAttachments }) {
  const canRecord = canRecordVoiceNotes();

  return (
    <div className="att-row">
      {media.cropDialog}
      {media.image ? (
        <span className="attach-chip">
          <ImageIcon size={14} aria-hidden="true" />
          Image attached
          <button type="button" onClick={media.removeImage}>
            Remove
          </button>
        </span>
      ) : media.uploading === "image" ? (
        <span className="att-state">Uploading image…</span>
      ) : (
        <ImagePicker
          media={media}
          label={
            <>
              <ImageIcon size={14} />
              Add image
            </>
          }
        />
      )}

      {media.audio ? (
        <span className="attach-chip">
          <Mic size={14} aria-hidden="true" />
          Audio attached, {clock(media.audio.seconds)}
          <button type="button" onClick={media.removeAudio}>
            Remove
          </button>
        </span>
      ) : media.uploading === "audio" ? (
        <span className="att-state">Uploading audio…</span>
      ) : media.recordingSince !== null ? (
        <RecordingControls media={media} />
      ) : (
        canRecord && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={media.busy}
            onClick={() => void media.startRecording()}
          >
            <Mic size={14} />
            Record audio
          </button>
        )
      )}
    </div>
  );
}
