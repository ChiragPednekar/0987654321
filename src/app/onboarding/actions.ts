'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function saveProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const profileData = {
    full_name: formData.get('fullName') as string,
    university: formData.get('university') as string,
    career_goal: formData.get('careerGoal') as string,
    current_level: formData.get('currentLevel') as string,
    target_role: formData.get('targetRole') as string,
    email: user.email,
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...profileData })

  if (error) {
    console.error('Failed to save profile:', error)
    throw new Error('Failed to save profile')
  }

  redirect('/dashboard')
}
