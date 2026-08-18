import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import Timer from './Timer'
import { FileText, Download } from 'lucide-react'

export default async function CaseDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const caseId = resolvedParams.id;
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: caseData, error } = await supabase
    .from('cases')
    .select(`*, domains(name)`)
    .eq('id', caseId)
    .single()

  if (error || !caseData) notFound()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.meta}>
          <span className={styles.badge}>{caseData.domains?.name || 'General'}</span>
          <span className={styles.badge}>{caseData.difficulty}</span>
          {caseData.company_track && (
            <span className={styles.badge} style={{ backgroundColor: '#1e3a8a', color: '#bfdbfe' }}>
              {caseData.company_track}
            </span>
          )}
        </div>
        <h1 className={styles.title}>{caseData.title}</h1>
        <Timer initialMinutes={120} />
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Scenario</h2>
        <div className={styles.content}>{caseData.scenario}</div>
      </section>

      {caseData.supporting_data && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Supporting Data</h2>
          <div className={styles.content}>{caseData.supporting_data}</div>
          
          {/* Mock attachment UI since storage isn't fully wired with real files yet */}
          <div className={styles.attachmentBox}>
            <FileText size={24} color="#aaa" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Exhibit_1_Financials.pdf</div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>1.2 MB</div>
            </div>
            <button className={styles.submitBtn} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#222', color: '#fff' }}>
              <Download size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/>
              Download
            </button>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Instructions</h2>
        <div className={styles.content}>{caseData.instructions}</div>
      </section>

      <div className={styles.submitSection}>
        <button className={styles.reportLink}>Report a problem with this case</button>
        <Link href={`/dashboard/cases/${caseId}/submit`} className={styles.submitBtn}>
          Begin Solution
        </Link>
      </div>
    </div>
  )
}
