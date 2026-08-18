import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import styles from '../../dashboard/leaderboard/page.module.css' // Reusing table styles

export default async function AdminCasesPage() {
  const supabase = await createClient()

  const { data: cases } = await supabase
    .from('cases')
    .select('id, title, difficulty, domains(name)')
    .order('created_at', { ascending: false })

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Manage Cases</h1>
          <p className={styles.subtitle}>Create, edit, or delete case studies.</p>
        </div>
        <button style={{ padding: '0.75rem 1.5rem', backgroundColor: '#fff', color: '#000', borderRadius: '6px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          + Create New Case
        </button>
      </header>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Title</th>
              <th className={styles.th}>Domain</th>
              <th className={styles.th}>Difficulty</th>
              <th className={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases && cases.map((c: any) => (
              <tr key={c.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 600 }}>{c.title}</td>
                <td className={styles.td}>{c.domains?.name || 'N/A'}</td>
                <td className={styles.td}>{c.difficulty}</td>
                <td className={styles.td}>
                  <button style={{ background: 'transparent', color: '#60a5fa', border: 'none', cursor: 'pointer', marginRight: '1rem' }}>Edit</button>
                  <button style={{ background: 'transparent', color: '#f87171', border: 'none', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
            {(!cases || cases.length === 0) && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
                  No cases found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
