import { login, signup, signInWithGoogle } from './actions'
import styles from './page.module.css'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const error = resolvedParams.error;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome Back</h1>
        
        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className={styles.input}
              placeholder="you@university.edu"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className={styles.input}
            />
          </div>

          <button formAction={login} className={`${styles.button} ${styles.primaryButton}`}>
            Sign In
          </button>
          
          <button formAction={signup} className={`${styles.button} ${styles.secondaryButton}`}>
            Create Account
          </button>
        </form>

        <div className={styles.divider}>OR</div>

        <form className={styles.form}>
          <button formAction={signInWithGoogle} className={`${styles.button} ${styles.secondaryButton}`}>
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  )
}
