import Link from 'next/link'
import styles from './layout.module.css'
import { LayoutDashboard, BookOpen, Trophy, Users, Settings } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>MBA Cases</div>
        <nav className={styles.nav}>
          <Link href="/dashboard" className={styles.navItem}>
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link href="/dashboard/cases" className={styles.navItem}>
            <BookOpen size={20} />
            Case Library
          </Link>
          <Link href="/dashboard/leaderboard" className={styles.navItem}>
            <Trophy size={20} />
            Leaderboard
          </Link>
          <Link href="/dashboard/community" className={styles.navItem}>
            <Users size={20} />
            Community
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/dashboard/settings" className={styles.navItem}>
            <Settings size={20} />
            Settings
          </Link>
        </nav>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
