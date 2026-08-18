import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import styles from './page.module.css'

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const view = resolvedParams?.view as string || 'global'
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: any = null
  if (user) {
    const { data } = await supabase.from('profiles').select('university').eq('id', user.id).single()
    profile = data
  }

  // Build the query based on the view
  let query = supabase
    .from('profiles')
    .select('id, full_name, university, score, level')
    .order('score', { ascending: false })
    .limit(50)

  if (view === 'university' && profile?.university) {
    query = query.eq('university', profile.university)
  }

  // NOTE: For "friends" view, we'd need a friends table/relation. 
  // We'll skip filtering for 'friends' in this initial mock if it's selected.

  const { data: leaders } = await query

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.subtitle}>See how you stack up against other candidates.</p>
        </div>
        
        <div className={styles.tabs}>
          <Link 
            href="/dashboard/leaderboard?view=global" 
            className={`${styles.tab} ${view === 'global' ? styles.activeTab : ''}`}
          >
            Global
          </Link>
          <Link 
            href="/dashboard/leaderboard?view=university" 
            className={`${styles.tab} ${view === 'university' ? styles.activeTab : ''}`}
          >
            My University
          </Link>
          <Link 
            href="/dashboard/leaderboard?view=friends" 
            className={`${styles.tab} ${view === 'friends' ? styles.activeTab : ''}`}
          >
            Friends
          </Link>
        </div>
      </header>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Rank</th>
              <th className={styles.th}>Candidate</th>
              <th className={styles.th}>Level</th>
              <th className={styles.th}>Total XP / Score</th>
            </tr>
          </thead>
          <tbody>
            {leaders && leaders.map((leader, index) => (
              <tr key={leader.id} className={styles.tr}>
                <td className={`${styles.td} ${styles.rank} ${index < 3 ? styles.rankTop : ''}`}>
                  #{index + 1}
                </td>
                <td className={styles.td}>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}>
                      {leader.full_name ? leader.full_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div className={styles.userName}>{leader.full_name || 'Anonymous User'}</div>
                      <div className={styles.userUni}>{leader.university || 'No University'}</div>
                    </div>
                  </div>
                </td>
                <td className={styles.td}>Lvl {leader.level}</td>
                <td className={`${styles.td} ${styles.score}`}>{leader.score}</td>
              </tr>
            ))}
            {(!leaders || leaders.length === 0) && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
                  No data available for this leaderboard yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
