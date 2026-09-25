import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { decodeImage, MAX_IMAGE_EDGE } from "~/lib/image";

/**
 * Crop and rotate a picture before it is uploaded — a photo of a whole page
 * becomes just the question. Every image attachment goes through this:
 * the question photo, solutions, follow-ups and comments.
 *
 * Hand-rolled rather than a crop library (CLAUDE.md): a frame dragged by
 * its body or its corners, turned in 90° steps, with arrow keys for both.
 * The dialog is a native <dialog>, which traps focus and closes on Escape.
 */

/** The crop frame, as fractions of the (rotated) picture: 0..1 on each axis. */
type Frame = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";
type Drag = { mode: "move" | Corner; startX: number; startY: number; start: Frame };

const WHOLE: Frame = { x: 0, y: 0, w: 1, h: 1 };
/** The smallest frame, so a corner can't be dragged through its opposite. */
const MIN = 0.05;
/** How far one arrow-key press moves or resizes the frame. */
const STEP = 0.02;
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** The picture's size once turned: a quarter turn swaps width and height. */
function turnedSize(bitmap: ImageBitmap, rotation: number) {
  return rotation % 180 === 0
    ? { width: bitmap.width, height: bitmap.height }
    : { width: bitmap.height, height: bitmap.width };
}

/**
 * Paints the turned picture onto `context`, with its top-left at the
 * origin. The caller's transform decides the scale and which part shows.
 */
function paintTurned(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  rotation: number,
) {
  const { width, height } = turnedSize(bitmap, rotation);
  context.translate(width / 2, height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
}

/**
 * The frame's part of the turned picture, no bigger than an upload keeps —
 * a 12-megapixel photo is scaled down here, not carried around at full size.
 */
function renderCrop(bitmap: ImageBitmap, rotation: number, frame: Frame) {
  const { width, height } = turnedSize(bitmap, rotation);
  const sx = frame.x * width;
  const sy = frame.y * height;
  const sw = Math.max(1, frame.w * width);
  const sh = Math.max(1, frame.h * height);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sw, sh));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing isn't available here");

  context.imageSmoothingQuality = "high";
  context.scale(scale, scale);
  context.translate(-sx, -sy);
  paintTurned(context, bitmap, rotation);
  return canvas;
}

