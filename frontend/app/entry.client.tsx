import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { SWRConfig } from "swr";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <SWRConfig
        value={{
          suspense: true,
          revalidateOnReconnect: false,
          revalidateOnMount: false,
          revalidateOnFocus: false,
          revalidateIfStale: false,
        }}
      >
        <HydratedRouter />
      </SWRConfig>
    </StrictMode>,
  );
});
