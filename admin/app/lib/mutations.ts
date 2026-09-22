import { mutate } from "swr";
import useSWRMutation from "swr/mutation";
import { api, unwrap } from "./api";

/**
 * Every write goes through `useSWRMutation`, then revalidates what it
 * changed — the server decides the resulting state.
 */

function revalidate(...prefixes: string[]) {
  return mutate(
    (key) => Array.isArray(key) && prefixes.includes(key[0] as string),
    undefined,
    { revalidate: true },
  );
}

export function useResolveReport() {
  return useSWRMutation(
    ["reports", "resolve"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const res = await api.api.admin.reports[":id"].resolve.$post({
        param: { id: String(arg.id) },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("reports");
      return out;
    },
  );
}

/** Deactivation bans the account, which also signs it out everywhere. */
export function useSetStudentActive() {
  return useSWRMutation(
    ["students", "active"],
    async (_key, { arg }: { arg: { id: string; active: boolean } }) => {
      const res = await api.api.admin.students[":id"].active.$post({
        param: { id: arg.id },
        json: { active: arg.active },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("students", "student");
      return out;
    },
  );
}

export function useSetSolverActive() {
  return useSWRMutation(
    ["solvers", "active"],
    async (_key, { arg }: { arg: { id: string; active: boolean } }) => {
      const res = await api.api.admin.solvers[":id"].active.$post({
        param: { id: arg.id },
        json: { active: arg.active },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("solvers");
      return out;
    },
  );
}

export function useSetSolverAdmin() {
  return useSWRMutation(
    ["solvers", "admin"],
    async (_key, { arg }: { arg: { id: string; isAdminSolver: boolean } }) => {
      const res = await api.api.admin.solvers[":id"].admin.$post({
        param: { id: arg.id },
        json: { isAdminSolver: arg.isAdminSolver },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("solvers");
      return out;
    },
  );
}

export function useCreateBatch() {
  return useSWRMutation(
    ["batches", "create"],
    async (
      _key,
      { arg }: { arg: { id: string; label: string; levelId: string | null } },
    ) => {
      const res = await api.api.admin.batches.$post({ json: arg });
      const out = await unwrap<{ id: string }>(res);
      await revalidate("batches");
      return out;
    },
  );
}

/**
 * The name and the class. Moving a batch to another class changes which
 * syllabus its students can ask against, so their taxonomy is revalidated
 * too — theirs, not ours, but the next page load is what matters.
 */
export function useUpdateBatch() {
  return useSWRMutation(
    ["batches", "update"],
    async (
      _key,
      { arg }: { arg: { id: string; label?: string; levelId?: string | null } },
    ) => {
      const { id, ...body } = arg;
      const res = await api.api.admin.batches[":id"].$patch({
        param: { id },
        json: body,
      });
      const out = await unwrap<{ id: string }>(res);
      await revalidate("batches");
      return out;
    },
  );
}

/** Deactivating a batch also signs out and blocks its students. */
export function useSetBatchActive() {
  return useSWRMutation(
    ["batches", "active"],
    async (_key, { arg }: { arg: { id: string; active: boolean } }) => {
      const res = await api.api.admin.batches[":id"].active.$post({
        param: { id: arg.id },
        json: { active: arg.active },
      });
      const out = await unwrap<{ affectedStudents: number }>(res);
      await revalidate("batches", "students", "student");
      return out;
    },
  );
}

export type CreateSolverBody = {
  name: string;
  email: string;
  phone: string;
  institution: string;
  password: string;
};

export function useCreateSolver() {
  return useSWRMutation(
    ["solvers", "create"],
    async (_key, { arg }: { arg: CreateSolverBody }) => {
      const res = await api.api.admin.solvers.$post({ json: arg });
      const out = await unwrap<{ id: string }>(res);
      await revalidate("solvers");
      return out;
    },
  );
}

// ---------- taxonomy ----------

type Names = { nameEn: string; nameBn: string };

/**
 * One edit to the syllabus tree. Kind and action are separate fields so the
 * switch below narrows to a single endpoint and the RPC client still checks
 * each body — one dynamic path would have thrown that away.
 */
export type TaxonomyWrite =
  | { kind: "level"; action: "create"; body: Names & { sort?: number } }
  | { kind: "level"; action: "update"; id: string; body: Partial<Names> & { sort?: number } }
  | { kind: "level"; action: "delete"; id: string }
  | { kind: "subject"; action: "create"; body: Names & { levelId: string; sort?: number } }
  | {
      kind: "subject";
      action: "update";
      id: string;
      body: Partial<Names> & { levelId?: string; sort?: number };
    }
  | { kind: "subject"; action: "delete"; id: string }
  | { kind: "book"; action: "create"; body: Names & { subjectId: string; sort?: number } }
  | { kind: "book"; action: "update"; id: string; body: Partial<Names> & { sort?: number } }
  | { kind: "book"; action: "delete"; id: string }
  | { kind: "chapter"; action: "create"; body: Names & { bookId: string; number?: number } }
  | {
      kind: "chapter";
      action: "update";
      id: string;
      body: Partial<Names> & { number?: number };
    }
  | { kind: "chapter"; action: "delete"; id: string };

export type TaxonomyKind = TaxonomyWrite["kind"];

function sendTaxonomyWrite(arg: TaxonomyWrite) {
  const t = api.api.admin.taxonomy;

  switch (arg.kind) {
    case "level":
      switch (arg.action) {
        case "create":
          return t.levels.$post({ json: arg.body });
        case "update":
          return t.levels[":id"].$patch({ param: { id: arg.id }, json: arg.body });
        case "delete":
          return t.levels[":id"].$delete({ param: { id: arg.id } });
      }
    // biome-ignore lint/correctness/noFallthroughSwitchClause: every inner switch returns
    case "subject":
      switch (arg.action) {
        case "create":
          return t.subjects.$post({ json: arg.body });
        case "update":
          return t.subjects[":id"].$patch({ param: { id: arg.id }, json: arg.body });
        case "delete":
          return t.subjects[":id"].$delete({ param: { id: arg.id } });
      }
    // biome-ignore lint/correctness/noFallthroughSwitchClause: every inner switch returns
    case "book":
      switch (arg.action) {
        case "create":
          return t.books.$post({ json: arg.body });
        case "update":
          return t.books[":id"].$patch({ param: { id: arg.id }, json: arg.body });
        case "delete":
          return t.books[":id"].$delete({ param: { id: arg.id } });
      }
    // biome-ignore lint/correctness/noFallthroughSwitchClause: every inner switch returns
    case "chapter":
      switch (arg.action) {
        case "create":
          return t.chapters.$post({ json: arg.body });
        case "update":
          return t.chapters[":id"].$patch({ param: { id: arg.id }, json: arg.body });
        case "delete":
          return t.chapters[":id"].$delete({ param: { id: arg.id } });
      }
  }
}

/**
 * Every taxonomy edit through one hook: the page has a dozen such buttons
 * and they all revalidate the same keys. The batch list shows a class name,
 * so it is refetched too.
 */
export function useTaxonomyWrite() {
  return useSWRMutation(
    ["taxonomy", "write"],
    async (_key, { arg }: { arg: TaxonomyWrite }) => {
      const out = await unwrap<unknown>(await sendTaxonomyWrite(arg));
      await revalidate("taxonomy", "levels", "batches");
      return out;
    },
  );
}
