import "swr";

// entry.client.tsx turns suspense on for every hook; this tells the types, so
// `data` is never `undefined` where a component reads it.
declare module "swr" {
  interface SWRGlobalConfig {
    suspense: true;
  }
}
