import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { ForestMap } from "@/components/forest-map";
import {
  regions, regionsSortedByLoss, ndviTrend, landCoverMix,
  recentAlerts, totals,
} from "@/lib/forest-data";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend,
  ReferenceLine,
} from "recharts";
import {
  AlertTriangle, TrendingDown, Layers, Activity, Flame,
  ArrowDown, Shield, Filter, ChevronRight, ArrowDownRight,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Monitoring Dashboard · Retreeval" },
      { name: "description", content: "Live deforestation monitoring across tracked regions: NDVI trends, alerts, land cover and impact metrics." },
    ],
  }),
  component: Dashboard,
});

const PIE_PALETTE = ["#2D6A4F", "#b54a2a", "#d4a14a", "#7F5539", "#40916C", "#95D5B2"];

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  warning:  "bg-amber-100 text-amber-700 border border-amber-200",
  info:     "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

type AlertFilter = "all" | "critical" | "warning" | "info";

function Dashboard() {
  const [selectedId, setSelectedId] = useState(regionsSortedByLoss[0].id);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");

  const selected = regions.find((r) => r.id === selectedId) ?? regionsSortedByLoss[0];
  const trend = useMemo(() => ndviTrend(selected.ndviBefore), [selected.id]);

  const totalLoss = totals.lossHa;
  const totalHa   = totals.monitoredHa;

  // Summary insights derived from data
  const highestRisk    = regionsSortedByLoss[0];
  const fastestRate    = [...regions].sort((a, b) => (b.lossHa / b.areaHa) - (a.lossHa / a.areaHa))[0];
  const recoveryLeader = [...regions].sort((a, b) => b.ndviAfter - a.ndviAfter)[0];
  const criticalCount  = regions.filter((r) => r.status === "critical").length;

  const filteredAlerts = alertFilter === "all"
    ? recentAlerts
    : recentAlerts.filter((a) => a.severity === alertFilter);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1400px] px-5 py-10 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-moss">Organization · Conservation Network</p>
            <h1 className="mt-1 text-4xl">Monitoring Overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {regions.length} regions · {totalHa.toLocaleString()} ha monitored · Sentinel-2 L2A
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-card px-3 py-1.5">Latest scan: 2026-06-15</span>
            <span className="rounded-full border border-border bg-card px-3 py-1.5">Cloud cover &lt; 20%</span>
            <span className="rounded-full border border-border bg-card px-3 py-1.5">{criticalCount} critical regions</span>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Layers className="h-4 w-4 text-moss" />}
            label="Regions Monitored"
            value={totals.regions.toString()}
            sub="across 8 countries"
          />
          <KpiCard
            icon={<Activity className="h-4 w-4 text-moss" />}
            label="Hectares Under Watch"
            value={totalHa.toLocaleString()}
            sub={`${(totalHa / 1_000_000).toFixed(2)}M ha total`}
          />
          <KpiCard
            icon={<TrendingDown className="h-4 w-4 text-alert" />}
            label="Hectares Lost (12 mo)"
            value={totalLoss.toLocaleString()}
            sub={`${((totalLoss / totalHa) * 100).toFixed(1)}% of monitored area`}
            tone="alert"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4 text-alert" />}
            label="Open Critical Alerts"
            value={criticalCount.toString()}
            sub={`${recentAlerts.filter(a => a.severity === "critical").length} in last 7 days`}
            tone="alert"
          />
        </div>

        {/* ── Insight banners ── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InsightChip
            icon={<Flame className="h-3.5 w-3.5 text-alert" />}
            label="Highest-risk region"
            value={highestRisk.name}
            sub={`${highestRisk.lossHa.toLocaleString()} ha lost`}
            color="alert"
          />
          <InsightChip
            icon={<ArrowDownRight className="h-3.5 w-3.5 text-orange-600" />}
            label="Fastest deforestation rate"
            value={fastestRate.name}
            sub={`${((fastestRate.lossHa / fastestRate.areaHa) * 100).toFixed(1)}% of area lost`}
            color="orange"
          />
          <InsightChip
            icon={<ArrowDown className="h-3.5 w-3.5 text-amber-600" />}
            label="Total NDVI decline (avg)"
            value={(() => {
              const avg = regions.reduce((s, r) => s + (r.ndviBefore - r.ndviAfter), 0) / regions.length;
              return `−${avg.toFixed(3)}`;
            })()}
            sub="across all monitored areas"
            color="amber"
          />
          <InsightChip
            icon={<Shield className="h-3.5 w-3.5 text-moss" />}
            label="Healthiest canopy"
            value={recoveryLeader.name}
            sub={`NDVI ${recoveryLeader.ndviAfter.toFixed(2)} · ${recoveryLeader.status}`}
            color="green"
          />
        </div>

        {/* ── Map + Leaderboard ── */}
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <ForestMap height={480} selectedId={selectedId} onSelect={setSelectedId} />

          {/* Top Deforested Regions leaderboard */}
          <div className="flex flex-col rounded-xl border border-border bg-card ring-soft overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Top Deforested Regions</div>
                <div className="text-xs text-muted-foreground">Ranked by hectares lost · 12-month window</div>
              </div>
              <span className="rounded-full bg-alert/10 px-2.5 py-0.5 text-xs font-medium text-alert">
                {totalLoss.toLocaleString()} ha total
              </span>
            </div>
            <ul className="divide-y divide-border overflow-y-auto flex-1">
              {regionsSortedByLoss.map((r, idx) => {
                const isSel = r.id === selectedId;
                const pct = ((r.lossHa / r.areaHa) * 100).toFixed(1);
                const tone = r.status === "critical" ? "text-alert" : r.status === "watch" ? "text-amber-600" : "text-moss";
                const badgeStyle = r.status === "critical"
                  ? "bg-red-100 text-red-700"
                  : r.status === "watch"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700";

                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${isSel ? "bg-muted/70 border-l-2 border-forest-deep" : ""}`}
                    >
                      {/* Rank */}
                      <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold ${
                        idx < 3 ? "bg-alert/15 text-alert" : "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </span>

                      {/* Name + country */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.country} · {r.ecosystem.split(" ").slice(-2).join(" ")}</div>
                      </div>

                      {/* Loss stats */}
                      <div className="text-right flex-shrink-0">
                        <div className={`text-sm font-semibold ${tone}`}>
                          {r.lossHa.toLocaleString()} ha
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeStyle}`}>
                            {r.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      </div>

                      {isSel && <ChevronRight className="h-3.5 w-3.5 text-forest-deep flex-shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* ── NDVI Trend + Monthly Loss ── */}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* NDVI 5-year trend — dynamic per selection */}
          <div className="rounded-xl border border-border bg-card p-5 ring-soft">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">NDVI · 5-Year Trend</div>
                <div className="font-display text-xl mt-0.5">{selected.name}</div>
                <div className="text-xs text-muted-foreground">{selected.country} · {selected.ecosystem}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-right text-xs">
                <span className="text-muted-foreground">Baseline NDVI</span>
                <span className="font-mono font-medium">{selected.ndviBefore.toFixed(3)}</span>
                <span className="text-muted-foreground">Current NDVI</span>
                <span className="font-mono font-medium text-alert">{selected.ndviAfter.toFixed(3)}</span>
                <span className="text-muted-foreground">Net change</span>
                <span className="font-mono font-medium text-alert">
                  −{(selected.ndviBefore - selected.ndviAfter).toFixed(3)}
                </span>
              </div>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ left: -10, right: 10, top: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2D6A4F" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#2D6A4F" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7df" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7568" }} tickLine={false} axisLine={false} interval={11} />
                  <YAxis domain={[0.3, 0.95]} tick={{ fontSize: 10, fill: "#6b7568" }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => v.toFixed(2)} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7df", fontSize: 12, padding: "8px 12px" }}
                    formatter={(v: number) => [v.toFixed(3), "NDVI"]}
                  />
                  {/* Historical baseline reference */}
                  <ReferenceLine
                    y={selected.ndviBefore}
                    stroke="#40916C"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{ value: `Baseline ${selected.ndviBefore.toFixed(2)}`, position: "right", fontSize: 10, fill: "#40916C" }}
                  />
                  {/* Current level reference */}
                  <ReferenceLine
                    y={selected.ndviAfter}
                    stroke="#b54a2a"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{ value: `Current ${selected.ndviAfter.toFixed(2)}`, position: "right", fontSize: 10, fill: "#b54a2a" }}
                  />
                  <Area type="monotone" dataKey="ndvi" stroke="#1B4332" strokeWidth={2} fill="url(#ndviGrad)" dot={false} activeDot={{ r: 4, fill: "#1B4332" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Forest Loss */}
          <div className="rounded-xl border border-border bg-card p-5 ring-soft">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Forest Loss</div>
            <div className="font-display text-xl mt-0.5">{selected.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Estimated monthly hectares lost over 18-month window
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={trend.slice(-18)} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7df" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7568" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7568" }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => v > 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7df", fontSize: 12 }}
                    formatter={(v: number) => [`${v.toLocaleString()} ha`, "Estimated loss"]}
                  />
                  <Bar dataKey="loss" fill="#b54a2a" radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Land Cover + Alerts ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.8fr]">
          {/* Land cover pie */}
          <div className="rounded-xl border border-border bg-card p-5 ring-soft">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Land Cover Classification</div>
            <div className="font-display text-xl mt-0.5">CNN Model Output</div>
            <div className="text-xs text-muted-foreground mt-0.5">Composite across all monitored regions</div>
            <div className="mt-2 h-60">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={landCoverMix}
                    dataKey="pct"
                    nameKey="class"
                    innerRadius={52}
                    outerRadius={90}
                    paddingAngle={2}
                    label={({ name, pct }) => `${pct}%`}
                    labelLine={false}
                  >
                    {landCoverMix.map((_, i) => (
                      <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7df", fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, "Coverage"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent alerts */}
          <div className="rounded-xl border border-border bg-card ring-soft overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div>
                <div className="text-sm font-semibold">Recent Alerts</div>
                <div className="text-xs text-muted-foreground">{recentAlerts.length} alerts · last 7 days</div>
              </div>
              {/* Filter buttons */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3 w-3 text-muted-foreground" />
                {(["all", "critical", "warning", "info"] as AlertFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setAlertFilter(f)}
                    className={`rounded-md px-2.5 py-1 text-xs capitalize transition ${
                      alertFilter === f
                        ? "bg-forest-deep text-white"
                        : "border border-border text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Region</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">ΔNDVI</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Hectares</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Severity</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-t border-border transition-colors hover:bg-muted/30 ${a.regionId === selectedId ? "bg-muted/40" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.id}</td>
                      <td className="px-4 py-3 font-medium">{a.region}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-alert">{a.deltaNdvi.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm">{a.hectares.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{a.date}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLE[a.severity]}`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedId(a.regionId)}
                          className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-moss hover:text-foreground transition"
                        >
                          Focus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAlerts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No {alertFilter} alerts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Alert summary footer */}
            <div className="border-t border-border bg-muted/20 px-5 py-2.5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-alert" />
                {recentAlerts.filter(a => a.severity === "critical").length} critical
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                {recentAlerts.filter(a => a.severity === "warning").length} warning
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                {recentAlerts.filter(a => a.severity === "info").length} info
              </span>
              <span className="ml-auto">
                Total: {recentAlerts.reduce((s, a) => s + a.hectares, 0).toLocaleString()} ha flagged
              </span>
            </div>
          </div>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "alert";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 ring-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`mt-3 font-display text-3xl tabular-nums ${tone === "alert" ? "text-alert" : "text-forest-deep"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function InsightChip({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: "alert" | "orange" | "amber" | "green";
}) {
  const bg = color === "alert" ? "bg-red-50 border-red-100"
    : color === "orange" ? "bg-orange-50 border-orange-100"
    : color === "amber"  ? "bg-amber-50 border-amber-100"
    : "bg-emerald-50 border-emerald-100";
  const textColor = color === "alert" ? "text-red-700"
    : color === "orange" ? "text-orange-700"
    : color === "amber"  ? "text-amber-700"
    : "text-emerald-700";

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-base font-semibold leading-tight ${textColor}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
