import useSWR from "swr";
import { api, unwrap } from "./api";

/**
 * SWR keys, fetchers and hooks for the admin panel. As on the main site,
 * `clientLoader` preloads the exact key a component reads, suspense is on
 * globally (entry.client.tsx, swr.d.ts), and every reading component sits in
 * its own <AsyncBoundary>.
 */

// ---------- taxonomy ----------

export type Chapter = { id: number; number: number; nameEn: string; nameBn: string };
export type Book = { id: string; nameEn: string; nameBn: string; chapters: Chapter[] };
export type Subject = {
  id: string;
  levelId: string;
  nameEn: string;
  nameBn: string;
  books: Book[];
};
/** A class, with its subjects nested: the API groups, the client renders. */
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
export const useTaxonomyTree = () => useSWR(taxonomyKey(), fetchTaxonomy).data;

// ---------- reports ----------

export type ReportReason = "wrong" | "incomplete" | "behaviour" | "other";

export type AdminReport = {
  id: number;
  questionId: number;
  reason: ReportReason;
  text: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  question: {
    id: number;
    status: string;
    subjectId: string;
    bookId: string;
    chapterId: number;
    deletedAt: string | null;
    solver: { id: string; name: string } | null;
  } | null;
  reporter: { id: string; name: string } | null;
  resolver: { id: string; name: string } | null;
};

/**
 * Every report, open and resolved. The page filters locally, like the
 * prototype, and the sidebar badge counts the open ones from the same data.
 */
export const reportsKey = () => ["reports"] as const;
export const fetchReports = () =>
  api.api.admin.reports.$get({ query: {} }).then((r) => unwrap<AdminReport[]>(r));
export const useReports = () => useSWR(reportsKey(), fetchReports).data;

// ---------- students ----------

export type StudentRow = {
  id: string;
  name: string;
  email: string;
  banned: boolean | null;
  joinedAt: string;
  college: string | null;
  district: string | null;
  hscYear: number | null;
  phone: string | null;
  asked: number;
  satisfied: number;
  unsatisfied: number;
};

export type StudentPage = { students: StudentRow[]; total: number; active: number };

/** Sorting happens in the API: one page can't be sorted client-side. */
export type StudentSort = "recent" | "name" | "asked" | "satisfaction";

export type StudentQuery = {
  q: string;
  sort: StudentSort;
  dir?: "asc" | "desc";
  page: number;
};

export const STUDENTS_PAGE_SIZE = 50;

export const studentsKey = (query: StudentQuery) => ["students", query] as const;

export const fetchStudents = ({ q, sort, dir, page }: StudentQuery) =>
  api.api.admin.students
    .$get({
      query: {
        q: q || undefined,
        sort,
        dir,
        limit: String(STUDENTS_PAGE_SIZE),
        offset: String((page - 1) * STUDENTS_PAGE_SIZE),
      },
    })
    .then((r) => unwrap<StudentPage>(r));

export const useStudents = (query: StudentQuery) =>
  useSWR(studentsKey(query), () => fetchStudents(query)).data;

export type StudentRecord = {
  user: {
    id: string;
    name: string;
    email: string;
    banned: boolean | null;
    createdAt: string;
  };
  student_profiles: {
    college: string | null;
    district: string | null;
    hscYear: number | null;
    phone: string | null;
  } | null;
  batch: {
    id: string;
    label: string;
    active: boolean;
    levelId: string | null;
    levelName: string | null;
  } | null;
  stats: { asked: number; satisfied: number; unsatisfied: number };
};

export const studentKey = (id: string) => ["student", id] as const;
export const fetchStudent = (id: string) =>
  api.api.admin.students[":id"]
    .$get({ param: { id } })
    .then((r) => unwrap<StudentRecord>(r));
export const useStudent = (id: string) =>
  useSWR(studentKey(id), () => fetchStudent(id)).data;

// ---------- solvers ----------

export type SolverRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  phone: string | null;
  institution: string | null;
  dept: string | null;
  batch: number | null;
  isAdminSolver: boolean;
  solved: number;
  satisfactionRate: number | null;
  pendingFollowups: number;
  /** Too many unanswered follow-ups to lock new questions (API's rule). */
  lockBlocked: boolean;
};

export const solversKey = () => ["solvers"] as const;
export const fetchSolvers = () =>
  api.api.admin.solvers.$get().then((r) => unwrap<SolverRow[]>(r));
