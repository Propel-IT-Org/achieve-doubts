import useSWRMutation from "swr/mutation";
import { mutate } from "swr";
import { api, unwrap } from "./api";
import { compressImage } from "./image";
import {
  unreadKey,
  type CommentRow,
  type QuestionRow,
  type SolutionRow,
  type ThreadRow,
} from "./queries";

/**
 * Every write goes through `useSWRMutation`. After a successful write we
 * revalidate the affected keys rather than hand-editing the cache — the
 * server is the source of truth for status transitions (a lock can be lost,
 * a quota can reject), so re-reading is both simpler and more honest.
 */

/** Revalidates every SWR key whose first element matches one of `prefixes`. */
function revalidate(...prefixes: string[]) {
  return mutate(
    (key) => Array.isArray(key) && prefixes.includes(key[0] as string),
    undefined,
    { revalidate: true },
  );
}

// ---------- questions ----------

export type CreateQuestionBody = {
  subjectId: string;
  bookId: string;
  chapterId: number;
  textbookId?: string | null;
  text: string;
  photoUrl?: string | null;
};

export function useCreateQuestion() {
  return useSWRMutation(
    ["questions", "create"],
    async (_key, { arg }: { arg: CreateQuestionBody }) => {
      const res = await api.api.questions.$post({ json: arg });
      const created = await unwrap<QuestionRow>(res);
      await revalidate("questions");
      return created;
    },
  );
}

export function useLockQuestion() {
  return useSWRMutation(
    ["questions", "lock"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const res = await api.api.questions[":id"].lock.$post({
        param: { id: String(arg.id) },
      });
      const question = await unwrap<QuestionRow>(res);
      await revalidate("questions", "question", "solver");
      return question;
    },
  );
}

export function useUnlockQuestion() {
  return useSWRMutation(
    ["questions", "unlock"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const res = await api.api.questions[":id"].unlock.$post({
        param: { id: String(arg.id) },
      });
      const question = await unwrap<QuestionRow>(res);
      await revalidate("questions", "question", "solver", "thread");
      return question;
    },
  );
}

export function useOverrideLock() {
  return useSWRMutation(
    ["questions", "override"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const res = await api.api.questions[":id"].override.$post({
        param: { id: String(arg.id) },
      });
      const question = await unwrap<QuestionRow>(res);
      await revalidate("questions", "question", "solver");
      return question;
    },
  );
}

export function useDeleteQuestion() {
  return useSWRMutation(
    ["questions", "delete"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const res = await api.api.questions[":id"].$delete({
        param: { id: String(arg.id) },
      });
      const question = await unwrap<QuestionRow>(res);
      await revalidate("questions", "question");
      return question;
    },
  );
}

// ---------- solutions + rating ----------

export type SolutionBody = {
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioSeconds?: number;
};

export function useSubmitSolution(questionId: number) {
  return useSWRMutation(
    ["solution", questionId],
    async (_key, { arg }: { arg: SolutionBody }) => {
      const res = await api.api.questions[":id"].solution.$post({
        param: { id: String(questionId) },
        json: arg,
      });
      const out = await unwrap<{ solution: SolutionRow; question: QuestionRow }>(res);
      await revalidate("question", "questions", "solver");
      return out;
    },
  );
}

export function useDeleteSolution(questionId: number) {
  return useSWRMutation(
    ["solution", questionId, "delete"],
    async () => {
      const res = await api.api.questions[":id"].solution.$delete({
        param: { id: String(questionId) },
      });
      const out = await unwrap<{ question: QuestionRow }>(res);
      await revalidate("question", "questions", "thread", "solver");
      return out;
    },
  );
}

export function useRateQuestion(questionId: number) {
  return useSWRMutation(
    ["rating", questionId],
    async (_key, { arg }: { arg: { value: "satisfied" | "unsatisfied" } }) => {
      const res = await api.api.questions[":id"].rating.$post({
        param: { id: String(questionId) },
        json: arg,
      });
      const out = await unwrap<{ question: QuestionRow }>(res);
      await revalidate("question", "questions");
      return out;
    },
  );
}

// ---------- thread + comments ----------