/** The frame after a drag of (dx, dy), as fractions of the picture. */
function dragged(drag: Drag, dx: number, dy: number): Frame {
  const { start } = drag;
  if (drag.mode === "move") {
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.w),
      y: clamp(start.y + dy, 0, 1 - start.h),
    };
  }

  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (drag.mode.includes("w")) left = clamp(left + dx, 0, right - MIN);
  if (drag.mode.includes("e")) right = clamp(right + dx, left + MIN, 1);
  if (drag.mode.includes("n")) top = clamp(top + dy, 0, bottom - MIN);
  if (drag.mode.includes("s")) bottom = clamp(bottom + dy, top + MIN, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Arrow keys move the frame; with Shift they resize it from its far corner. */
function nudged(frame: Frame, key: string, resize: boolean): Frame | null {
  const dx = key === "ArrowLeft" ? -STEP : key === "ArrowRight" ? STEP : 0;
  const dy = key === "ArrowUp" ? -STEP : key === "ArrowDown" ? STEP : 0;
  if (!dx && !dy) return null;
  const drag: Drag = { mode: resize ? "se" : "move", startX: 0, startY: 0, start: frame };
  return dragged(drag, dx, dy);
}

function CropDialog({
  bitmap,
  onDone,
}: {
  bitmap: ImageBitmap;
  onDone: (image: HTMLCanvasElement | null) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const [rotation, setRotation] = useState(0);
  const [frame, setFrame] = useState<Frame>(WHOLE);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState(0);

  // Before the preview below is measured: a closed dialog has no size.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // A phone turned sideways gives the stage a new size; refit the preview.
  useEffect(() => {
    const refit = () => setViewport((n) => n + 1);
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, []);

  // The preview: the turned picture, fitted to the space the stylesheet
  // gives the stage, at the screen's pixel density. `viewport` only
  // re-runs it after a resize.
  useLayoutEffect(() => {
    void viewport;
    const canvas = previewRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const { width, height } = turnedSize(bitmap, rotation);
    const fit = Math.min(stage.clientWidth / width, stage.clientHeight / height, 1);
    const cssWidth = Math.max(1, Math.round(width * fit));
    const cssHeight = Math.max(1, Math.round(height * fit));
    const density = window.devicePixelRatio || 1;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * density);
    canvas.height = Math.round(cssHeight * density);

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    paintTurned(context, bitmap, rotation);
  }, [bitmap, rotation, viewport]);

  const startDrag = (mode: Drag["mode"]) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: frame };
  };

  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    const picture = previewRef.current?.getBoundingClientRect();
    if (!current || !picture) return;
    setFrame(
      dragged(
        current,
        (e.clientX - current.startX) / picture.width,
        (e.clientY - current.startY) / picture.height,
      ),
    );
  };

  const endDrag = () => {
    drag.current = null;
  };

  const confirm = () => {
    try {
      onDone(renderCrop(bitmap, rotation, frame));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The picture couldn't be cropped.");
    }
  };

  const whole = frame.x === 0 && frame.y === 0 && frame.w === 1 && frame.h === 1;
  const box = {
    left: `${frame.x * 100}%`,
    top: `${frame.y * 100}%`,
    width: `${frame.w * 100}%`,
    height: `${frame.h * 100}%`,
  };

  return (
    <dialog
      ref={dialogRef}
      className="crop-dialog"
      aria-labelledby="crop-h"
      onCancel={(e) => {
        // Escape: close through onDone, so the caller hears "cancelled".
        e.preventDefault();
        onDone(null);
      }}
    >
      <div className="crop-head">
        <h2 className="h3" id="crop-h">
          Crop the photo
        </h2>
        <p className="muted" id="crop-help">
          Drag the corners so only the question is left. Arrow keys move the
          frame; Shift and an arrow key resizes it.
        </p>
      </div>

      <div className="crop-stage" ref={stageRef}>
        <div className="crop-picture">
          <canvas ref={previewRef} role="img" aria-label="The photo being cropped" />
          {/* A button so it is focusable and interactive natively; its
              label says how much of the photo the frame keeps. */}
          <button
            type="button"
            className="crop-frame"
            style={box}
            aria-label={`Crop area: ${Math.round(frame.w * 100)}% wide, ${Math.round(frame.h * 100)}% tall`}
            aria-describedby="crop-help"
            // biome-ignore lint/a11y/noAutofocus: adjusting the frame is what the dialog is for
            autoFocus
            onPointerDown={startDrag("move")}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(e) => {
              const next = nudged(frame, e.key, e.shiftKey);
              if (!next) return;
              e.preventDefault();
              setFrame(next);
            }}
          >
            {CORNERS.map((corner) => (
              <span
                key={corner}
                className={`crop-handle ${corner}`}
                aria-hidden="true"
                onPointerDown={startDrag(corner)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ))}
          </button>
        </div>
      </div>

      {error && (
        <p className="field-err" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}

      <div className="crop-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            // A quarter turn swaps the axes the frame is measured on.
            setRotation((turn) => (turn + 90) % 360);
            setFrame(WHOLE);
          }}
        >
          <RotateCw size={14} />
          Rotate
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={whole}
          onClick={() => setFrame(WHOLE)}
        >
          Reset
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone(null)}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={confirm}>
          {whole ? "Use whole photo" : "Crop and use"}
        </button>
      </div>
    </dialog>
  );
}

/**
 * `crop(file)` opens the dialog and resolves with the cropped picture, or
 * null if it was cancelled. Render `dialog` anywhere in the component —
 * it opens in the top layer, above everything else.
 */
export function useImageCropper() {
  const [session, setSession] = useState<{
    bitmap: ImageBitmap;
    resolve: (image: HTMLCanvasElement | null) => void;
  } | null>(null);

  // Decoded pixels are held outside the JS heap: free them as soon as the
  // dialog closes, or if the component goes away with it still open.
  useEffect(() => {
    if (!session) return;
    return () => {
      session.resolve(null);
      session.bitmap.close();
    };
  }, [session]);

  const crop = async (file: File) => {
    const bitmap = await decodeImage(file);
    return new Promise<HTMLCanvasElement | null>((resolve) => {
      setSession({ bitmap, resolve });
    });
  };

  const dialog = session ? (
    <CropDialog
      bitmap={session.bitmap}
      onDone={(image) => {
        session.resolve(image);
        setSession(null);
      }}
    />
  ) : null;

  return { crop, dialog, cropping: session !== null };
}
