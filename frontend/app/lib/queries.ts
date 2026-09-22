import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { api, unwrap } from "./api";

/**
 * SWR keys, fetchers and hooks in one place, so `clientLoader` can
 * `preload(...)` the exact key a component later reads. Keys are arrays; the
 * first element namespaces the resource.
 *
 * The `use*` hooks suspend (suspense is on globally — see entry.client.tsx and
 * swr.d.ts): each component that calls one sits inside its own
 * <AsyncBoundary>, so the page shell paints at once and every section fills
 * in as its own request lands. Several components reading the same key share
 * one request.
 */

// ---------- taxonomy ----------

export type Chapter = {
  id: number;
  number: number;
  nameEn: string;
  nameBn: string;
};
export type Book = {
  id: string;
  nameEn: string;
  nameBn: string;
  chapters: Chapter[];
};
export type Subject = {
  id: string;
  levelId: string;
  nameEn: string;
  nameBn: string;
  books: Book[];
};
/**
 * A class, with its subjects nested. The API groups and filters: a student
 * gets their own class and nothing else, everyone else gets them all.
 */
export type Level = {
  id: string;
  nameEn: string;
  nameBn: string;
  sort: number;
  subjects: Subject[];
};

export const taxonomyKey = () => ["taxonomy"] as const;
export const fetchTaxonomy = () =>
  api.api.taxonomy.$get().then((r) => unwrap<Level[]>(r));

export const useTaxonomyTree = () =>
  useSWR(taxonomyKey(), fetchTaxonomy).data;

// ---------- questions ----------

export type QuestionListFilters = {
  subject?: string;
  book?: string;
  chapter?: number;
  status?: string;
  q?: string;
  mine?: boolean;
  cursor?: string;
  limit?: number;
};

export type QuestionRow = {
  id: number;
  askerId: string;
  subjectId: string;
  bookId: string;
  chapterId: number;
  text: string;
  photoUrl: string | null;
  status: string;
  solverId: string | null;
  matchedAfterSec: number | null;
  askedAt: string;
  answeredAt: string | null;
};

/** One keyset page of the questions feed. */
export type QuestionPage = {
  items: QuestionRow[];
  nextCursor: string | null;
};

export const questionsKey = (filters: QuestionListFilters) =>
  ["questions", filters] as const;

export function fetchQuestions(filters: QuestionListFilters) {
  const query: Record<string, string> = {};
  if (filters.subject) query.subject = filters.subject;
  if (filters.book) query.book = filters.book;
  if (filters.chapter) query.chapter = String(filters.chapter);
  if (filters.status) query.status = filters.status;
  if (filters.q) query.q = filters.q;
  if (filters.mine) query.mine = "true";
  if (filters.cursor) query.cursor = filters.cursor;
  if (filters.limit) query.limit = String(filters.limit);

  return api.api.questions.$get({ query }).then((r) => unwrap<QuestionPage>(r));
}

export const questionKey = (id: number) => ["question", id] as const;
export const fetchQuestion = (id: number) =>
  api.api.questions[":id"]
    .$get({ param: { id: String(id) } })
    .then((r) => unwrap<QuestionDetail>(r));

export const useQuestion = (id: number) =>
  useSWR(questionKey(id), () => fetchQuestion(id)).data;

export type QuestionDetail = QuestionRow & {
  lockedAt: string | null;
  lockExpiresAt: string | null;
  ratedAt: string | null;
  asker: { id: string; name: string; image: string | null } | null;
  solver: { id: string; name: string; image: string | null } | null;
  subject: Subject | null;
  book: Book | null;
  chapter: Chapter | null;
  solution?: SolutionRow | null;
  thread?: ThreadRow[];
};

export type SolutionRow = {
  id: number;
  questionId: number;
  solverId: string;
  text: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
  createdAt: string;
  deletedAt: string | null;
};

/**
 * Cursor-paginated questions list.
 *
 * The API paginates by keyset (`nextCursor`), not by page number, so each page
 * key has to carry the *previous* page's cursor — which is exactly the shape
 * `useSWRInfinite`'s `getKey(index, previousPageData)` provides.
 *
 * Deliberately not suspense: `setSize` would re-suspend the whole list on
 * every "load more", throwing the reader back to a fallback. The first page is
 * still primed from `clientLoader`, so the initial paint is immediate.
 */
export function useQuestionsInfinite(
  filters: QuestionListFilters,
  pageSize = 20,
) {
  const swr = useSWRInfinite(
    (index, previous: QuestionPage | null) => {
      // `null` ends the list — SWR stops requesting further pages.
      if (previous && !previous.nextCursor) return null;
      const cursor = index === 0 ? null : (previous?.nextCursor ?? null);
      return ["questions-infinite", filters, cursor] as const;
    },
    ([, pageFilters, cursor]) =>
      fetchQuestions({
        ...pageFilters,
        cursor: cursor ?? undefined,
        limit: pageSize,
      }),
    {
      // The first page revalidating on every append would refetch the whole
      // list each time the reader scrolls.
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      suspense: false,
    },
  );

  const pages = swr.data ?? [];
  const items = pages.flatMap((page) => page.items);
  const last = pages[pages.length - 1];

  return {
    ...swr,
    items,
    hasMore: Boolean(last?.nextCursor),
    /** True only while an *additional* page is in flight, not the first. */
    isLoadingMore:
      swr.isValidating && pages.length > 0 && swr.size > pages.length,
    isLoadingInitial: !swr.data && !swr.error,
    loadMore: () => swr.setSize((size) => size + 1),
  };
}

// ---------- comments / thread ----------

export type CommentRow = {
  id: number;
  authorId: string;
  /** Null only if the account no longer exists. */
  authorName: string | null;
  authorRole: string | null;
  text: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
  createdAt: string;
  deleted: boolean;
};

