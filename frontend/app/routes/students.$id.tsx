import { Link, useParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/students.$id";
import {
  fetchStudentProfile,
  fetchSubjects,
  studentProfileKey,
  subjectsKey,
} from "~/lib/queries";
import { AsyncBoundary } from "~/components/async-boundary";
import { CardsSkeleton, Skeleton } from "~/components/skeleton";
import {
  StudentHeader,
  StudentMetrics,
  StudentRecentQuestions,
} from "~/features/profiles/student-profile";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Student profile — Achieve Doubts" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  preload(subjectsKey(), fetchSubjects);
  preload(studentProfileKey(params.id), () => fetchStudentProfile(params.id));
  return null;
}

export default function StudentProfilePage() {
  const { id = "" } = useParams();

  return (
    <main id="main" className="page">
      <div className="wrap">
        <Link className="back" to="/questions">
          <ChevronLeft size={16} />
          Back
        </Link>

        <AsyncBoundary
          fallback={<Skeleton height={180} radius={16} />}
          errorText="This student profile doesn't exist."
        >
          <StudentHeader id={id} />
          <StudentMetrics id={id} />
        </AsyncBoundary>

        <h2 className="h2">Recent questions</h2>
        <AsyncBoundary fallback={<CardsSkeleton count={2} />} errorText="Couldn't load recent questions.">
          <StudentRecentQuestions id={id} />
        </AsyncBoundary>
      </div>
    </main>
  );
}
