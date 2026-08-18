import Link from 'next/link'
import styles from '../dashboard/layout.module.css' // Reusing dashboard styles for speed
import { LayoutDashboard, BookOpen, Users, Settings } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand} style={{ color: '#f87171' }}>MBA Cases Admin</div>
        <nav className={styles.nav}>
          <Link href="/admin" className={styles.navItem}>
            <LayoutDashboard size={20} />
            Analytics
          </Link>
          <Link href="/admin/cases" className={styles.navItem}>
            <BookOpen size={20} />
            Manage Cases
          </Link>
          <Link href="/admin/users" className={styles.navItem}>
            <Users size={20} />
            Manage Users
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/dashboard" className={styles.navItem}>
            <Settings size={20} />
            Back to App
          </Link>
        </nav>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
