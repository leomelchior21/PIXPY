export type IfElseMode = 'observe' | 'sequence' | 'select' | 'prediction' | 'condition' | 'structure' | 'debug' | 'expression' | 'derive' | 'independent'

export interface IfElsePedagogy {
  mode: IfElseMode
  title: string
  instruction: string
  support: number
  showTwoPaths: 'full' | 'compact' | 'unknown' | 'hint'
  showCondition: boolean
  showOrderLabels: boolean
  construction: 'sequence' | 'slot' | 'operator' | 'expression' | 'independent'
  prefilledLines: number[]
  distractorCount: number
  requirePrediction: 'output' | 'truth' | false
  requireDebugRun: boolean
  useInput: boolean
  executionVisualization: boolean
  showProgramByDefault?: boolean
}

// The questions remain in ifElseBuilder.ts. This table controls only how they
// are taught; no story, variable, threshold, or expected output lives here.
export const ifElsePedagogy: IfElsePedagogy[] = [
  { mode: 'observe', title: 'Observe the structure', instruction: 'Place all five pieces. The labels show the structure Python expects.', support: 10, showTwoPaths: 'full', showCondition: true, showOrderLabels: true, construction: 'sequence', prefilledLines: [], distractorCount: 0, requirePrediction: false, requireDebugRun: false, useInput: false, executionVisualization: true },
  { mode: 'sequence', title: 'Order the structure', instruction: 'Start with the value, then IF, its action, ELSE, and its action. Arrange the shuffled pieces.', support: 9, showTwoPaths: 'full', showCondition: true, showOrderLabels: false, construction: 'sequence', prefilledLines: [], distractorCount: 0, requirePrediction: false, requireDebugRun: false, useInput: false, executionVisualization: true },
  { mode: 'select', title: 'Select the right pieces', instruction: 'Choose the pieces that match the mission. Two comparisons ask a different question.', support: 8, showTwoPaths: 'compact', showCondition: false, showOrderLabels: false, construction: 'sequence', prefilledLines: [], distractorCount: 2, requirePrediction: false, requireDebugRun: false, useInput: false, executionVisualization: true },
  { mode: 'prediction', title: 'Predict the result', instruction: 'Predict what happens with the starting value, then build. A prediction is an idea to test, not a scored answer.', support: 7, showTwoPaths: 'compact', showCondition: true, showOrderLabels: false, construction: 'sequence', prefilledLines: [], distractorCount: 1, requirePrediction: 'output', requireDebugRun: false, useInput: false, executionVisualization: true },
  { mode: 'condition', title: 'Reason about the condition', instruction: 'The structure is ready. Choose the comparison that asks the question in the mission.', support: 6, showTwoPaths: 'compact', showCondition: false, showOrderLabels: false, construction: 'operator', prefilledLines: [0, 2, 3, 4], distractorCount: 0, requirePrediction: false, requireDebugRun: false, useInput: false, executionVisualization: true },
  { mode: 'structure', title: 'Complete the structure', instruction: 'One structural piece is missing. Fill the gap, choose an input, and run both paths.', support: 5, showTwoPaths: 'unknown', showCondition: true, showOrderLabels: false, construction: 'slot', prefilledLines: [0, 1, 2, 4], distractorCount: 1, requirePrediction: false, requireDebugRun: false, useInput: true, executionVisualization: true },
  { mode: 'debug', title: 'Debug the logic', instruction: 'Run this valid Python first. Compare its result with the mission, then edit the decision without rebuilding the program.', support: 4, showTwoPaths: 'hint', showCondition: false, showOrderLabels: false, construction: 'operator', prefilledLines: [0, 1, 2, 3, 4], distractorCount: 0, requirePrediction: false, requireDebugRun: true, useInput: true, executionVisualization: true },
  { mode: 'expression', title: 'Build the expression', instruction: 'Tap a left value, an operator, and a right value to build the condition. The surrounding structure is ready.', support: 3, showTwoPaths: 'hint', showCondition: false, showOrderLabels: false, construction: 'expression', prefilledLines: [0, 2, 3, 4], distractorCount: 0, requirePrediction: false, requireDebugRun: false, useInput: true, executionVisualization: true, showProgramByDefault: false },
  { mode: 'derive', title: 'Derive the condition', instruction: 'Translate the mission into a condition using tokens. Choose your input, run it, and inspect the decision.', support: 2, showTwoPaths: 'hint', showCondition: false, showOrderLabels: false, construction: 'expression', prefilledLines: [0, 2, 3, 4], distractorCount: 0, requirePrediction: false, requireDebugRun: false, useInput: true, executionVisualization: true, showProgramByDefault: false },
  { mode: 'independent', title: 'Solve with minimal support', instruction: 'Build the condition and choose each branch action. Predict TRUE or FALSE for your input, then test your reasoning.', support: 1, showTwoPaths: 'hint', showCondition: false, showOrderLabels: false, construction: 'independent', prefilledLines: [0, 3], distractorCount: 0, requirePrediction: 'truth', requireDebugRun: false, useInput: true, executionVisualization: true, showProgramByDefault: false },
]
