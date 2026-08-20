import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms you agree to when using CaseCode.",
};

const UPDATED = "19 August 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-xs">Last updated: {UPDATED}</p>

      <p>
        By creating an account or using CaseCode, you agree to these terms. If
        you do not agree with them, please do not use the service.
      </p>

      <h2>What CaseCode is</h2>
      <p>
        CaseCode is a practice platform. You attempt business cases, an AI model
        grades your answer against a rubric, and you get a score and written
        feedback.
      </p>

      <h2>What CaseCode is not</h2>
      <p>
        This matters, so it is stated plainly:
      </p>
      <ul>
        <li>
          It is <strong>not</strong> career, financial, investment, legal or tax
          advice. Cases are teaching exercises, not recommendations to act on.
        </li>
        <li>
          It is <strong>not</strong> affiliated with, endorsed by, or connected
          to McKinsey, BCG, Bain, Goldman Sachs, Morgan Stanley, Amazon, Google,
          or any other firm. Where a case is labelled with a company name, that
          describes the <strong>style of question</strong> that firm is known
          for. The cases are original and written for this platform; they are
          not that firm&apos;s real interview material.
        </li>
        <li>
          It does <strong>not</strong> guarantee an interview, an offer, or any
          particular outcome.
        </li>
      </ul>

      <h2>AI grading, and its limits</h2>
      <ul>
        <li>
          Scores are produced by an AI model. They are an{" "}
          <strong>opinion, not a verdict</strong>, and they can be wrong.
        </li>
        <li>
          The model returns per-criterion points; the platform clamps every one
          to the rubric&apos;s maximum and recalculates the total itself, so a
          model cannot inflate a score beyond what the rubric allows.
        </li>
        <li>
          Grading is not perfectly repeatable. The same answer may score
          slightly differently on different attempts.
        </li>
        <li>
          Use scores as a signal of where you are weak, not as a certified
          measure of ability.
        </li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>Provide accurate details and keep your login credentials secure.</li>
        <li>One account per person.</li>
        <li>
          Your university is self-reported and appears on campus leaderboards.
          Misrepresenting it to gain leaderboard position may result in removal.
        </li>
        <li>You are responsible for activity that happens under your account.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Copy, scrape, republish or resell case content, rubrics or model
          answers. They are our original work and are protected by copyright.
        </li>
        <li>
          Submit content you do not have the right to share, including material
          covered by an NDA or confidential to an employer.
        </li>
        <li>
          Post abusive, harassing or unlawful content in discussions or shared
          solutions.
        </li>
        <li>
          Attempt to game scoring or leaderboards through automation, multiple
          accounts, or manipulation of the grading endpoint.
        </li>
        <li>
          Disrupt the service, or attempt to access data belonging to other
          users.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of the answers you write. By submitting an answer you
        grant us a limited licence to store it, send it to our AI grading
        provider, and display it back to you. If you choose to share a solution
        publicly, you also grant other users the right to read it on the
        platform. You can withdraw that by unsharing it.
      </p>

      <h2>Availability</h2>
      <p>
        CaseCode is provided on an &quot;as is&quot; and &quot;as
        available&quot; basis. It may be interrupted, changed or discontinued.
        We do not warrant that it will be uninterrupted or error-free, and we
        are not liable for indirect or consequential loss arising from its use.
      </p>

      <h2>Suspension</h2>
      <p>
        We may suspend or terminate an account that breaches these terms. You
        can delete your account at any time; see the{" "}
        <strong>Privacy Policy</strong> for what that removes.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change. Material changes will be notified to signed-in
        users, and the date above will be updated.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <strong>chiragpednekar3@gmail.com</strong>.
      </p>
    </>
  );
}
