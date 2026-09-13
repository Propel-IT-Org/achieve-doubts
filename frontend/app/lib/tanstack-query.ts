import { QueryClient } from "@tanstack/react-query";
import { createContext, RouterContextProvider } from "react-router";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
  },
});

export const queryContext = createContext<QueryClient>();

export function getContext() {
  const routerContext = new RouterContextProvider();
  routerContext.set(queryContext, queryClient);
  return routerContext;
}

export function getQueryClient(context: Readonly<RouterContextProvider>) {
  const client = context.get(queryContext);
  if (!client) {
    throw new Error("QueryClient not found in router context");
  }
  return client;
}
