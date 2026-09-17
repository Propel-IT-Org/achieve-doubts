import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  AlertTriangle,
  ImageIcon,
  Lock,
  Plus,
  Send,
  User,
  X,
} from "lucide-react";
import useSWR, { preload } from "swr";
import { z } from "zod";

import type { Route } from "./+types/ask";
import { fetchSubjects, subjectsKey } from "~/lib/queries";
import { uploadFile, useCreateQuestion } from "~/lib/mutations";
import { useSession } from "~/lib/session";
import { Gate } from "~/components/primitives";
import { useToast } from "~/components/toast";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Ask a question — Achieve Doubts" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(subjectsKey(), fetchSubjects);
  return null;
}

/** Mirrors the backend's createQuestionSchema, including its 15-char floor. */
const askSchema = z.object({
  subjectId: z.string().min(1, "Choose a subject, book and chapter."),
  bookId: z.string().min(1, "Choose a subject, book and chapter."),
  chapterId: z.coerce
    .number()
    .int()
    .positive("Choose a subject, book and chapter."),
  text: z
    .string()
    .min(
      15,
      "Write at least 15 characters so the solver understands the problem.",
    ),
});

type AskForm = z.input<typeof askSchema>;

export default function AskPage() {
  const { user, isPending } = useSession();
  const navigate = useNavigate();
  const flash = useToast();
  const create = useCreateQuestion();
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AskForm>({
    resolver: zodResolver(askSchema),
    defaultValues: { subjectId: "", bookId: "", chapterId: 0, text: "" },
  });

  const subjectId = watch("subjectId");
  const bookId = watch("bookId");

  const books = subjects?.find((s) => s.id === subjectId)?.books ?? [];
  const chapters = books.find((b) => b.id === bookId)?.chapters ?? [];

  if (isPending) return null;

  if (!user) {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<Lock size={24} />}
            title="Log in to continue"
            text="Log in as a student to ask a question."
          >
            <Link className="btn btn-primary" to="/login">
              Student login
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  if (user.role !== "student") {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<User size={24} />}
            title="Ask a question"
            text="Only students can ask questions. Switch to a student account to use this page."
          >
            <Link className="btn btn-ghost" to="/questions">
              Questions
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError("");
    try {
      const created = await create.trigger({
        subjectId: values.subjectId,
        bookId: values.bookId,
        chapterId: Number(values.chapterId),
        text: values.text,
        photoUrl,
      });
      flash("Question posted. It's now in the queue.");
      navigate(`/questions/${created.id}`);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Couldn't post the question",
      );
    }
  });

  const firstError =
    errors.subjectId?.message ??
    errors.bookId?.message ??
    errors.chapterId?.message ??
    errors.text?.message ??
    submitError;

  return (
    <main id="main" className="page">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="ph">
          <h1>Ask a question</h1>
          <p>
            Your question goes to the next online solver. Add a photo if the
            problem has a diagram or working.
          </p>
        </div>

        <form
          className="panel"
          style={{ display: "grid", gap: 18 }}
          onSubmit={onSubmit}
        >
          <div className="ask-grid">
            <label className="field">
              <span>Subject</span>
              <select
                className="select"
                {...register("subjectId")}
                onChange={(e) => {
                  setValue("subjectId", e.target.value);
                  setValue("bookId", "");
                  setValue("chapterId", 0);
                }}
              >
                <option value="">Choose</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Book</span>
              <select
                className="select"
                disabled={!subjectId}
                {...register("bookId")}
                onChange={(e) => {
                  setValue("bookId", e.target.value);
                  setValue("chapterId", 0);
                }}
              >
                <option value="">
                  {subjectId ? "Choose" : "Choose a subject first"}
                </option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Chapter</span>
              <select
                className="select"
                disabled={!bookId}
                {...register("chapterId")}
              >
                <option value="">
                  {bookId ? "Choose" : "Choose a book first"}
                </option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.number}. {ch.nameEn}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Your question</span>
            <textarea
              className="textarea"
              style={{ minHeight: 150 }}
              aria-invalid={errors.text ? "true" : undefined}
              {...register("text")}
            />
            <small>Write the full problem and what you've already tried.</small>
          </label>

          <div className="field">
            <span>Photo of the problem</span>
            <div className="photo-drop">
              {photoUrl ? (
                <img className="ph" src={photoUrl} alt="Attached" />
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

              {photoUrl ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPhotoUrl(null)}
                >
                  <X size={14} />
                  Remove
                </button>
              ) : (
                <label
                  className="btn btn-ghost btn-sm"
                  style={{ cursor: "pointer" }}
                >
                  <Plus size={14} />
                  {uploading ? "Uploading…" : "Add photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        setPhotoUrl(await uploadFile(file));
                      } catch (err) {
                        setSubmitError(
                          err instanceof Error ? err.message : "Upload failed",
                        );
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {firstError && (
            <div className="err" role="alert">
              <AlertTriangle size={16} />
              {firstError}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="btn btn-primary btn-lg ask-submit"
              disabled={isSubmitting || create.isMutating}
            >
              <Send size={16} />
              Post question
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
