# THE LAST POD

A 60-second, keyboard-controlled rescue game built with React, Vite, and TypeScript. Everything is drawn on one 960×540 HTML canvas, scaled and letterboxed to the window. No images, fonts, APIs, or backend.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` type-checks and creates the production bundle; `npm run preview` serves it. Requires Node.js 20.19+ or 22.12+.

## Deploy to Vercel

Import this repository into Vercel. The included `vercel.json` configures the Vite framework, `npm ci` install, `npm run build` build command, and `dist` output directory. No environment variables are required.

## Git identity and safe pushes

This repository uses the GitHub-linked identity `Ahammed Anas Nihal <108085694+AnasNihal@users.noreply.github.com>`. The repository includes commit and push hooks that block a different identity or any remote other than `AnasNihal/the-last-pod`.

After cloning, enable the hooks once:

```sh
git config user.name "Ahammed Anas Nihal"
git config user.email "108085694+AnasNihal@users.noreply.github.com"
git config core.hooksPath .githooks
```

Check the active identity and push destination before contributing:

```sh
git config user.name
git config user.email
git remote -v
```

## Play

- **WASD / arrows:** move. Touch crew to recruit them; they follow your trail.
- **Hold E:** unlock doors, reset breakers, pick up fuel, bioscan, or launch. **Tap E:** fix wires.
- **1–4:** abandon the matching recruited crew member. Waiting crew are unaffected.
- **M:** mute. **R:** fresh run. **Enter / Space:** start or play again.
- The title START, mute toggle, and PLAY AGAIN can also be clicked.
- **Touch devices:** play in landscape orientation. Use the virtual joystick to move, **TAP E** for wires, **HOLD E** for continuous interactions, and the numbered buttons to abandon followers. Sound and restart controls are also available.

Rescue who you can, watch nameplates, and reach the pod on the right. One crew member is an impostor: after you stay nearby for 1.2 seconds, their nameplate periodically scrambles and their visor flickers red. Innocents never glitch.

**Pod prep.** The pod launches only after 2 of 3 tasks:
- **Wires** (Cafeteria): tap E when the marker is in the green zone, 3 times. A miss loses one hit.
- **Fuel** (Storage): hold E to pick up the cell, then carry it into the Pod Bay. You move 15% slower while carrying it.
- **Bioscan** (Med Bay): stand still and hold E for 2 seconds. It reports whether the impostor is among your followers. It is repeatable, so abandon someone and scan again.

**What the impostor does while following you:**
- **Sabotage** every 9 seconds, alternating between two types:
  - **Door lock:** hold E at the door console, or wait 6 seconds.
  - **Lights out:** vision shrinks and nameplates only reveal inside your light. Hold E at any yellow breaker (door console), or wait 8 seconds.
- **Kills** a crewmate next to it in the line after 16 seconds of following, then every 16 seconds. The lights flicker 1.5 seconds before, which is your warning to act. The body stays behind, and the killer was beside the victim.
- If you abandon it, it **vents** and stops all sabotage.

The collapse starts after four safe seconds, accelerating to the Pod Bay entrance at 60 seconds. Touching it is fatal. Hold E at the launch console to escape early. At zero, being in the Pod Bay with the pod prepped launches automatically. Unprepped means **POD NOT READY**. Launch with an impostor following and the pod is sabotaged. Abandoned crew cannot be re-recruited.

Ranks count innocent followers aboard: **S** = 3, **A** = 2, **B** = 1, **C** = 0 (Lone Survivor). The report also shows time remaining, pod tasks done, kills, sabotages, door unlocks, scans, and whether you identified the impostor.

## Look and sound

- **Visuals:** a retro-arcade screen frame (bezel, scanlines, glass glare) around a cartoon-in-space canvas.
  - Everything is drawn in code, including a custom blocky pixel font (`src/pixelfont.ts`) for titles, the timer and banners.
  - Characters have thick outlines, shaded bodies and shiny visors.
  - The ship interior (hull, portholes, walls, tiled floors, room props) is drawn once to an offscreen layer for performance.
- **Audio:** everything is synthesized with WebAudio (`src/audio.ts`).
  - Chiptune music plays on the title screen and during a run; the run music speeds up and adds layers as the collapse closes in.
  - Sound effects include steps, recruit, door lock/unlock, siren, power-down, static, vent, kill, countdown ticks, the launch fanfare and a crash.
  - A collapse rumble rises in pitch as the wave gets closer. **M** mutes everything.
- The title and end screens also play after-screen music. Reduced-motion settings disable shake, blinking and flicker.

## Tuning and implementation

All gameplay tuning and map dimensions are in `CONFIG` at the top of `src/game.ts`. Two crew always start in Engine and Storage; the other two occupy different randomly selected rooms. Crew identities, impostor identity, tell timing, and sabotage door selection are randomized per run.

Simulation uses delta time with small collision substeps; React is not re-rendered for animation. Movement is normalized, collision slides along axis-aligned room/door boundaries, and followers use a time-delayed trail. Losing focus or hiding the tab pauses both simulation and audio and clears held keys. Refocusing resumes without a time jump.
