'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import { submitCase } from './actions'

export default function SubmitCasePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const caseId = resolvedParams.id
  const router = useRouter()

  const [mode, setMode] = useState<'unstructured' | 'structured'>('unstructured')
  const [answer, setAnswer] = useState('')
  const [framework, setFramework] = useState('none')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(`draft_${caseId}`)
    if (draft) {
      try {
        const parsed = JSON.parse(draft)
        setAnswer(parsed.answer)
        setMode(parsed.mode)
        setFramework(parsed.framework)
      } catch (e) {}
    }
  }, [caseId])

  // Autosave
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`draft_${caseId}`, JSON.stringify({ answer, mode, framework }))
      setLastSaved(new Date())
    }, 2000)

    return () => clearTimeout(timer)
  }, [answer, mode, framework, caseId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const formData = new FormData()
    formData.append('caseId', caseId)
    formData.append('mode', mode)
    formData.append('answer', answer)
    formData.append('framework', framework)

    try {
      const submissionId = await submitCase(formData)
      localStorage.removeItem(`draft_${caseId}`)
      
      // Call the AI evaluation endpoint
      await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          caseId,
          unstructuredAnswer: mode === 'unstructured' ? answer : null,
          structuredAnswer: mode === 'structured' ? { framework, answer } : null
        })
      })

      router.push(`/dashboard/submissions/${submissionId}`)
    } catch (err) {
      console.error(err)
      setIsSaving(false)
      alert('Failed to submit case.')
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Submit Solution</h1>
      </header>

      <div className={styles.modeToggle}>
        <button 
          className={`${styles.toggleBtn} ${mode === 'unstructured' ? styles.active : ''}`}
          onClick={() => setMode('unstructured')}
          type="button"
        >
          Free Text Mode
        </button>
        <button 
          className={`${styles.toggleBtn} ${mode === 'structured' ? styles.active : ''}`}
          onClick={() => setMode('structured')}
          type="button"
        >
          Structured Framework Mode
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'structured' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Select Framework</label>
            <select 
              className={styles.select} 
              value={framework} 
              onChange={e => setFramework(e.target.value)}
            >
              <option value="none">-- Select a Framework --</option>
              <option value="profitability">Profitability Framework</option>
              <option value="market_entry">Market Entry Framework</option>
              <option value="pricing">Pricing Framework</option>
              <option value="ma">M&A Framework</option>
            </select>
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.label}>Your Answer</label>
          <textarea
            className={styles.textarea}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write your case solution here..."
            required
          />
          <div className={styles.autosaveStatus}>
            {lastSaved ? `Draft saved locally at ${lastSaved.toLocaleTimeString()}` : 'Typing...'}
          </div>
        </div>

        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={isSaving}
        >
          {isSaving ? 'Submitting & Evaluating...' : 'Submit to AI Grader'}
        </button>
      </form>
    </div>
  )
}
