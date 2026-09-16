import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { SWRConfig } from "swr";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      {/*
        `revalidateOnMount: false` must NOT be set globally alongside
        suspense: a key the clientLoader didn't preload would then have no
        data and no fetch to produce any, and suspend with nothing to resolve
        it. Filters build keys at runtime, so that case is routine.
      */}
      <SWRConfig
        value={{
          suspense: true,
          revalidateOnReconnect: false,
          revalidateOnFocus: false,
          // Preloaded data is fresh enough to paint immediately; the feed
          // subscription is what pushes updates after that.
          revalidateIfStale: true,
          keepPreviousData: true,
        }}
      >
        <HydratedRouter />
      </SWRConfig>
    </StrictMode>,
  );
});
