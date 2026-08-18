import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { saveProfile } from './actions'
import styles from './page.module.css'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if profile already exists and is complete
  const { data: profile } = await supabase
    .from('profiles')
    .select('target_role')
    .eq('id', user.id)
    .single()

  if (profile?.target_role) {
    redirect('/dashboard')
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Complete Your Profile</h1>
        <p className={styles.subtitle}>Tell us a bit about yourself to personalize your case practice.</p>

        <form action={saveProfile}>
          <div className={styles.formGroup}>
            <label htmlFor="fullName" className={styles.label}>Full Name</label>
            <input id="fullName" name="fullName" type="text" required className={styles.input} />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="university" className={styles.label}>University / Business School</label>
            <input id="university" name="university" type="text" required className={styles.input} placeholder="e.g., INSEAD, ISB, HBS" />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="currentLevel" className={styles.label}>Current Level</label>
            <select id="currentLevel" name="currentLevel" required className={styles.select}>
              <option value="">Select Level...</option>
              <option value="Undergrad">Undergraduate</option>
              <option value="Pre-MBA">Pre-MBA Professional</option>
              <option value="Current MBA">Current MBA</option>
              <option value="Post-MBA">Post-MBA / Experienced Hire</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="targetRole" className={styles.label}>Primary Target Role</label>
            <select id="targetRole" name="targetRole" required className={styles.select}>
              <option value="">Select Target Role...</option>
              <option value="Consulting">Management Consulting</option>
              <option value="IB-DealAdvisory">Investment Banking / Deal Advisory</option>
              <option value="PM">Product Management</option>
              <option value="General Management">General Management / LDP</option>
              <option value="Marketing">Marketing / Brand Management</option>
              <option value="Strategy">Corporate Strategy</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="careerGoal" className={styles.label}>Career Goal (Optional)</label>
            <input id="careerGoal" name="careerGoal" type="text" className={styles.input} placeholder="e.g., MBB Consulting, FAANG PM" />
          </div>

          <button type="submit" className={styles.submitBtn}>
            Save Profile & Continue
          </button>
        </form>
      </div>
    </div>
  )
}
