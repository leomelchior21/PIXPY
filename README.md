# PixPy

> Tiny Python experiments. Immediate consequences. Real understanding.

PixPy is a classroom-first Python experience playground for middle-school students. It is a collection of short, polished interactions where students change real Python, run it, and immediately see what happens.

The guiding loop is:

**PLAY -> CHANGE -> RUN -> SEE -> UNDERSTAND**

PixPy is not an LMS, a traditional course, a browser IDE, or a student-management platform. The product should feel closer to an interactive science exhibit, mini game, and coding playground than to a sequence of lessons and quizzes.

## Product principles

- One concept, one playful interaction, and one visible consequence.
- Interaction comes before explanation.
- All student-facing text is short, accessible English.
- Students manipulate valid Python rather than a PixPy-specific language.
- Every activity is open; recommended order never becomes enforced progression.
- Completion is lightweight: a simple `DONE` or check mark, with no global XP economy.
- Strange values should create playful feedback, never freeze or crash the browser.
- Core activities behave like one-screen apps and do not require document-level scrolling.

The product succeeds when a student asks, “What happens if I change this?”

## Student session

Entry asks only:

> What should we call you?

There are no passwords, accounts, classes, avatars, or profiles. The name exists only to personalize the current browser session.

Progress is stored in `sessionStorage`, not `localStorage` or a cloud database. It survives navigation and accidental refreshes, but may disappear when the tab or browser session ends. That behavior is intentional.

The app header has a **QUICK LIST** for jumping directly to any activity in the current group. It stays focused on navigation and contains no screenshot, print, or session-reset actions.

## Main experience map

The home screen has three large areas. Variables is available now; unfinished groups appear as disabled gray cards so their status is unambiguous:

| Area | Promise | Delivery status |
| --- | --- | --- |
| Variables | Change values and watch Python remember them. | First complete area |
| Conditionals | Make choices with code. | Coming next |
| Functions | Build actions and reuse them. | Coming next |

This is a simple world selector, not a dashboard. It has no graphs, side navigation, statistics, leaderboards, or locked content.

## Variables

Variables is the first classroom-ready module. Its recommended sequence creates a small conceptual arc without enforcing prerequisites:

1. **Dino Variables** — values can change things.
2. **Print Playground** — Python can output values.
3. **Black Box** — values can be transformed.
4. **Input Machine** — values can enter the program.
5. **Memory Machine** — variables remember those values.
6. **Build a Black Box** — now combine everything.
7. **Final Bosses** — prove you can use it.

Every experience is always selectable and replayable.

### Dino Variables

Students freely move sliders for real Python values such as `speed`, `jump`, `gravity`, `obstacles`, and `player_size`, then run a zoomed-out pixel T-Rex game. There are no levels or prescribed challenges: the goal is to make a change and immediately observe its effect.

The concept is revealed only after experimentation:

> A variable gives a name to a value.

Rendering clamps extreme values safely while preserving playful responses such as “THAT IS TOO MUCH DINO.”

### Print Playground

Students write anything they want inside `print()` and immediately see it in a visible terminal. Code and output remain side by side without idea buttons or predefined challenge categories.

### Black Box

Students physically touch a dark, tactile Black Box to collect fresh random input-to-output clues. After collecting at least two pairs, they form and test a hypothesis. A successful hypothesis reveals the real Python that performed the transformation. Cracking all three boxes unlocks a ten-question quiz covering `+`, `-`, `*`, and `/` before the activity is marked complete.

### Input Machine

A vending-machine-style interaction makes the flow visible:

**HUMAN -> `input()` -> VARIABLE -> PYTHON -> `print()` -> HUMAN**

Challenges include echoing a message, doubling a number, adding ten, and a simple age machine.

### Memory Machine

Students press **EXECUTE LINE** and follow one fading, scanning line at a time while code, memory, and output remain visible side by side. Traveling dots show a value entering memory and moving from memory to output. After completing all five examples, students advance through a ten-question code-output quiz before the activity is marked complete.

### Build a Black Box

Students edit a small input/process/output program and test it with multiple values. A compact **Try these operators** reference presents the four classic operators (`+`, `-`, `*`, `/`) as real code, while a blinking editor line invites the student to type the operation themselves. **HIDE MY CODE** turns the result into a classroom game where another student tries to crack the rule.

### Final Bosses

Final Bosses contains approximately 12–15 compact programming challenges, shown one at a time or in a small stage grid. It covers arithmetic, quotient and remainder, temperature conversion, averages, fares, discounts, powers, and a student-created formula.

## Experience shell

Every activity uses a familiar compact structure:

- a compact header with Back, a one-line `title — question`, and Hint;
- a primary interaction or visual world;
- a focused Python editor or controls with Run and Reset;
- short instructions and feedback inside the activity itself, with no persistent bottom banner;
- at most three predefined, progressively stronger hints.