export type ThreadRow = Omit<CommentRow, "authorName" | "authorRole"> & {
  authorSide: "asker" | "solver";
};

export const commentsKey = (id: number) => ["comments", id] as const;
export const fetchComments = (id: number) =>
  api.api.questions[":id"].comments
    .$get({ param: { id: String(id) } })
    .then((r) => unwrap<{ comments: CommentRow[] }>(r));

export const useComments = (id: number) =>
  useSWR(commentsKey(id), () => fetchComments(id)).data.comments;

export const threadKey = (id: number) => ["thread", id] as const;
export const fetchThread = (id: number) =>
  api.api.questions[":id"].thread
    .$get({ param: { id: String(id) } })
    .then((r) => unwrap<{ messages: ThreadRow[] }>(r));

/** The thread is login-gated, so the key is null for guests. */
export function useThread(id: number, enabled: boolean): ThreadRow[] {
  const { data } = useSWR(
    enabled ? threadKey(id) : null,
    () => fetchThread(id),
  );
  // A null key never suspends and leaves `data` unset, whatever its type says.
  return (data as { messages: ThreadRow[] } | undefined)?.messages ?? [];
}

// ---------- notifications ----------

export type NotificationRow = {
  id: number;
  type: string;
  questionId: number | null;
  actorId: string | null;
  createdAt: string;
  readAt: string | null;
};

export const notificationsKey = (filters: { type?: string; read?: string }) =>
  ["notifications", filters] as const;

export function fetchNotifications(filters: { type?: string; read?: string }) {
  const query: Record<string, string> = {};
  if (filters.type) query.type = filters.type;
  if (filters.read) query.read = filters.read;
  return api.api.me.notifications
    .$get({ query })
    .then((r) => unwrap<{ items: NotificationRow[] }>(r));
}

export const useNotifications = (filters: { type?: string; read?: string }) =>
  useSWR(notificationsKey(filters), () => fetchNotifications(filters))
    .data.items;

export const unreadKey = () => ["notifications", "unread"] as const;
export const fetchUnread = () =>
  api.api.me.notifications.unread
    .$get()
    .then((r) => unwrap<{ count: number }>(r));

/**
 * Header badge. Not suspense — the header must never wait on it. The feed
 * doesn't say whose question an event concerns, so the count is polled
 * rather than revalidated on every event for every client.
 */
export function useUnreadCount(enabled: boolean): number {
  const { data } = useSWR(enabled ? unreadKey() : null, fetchUnread, {
    suspense: false,
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
  return data?.count ?? 0;
}

// ---------- profiles / stats ----------

export type HomeStats = {
  solved: number;
  satisfactionRate: number | null;
  medianMatchSeconds: number | null;
  medianAnswerMinutes: number | null;
  solversAvailable: number;
};

export const homeStatsKey = () => ["stats", "home"] as const;
export const fetchHomeStats = () =>
  api.api.stats.home.$get().then((r) => unwrap<HomeStats>(r));
export const useHomeStats = () =>
  useSWR(homeStatsKey(), fetchHomeStats).data;

export type SolverDashboard = {
  solved: number;
  satisfied: number;
  unsatisfied: number;
  satisfactionRate: number | null;
  avgResponseMinutes: number | null;
  locked: number;
  unlocked: number;
  unlockRate: number | null;
  openQuestions: number;
  lockedByMe: QuestionRow[];
  /** Questions whose latest follow-up is the student's, awaiting a reply. */
  pendingFollowups: QuestionRow[];
  /** How many of those a solver may hold and still lock new questions. */
  followupLimit: number;
  /** Over the limit: locking new questions is paused. */
  lockBlocked: boolean;
  recentlySolved: QuestionRow[];
};

export const dashboardKey = () => ["solver", "dashboard"] as const;
export const fetchDashboard = () =>
  api.api.me.solver.dashboard.$get().then((r) => unwrap<SolverDashboard>(r));
/**
 * A student's follow-up arrives from another browser, so the count is
 * re-read whenever the solver comes back to the tab.
 */
export const useDashboard = () =>
  useSWR(dashboardKey(), fetchDashboard, { revalidateOnFocus: true }).data;

export type StudentProfile = {
  id: string;
  name: string;
  joinedAt: string;
  hscYear: number | null;
  college: string | null;
  district: string | null;
  asked: number;
  answered: number;
  satisfactionRate: number | null;
  avgMatchSeconds: number | null;
  recentQuestions: QuestionRow[];
};

export const studentProfileKey = (id: string) => ["student", id] as const;
export const fetchStudentProfile = (id: string) =>
  api.api.students[":id"]
    .$get({ param: { id } })
    .then((r) => unwrap<StudentProfile>(r));
export const useStudentProfile = (id: string) =>
  useSWR(studentProfileKey(id), () => fetchStudentProfile(id)).data;

export type SolverProfile = {
  id: string;
  name: string;
  joinedAt: string;
  institution: string | null;
  dept: string | null;
  batch: number | null;
  solved: number;
  satisfactionRate: number | null;
  avgResponseMinutes: number | null;
  recentlySolved: QuestionRow[];
};

export const solverProfileKey = (id: string) => ["solver-profile", id] as const;
export const fetchSolverProfile = (id: string) =>
  api.api.solvers[":id"]
    .$get({ param: { id } })
    .then((r) => unwrap<SolverProfile>(r));
export const useSolverProfile = (id: string) =>
  useSWR(solverProfileKey(id), () => fetchSolverProfile(id)).data;

// The student-facing "my reports" list isn't built yet; its key/fetcher pair
// went with it rather than sitting here unused. GET /api/me/reports still
// exists server-side for when that screen lands.
