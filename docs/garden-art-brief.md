# Vrt zgodb: the art brief for Claude Design

The pictures for the garden of stories ([garden-concept.md](garden-concept.md)), described so Claude Design can
draw them without seeing the app.

**How to use it.** Each request to Claude Design gets **Part 1** (the shared rules) and **one batch** from
Part 2. Ask for every file as its own SVG with the name given. Start with batch A (the plant): both the garden
and Home's mark use it. The batches can come in any order after that, as each file stands alone.

---

## Part 1: shared rules (paste with every batch)

### What this is

Illustrations for **Pensieve**, a cozy desktop writing app. A small tree grows out of a stone basin, the app's
logo, as the writer writes. Around the basin, small **keepsakes** appear one by one: flowers, books, birds,
butterflies, teacups, a lantern. Every picture is a **layer**: the app lays the files on top of each other to
make the scene, so each file holds **one element, drawn in its final place, with everything else transparent**.

### The canvas

- Every file: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">`.
- Same coordinates in every file. **x** runs 0 to 600 from left to right, **y** runs 0 to 400 from top to bottom.
- **Transparent**: no background rectangle, except in the five backdrop files.
- Nothing may move to fit: an element sits exactly where this brief puts it, so the layers line up.

### The style

The style of the app's existing art: **flat vector, built from simple geometric shapes**.
- **Shapes:** circles, ellipses, rectangles with rounded corners, and short smooth paths for leaves and
  petals.
