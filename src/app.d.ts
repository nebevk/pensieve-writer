declare global {
  namespace App {}
  interface ImportMetaEnv {
    /** "hushed" builds Hushed Tales, the version for the owner's friends (IMP-29); otherwise it is Pensieve. */
    readonly VITE_EDITION?: string;
  }
}

export {};
