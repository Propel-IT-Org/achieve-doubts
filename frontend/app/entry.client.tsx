import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { getContext, queryClient } from "./lib/tanstack-query";

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<HydratedRouter getContext={getContext} />
			</QueryClientProvider>
		</StrictMode>,
	);
});
