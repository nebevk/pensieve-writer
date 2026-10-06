<script lang="ts">
  import { onMount } from "svelte";

  let { active }: { active: boolean } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let calm = $state(false);
  // Starts the drawing loop; set once the canvas is ready.
  let wake = () => {};

  $effect(() => {
    if (active && !calm) wake();
  });

  onMount(() => {
    // Windows' "show animations" setting turns the particles off, as it does other motion.
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const follow = () => (calm = motion.matches);
    follow();
    motion.addEventListener("change", follow);

    const surface = canvas;
    const context = surface?.getContext("2d");
    if (!surface || !context) return () => motion.removeEventListener("change", follow);
    const dots = Array.from({ length: 18 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.00015 + Math.random() * 0.00025,
      size: 1 + Math.random() * 2,
    }));
    let frame = 0;
    let last = 0;

    const draw = (time: number) => {
      frame = 0;
      // The loop stops while the particles are off, so it never wakes the page for nothing.
      if (!active || calm) {
        context.clearRect(0, 0, surface.width, surface.height);
        return;
      }
      frame = requestAnimationFrame(draw);
      if (document.hidden || time - last < 33) return;
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
    wake = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    if (active && !calm) wake();
    return () => {
      motion.removeEventListener("change", follow);
      wake = () => {};
      cancelAnimationFrame(frame);
    };
  });
</script>

<canvas bind:this={canvas} class="particles" aria-hidden="true"></canvas>

<style>
  /* Fills the writing area, under the page: only the desk around it shows the sparks. */
  .particles {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: -1;
  }
</style>
