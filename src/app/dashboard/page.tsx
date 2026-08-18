import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import RadarChart from './RadarChart'
import { CheckCircle, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch basic profile & stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Mock radar data for now (since we'd need to aggregate scores per domain)
  // In a real scenario, this would be computed from submissions grouping by case->domain
  const radarData = [
    { domain: 'Finance', score: 8.5 },
    { domain: 'Consulting', score: 6.2 },
    { domain: 'PM', score: 7.8 },
    { domain: 'Strategy', score: 4.5 },
    { domain: 'Marketing', score: 5.0 },
  ]

  // Find weakest domain for recommendation
  const weakestDomain = [...radarData].sort((a, b) => a.score - b.score)[0]

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome back, {profile?.full_name || 'Student'}</h1>
          <p className={styles.subtitle}>{profile?.target_role || 'General'} Track • Level {profile?.level || 1}</p>
        </div>
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Cases Solved</div>
          <div className={styles.statValue}>12</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Avg Score</div>
          <div className={styles.statValue}>7.8</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Current Streak</div>
          <div className={styles.statValue}>{profile?.streak || 0} 🔥</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total XP</div>
          <div className={styles.statValue}>{profile?.xp || 0}</div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div>
          <div className={styles.contestWidget}>
            <div className={styles.contestTitle}>Weekend Contest Begins In</div>
            <div className={styles.countdown}>48:12:05</div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Skill Radar</h2>
            <div className={styles.radarContainer}>
              <RadarChart data={radarData} />
            </div>
          </section>
        </div>

        <div>
          <section className={styles.recommendationCard}>
            <div className={styles.recDomain}>Focus Area: {weakestDomain.domain}</div>
            <h2 className={styles.recTitle}>Recommended Next Case</h2>
            <p style={{ color: '#aaa', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Your scores in {weakestDomain.domain} are trailing. Try this medium-difficulty case to improve.
            </p>
            <Link href="/dashboard/cases/recommendation" className={styles.recButton}>
              Start Case
            </Link>
          </section>

          <section className={styles.section} style={{ marginTop: '2rem' }}>
            <h2 className={styles.sectionTitle}>Recent Activity</h2>
            <div className={styles.activityList}>
              <div className={styles.activityItem}>
                <CheckCircle size={20} className={styles.activityIcon} style={{ color: '#4ade80' }}/>
                <div className={styles.activityText}>
                  <div>Market Entry: NeoBank</div>
                  <div className={styles.activityTime}>2 hours ago</div>
                </div>
                <div style={{ fontWeight: 600 }}>8.2</div>
              </div>
              <div className={styles.activityItem}>
                <Clock size={20} className={styles.activityIcon} />
                <div className={styles.activityText}>
                  <div>M&A: Pharma Giant</div>
                  <div className={styles.activityTime}>Yesterday</div>
                </div>
                <div style={{ fontWeight: 600 }}>6.5</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
