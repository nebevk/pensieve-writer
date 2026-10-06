/**
 * A part of the app read the first time the page shows it, or earlier through `load`, so Home can
 * appear before the editor's code has been read: the editor alone is half of the app.
 */
export function lazy<T>(read: () => Promise<{ default: T }>) {
  let current = $state.raw<T | null>(null);
  let loading: Promise<T> | null = null;

  function load(): Promise<T> {
    loading ??= read().then(
      (module) => (current = module.default),
      (error: unknown) => {
        // Let the next look try again.
        loading = null;
        throw error;
      },
    );
    return loading;
  }

  return {
    /** The part once it has been read; asking for it starts reading it. */
    get current(): T | null {
      if (!current) load().catch((error: unknown) => console.error(error));
      return current;
    },
    load,
  };
}
