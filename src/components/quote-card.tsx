import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <Card>
      <CardContent className="p-5">
        <Quote className="size-4 text-muted-foreground/50" />
        <blockquote className="mt-2.5 text-sm leading-relaxed">
          {quote.text}
        </blockquote>
        <figcaption className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{quote.author}</span> ·{" "}
          {quote.role}
        </figcaption>
      </CardContent>
    </Card>
  );
}
