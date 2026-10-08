"use client";

/**
 * Dashboard charts (Recharts). Kept client-side, fed by server-rendered data so
 * the dashboard itself stays a server component.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = ["#b76e79", "#c2a173", "#dcc7b9", "#96545f", "#e5c2c6"];

const axisProps = {
  stroke: "#7c6f73",
  fontSize: 11,
  tickLine: false,
} as const;

export function MonthlyActivityChart({
  data,
}: {
  data: Array<{ month: string; appointments: number; customers: number }>;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9ded7" vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e9ded7", fontSize: 12 }}
            labelStyle={{ color: "#2b2427" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="appointments"
            name="Appointments"
            stroke="#b76e79"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="customers"
            name="New customers"
            stroke="#c2a173"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PopularServicesChart({ data }: { data: Array<{ name: string; appointments: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9ded7" horizontal={false} />
          <XAxis type="number" {...axisProps} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={130} {...axisProps} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e9ded7", fontSize: 12 }}
            formatter={(value) => [`${value} appointments`, ""]}
          />
          <Bar dataKey="appointments" name="Appointments" radius={[0, 8, 8, 0]} fill="#b76e79" barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e9ded7", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
