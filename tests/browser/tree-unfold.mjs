// Since 8 October the library's writing folders, note groups and parts start folded unless they lead to
// the chapter on the page. A check that wants a row inside one unfolds them first, as she would.
export const UNFOLD = `(() => {
  let unfolded = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    const folded = [...document.querySelectorAll('.library button.tree-row[aria-expanded="false"]')].filter(
      (el) => el.classList.contains("wfolder") || el.classList.contains("group") || el.classList.contains("part") || el.classList.contains("deleted") || el.closest("li.part"),
    );
    if (!folded.length) break;
    for (const el of folded) el.click();
    unfolded += folded.length;
  }
  return unfolded;
})()`;

/** Clicks the row the expression finds, unfolding the folded rows first if it isn't there yet. */
export async function clickFound(page, find) {
  const click = `(() => { const el = ${find}; if (!el) return false; el.click(); return true; })()`;
  if (await page.run(click)) return true;
  await page.run(UNFOLD);
  await new Promise((resolve) => setTimeout(resolve, 200));
  return page.run(click);
}
