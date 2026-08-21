"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface WeekPoint {
  label: string;
  points: number;
  solved: number;
}

/**
 * Points earned per week. A bar chart rather than a line: weekly totals are
 * discrete buckets, and a line implies a continuous value between them.
 */
export function WeeklyPoints({ data }: { data: WeekPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.points, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-center">
        <p className="text-sm text-muted-foreground">
          Solve a case to start earning points.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "var(--accent)", opacity: 0.3 }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value, _name, item) => [
            `${value} pts · ${(item?.payload as WeekPoint | undefined)?.solved ?? 0} solved`,
            "Week",
          ]}
        />
        <Bar dataKey="points" fill="var(--primary)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