export const useSolvers = () => useSWR(solversKey(), fetchSolvers).data;

/** "BUET Mechanical ’24"-style credentials from whatever the profile holds. */
export function solverCredentials(s: Pick<SolverRow, "institution" | "dept" | "batch">) {
  return [s.institution, s.dept, s.batch ? `’${s.batch}` : null]
    .filter(Boolean)
    .join(" ");
}

// ---------- batches ----------

/**
 * A course cohort. Achieve sends its id with every student sign-in, and a
 * sign-in for an unknown or inactive batch is refused (UNKNOWN_BATCH).
 */
export type BatchRow = {
  id: string;
  label: string;
  active: boolean;
  /** The class its students study. Null means every level's taxonomy. */
  levelId: string | null;
  levelName: string | null;
  createdAt: string;
  students: number;
  /** Of those students, how many aren't deactivated. */
  activeStudents: number;
};

export const batchesKey = () => ["batches"] as const;
export const fetchBatches = () =>
  api.api.admin.batches.$get().then((r) => unwrap<BatchRow[]>(r));
export const useBatches = () => useSWR(batchesKey(), fetchBatches).data;

// ---------- levels ----------

/** A class: the top of the taxonomy, and what a batch is put on. */
export type LevelRow = {
  id: string;
  nameEn: string;
  nameBn: string;
  sort: number;
};

export const levelsKey = () => ["levels"] as const;
export const fetchLevels = () =>
  api.api.admin.levels.$get().then((r) => unwrap<LevelRow[]>(r));
export const useLevels = () => useSWR(levelsKey(), fetchLevels).data;

// ---------- analytics ----------

export type RangeFilters = {
  from: string;
  to: string;
  subject?: string;
  solver?: string;
};

function rangeQuery(f: RangeFilters) {
  return {
    from: f.from,
    to: f.to,
    subject: f.subject || undefined,
    solver: f.solver || undefined,
  };
}

export type Analytics = {
  perSubject: Array<{ subjectId: string; total: number }>;
  satisfaction: { satisfied: number; unsatisfied: number; unrated: number };
  total: number;
  avgMatchSeconds: number | null;
  avgResponseMinutes: number | null;
  trend: Array<{ day: string; total: number }>;
};

export const analyticsKey = (f: RangeFilters) => ["analytics", f] as const;
export const fetchAnalytics = (f: RangeFilters) =>
  api.api.admin.analytics
    .$get({ query: rangeQuery(f) })
    .then((r) => unwrap<Analytics>(r));
export const useAnalytics = (f: RangeFilters) =>
  useSWR(analyticsKey(f), () => fetchAnalytics(f)).data;

export type RankedSolver = {
  solverId: string;
  name: string;
  active: boolean;
  answered: number;
  satisfied: number;
  unsatisfied: number;
  satisfactionRate: number | null;
  avgResponseMinutes: number | null;
};

export type Rankings = {
  eligibleCount: number;
  rankedCount: number;
  best: RankedSolver[];
  worst: RankedSolver[];
  mostAnswered: RankedSolver | null;
  highestSatisfaction: RankedSolver | null;
  fastest: RankedSolver | null;
};

export type RankingFilters = Omit<RangeFilters, "solver"> & { minAnswered: number };

export const rankingsKey = (f: RankingFilters) => ["rankings", f] as const;
export const fetchRankings = (f: RankingFilters) =>
  api.api.admin.analytics.rankings
    .$get({ query: { ...rangeQuery(f), minAnswered: String(f.minAnswered) } })
    .then((r) => unwrap<Rankings>(r));
export const useRankings = (f: RankingFilters) =>
  useSWR(rankingsKey(f), () => fetchRankings(f)).data;

// ---------- invoice ----------

export type PayoutRow = {
  solverId: string;
  name: string;
  answered: number;
  satisfied: number;
  unsatisfied: number;
  unrated: number;
  avgRespMin: number | null;
};

export const payoutsKey = (from: string, to: string) => ["payouts", from, to] as const;
export const fetchPayouts = (from: string, to: string) =>
  api.api.admin.payouts
    .$get({ query: { from, to } })
    .then((r) => unwrap<PayoutRow[]>(r));
export const usePayouts = (from: string, to: string) =>
  useSWR(payoutsKey(from, to), () => fetchPayouts(from, to)).data;
