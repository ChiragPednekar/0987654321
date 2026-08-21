import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What CaseCode collects, why, how long it is kept, and how to have it deleted.",
};

const UPDATED = "19 August 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-xs">Last updated: {UPDATED}</p>

      <p>
        This policy explains what CaseCode collects, why, and what you can ask
        us to do with it. It is written to be read rather than to be
        impenetrable.
      </p>

      <h2>Who we are</h2>
      <p>
        CaseCode is an independent case-practice platform. For questions about
        this policy or your data, contact{" "}
        <strong>chiragpednekar3@gmail.com</strong>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your email address and name. If you
          sign in with Google, we receive your email, name and profile picture
          from Google; we never see your Google password.
        </li>
        <li>
          <strong>University or business school</strong> — optional, and{" "}
          <strong>self-reported</strong>. We do not currently verify it. It is
          used to place you on campus leaderboards.
        </li>
        <li>
          <strong>Your submitted answers</strong> — the full text of every case
          answer you submit, along with the time spent and attempt number.
        </li>
        <li>
          <strong>Grades and feedback</strong> — the scores and written feedback
          produced for each submission.
        </li>
        <li>
          <strong>Activity</strong> — cases solved, XP, streaks, badges and
          leaderboard standing.
        </li>
      </ul>

      <h2>How your answers are used</h2>
      <p>
        This is the part worth reading carefully, because it is the least
        obvious.
      </p>
      <ul>
        <li>
          When you submit an answer, its text is sent to a third-party AI
          provider together with the case and its rubric, so it can be graded.
          The provider currently in use is named under &quot;Who else processes
          your data&quot; below. Do not put confidential employer
          information, personal data about other people, or anything you are
          under an NDA about into a case answer.
        </li>
        <li>
          Your answers are <strong>private by default</strong>. An answer only
          becomes visible to other users if you explicitly choose to share it.
        </li>
        <li>
          We may read submitted answers in aggregate to improve rubrics and
          calibrate grading. Where we quote an answer in any public material, it
          will be anonymised and only with your consent.
        </li>
        <li>
          We do <strong>not</strong> sell your data, and we do not use your
          answers to train our own models.
        </li>
      </ul>

      <h2>Who else processes your data</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication and storage.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and request logs.
        </li>
        <li>
          <strong>The configured AI provider</strong> — grading of submitted
          answers. This is one of Anthropic, OpenAI or Google (Gemini),
          depending on configuration. If it changes, this page is updated.
        </li>
        <li>
          <strong>Google</strong> — only if you choose Google sign-in.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Account data</strong> — until you delete your account.
        </li>
        <li>
          <strong>Submissions and grades</strong> — until you delete your
          account, because your progress history depends on them.
        </li>
        <li>
          <strong>Request logs</strong> — retained by our hosting provider on
          their own schedule, typically weeks rather than months.
        </li>
      </ul>
      <p>
        Deleting your account removes your profile, submissions, grades,
        bookmarks and leaderboard entries. Anonymised aggregate counts (for
        example, how many people attempted a given case) may remain.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us to give you a copy of your data, correct it, or delete it
        entirely. Email <strong>chiragpednekar3@gmail.com</strong> and we will
        action it within 30 days. You can edit your profile details yourself at
        any time from your account settings.
      </p>

      <h2>Cookies</h2>
      <p>
        We use cookies only to keep you signed in. There is no advertising
        tracking and no third-party analytics profiling on this site. If that
        changes, this policy will be updated first and you will be asked for
        consent where the law requires it.
      </p>

      <h2>Children</h2>
      <p>
        CaseCode is intended for university students and working professionals
        and is not directed at anyone under 16.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially, we will update the date above and
        notify signed-in users.
      </p>
    </>
  );
}
