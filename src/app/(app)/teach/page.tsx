import { redirect } from "next/navigation";

/**
 * /teach was the first cut of the teacher area. It is kept as a redirect
 * rather than deleted, because links to it exist in earlier notifications and
 * in anything a teacher bookmarked.
 */
export default function TeachRedirect() {
  redirect("/teacher");
}
