import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How grading works",
  description:
    "Exactly how a CaseCode answer is scored, what the AI does and does not decide, and how to read a score.",
};

export default function HowGradingWorksPage() {
  return (
    <>
      <h1>How grading works</h1>
      <p>
        A score you do not understand is a score you cannot learn from. This
        page explains exactly what happens between hitting submit and seeing a
        number.
      </p>

      <h2>1. Every case has a rubric</h2>
      <p>
        A rubric is written before the case is published. It lists the criteria
        the answer is judged on and how many points each is worth — for example{" "}
        <strong>financial analysis 30</strong>,{" "}
        <strong>risk assessment 25</strong>,{" "}
        <strong>recommendation 25</strong>,{" "}
        <strong>market analysis 20</strong>. Each criterion also has a
        descriptor saying what a strong answer looks like. The weights are
        fixed, identical for everyone attempting that case, and not chosen by
        the model.
      </p>

      <h2>2. The model sees the case, the rubric, and your answer</h2>
      <p>
        Your answer is sent to Anthropic&apos;s API along with the scenario, the
        instructions, the rubric and its descriptors, and the model answer. It
        is asked to return points per criterion plus specific written feedback:
        what you did well, what was missing, and what to do differently next
        time.
      </p>
      <p>
        The request runs at a low temperature setting, which makes the output
        more repeatable than a normal chat response — though not perfectly so.
      </p>

      <h2>3. The platform, not the model, does the arithmetic</h2>
      <p>This is the part that protects you from a bad grade:</p>
      <ul>
        <li>
          Every criterion score is <strong>clamped</strong> to that
          criterion&apos;s maximum. A model that tries to award 40 out of 30
          gets 30.
        </li>
        <li>Negative scores are floored at zero.</li>
        <li>
          Any criterion the model invents that is not in the rubric is{" "}
          <strong>discarded</strong>.
        </li>
        <li>
          The total is <strong>recomputed by summing the clamped criteria</strong>
          . The model&apos;s own claimed total is never used — models are
          unreliable at arithmetic, and this number decides leaderboard
          position.
        </li>
      </ul>

      <h2>4. What you get back</h2>
      <p>
        A per-criterion breakdown, an overall percentage, a one-line verdict,
        and three lists: strengths, weaknesses, and concrete improvements. The
        feedback is the point. The number is just a way to track whether the
        feedback is landing.
      </p>

      <h2>How to read your score</h2>
      <ul>
        <li>
          <strong>Compare against yourself.</strong> A rising trend on a
          criterion means the feedback is working.
        </li>
        <li>
          <strong>Read the weakest criterion first.</strong> That is where the
          next marginal point is.
        </li>
        <li>
          <strong>Do not over-trust a single grade.</strong> AI grading has
          variance. Three attempts across three cases tell you far more than one
          score on one case.
        </li>
      </ul>

      <h2>Where it is weak</h2>
      <p>
        Being straight about the limits: an AI grader rewards structure and
        explicit reasoning, so an answer that shows its working tends to score
        better than an equally good answer that states conclusions tersely. It
        can miss genuinely creative arguments that do not match the rubric&apos;s
        expectations. And it is not a substitute for a human interviewer pushing
        back on you.
      </p>
      <p>
        If a grade looks wrong, it may well be. Use the report link on the case
        and it will be reviewed.
      </p>

      <p className="pt-4">
        <Link href="/cases" className="underline underline-offset-4">
          Back to the case library
        </Link>
      </p>
    </>
  );
}
