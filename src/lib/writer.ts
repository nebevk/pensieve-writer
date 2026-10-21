import { EDITION } from "./edition";

/** Pensieve is written for one author: Eva. Home greets her by name; Hushed Tales, for the owner's friends, by none (IMP-29). */
export const WRITER = EDITION === "pensieve" ? "Eva" : "";
