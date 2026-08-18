import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { evaluationSchema } from './schema';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const { submissionId, caseId, unstructuredAnswer, structuredAnswer } = await req.json();

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the case to get the rubric and model answer
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('title, scenario, instructions, rubric, model_answer, expected_framework')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Prepare prompt
    const prompt = `
You are an expert MBA consultant grading a case study submission.
Case Title: ${caseData.title}
Scenario: ${caseData.scenario}
Instructions Given to Student: ${caseData.instructions}

Model Answer: ${caseData.model_answer || 'N/A'}
Expected Framework: ${caseData.expected_framework || 'N/A'}

Student Submission:
${unstructuredAnswer ? unstructuredAnswer : JSON.stringify(structuredAnswer)}

Rubric to evaluate against:
${JSON.stringify(caseData.rubric)}

Provide specific, actionable feedback for each rubric criterion, and score them from 0-10.
Clamp the scores strictly to 0-10.
Flag isConfident as false if the submission is so ambiguous or off-topic that grading it is highly subjective.
`;

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: evaluationSchema,
      prompt: prompt,
    });

    // Calculate total/average score based on weights if needed, or simple average
    const totalScore = object.criteriaScores.reduce((sum, c) => sum + c.score, 0);
    const averageScore = object.criteriaScores.length > 0 ? (totalScore / object.criteriaScores.length) : 0;

    // Update the submission in the database
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        score: averageScore,
        ai_feedback: object,
        confidence_flag: object.isConfident
      })
      .eq('id', submissionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating submission', updateError);
      return NextResponse.json({ error: 'Failed to save evaluation' }, { status: 500 });
    }

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('Evaluation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
