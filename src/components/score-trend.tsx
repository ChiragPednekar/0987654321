"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  /** Short label for the axis, e.g. "12 Aug". */
  label: string;
  percentage: number;
  title: string;
  domain: string;
}

export function ScoreTrend({ data }: { data: TrendPoint[] }) {
  // One point is not a trend; say so rather than drawing a misleading dot.
  if (data.length < 2) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted-foreground">
          {data.length === 0
            ? "Solve a case to start tracking your score."
            : "Solve one more case to see a trend."}
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value, _name, item) => [
            `${Number(value).toFixed(0)}%`,
            (item?.payload as TrendPoint | undefined)?.title ?? "Score",
          ]}
        />
        <Line
          type="monotone"
          dataKey="percentage"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--primary)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
