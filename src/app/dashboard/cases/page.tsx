import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import styles from './page.module.css'
import { Clock, Users } from 'lucide-react'

export default async function CaseLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q as string || ''
  const domain = resolvedParams?.domain as string || ''

  const supabase = await createClient()

  let query = supabase.from('cases').select(`
    id, title, difficulty, company_track, company_style, estimated_time, completion_rate,
    domains(name)
  `)

  if (q) query = query.ilike('title', `%${q}%`)
  // Note: Filtering by domain requires joining or mapping the domain string to ID

  const { data: cases } = await query

  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Case Library</h1>
        <div className={styles.controls}>
          <input 
            type="text" 
            placeholder="Search cases..." 
            className={styles.searchBar} 
            defaultValue={q}
          />
          <select className={styles.filterSelect} defaultValue={domain}>
            <option value="">All Domains</option>
            <option value="Finance">Finance</option>
            <option value="Consulting">Consulting</option>
            <option value="PM">Product Management</option>
            <option value="Marketing">Marketing</option>
            <option value="Strategy">Strategy</option>
          </select>
          <select className={styles.filterSelect}>
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </header>

      {cases && cases.length > 0 ? (
        <div className={styles.grid}>
          {cases.map((c: any) => (
            <Link href={`/dashboard/cases/${c.id}`} key={c.id} className={styles.caseCard}>
              <div className={styles.cardHeader}>
                <span className={styles.domainBadge}>{c.domains?.name || 'General'}</span>
                <span className={`${styles.difficultyBadge} ${styles[`diff${c.difficulty}`]}`}>
                  {c.difficulty}
                </span>
              </div>
              <h3 className={styles.cardTitle}>{c.title}</h3>
              {c.company_style && (
                <div className={styles.companyTag}>{c.company_style}</div>
              )}
              
              <div className={styles.cardMeta}>
                <div className={styles.metaItem}>
                  <Clock size={16} />
                  {c.estimated_time}m
                </div>
                <div className={styles.metaItem}>
                  <Users size={16} />
                  {c.completion_rate}% solved
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: '#111', borderRadius: '12px', border: '1px dashed #333' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#fff' }}>No cases found</h2>
          <p style={{ color: '#aaa' }}>
            We couldn't find any cases matching your current filters. 
            Check back later as new cases are added weekly!
          </p>
        </div>
      )}
    </div>
  )
}
