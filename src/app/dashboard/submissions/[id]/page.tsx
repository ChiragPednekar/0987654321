import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import styles from './page.module.css'
import { AlertCircle } from 'lucide-react'

export default async function SubmissionResultPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const submissionId = resolvedParams.id;
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch submission and linked case
  const { data: submission, error } = await supabase
    .from('submissions')
    .select(`
      *,
      case:cases (
        title,
        model_answer
      )
    `)
    .eq('id', submissionId)
    .eq('user_id', user.id)
    .single()

  if (error || !submission) {
    notFound()
  }

  const aiFeedback = submission.ai_feedback as {
    criteriaScores: { criterionName: string; score: number; feedback: string }[]
    overallFeedback: string
    isConfident: boolean
  } | null

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Evaluation: {submission.case?.title}</h1>
        <p>Attempt #{submission.attempt_number}</p>
      </header>

      {submission.score !== null && (
        <div className={styles.scoreBanner}>
          <div>
            <h2>Final Score</h2>
            <p>Based on AI Rubric Evaluation</p>
          </div>
          <div className={styles.score}>{Number(submission.score).toFixed(1)} / 10</div>
        </div>
      )}

      {aiFeedback && !aiFeedback.isConfident && (
        <div className={styles.confidenceWarning}>
          <AlertCircle size={20} />
          <p>
            <strong>Low Confidence Score:</strong> The AI grader indicated that your answer was ambiguous, incomplete, or off-topic. This score may not be fully reliable.
          </p>
        </div>
      )}

      <div className={styles.splitView}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Your Submission</h2>
          <div className={styles.content}>
            {submission.unstructured_answer || JSON.stringify(submission.structured_answer, null, 2)}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Model Answer</h2>
          <div className={styles.content}>
            {submission.case?.model_answer || 'No model answer provided.'}
          </div>
        </div>
      </div>

      {aiFeedback && (
        <div className={styles.section} style={{ marginTop: '2rem' }}>
          <h2 className={styles.sectionTitle}>Detailed AI Feedback</h2>
          <div className={styles.feedbackList}>
            {aiFeedback.criteriaScores.map((criterion, idx) => (
              <div key={idx} className={styles.feedbackItem}>
                <div className={styles.feedbackCriterion}>
                  <span>{criterion.criterionName}</span>
                  <span className={styles.criterionScore}>{criterion.score} / 10</span>
                </div>
                <div className={styles.feedbackText}>{criterion.feedback}</div>
              </div>
            ))}
          </div>

          <div className={styles.overallFeedback}>
            <h3>Overall Feedback</h3>
            <p className={styles.feedbackText} style={{ marginTop: '0.5rem' }}>
              {aiFeedback.overallFeedback}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