export function usePostThreadMessage(questionId: number) {
  return useSWRMutation(
    ["thread", questionId, "post"],
    async (_key, { arg }: { arg: SolutionBody }) => {
      const res = await api.api.questions[":id"].thread.$post({
        param: { id: String(questionId) },
        json: arg,
      });
      const out = await unwrap<{ message: ThreadRow }>(res);
      await revalidate("thread", "solver");
      return out;
    },
  );
}

export function usePostComment(questionId: number) {
  return useSWRMutation(
    ["comments", questionId, "post"],
    async (_key, { arg }: { arg: SolutionBody }) => {
      const res = await api.api.questions[":id"].comments.$post({
        param: { id: String(questionId) },
        json: arg,
      });
      const out = await unwrap<{ comment: CommentRow }>(res);
      await revalidate("comments");
      return out;
    },
  );
}

/** Admin solvers remove a comment; it stays in place as "Removed by an admin". */
export function useDeleteComment(questionId: number) {
  return useSWRMutation(
    ["comments", questionId, "delete"],
    async (_key, { arg }: { arg: { commentId: number } }) => {
      const res = await api.api.questions[":id"].comments[":cid"].$delete({
        param: { id: String(questionId), cid: String(arg.commentId) },
      });
      const out = await unwrap<{ comment: CommentRow }>(res);
      await revalidate("comments");
      return out;
    },
  );
}

// ---------- reports ----------

export function useCreateReport(questionId: number) {
  return useSWRMutation(
    ["reports", questionId, "create"],
    async (
      _key,
      { arg }: { arg: { reason: string; text: string } },
    ) => {
      const res = await api.api.questions[":id"].reports.$post({
        param: { id: String(questionId) },
        json: arg as never,
      });
      const out = await unwrap<unknown>(res);
      await revalidate("me");
      return out;
    },
  );
}

// ---------- notifications ----------

/**
 * Marking one notification read updates the header badge optimistically —
 * the badge is the thing the reader is watching when they tap, so waiting a
 * round-trip to decrement it feels broken. The count is rolled back if the
 * write fails, then reconciled against the server either way.
 */
export function useMarkNotificationRead() {
  return useSWRMutation(
    ["notifications", "read"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const previous = await mutate<{ count: number }>(
        unreadKey(),
        (current) => ({ count: Math.max(0, (current?.count ?? 1) - 1) }),
        { revalidate: false },
      );

      try {
        const res = await api.api.me.notifications[":id"].read.$post({
          param: { id: String(arg.id) },
        });
        const out = await unwrap<unknown>(res);
        await revalidate("notifications");
        return out;
      } catch (err) {
        // Put the badge back where it was before re-throwing.
        await mutate(unreadKey(), previous, { revalidate: true });
        throw err;
      }
    },
  );
}

export function useMarkAllNotificationsRead() {
  return useSWRMutation(["notifications", "read-all"], async () => {
    const res = await api.api.me.notifications["read-all"].$post();
    const out = await unwrap<{ updated: number }>(res);
    await revalidate("notifications");
    return out;
  });
}

// ---------- uploads ----------

/**
 * Uploads a file straight to object storage and returns its public URL.
 * Images are compressed first (lib/image.ts); the file never passes through
 * the API.
 */
export async function uploadFile(file: File): Promise<string> {
  const body = file.type.startsWith("image/") ? await compressImage(file) : file;

  const res = await api.api.upload.presign.$post({
    json: { contentType: body.type as never, size: body.size },
  });
  const { uploadUrl, publicUrl, headers } = await unwrap<{
    uploadUrl: string;
    publicUrl: string;
    headers: Record<string, string>;
  }>(res);

  let put: Response;
  try {
    put = await fetch(uploadUrl, { method: "PUT", body, headers });
  } catch {
    // The browser blocked it or never got an answer: the bucket's CORS rules
    // have to allow PUT with a content-type header from this origin. A
    // rejected preflight surfaces here as a bare "Failed to fetch".
    throw new Error(
      "The storage bucket refused the upload. Check its CORS rules allow PUT from this site.",
    );
  }

  if (!put.ok) {
    // S3-compatible services answer with an XML <Error><Code>…</Code>.
    const detail = (await put.text().catch(() => "")).match(/<Code>([^<]+)<\/Code>/)?.[1];
    throw new Error(
      `Upload failed (${put.status}${detail ? `: ${detail}` : ""}).`,
    );
  }

  return publicUrl;
}
