<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Editor } from "@tiptap/core";
  import Icon from "./Icon.svelte";
  import { commentAt, findComments, removeComment, setCommentText, showComment, type CommentInfo } from "./comments";
  import { locale, t } from "$lib/ui.svelte";

  let {
    editor,
    revision,
    focusId = "",
    count = $bindable(0),
    onFocused,
    onTodo,
    onNote,
  }: {
    editor: Editor | null;
    /** Bumps on every edit or cursor move in the chapter. */
    revision: number;
    /** A comment just added, to start typing in. */
    focusId?: string;
    /** How many comments the chapter has, so the page can make room for them. */
    count?: number;
    onFocused?: () => void;
    onTodo: (comment: CommentInfo) => void;
    onNote: (comment: CommentInfo) => void;
  } = $props();

  let comments = $state<CommentInfo[]>([]);
  let tops = $state<Record<string, number>>({});
  let height = $state(0);
  let open = $state("");
  let rail: HTMLDivElement | undefined = $state();
  // The comment whose box has the keyboard; the cursor in the text doesn't close it.
  let typingIn = "";
  let readDoc: unknown = null;
  let timer = 0;
  let frame = 0;

  $effect(() => {
    void revision;
    const current = editor;
    if (!current || current.isDestroyed) return;
    // The comment under the cursor opens at once; the list is read again once typing pauses.
    if (!typingIn) setOpen(commentAt(current.state));
    window.clearTimeout(timer);
    timer = window.setTimeout(read, 150);
  });

  $effect(() => {
    if (!focusId) return;
    const id = focusId;
    read();
    void tick().then(() => {
      rail?.querySelector<HTMLTextAreaElement>(`[data-id="${CSS.escape(id)}"] textarea`)?.focus();
      onFocused?.();
    });
  });

  onMount(() => {
    // Cards follow their words when the window, the font or the chapter list changes the page.
    const observer = new ResizeObserver(() => place());
    if (rail?.parentElement) observer.observe(rail.parentElement);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  });

  function read() {
    const current = editor;
    if (!current || current.isDestroyed) return;
    if (current.state.doc !== readDoc) {
      readDoc = current.state.doc;
      comments = findComments(current.state.doc);
      count = comments.length;
    }
    place();
  }

  /** Puts each card level with its words, pushed down where it would overlap the one above. */
  function place() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const current = editor;
      if (!rail || !current || current.isDestroyed) return;
      const origin = rail.getBoundingClientRect().top;
      const size = current.state.doc.content.size;
      const next: Record<string, number> = {};
      let floor = 0;
      for (const comment of comments) {
        let wanted = floor;
        try {
          wanted = current.view.coordsAtPos(Math.min(comment.from, size), 1).top - origin;
        } catch {
          // The words are gone; the card waits below the others until the list is read again.
        }
        const top = Math.max(wanted, floor);
        next[comment.id] = top;
        const card = rail.querySelector<HTMLElement>(`[data-id="${CSS.escape(comment.id)}"]`);
        floor = top + (card?.offsetHeight ?? 64) + 8;
      }
      tops = next;
      height = floor;
    });
  }

  function setOpen(id: string) {
    if (open === id) return;
    open = id;
    const current = editor;
    if (current && !current.isDestroyed) {
      const tr = showComment(current.state, id);
      if (tr) current.view.dispatch(tr);
    }
    place();
  }

  function write(id: string, text: string) {
    const current = editor;
    if (!current || current.isDestroyed) return;
    current.view.dispatch(setCommentText(current.state, id, text));
    place();
  }

  function remove(id: string) {
    const current = editor;
    if (!current || current.isDestroyed) return;
    current.view.dispatch(removeComment(current.state, id));
    if (open === id) open = "";
    read();
  }

  function leave(id: string, text: string) {
    typingIn = "";
    // An empty comment goes away when you move on, but not when you only switch to another window.
    if (!text.trim() && document.hasFocus()) remove(id);
  }

  function backToText(comment: CommentInfo) {
    const current = editor;
    if (!current || current.isDestroyed) return;
    current.chain().focus().setTextSelection(Math.min(comment.to, current.state.doc.content.size)).run();
  }

  function when(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
</script>

<div class="rail" class:empty={comments.length === 0} bind:this={rail} style:min-height="{height}px">
  {#each comments as comment (comment.id)}
    <div
      class="card"
      class:open={open === comment.id}
      data-id={comment.id}
      style:top="{tops[comment.id] ?? 0}px"
      role="group"
      aria-label={t("comment")}
    >
      <div class="head">
        <span>{when(comment.createdAt)}</span>
        <button
          type="button"
          class="remove"
          title={t("deleteComment")}
          aria-label={t("deleteComment")}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => remove(comment.id)}
        >
          <Icon name="x" />
        </button>
      </div>
      <textarea
        rows="1"
        value={comment.text}
        placeholder={t("commentHint")}
        aria-label={t("comment")}
        oninput={(event) => write(comment.id, event.currentTarget.value)}
        onfocus={() => {
          typingIn = comment.id;
          setOpen(comment.id);
        }}
        onblur={(event) => leave(comment.id, event.currentTarget.value)}
        onkeydown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            backToText(comment);
          }
        }}
      ></textarea>
      {#if open === comment.id}
        <div class="actions">
          <button type="button" title={t("commentToTodoHint")} onmousedown={(event) => event.preventDefault()} onclick={() => onTodo(comment)}>
            <Icon name="listTodo" />{t("commentToTodo")}
          </button>
          <button type="button" title={t("commentToNoteHint")} onmousedown={(event) => event.preventDefault()} onclick={() => onNote(comment)}>
            <Icon name="newNote" />{t("commentToNote")}
          </button>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .rail {
    position: relative;
    width: 220px;
    margin-left: 20px;
  }

  .rail.empty {
    display: none;
  }

  /* A slip of paper tucked beside the line it is about. */
  .card {
    position: absolute;
    left: 0;
    right: 0;
    padding: 6px 8px 8px 10px;
    background: var(--pv-paper);
    color: var(--pv-ink);
    box-shadow: var(--pv-shadow-slip);
    border-left: 2px solid var(--pv-ink-rule-accent);
    font-size: var(--pv-text-sm);
  }

  .card.open {
    border-left-color: var(--pv-ink-accent);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    color: var(--pv-ink-meta);
    font-size: var(--pv-text-xs);
  }

  .remove {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 0;
    background: transparent;
    color: var(--pv-ink-muted);
  }

  .remove :global(svg) {
    width: 11px;
    height: 11px;
  }

  .remove:hover {
    background: var(--pv-ink-chip);
    color: var(--pv-ink);
  }

  textarea {
    display: block;
    width: 100%;
    min-height: 1.5em;
    max-height: 12em;
    margin-top: 2px;
    border: 0;
    padding: 0;
    resize: none;
    field-sizing: content;
    background: transparent;
    color: var(--pv-ink);
    font: inherit;
    line-height: 1.45;
    outline: none;
  }

  textarea::placeholder {
    color: var(--pv-ink-muted);
  }

  .actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    border-radius: var(--pv-radius-xs);
    padding: 2px 6px;
    background: var(--pv-ink-chip);
    color: var(--pv-ink-chip-text);
    font-size: var(--pv-text-xs);
  }

  .actions button:hover {
    background: var(--pv-ink-tint);
    color: var(--pv-ink-tint-text);
  }

  .actions :global(svg) {
    width: 12px;
    height: 12px;
  }
</style>
