import { createClient } from '@/utils/supabase/server'
import styles from '../dashboard/page.module.css'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // In a real app, we'd enforce admin role checking here.

  const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: casesCount } = await supabase.from('cases').select('*', { count: 'exact', head: true })
  const { count: submissionsCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true })

  // Mocking average latency and cost as per specs
  const avgLatency = '4.2s'
  const estCost = '$0.003'

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Analytics</h1>
          <p className={styles.subtitle}>Overview of platform usage and AI grading costs.</p>
        </div>
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Users</div>
          <div className={styles.statValue}>{usersCount || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Cases</div>
          <div className={styles.statValue}>{casesCount || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Submissions</div>
          <div className={styles.statValue}>{submissionsCount || 0}</div>
        </div>
        <div className={styles.statCard} style={{ borderColor: '#f87171' }}>
          <div className={styles.statLabel}>Avg AI Latency</div>
          <div className={styles.statValue} style={{ color: '#f87171' }}>{avgLatency}</div>
        </div>
        <div className={styles.statCard} style={{ borderColor: '#f87171' }}>
          <div className={styles.statLabel}>Avg Cost / Grade</div>
          <div className={styles.statValue} style={{ color: '#f87171' }}>{estCost}</div>
        </div>
      </div>
    </div>
  )
}
