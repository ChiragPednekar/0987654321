import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import styles from './page.module.css'
import { ChevronUp, MessageSquare, CheckCircle, Clock } from 'lucide-react'

export default async function CommunityPage() {
  const supabase = await createClient()

  // Fetch top threads/comments (mocked structure if table is empty)
  const { data: threads } = await supabase
    .from('comments')
    .select('*, profiles(full_name), cases(title)')
    .is('parent_id', null)
    .order('upvotes', { ascending: false })
    .limit(20)

  // Fallback mock data if empty
  const mockThreads = threads && threads.length > 0 ? threads : [
    {
      id: '1',
      content: 'Here is my structured approach for the Market Entry case. I used a modified 3C framework...',
      upvotes: 142,
      created_at: new Date().toISOString(),
      profiles: { full_name: 'Sarah J.' },
      cases: { title: 'Market Entry: NeoBank' },
      is_verified: true, // mock field for Verified Strong Solution
      reply_count: 12
    },
    {
      id: '2',
      content: 'Does anyone have tips for estimating market sizing when data is missing?',
      upvotes: 45,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      profiles: { full_name: 'David L.' },
      cases: { title: 'General Discussion' },
      is_verified: false,
      reply_count: 8
    }
  ]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Community Discussions</h1>
        <p className={styles.subtitle}>Discuss cases, share frameworks, and learn from top answers.</p>
      </header>

      <div className={styles.threadList}>
        {mockThreads.map((thread: any) => (
          <div key={thread.id} className={styles.threadCard}>
            <div className={styles.voteColumn}>
              <button className={styles.voteBtn}><ChevronUp size={24} /></button>
              <span className={styles.voteCount}>{thread.upvotes}</span>
            </div>
            
            <div className={styles.threadContent}>
              <div className={styles.threadHeader}>
                <div className={styles.threadMeta}>
                  Posted by <strong>{thread.profiles?.full_name || 'Anonymous'}</strong> in <em>{thread.cases?.title || 'General'}</em>
                </div>
                {thread.is_verified && (
                  <div className={styles.badgeVerified}>
                    <CheckCircle size={14} /> Verified Strong Solution
                  </div>
                )}
              </div>
              
              <Link href={`/dashboard/community/${thread.id}`} className={styles.threadTitle} style={{display: 'block', marginBottom: '0.5rem'}}>
                Discussion Thread
              </Link>
              
              <p className={styles.threadPreview}>
                {thread.content}
              </p>
              
              <div className={styles.threadFooter}>
                <div className={styles.footerItem}>
                  <MessageSquare size={16} />
                  {thread.reply_count || 0} Comments
                </div>
                <div className={styles.footerItem}>
                  <Clock size={16} />
                  {new Date(thread.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
