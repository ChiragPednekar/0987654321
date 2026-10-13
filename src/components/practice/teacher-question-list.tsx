import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PickToggle } from "@/components/teacher/library-picker";

export interface TeacherQuestion {
  id: string;
  stem: string;
  context: string | null;
  topic: string;
  difficulty: string;
  options: string[];
  correct_index: number;
  /** Written by this teacher (private to their quizzes). */
  own: boolean;
}

/**
 * Every question in a track, for a teacher building a quiz.
 *
 * Shown with its answer key: a teacher choosing questions for their batch needs
 * to see what each one tests and what the right answer is. Students never get
 * this list — the page only renders it for teachers — and the key is read with
 * the service role, never sent to a student's browser.
 */
export function TeacherQuestionList({ questions }: { questions: TeacherQuestion[] }) {
  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">No questions in this track yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {questions.map((q, i) => (
        <li key={q.id}>
          <Card>
            <CardContent className="flex gap-3 p-4">
              <PickToggle
                kind="aptitude"
                id={q.id}
                title={q.stem.length > 90 ? `${q.stem.slice(0, 87)}…` : q.stem}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular">Q{i + 1}</span>
                  <Badge variant="outline">{q.difficulty}</Badge>
                  <Badge variant="secondary">{q.topic}</Badge>
                  {q.own && <Badge>Yours</Badge>}
                </div>
                {q.context && (
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{q.context}</p>
                )}
                <p className="whitespace-pre-line text-sm">{q.stem}</p>
                <ol className="space-y-1 text-sm">
                  {q.options.map((opt, idx) => (
                    <li
                      key={idx}
                      className={
                        idx === q.correct_index
                          ? "flex items-start gap-1.5 font-medium text-[var(--success)]"
                          : "flex items-start gap-1.5 text-muted-foreground"
                      }
                    >
                      <span className="w-4 shrink-0">{String.fromCharCode(65 + idx)}.</span>
                      <span className="min-w-0">{opt}</span>
                      {idx === q.correct_index && <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-label="Correct answer" />}
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
