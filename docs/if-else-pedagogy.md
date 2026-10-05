# IF/ELSE progression

Question content remains in `src/data/ifElseBuilder.ts`. The ten stories,
variables, starting values, conditions, and outputs are unchanged.

`src/data/ifElsePedagogy.ts` configures the interaction for each existing level:

| Level | Interaction | Main support |
| --- | --- | --- |
| 1 | Observe the structure | Five required pieces, order labels, both paths |
| 2 | Order the structure | Shuffled required pieces, both paths |
| 3 | Select the right pieces | Two valid comparison distractors, compact paths |
| 4 | Predict the result | Unscored outcome prediction before building |
| 5 | Reason about the condition | Provided structure, editable comparison |
| 6 | Complete the structure | One missing piece, concealed branch outcomes |
| 7 | Debug the logic | Valid wrong program runs first; edit its comparison |
| 8 | Build the expression | Tap left value, operator, and right value |
| 9 | Derive the condition | Derive expression from mission; paths are a hint |
| 10 | Solve independently | Construct condition, assign actions, predict truth |

The shared interaction components interpret configuration; they do not contain
alternate questions. Expression choices and distractors are derived from the
existing question. Programs stay five lines long.
Later levels start with a collapsed program preview so the reasoning controls
are prominent; checking code opens the preview for execution highlighting.

## Execution and assessment

Runnable programs execute through the existing Python runner, including valid
programs that fail the mission. The trace shows the actual chosen value,
condition with substituted operands, TRUE/FALSE, branch, and printed output.
Line highlighting follows the trace. Reduced-motion settings skip animation.

Assessment distinguishes structure, condition, logic, output, and runtime
errors. Rule checks also probe the cutoff and nearby values, so a wrong rule
cannot pass because one input happens to print the expected message. Equivalent
reversed comparisons are accepted. The local Python fallback preserves Python
remainder behavior for negative values.

Failed attempts progress from identifying an area, to prompting reasoning, to
explaining a concept, to offering a stronger hint. An actual model appears only
when requested after at least four failures of that kind. A retry preserves
the student's work. Predictions are compared to execution without affecting
correctness or completion.

## Learning records

`SessionProgress.ifElseLearning` stores prediction, check, and hint events with
level, mode, attempt, input, prediction, actual output, truth result, error kind,
and timestamp. It travels through the existing session/cloud progress flow.
Restoration validates records and keeps the latest 200; older progress without
this field still loads. No additional database table is required.

The history is data for learning analytics; this change does not add an
analytics dashboard. Activity completion is awarded only after the final level
is successfully constructed and the student selects Finish Activity.
