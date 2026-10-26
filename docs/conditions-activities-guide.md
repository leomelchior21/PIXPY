# Conditions activities 04–06: guide

This guide covers the last three activities of **World 02 — Conditions**. They build on Backroom Run, How the Computer Makes a Choice, and IF/ELSE. None of them uses `elif`, `and`, or `or`. Three-way decisions are built with an `if/else` nested inside `else`.

| Activity | New skill | Format | Saved progress |
| --- | --- | --- | --- |
| 04 MAKE IT WORK | Debugging: reproduce, classify, locate, fix, verify | 8 repair tickets | `repairTickets`, `repairLog` |
| 05 MORE THAN ONE CHOICE? | Separate ifs vs. if/else inside else; order of questions | 8 levels in the sorting tower | `moreChoiceLevels`, `moreChoiceLog` |
| 06 Final Bosses | Writing complete decisions in real Python | 10 bosses with boundary tests | `conditionBosses`, `conditionBossLog` |

Progress travels in the existing session and cloud progress record. No new database table is needed.

## 04 — MAKE IT WORK: the repair shop

Each ticket is a broken machine with a customer complaint and the rule it should follow. Students go through five steps:

1. **Reproduce:** run the machine with an input that shows the complaint. An input that works fine does not count.
2. **Diagnose:** stamp the bug as SYNTAX (no line ran), RUNTIME (it started, then crashed), or LOGIC (it finished with a wrong answer).
3. **Locate:** tap the broken line. For syntax and runtime errors, Python's report names a line. On the ride gate, Python crashes on line 2 but the bug is on line 1.
4. **Fix:** choose a replacement part and run the machine again with the same input.
5. **Verify:** a test bench runs values on both sides of the rule. A part that only fixes the customer's value (for example `== 3` instead of `>= 3`) is rejected here.

| # | Machine | Bug | Lesson |
| --- | --- | --- | --- |
| 1 | Arcade | Logic: `>` instead of `>=` | The limit itself counts |
| 2 | Safe door | Syntax: `=` in an if | `=` stores, `==` compares |
| 3 | Phone dock | Syntax: missing indentation | Indented lines belong to the if |
| 4 | Ride gate | Runtime: `input()` without `int()` | The crash line is not always the bug |
| 5 | Thermo fan | Logic: two ifs leave 30 uncovered | `else` catches everything else |
| 6 | Quiz show | Runtime: `print(Retry)` only fails below 50 | Errors can hide in a branch |
| 7 | Night lamp | Logic: an unindented print always runs | Put it under `else:` |
| 8 | Snack machine | Syntax, then logic | Fixing one bug can reveal the next |

Programs run in a small, exact tracer (`src/lib/decisionTracer.ts`), which animates the lines Python runs. Its error messages follow CPython 3.12+ wording. Every ticket was cross-checked against CPython for every combination of parts and inputs.

Support decreases across the tickets. Tickets 1–3 suggest the customer's value and show clues; later tickets hide the clue behind a button, and the use is counted.

## 05 — MORE THAN ONE CHOICE?: the sorting tower

A value drops through a tower of gates. Each gate shows its condition with the real numbers and TRUE/FALSE. With separate ifs, the ball passes every gate and lights every TRUE lamp. With if/else inside else, it lands in exactly one bin. A number-line map colours every value in the range. Overlaps are striped, gaps are hatched, and a bin that can never be reached is tagged NEVER REACHED.

| Level | Task | What students see |
| --- | --- | --- |
| 1 Two at once? | Find a temperature with two messages | Separate ifs can overlap |
| 2 The silent phone | Find a battery level with no message | Separate ifs can leave a gap |
| 3 One path only | Land in all three bins | Nesting gives exactly one message |
| 4 Predict the drop | Four right predictions in a row | The first TRUE wins |
| 5 The lost gold | Swap two questions | Order matters; Gold was unreachable |
| 6 Ticket booth | Build a 3-way decision with a mission map | Two questions make three paths |
| 7 The wardrobe app | Rebuild an overlapping app | Inside else, earlier cases are already ruled out |
| 8 School zone camera | Build alone; the map stays hidden | Translate three rules in words |

CHECK MACHINE compares the student's map with the mission for every whole value in the range. Any correct tree passes, including equivalent orders. A failed check points to the first wrong range, for example "At 12 your machine says Senior ticket, but the rule says Adult ticket."

## 06 — Final Bosses: the arena

Students write real Python in the editor. Each boss has 5–8 tests, which are its HP. Two tests are shown as examples; the rest are surprises aimed at the cutoff and its neighbours. Every passing test is a hit. A missed test shows what the code printed, what was needed, and, when the program is simple enough to trace, the path it took (for example `18 > 18 → False → else → print → Too young`).

Bosses unlock in order: if/else (1–2), fixing broken code (3), comparing two inputs (4), remainder (5), text comparison (6), three-way nesting (7–8), calculations in a branch (9), and a four-way grade decision with decimals (10). Each boss has three hints, revealed one at a time and saved with the next attack.

Code runs in Pyodide. While Python is still downloading, the arena uses the classroom fallback interpreter immediately rather than waiting for a timeout.

## Teacher dashboard

In the Conditions view, three columns follow IF/ELSE reasoning:

- **Repair shop:** tickets fixed; how often the bug type was named on the first try; test runs and clues; the step with the most retries (naming the bug, finding the line, choosing the fix, or passing every test); last ticket.
- **Many choices:** levels solved, latest level and skill, drops and hints, prediction accuracy in level 4, and failed build checks.
- **Boss arena:** bosses defeated, attacks and hints, the last boss with its hits, and the toughest boss (the one that took the most attacks).

Each activity is marked complete only when all of its tickets, levels, or bosses are saved.
