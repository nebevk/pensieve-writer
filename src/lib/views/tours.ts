import { t } from "$lib/ui.svelte";
import type { TourStep } from "./Tour.svelte";

/** The places with tutorial tips, each shown the first time she reaches it (owner, 8 October). */
export type TourPlace = "home" | "write" | "notes" | "book";

/** What the tips at each place point at and say. */
export function tourFor(place: TourPlace): TourStep[] {
  if (place === "home") {
    return [
      { target: ".home .continue", title: t("tipHomeTitle"), text: t("tipHomeText") },
      { target: ".gear", title: t("tipSettingsTitle"), text: t("tipSettingsText") },
    ];
  }
  if (place === "write") {
    return [
      { target: ".sidebar", title: t("tipLibraryTitle"), text: t("tipLibraryText") },
      { target: ".paper", title: t("tipPageTitle"), text: t("tipPageText") },
      { target: ".ribbon", title: t("tipToolbarTitle"), text: t("tipToolbarText") },
      { target: ".statusbar", title: t("tipBarTitle"), text: t("tipBarText") },
      { target: ".titlebar .tabs", title: t("tipViewsTitle"), text: t("tipViewsText") },
    ];
  }
  if (place === "notes") return [{ target: ".notes .list", title: t("tipNotesTitle"), text: t("tipNotesText") }];
  return [{ target: ".book .bar", title: t("tipBookTitle"), text: t("tipBookText") }];
}
