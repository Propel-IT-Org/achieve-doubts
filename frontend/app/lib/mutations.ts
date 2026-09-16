import useSWRMutation from "swr/mutation";
import { mutate } from "swr";
import { api, unwrap } from "./api";
import type { CommentRow, QuestionRow, SolutionRow, ThreadRow } from "./queries";

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

export function useMarkNotificationRead() {
  return useSWRMutation(
    ["notifications", "read"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const res = await api.api.me.notifications[":id"].read.$post({
        param: { id: String(arg.id) },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("notifications");
      return out;
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
 * Presign then PUT straight to storage. The API only ever hands back a URL
 * for an allow-listed content type, and the create endpoints re-check that
 * the URL came from this flow before persisting it.
 */
export async function uploadFile(file: File): Promise<string> {
  const res = await api.api.upload.presign.$post({
    json: { fileName: file.name, contentType: file.type as never },
  });
  const { uploadUrl, publicUrl } = await unwrap<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
  }>(res);

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type },
  });
  if (!put.ok) throw new Error("Upload failed");

  return publicUrl;
}
