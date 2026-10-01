<script lang="ts">
  import { onMount } from "svelte";
  import {
    listNotes,
    listTasks,
    saveNote,
    saveTask,
    type Note,
    type Task,
    type TodoState,
  } from "$lib/storage/organize";

  let { projectId }: { projectId: string } = $props();

  let notes = $state<Note[]>([]);
  let tasks = $state<Task[]>([]);
  let draft = $state("");
  let message = $state("");

  const columns: TodoState[] = ["todo", "doing", "done"];

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    try {
      [notes, tasks] = await Promise.all([listNotes(projectId), listTasks(projectId)]);
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not load todos";
    }
  }

  function cards(state: TodoState): { id: string; title: string; kind: "note" | "task" }[] {
    return [
      ...notes
        .filter((note) => note.todoState === state)
        .map((note) => ({ id: note.id, title: note.title, kind: "note" as const })),
      ...tasks
        .filter((task) => task.todoState === state)
        .map((task) => ({ id: task.id, title: task.title, kind: "task" as const })),
    ];
  }

  async function move(id: string, kind: "note" | "task", state: TodoState) {
    const updatedAt = new Date().toISOString();
    try {
      if (kind === "note") {
        const note = notes.find((item) => item.id === id);
        if (!note) return;
        const next = { ...note, todoState: state, updatedAt };
        notes = notes.map((item) => (item.id === id ? next : item));
        await saveNote(next);
      } else {
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        const next = { ...task, todoState: state, updatedAt };
        tasks = tasks.map((item) => (item.id === id ? next : item));
        await saveTask(next);
      }
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not update that todo";
    }
  }

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      title,
      todoState: "todo",
      updatedAt: new Date().toISOString(),
    };
    draft = "";
    tasks = [task, ...tasks];
    try {
      await saveTask(task);
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not add the task";
    }
  }
</script>

<section class="board">
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void addTask();
    }}
  >
    <input bind:value={draft} aria-label="New task" placeholder="New task" />
    <button type="submit">Add</button>
  </form>
  <div class="columns">
    {#each columns as state (state)}
      <div class="column">
        <h2>{state}</h2>
        {#each cards(state) as card (card.kind + card.id)}
          <article>
            <p>{card.title}</p>
            <div>
              {#each columns as next (next)}
                <button
                  type="button"
                  class:active={next === state}
                  onclick={() => void move(card.id, card.kind, next)}
                >
                  {next}
                </button>
              {/each}
            </div>
          </article>
        {/each}
      </div>
    {/each}
  </div>
  {#if message}
    <p class="error" role="alert">{message}</p>
  {/if}
</section>

<style>
  .board {
    height: 100%;
    overflow: auto;
    padding: 1rem 1.25rem 2rem;
  }

  form {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }

  input {
    width: 18rem;
    max-width: 100%;
    border: 1px solid var(--line);
    background: var(--paper);
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .column {
    background: var(--sidebar);
    border-radius: 10px;
    padding: 0.7rem;
    min-height: 12rem;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }

  article {
    background: var(--paper);
    border-radius: 8px;
    padding: 0.55rem 0.65rem;
    margin-bottom: 0.45rem;
  }

  article p {
    margin: 0 0 0.35rem;
  }

  button {
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 0.15rem 0.35rem;
    color: var(--muted);
    font-size: 0.75rem;
  }

  button.active {
    color: var(--ink);
    background: var(--desk);
  }

  .error {
    color: var(--danger);
  }
</style>
