import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { getQueryClient } from "~/lib/tanstack-query";
import type { Route } from "./+types/_index";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "New React Router App" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

async function list() {
	console.log("list called");
	await new Promise((resolve) => setTimeout(resolve, 1000));
	console.log("list resolved");
	return ["item1", "item2", "item3"];
}

const getList = queryOptions({
	queryKey: ["list"],
	queryFn: async () => {
		return list();
	},
});

export function clientLoader({ context }: Route.ClientLoaderArgs) {
	const queryClient = getQueryClient(context);
	queryClient.query(getList);
	return null;
}

function List() {
	const { data } = useSuspenseQuery(getList);
	return (
		<ul>
			{data.map((item) => (
				<li key={item}>{item}</li>
			))}
		</ul>
	);
}

export default function Home({}: Route.ComponentProps) {
	console.log("first frame");
	return (
		<div>
			<Suspense fallback={<div>Loading...</div>}>
				<List />
			</Suspense>
		</div>
	);
}