The interaction is the star. Instructions should take seconds to read. `RUN` and `HINT` must never be hidden below the fold.

Target viewports:

- 768x1024 iPad portrait displays a rotate-to-landscape screen;
- 1024x768 iPad landscape;
- 1180x820 iPad landscape;
- 1366x768 Chromebook or laptop;
- 1440x900 laptop;
- 1920x1080 desktop.

## Visual direction

PixPy uses a warm, spacious neo-brutalist interface: soft paper backgrounds, folder-shaped cards, crisp black outlines, rounded corners, offset shadows, strong typography, and one bright accent color per activity. Dark surfaces are reserved for code editors, quizzes, terminals, the Dino game, and other focused interactive objects. It should feel playful, clever, experimental, polished, and slightly rebellious—never childish, corporate, crowded, or like an admin dashboard.

Pixel art supports the interaction instead of overwhelming it. Touch targets, keyboard focus, readable contrast, and reduced-motion preferences remain first-class requirements.

## Technical direction

- React, TypeScript, and Vite.
- CodeMirror for a focused, touch-friendly Python editor.
- Pyodide or the existing browser Python worker when it remains reliable.
- Canvas, DOM, or CSS chosen per experience rather than forced through one renderer.
- Small reusable components such as `ExperienceShell`, `CodeEditor`, `PythonRunner`, `HintButton`, `RunButton`, and `PrintProgress`.
- A tiny session layer for the student's name, completed activities, boss progress, and custom Black Box work.
- Lazy-loaded experiences where that improves startup performance.

Conceptual source structure:

```text
src/
  app/
    home/
    variables/
    conditionals/
    functions/
  experiences/
    variables/
      dino/
      print-playground/
      black-box/
      input-machine/
      memory-machine/
      build-black-box/
      final-bosses/
  components/
    ExperienceShell/
    CodeEditor/
    PythonRunner/
    HintButton/
    RunButton/
    PrintProgress/
  session/
    studentSession.ts
    progressSession.ts
```

Adapt this structure to the codebase when reuse produces a cleaner result; it is a direction, not a rigid template.

## Current delivery

The playground refactor includes:

- simple name entry;
- `sessionStorage` progress;
- the three-area home screen;
- simplified navigation;
- a reusable no-scroll experience shell;
- all seven Variables experiences;
- no Supabase, authentication, avatars, backend persistence, ranking, or global XP.

The working Dino canvas, safe value clamping, CodeMirror editor, and browser Python worker were preserved and simplified. Black Box, Input Machine, Memory Machine, Build a Black Box, and Final Bosses were built as new modular experiences.

### Classroom UX review

The Variables collection now has readable experiment previews, larger code and touch controls, and layouts tailored to landscape iPads and laptops. Activities keep their panels side by side without page scrolling. Portrait mode displays a rotate-to-landscape screen and preserves the current activity. The shared header shows the experiment question and completion state. Hints and the activity list support Escape and keyboard focus; browser Back follows activity navigation.

- **Input Machine:** send with Enter, reset the active machine, keep drafts when switching, and see distinct input, output, and error states.
- **Black Box:** keep clues after a wrong guess, inspect the revealed Python, and revisit the boxes after unlocking the quiz.
- **Memory Machine:** read an explanation for each executed line, see multiple stored values, and revisit examples or replay the quiz.
- **Both quizzes:** read feedback at your own pace and press Next to continue.
- **Build a Black Box:** changing the rule clears old clues; two different inputs must test the same rule. Classmate mode keeps the code hidden while the machine remains usable.
- **Final Bosses:** named challenge buttons, reset controls, readable result feedback, and drafts that survive switching challenges within the activity.

`src/classroom.css` contains the classroom layout refinements. The application fills the viewport without document scrolling. Code wraps inside its editor, and decorative motion respects reduced-motion preferences.

Conditionals and Functions currently provide open visual previews only. Their playable experiences are intentionally outside this delivery.

## Run locally

```sh
npm install
npm run dev
```

PixPy requires no backend, account, database, or environment variables.

## Quality checks

```sh
npm run lint
npm test
npm run build
npm run check:viewports
```

Also verify every core experience at each target viewport, with touch and keyboard input, after refresh, and in the print preview. No activity may clip its editor, visual, Run button, or Hint button.

The viewport checker also checks the portrait rotation screen and runs touch and keyboard interactions on both landscape iPad sizes: input submission and errors, hint/list dismissal, memory execution, custom rules and hidden code, all three mystery boxes, quiz feedback, boss solutions, and progress after refresh. Screenshots are saved under the system temporary directory in `pixpy-viewport-checks`.

## Product test

In a 45-minute class, a student should interact within 30 seconds, change Python within two minutes, cause something unexpected within five minutes, and understand at least one programming idea better within ten minutes.

Everything is open. Everything can be replayed. Everything invites experimentation.