- **Gradients:** at most a gentle two-colour linear or radial gradient; most shapes are one flat colour.
- **Outlines:** none. The only exception is paper (pages, books' page edges), which may have a thin 1.5 px
  line in #d9cfbf, as the app's paper notes do.
- **Light:** comes from the **upper left**. A round thing may have one lighter shape on its upper-left side
  and one darker shape on its lower right, and no more.
- **Glow** (fireflies, lantern, sun) is a **radial gradient circle** fading to fully transparent. Never use
  SVG filters (no blur, no drop shadow): the app must stay light.
- **Not allowed:** text, letters or numbers anywhere, embedded images, and faces beyond two small dot eyes
  (birds and the owl). Each file stays small, under about 10 KB.
- **The mood:** warm, quiet, a little naive, like a children's book printed in few colours. Nothing glossy,
  nothing cartoon-loud, no bounce.
- **Light and dark:** the same plant and keepsakes are shown over light backdrops (cream) and dark ones
  (near-black brown, night blue). Use mid tones, nothing darker than #5c3d28 except the tiny eyes, and
  give every element a lighter upper-left edge so it reads on the dark backdrops too.

### The colours

| Use | Colours |
|---|---|
| Leaves: deep, mid, light, pale | #3f7d4e, #5e9654, #74b350, #a9d18e |
| Trunk and branches, with its shade | #7a5236, #5c3d28 |
| Soil | #6b4a33 |
| Wood (gate, birdhouse, posts, sticks), with its shade | #b98a5e, #8c6440 |
| Stone (stepping stones, tea slab), with its shade | #c4bcae, #9d9486 |
| Terracotta, rust, warm orange, peach | #a94f2e, #c46a35, #e0975a, #f4c3b8 |
| Paper cream and its line | #fcf9f2, #d9cfbf |
| Butter yellow | #f2c95b |
| Poppy red, rose pink, tulip coral | #d4553f, #e48a9a, #e07a5f |
| Lavender, and deeper | #a99cf5, #8a7fd6 |
| Forget-me-not blue, slate blue | #7fa7d8, #7a8fb3 |
| Firefly and lantern light: core, glow | #f6d2a8, #e9a265 |
| Eyes and bee stripes | #3b2f2a |

### The basin, and where everything goes

The basin is the app's logo, scaled up. It is drawn by the basin files (batch B). All other files leave its
area to it:

- **Bowl:** `M211 289 H389 A89 65 0 0 1 211 289 Z`. A flat rim from x 211 to x 389 at y 289, and a half-ellipse
  bowl down to y 354.
- **Foot:** a rounded rectangle under the bowl: x 278, y 360, width 44, height 12, corner radius 6.
- **Ground:** the lawn is a wide, flat ellipse from about y 340 down. Things stand on it on two rows:
  - the **back row** has its feet on **y 360**;
  - the **front row** has its feet on **y 390**.
- **The tree's room:** at its biggest the crown fills x 150 to 450, y 20 to 240, and the trunk rises at
  x 285 to 315 from the rim up to the crown. Keepsakes never touch the crown's area or the trunk. Below the
  crown, beside the trunk, the two rim birds and one bee have their places.
- **The air:** left of the tree's room (x 10 to 145) and right of it (x 455 to 590), from y 20 down to about y 300.
- **Layer order** in the app, bottom to top: backdrop, plant, basin, keepsakes. Keepsakes that touch overlap
  back row behind front row.

```
y  0 ┌──────────────────────────────────────────────────────────┐
     │ rainbow        ·   ·  tree's room (x 150–450)  bird-2    │
     │ idea-1 ·           ╭───────────────╮           idea-2    │
     │ idea-3            (    the crown    )        butterflies  │
     │ butterflies        ╰───────╥───────╯         fireflies   │
     │ fireflies                  ║ trunk                       │
 240 │ flower-7 sunflower    robin║        owl   flower-8 chime  │
 289 │ gate pennant books  ▔▔▔▔▔▔rim▔▔▔▔▔▔ lantern rose birdhouse│ back row, feet y 360
 354 │                       ╲   bowl    ╱                      │
 390 │ can poppies manuscript buttercups daisy  stones  forget-me-nots lavender tea tulips bird-1 │ front row
 400 └──────────────────────────────────────────────────────────┘
```

The exact box of every keepsake is in its batch below: **x from–to, y from–to**. A keepsake stays inside its
box.

---

## Part 2: the batches

### Batch A: the plant, eight stages (`stage-1.svg` … `stage-8.svg`)

The same tree at eight ages. It grows from the middle of the basin, its trunk centred on **x 300**.
- **What's drawn:** the plant alone, no basin and no ground. The basin is drawn over it by another file.
- **The gap at the rim:** in every stage, cut the plant away wherever it comes within about 8 px of the
  basin, so a thin gap of background shows between plant and rim. That is how the logo does it. Use a mask:
  white everywhere, plus the bowl path (`M211 289 H389 A89 65 0 0 1 211 289 Z`) filled black with a black
  stroke 17 px wide and round joins.
- **The same in every look:** stages 1 to 3 are a sprout in the logo's greens; later stages add the trunk
  browns.

1. **`stage-1` Seme (a seed).** A low soil mound peeks over the rim: a half-ellipse of soil #6b4a33, x 255 to
   345, rising to y 276 (the gap cuts its foot). On its top lies one seed, an oval tilted 20°, x 292 to 310,
   y 266 to 278, in #8c6440 with a lighter #b98a5e upper-left half. A tiny pale-green tip (#a9d18e), 5 px
   long, comes out of the seed's top.
2. **`stage-2` Kalček (a sprout).** The Forest logo's sprout, scaled 2.4 times.
   - The same soil mound as stage 1.
   - A stem: a line from (300, 296) up to (300, 262), 8 px wide with round ends, #74b350.
   - Two pointed oval leaves in #74b350, each a vesica shape (two curves meeting in points at both ends).
     The left one starts at (298, 261), is 62 px long and 24 px wide, and leans up and left at 48° from
     upright. The right one starts at (302, 268), is 50 px long and 20 px wide, and leans up and right at
     50°.
3. **`stage-3` Sadika (a seedling).**
   - The soil mound.
   - A stem from (300, 296) up to (300, 214), 9 px wide, #5e9654, bending gently left then right.
   - Five vesica leaves in alternate pairs up the stem, in #74b350 and #5e9654. The lowest pair is 46 px
     long; the top leaf is 34 px long and points straight up. Each leaf has a thin lighter vein (#a9d18e).
   - Room: x 250 to 350, y 196 to the rim.
4. **`stage-4` Drevesce (a sapling).**
   - The soil mound.
   - A slim trunk, #7a5236 with a #5c3d28 right edge, 12 px wide at the rim, 9 px at the top, from the rim
     up to y 196.
   - A small round crown of three overlapping circles: deep green #3f7d4e, r 38, at (300, 168); mid green
     #5e9654, r 30, at (276, 182); light green #74b350, r 28, at (326, 180).
   - One pale highlight circle, #a9d18e, r 12, at (286, 150).
   - Crown room: x 248 to 352, y 128 to 208.
5. **`stage-5` Mlado drevo (a young tree).**
   - A trunk 16 px wide at the rim, tapering, #7a5236 with a #5c3d28 shade.
   - Two short branches at y 190, angled up left and up right, 6 px wide.
   - A crown of five overlapping circles in three greens. The largest, r 50, is at (300, 140); the others,
     r 36 to 42, sit around it.
   - Two pale highlight circles on the upper left.
   - Crown room: x 215 to 385, y 90 to 215.
6. **`stage-6` Drevo (a tree).**
   - A trunk 22 px wide at the rim, with a slight flare at its base, #7a5236 with a #5c3d28 shade on its
     right side.
   - Three branches into the crown.
   - A crown of seven overlapping circles and ellipses in deep, mid and light green, the deepest at the
     bottom and right, the lightest at the top left.
   - Three pale #a9d18e highlight circles on the upper left.
   - Crown room: x 180 to 420, y 50 to 235.
7. **`stage-7` Cvetoče drevo (a tree in blossom).**
   - Stage 6, a little fuller: crown room x 165 to 435, y 35 to 240.
   - About 14 small blossoms dotted evenly over the crown. Each is a five-petal flower of peach #f4c3b8
     petals, 5 px circles around a cream #fcf9f2 centre, about 14 px across. Some are half hidden at the
     crown's edge.
8. **`stage-8` Drevo zgodb (a story tree).**
   - The fullest tree: crown room x 150 to 450, y 20 to 240.
   - A trunk 28 px wide at the rim. Two root shapes spread over the rim's middle; the gap cuts them as for
     the stem.
   - The crown is nine overlapping circles and ellipses in the four greens, with the blossoms of stage 7.
   - **What makes it the story tree:** among the leaves hang six small cream "pages". Each is a 12 by 16 px
     rounded rectangle in #fcf9f2 with a #d9cfbf 1.5 px line, two short #d9cfbf line marks inside, and
     tilted a little. They hang on thin #5c3d28 threads from the crown's lower edge, spread from x 190 to 410.

### Batch B: the looks (`backdrop-*.svg` and `basin-*.svg`)

**Backdrop** files: one for each look, the only files with a background. Each one has, in this order:
1. **A full rectangle** in the look's background colour.
2. **The halo**: a circle centred at (300, 190), r 190, in the look's halo colour at the halo's opacity.
3. **The look's light** in the sky, as described for each look below.
4. **The lawn**: an ellipse centred at (300, 386), rx 330, ry 46, in the look's ground colour at opacity 0.85.
5. **The contact shadow** under the basin: an ellipse centred at (300, 373), rx 72, ry 8, in the shadow colour.

**Basin** files: the bowl path and the foot from Part 1, both in the look's basin colour. No light and no
plant in them. Add one darker crescent along the bowl's lower right: the basin colour mixed 25 % with black,
at opacity 0.35.

| Look | Background | Halo | Ground | Shadow | Basin | The light in the sky |
|---|---|---|---|---|---|---|
| `daylight` | #f3eee5 | #ffe1d0, 0.6 | #cfdcb8 | #5a4630, 0.14 | #a94f2e | A sun: #e0975a circle r 26 at (505, 78), in a #ffe1d0 ring r 40 at 0.6 |
| `sunset` | #fdf4e6 | #f4c3b8, 0.6 | #d9a08c | #5a4630, 0.14 | #a63f33 | A setting sun: #e77b5c circle r 34 at (520, 330), its lower half behind the lawn. Over the top of the sky, a soft band fading from #f4c3b8 to clear |
| `candlelit` | #1f1a16 | #e0975a, 0.16 | #4a3a2c | #000000, 0.35 | #c46a35 | No sun. A warmer glow behind the basin: a radial gradient circle at (300, 250), r 170, from #e9a265 at 0.22 to clear |
| `moonlit` | #161a26 | #a99cf5, 0.16 | #2a3250 | #000000, 0.35 | #a99cf5 | A crescent moon: a #e6e8f0 circle r 24 at (500, 72), with a circle r 20 at (510, 66) cut out. Seven tiny #e6e8f0 stars, r 1.2 to 2: three on the left above y 90 and four on the right above y 120 |
| `forest` | #f2f6e9 | #d3ebb4, 0.6 | #b7d699 | #5a4630, 0.14 | #3f7d4e | Morning light through leaves: three #ffffff circles at 0.25, r 60, 40 and 26, at (110, 70), (520, 60) and (560, 150). Three soft #a9d18e leaf shapes, 30 px, at the top corners |

Ten files in all: `backdrop-daylight`, `backdrop-sunset`, `backdrop-candlelit`, `backdrop-moonlit`,
`backdrop-forest`, and `basin-daylight`, `basin-sunset`, `basin-candlelit`, `basin-moonlit`, `basin-forest`.

### Batch C: words, the flowers (`flower-1` … `flower-9`)

Each word milestone brings a flower, and they get grander as the words grow. **Flowers 1 to 6 stand in the
front row** (feet on y 390) **and 7 to 9 in the back row** (feet on y 360). Stems are #5e9654 lines 2.5 to
4 px wide, with a #74b350 vesica leaf or two.

1. **`flower-1` A daisy (100 words).** Box x 196 to 214, y 370 to 392. One small daisy: eight white
   #fcf9f2 oval petals around a #f2c95b centre, about 14 px across, on a short stem with one leaf.
2. **`flower-2` Forget-me-nots (1,000).** Box x 386 to 404, y 368 to 392. Three tiny five-petal flowers,
   #7fa7d8 with #f2c95b dots for centres, on two thin stems.
3. **`flower-3` Buttercups (5,000).** Box x 164 to 190, y 358 to 392. Three cup-shaped yellow flowers,
   #f2c95b with a lighter rim, on stems of different heights, with two leaves at the foot.
4. **`flower-4` Lavender (10,000).** Box x 410 to 434, y 354 to 392. Three slim spikes of small #a99cf5 and
   #8a7fd6 ovals stacked up thin stems, with narrow leaves at the foot.
5. **`flower-5` Poppies (25,000).** Box x 70 to 96, y 350 to 392. Two red poppies, #d4553f with a darker
   centre (#5c3d28 at 0.6), four rounded petals each, on curving stems, and one closed bud.
6. **`flower-6` Tulips (50,000).** Box x 532 to 554, y 350 to 392. Two tulips: cup shapes of three
   pointed petals, one #e07a5f and one #e48a9a, on straight stems with long leaves.
7. **`flower-7` A sunflower (80,000, a novel's worth).** Box x 76 to 106, y 236 to 360 (back row).
   - A tall stem with three big leaves.
   - A head turned a little to the right: a #7a5236 disc, r 12, ringed by sixteen #f2c95b pointed petals.
8. **`flower-8` Hollyhocks (100,000).** Box x 484 to 508, y 236 to 360 (back row). A tall spire of six
   round #e48a9a blossoms, getting smaller towards the top, each with a lighter centre, up one stem, with
   broad leaves at the foot.
9. **`flower-9` A rose bush (150,000).** Box x 436 to 480, y 314 to 360 (back row). A round bush of
   #3f7d4e and #5e9654 leaves, with five roses: #e48a9a spirals of three overlapping circles, one rose
   #f4c3b8.

### Batch D: writing days and good days (`firefly-1` … `firefly-5`, `butterfly-1` … `butterfly-4`)

**Fireflies, one file each.** Every firefly is a glow: a radial gradient circle, r 9, from #e9a265 at 0.55 to
clear, around a #f6d2a8 core, r 2.5. They float in the air, never in the tree's room. Each file adds these:
- `firefly-1` (the first day): one at (128, 206).
- `firefly-2` (7 days): two, at (470, 252) and (536, 196).
- `firefly-3` (30 days): three, at (40, 118), (56, 262) and (136, 170).
- `firefly-4` (100 days): three, at (590, 196), (466, 160) and (566, 60).
- `firefly-5` (365 days): four, at (22, 282), (300, 8), (446, 24) and (160, 10).

**Butterflies for good days.** Each is two pairs of wings: upper wings as larger rounded triangles, lower
wings as smaller round ones, a slim #5c3d28 body, and two tiny feelers. Seen from above, wings open, tilted
a little as in flight.
- `butterfly-1` (500 words in a day). Box x 112 to 134, y 248 to 270. Butter yellow #f2c95b wings with a
  #e0975a edge.
- `butterfly-2` (1,000). Box x 462 to 484, y 198 to 220. Peach #f4c3b8 wings with #e48a9a spots.
- `butterfly-3` (2,000). Box x 28 to 52, y 218 to 240. Blue #7fa7d8 wings with lighter tips.
- `butterfly-4` (5,000, inspired). Box x 552 to 580, y 146 to 170. The biggest: warm orange #e0975a wings with
  cream spots, and a faint glow (radial #f6d2a8 at 0.3, r 20) around it.

### Batch E: the daily goal (`can`, `bee-1`, `bee-2`)

- **`can` A watering can (the first time).** Box x 12 to 66, y 354 to 392, front row.
  - A rounded terracotta #a94f2e body, its lighter side at the upper left.
  - A long spout to the right, ending in a round rose (a small disc).
  - A handle arching over the top.
  - Three small drops of #7fa7d8 falling from the rose onto the grass.
- **`bee-1` A bee (10 times).** Box x 150 to 168, y 274 to 292, in the air over the books. A round #f2c95b
  body with two #3b2f2a stripes, and two #fcf9f2 wings at 0.7 like small ovals. A tiny dotted flight trail
  of three #f2c95b dots behind it.
- **`bee-2` A second bee (50 times).** Box x 428 to 446, y 280 to 298, over the rose bush. The same bee,
  flying the other way.

### Batch F: chapters and books (`books-1`, `books-2`, `books-3`, `pennant`, `manuscript`)

**The books grow as one stack**, back row, just left of the basin, in box x 146 to 204. `books-2` and `books-3`
sit on top of the earlier ones (they always come in order).

- **`books-1` (the first chapter).** Two closed books lying flat, slightly offset, feet on y 360, reaching y 338.
  - A lower one 56 px long and 11 px thick in terracotta #a94f2e, and an upper one 50 px long in slate blue
    #7a8fb3.
  - Each has a cream #fcf9f2 page edge on the side facing the viewer, with a 1.5 px #d9cfbf line, and a
    lighter band near the spine.
- **`books-2` (10 chapters).** Two more books on top, from y 338 to 316: a sage #5e9654 one and a #e0975a
  one, each a little turned.
- **`books-3` (25 chapters).** On top of the stack, y 316 to 298, one open book: two cream page fans (each
  a curved shape, #fcf9f2 with #d9cfbf lines across) on a terracotta cover.
- **`pennant` (a book reaches its target).** Box x 112 to 138, y 284 to 360, back row.
  - A thin #8c6440 stick, 3 px, with a small round top.
  - Near the top, a triangular #a94f2e flag flying to the right, with a lighter #c46a35 stripe.
- **`manuscript` (a manuscript brought in from Word).** Box x 102 to 158, y 372 to 394, front row. A thick
  stack of cream pages, lying flat:
  - three page edges showing, with #d9cfbf lines;
  - tied crosswise with #a94f2e string ending in a small bow on top;
  - the top page slightly askew.

### Batch G: notes and ideas (`bird-1`, `bird-2`, `birdhouse`, `idea-1`, `idea-2`, `idea-3`)

- **`bird-1` A bird on the ground (the first note).** Box x 560 to 594, y 366 to 392, front row, facing left.
  - A round slate blue #7a8fb3 body with a cream #fcf9f2 belly.
  - A small #e0975a beak, one #3b2f2a dot eye, a short tail up behind, and two thin legs.
- **`bird-2` A bird flying (10 notes).** Box x 468 to 512, y 34 to 66, high in the right sky. A slate blue
  bird seen from the side, wings up in a soft curve, flying left.
- **`birdhouse` A birdhouse (50 notes, a full notebook).** Box x 554 to 592, y 226 to 360, back row.
  - A #8c6440 pole, 5 px wide, from the ground to y 270.
  - On top, a #b98a5e house: a square body 30 px wide with a pointed #a94f2e roof and a round dark #5c3d28
    door hole.
  - A small perch stick under the hole.
- **`idea-1` A lavender butterfly (the first idea).** Box x 58 to 86, y 114 to 138, in the left sky. Like the
  good-day butterflies, in lavender #a99cf5 with #8a7fd6 edges.
- **`idea-2` A little swarm (10 ideas).** Box x 498 to 578, y 78 to 130, in the right sky. Five tiny lavender
  and peach butterflies, 8 to 12 px, scattered in a loose arc, as if dancing.
- **`idea-3` A connection (two ideas linked on the map).** Box x 18 to 100, y 146 to 200, in the left sky.
  - Two butterflies, one lavender and one peach, facing each other.
  - A dotted loop of small #a99cf5 dots that circles both, like a figure eight, joining them.

### Batch H: to-dos, the stepping stones (`stone-1`, `stone-2`, `stone-3`)

Three flat stones in the front middle, leading to the basin's foot. Each is a soft rounded oval, wider than
deep, #c4bcae with a darker #9d9486 lower edge, lying in the grass, in this order:
- **`stone-1` (the first to-do done).** x 284 to 316, y 375 to 385, nearest the foot.
- **`stone-2` (25).** x 258 to 294, y 384 to 393.
- **`stone-3` (100).** x 300 to 340, y 390 to 399.

### Batch I: quiet hours (`cup-1`, `cup-2`, `cup-3`, `lantern`, `chime`)

**The tea grows in order** on one flat stone slab, front row, box x 440 to 528.

- **`cup-1` A cup of tea (the first pomodoro).**
  - The slab: a low rounded #c4bcae oval with a #9d9486 lower edge, x 440 to 528, y 380 to 394.
  - On its left, a teacup: a cream #fcf9f2 cup with a terracotta #a94f2e band, a small handle on the right,
    and a cream saucer, x 448 to 472, y 362 to 382.
  - Two soft S-curves of steam, cream at 0.6, rising to y 344.
- **`cup-2` A tea party (10).** A round teapot on the slab, x 474 to 504, y 350 to 382: rust #c46a35, with
  a lid knob, a curved spout to the left and a handle to the right.
- **`cup-3` A tea set (50).** A second cup on the slab's right, x 506 to 526, y 364 to 382, like the first
  but with a sage #5e9654 band.
- **`lantern` A lantern (the first time in Zen).** Box x 398 to 428, y 310 to 360, back row, just right of
  the basin.
  - A small standing lantern: a #5c3d28 frame (a square base, four thin corner posts, a little pointed roof
    with a ring).
  - Its glass: #f6d2a8 panes with a #e9a265 flame shape inside.
  - A warm glow around it: a radial gradient circle, r 34, #e9a265 at 0.35 to clear. The glow alone may
    spill out of the box.
- **`chime` A wind chime (an hour of quiet).** Box x 514 to 548, y 236 to 360, back row.
  - A thin #8c6440 shepherd's-hook post, 3 px, rising from the ground and curling over at the top to the
    left.
  - From the hook hangs a small wooden disc. Under it hang five thin tubes of different lengths, #d9cfbf with a
    lighter edge, on #8c6440 threads, and a little cream leaf-shaped sail below.

### Batch J: little rituals (`robin`, `owl`, `rainbow`, `gate`)

- **`robin` A robin (writing before 7 in the morning).** Box x 214 to 244, y 262 to 291. It perches on the
  left end of the basin's rim, its feet on y 289, facing right.
  - A plump #8c6440 body with a warm orange #e0975a breast.
  - A small dark beak, one dot eye, and a short tilted tail.
- **`owl` An owl (writing after 11 at night).** Box x 354 to 386, y 246 to 291. It perches on the right end
  of the rim, its feet on y 289, facing the viewer.
  - A rounded #b98a5e body with #8c6440 wing shapes on its sides.
  - A cream #fcf9f2 face disc in two circles, with two #3b2f2a dot eyes inside small #f2c95b circles.
  - Two tiny ear tufts, and small feet gripping the rim.
- **`rainbow` A rainbow (writing in every look).** Box x 20 to 150, y 30 to 100, the upper left sky. A small
  arc of four soft bands, from the outside in: rose #e48a9a, butter #f2c95b, pale green #a9d18e, blue
  #7fa7d8. Each band is 6 px wide and at opacity 0.8. The ends fade into two small cream clouds (three
  overlapping circles each).
- **`gate` A garden gate (a backup folder chosen: safe and sound).** Box x 10 to 72, y 296 to 360, back row,
  far left.
  - Two #8c6440 posts, 6 px wide, with round caps.
  - Between them, a small closed #b98a5e gate of four pickets with pointed tops on two cross rails.
  - A tiny #e0975a latch.

---

## Checking the art

Lay every file on the others in the layer order (backdrop, plant, basin, keepsakes), and check:
- nothing sits in another's box or in the tree's room;
- the plant's gap shows at the rim in every stage;
- each keepsake reads on the light backdrops and on candlelit and moonlit.

When the files come, the app gets a small page that stacks them for this check, in every look and stage.

## The files, all together

| Batch | Files | How many |
|---|---|---|
| A | `stage-1` … `stage-8` | 8 |
| B | `backdrop-{daylight,sunset,candlelit,moonlit,forest}`, `basin-{same}` | 10 |
| C | `flower-1` … `flower-9` | 9 |
| D | `firefly-1` … `firefly-5`, `butterfly-1` … `butterfly-4` | 9 |
| E | `can`, `bee-1`, `bee-2` | 3 |
| F | `books-1`, `books-2`, `books-3`, `pennant`, `manuscript` | 5 |
| G | `bird-1`, `bird-2`, `birdhouse`, `idea-1`, `idea-2`, `idea-3` | 6 |
| H | `stone-1`, `stone-2`, `stone-3` | 3 |
| I | `cup-1`, `cup-2`, `cup-3`, `lantern`, `chime` | 5 |
| J | `robin`, `owl`, `rainbow`, `gate` | 4 |

62 files: 8 stages, 10 for the looks, 44 keepsakes (one for each keepsake in the concept).
