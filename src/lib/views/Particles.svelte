<script lang="ts">
  import { onMount } from "svelte";

  let { active }: { active: boolean } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  let playing = false;

  $effect(() => {
    playing = active;
  });

  onMount(() => {
    const surface = canvas;
    if (!surface) return;
    const context = surface.getContext("2d");
    if (!context) return;
    const dots = Array.from({ length: 18 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.00015 + Math.random() * 0.00025,
      size: 1 + Math.random() * 2,
    }));
    let frame = 0;
    let last = 0;
    let running = true;

    const draw = (time: number) => {
      if (!running) return;
      frame = requestAnimationFrame(draw);
      if (!playing || document.hidden || time - last < 33) return;
      last = time;
      const width = surface.clientWidth;
      const height = surface.clientHeight;
      if (surface.width !== width) surface.width = width;
      if (surface.height !== height) surface.height = height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(240, 194, 122, 0.35)";
      for (const dot of dots) {
        dot.y -= dot.speed;
        if (dot.y < 0) dot.y = 1;
        context.beginPath();
        context.arc(dot.x * width, dot.y * height, dot.size, 0, Math.PI * 2);
        context.fill();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  });
</script>

<canvas bind:this={canvas} class="particles" aria-hidden="true"></canvas>

<style>
  .particles {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>
