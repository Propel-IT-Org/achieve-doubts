import { useState } from "react";
import { ImageIcon, Plus, X } from "lucide-react";
import { useImageCropper } from "~/components/image-crop";
import { uploadImage } from "~/lib/mutations";

/**
 * Picks a photo, lets the student crop it to the question
 * (components/image-crop.tsx), uploads it compressed (lib/mutations.ts),
 * and reports the public URL — or null once removed.
 */
export function PhotoField({
  value,
  onChange,
  onError,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const cropper = useImageCropper();

  const pick = async (file: File) => {
    let cropped: HTMLCanvasElement | null;
    try {
      cropped = await cropper.crop(file);
    } catch (err) {
      onError(err instanceof Error ? err.message : "That file couldn't be opened as an image.");
      return;
    }
    if (!cropped) return;

    setUploading(true);
    try {
      onChange(await uploadImage(cropped));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="field">
      {cropper.dialog}
      <span>Photo of the problem</span>
      <div className="photo-drop">
        {value ? (
          <img className="ph" src={value} alt="Attached" />
        ) : (
          <span
            className="ph"
            style={{
              width: 96,
              height: 72,
              borderRadius: 8,
              background: "var(--panel)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <ImageIcon size={22} aria-hidden="true" />
          </span>
        )}

        {value ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
            <X size={14} />
            Remove
          </button>
        ) : (
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            <Plus size={14} />
            {uploading ? "Uploading…" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading || cropper.cropping}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void pick(file);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
