import { utcDayIndex } from "@/lib/daily-case";

/**
 * Rotates once per UTC day, same as the daily case, so it is stable across a
 * session and identical for everyone. A random pick would change on every
 * re-render and flicker during navigation.
 */
const QUOTES: { text: string; author: string; role: string }[] = [
  {
    text: "The most dangerous kind of waste is the waste we do not recognise.",
    author: "Shigeo Shingo",
    role: "architect of the Toyota Production System",
  },
  {
    text: "Strategy is about making choices, trade-offs; it's about deliberately choosing to be different.",
    author: "Michael Porter",
    role: "Harvard Business School",
  },
  {
    text: "In preparing for battle I have always found that plans are useless, but planning is indispensable.",
    author: "Dwight D. Eisenhower",
    role: "on why the framework matters more than the answer",
  },
  {
    text: "Price is what you pay. Value is what you get.",
    author: "Warren Buffett",
    role: "Berkshire Hathaway",
  },
  {
    text: "If you can't feed a team with two pizzas, it's too large.",
    author: "Jeff Bezos",
    role: "Amazon",
  },
  {
    text: "Your margin is my opportunity.",
    author: "Jeff Bezos",
    role: "Amazon",
  },
  {
    text: "It is better to be roughly right than precisely wrong.",
    author: "John Maynard Keynes",
    role: "on market sizing",
  },
  {
    text: "The essence of strategy is choosing what not to do.",
    author: "Michael Porter",
    role: "Harvard Business School",
  },
  {
    text: "Culture eats strategy for breakfast.",
    author: "Attributed to Peter Drucker",
    role: "on why the recommendation has to be implementable",
  },
  {
    text: "Fall in love with the problem, not the solution.",
    author: "Uri Levine",
    role: "co-founder, Waze",
  },
  {
    text: "You can observe a lot by just watching.",
    author: "Yogi Berra",
    role: "on reading the exhibit before theorising",
  },
  {
    text: "Not everything that can be counted counts, and not everything that counts can be counted.",
    author: "William Bruce Cameron",
    role: "often misattributed to Einstein",
  },
];

export function QuoteCard() {
  const quote = QUOTES[utcDayIndex() % QUOTES.length];

  // A pull quote, set like one: the words in the serif italic, the source in
  // small capitals. No card and no quotation-mark icon.
  return (
    <figure className="border-t border-border pt-6">
      <blockquote className="font-editorial text-[1.65rem] italic leading-snug tracking-[-0.005em]">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <figcaption className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {quote.author} · {quote.role}
      </figcaption>
    </figure>
  );
}
