import { useState } from "react";
import { ImageIcon, Plus, X } from "lucide-react";
import { uploadFile } from "~/lib/mutations";

/**
 * Picks a photo, compresses and uploads it (lib/mutations.ts), and reports
 * the public URL — or null once removed.
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

  return (
    <div className="field">
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
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploading(true);
                try {
                  onChange(await uploadFile(file));
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
