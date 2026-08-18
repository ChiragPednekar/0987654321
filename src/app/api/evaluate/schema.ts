import { z } from 'zod';

export const evaluationSchema = z.object({
  criteriaScores: z.array(z.object({
    criterionName: z.string().describe('The name of the rubric criterion evaluated.'),
    score: z.number().min(0).max(10).describe('The score given for this criterion, from 0 to 10.'),
    feedback: z.string().describe('Specific, actionable feedback explaining why this score was given and how to improve.')
  })).describe('Array of scores for each criterion defined in the rubric.'),
  overallFeedback: z.string().describe('Overall feedback on the submission, highlighting strengths and weaknesses.'),
  isConfident: z.boolean().describe('True if the model is highly confident in this evaluation, false if the answer was confusing or ambiguous and the score might not be fully reliable.'),
});

export type EvaluationOutput = z.infer<typeof evaluationSchema>;
