'use server'

import { createClient } from '@/utils/supabase/server'

export async function submitCase(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const caseId = formData.get('caseId') as string
  const mode = formData.get('mode') as string
  const answer = formData.get('answer') as string
  const framework = formData.get('framework') as string

  // Fetch the current attempt number
  const { data: previousSubmissions } = await supabase
    .from('submissions')
    .select('attempt_number')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .order('attempt_number', { ascending: false })
    .limit(1)

  const attemptNumber = previousSubmissions && previousSubmissions.length > 0
    ? previousSubmissions[0].attempt_number + 1
    : 1

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      user_id: user.id,
      case_id: caseId,
      attempt_number: attemptNumber,
      unstructured_answer: mode === 'unstructured' ? answer : null,
      structured_answer: mode === 'structured' ? { framework, answer } : null,
      // Score and ai_feedback will be updated by the AI engine
    })
    .select('id')
    .single()

  if (error) {
    console.error(error)
    throw new Error('Failed to insert submission')
  }

  return data.id
}
