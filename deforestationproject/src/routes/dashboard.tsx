import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { ForestMap } from "@/components/forest-map";
import { regions, ndviTrend, landCoverMix, recentAlerts, totals } from "@/lib/forest-data";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { AlertTriangle, TrendingDown, Layers, Activity } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Monitoring Dashboard · ForestWatch AI" },
      { name: "description", content: "Live deforestation monitoring across saved regions: NDVI trends, alerts, land cover and impact metrics." },
    ],
  }),
  component: Dashboard,
});

const PALETTE = ["#2D6A4F", "#b54a2a", "#d4a14a", "#7F5539", "#40916C", "#95D5B2"];

function Dashboard() {
  const [selectedId, setSelectedId] = useState(regions[0].id);
  const selected = regions.find((r) => r.id === selectedId)!;
  const trend = useMemo(() => ndviTrend(selected.ndviBefore), [selected.id]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-moss">Organization · Conservation Network</p>
            <h1 className="mt-2 text-4xl">Monitoring overview</h1>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-card px-3 py-1">Latest scan: 2026-06-15</span>
            <span className="rounded-full border border-border bg-card px-3 py-1">Sentinel-2 L2A · cloud &lt; 20%</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Layers, label: "Regions monitored", value: totals.regions.toString() },
            { icon: Activity, label: "Hectares under watch", value: totals.monitoredHa.toLocaleString() },
            { icon: TrendingDown, label: "Hectares lost (12 mo)", value: totals.lossHa.toLocaleString(), tone: "alert" as const },
            { icon: AlertTriangle, label: "Open critical alerts", value: "2", tone: "alert" as const },
          ].map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className="ring-soft rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${tone === "alert" ? "text-alert" : "text-moss"}`} />
              </div>
              <div className={`mt-3 font-display text-3xl ${tone === "alert" ? "text-alert" : "text-forest-deep"}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Map + region list */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <ForestMap height={460} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="ring-soft rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Saved regions</div>
            <ul className="max-h-[396px] divide-y divide-border overflow-y-auto">
              {regions.map((r) => {
                const tone = r.status === "critical" ? "text-alert" : r.status === "watch" ? "text-earth" : "text-moss";
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-muted/60 ${selectedId === r.id ? "bg-muted/70" : ""}`}
                    >
                      <div>
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.country} · {r.areaHa.toLocaleString()} ha</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${tone}`}>{r.lossHa.toLocaleString()} ha</div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.status}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* NDVI trend */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="ring-soft rounded-xl border border-border bg-card p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm text-muted-foreground">NDVI · 5-year trend</div>
                <div className="font-display text-xl">{selected.name}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Before <span className="font-mono text-foreground">{selected.ndviBefore}</span></div>
                <div>After <span className="font-mono text-alert">{selected.ndviAfter}</span></div>
              </div>
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2D6A4F" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#2D6A4F" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e5e7df" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7568" }} tickLine={false} axisLine={false} interval={11} />
                  <YAxis domain={[0.3, 0.9]} tick={{ fontSize: 11, fill: "#6b7568" }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7df", fontSize: 12 }} />
                  <Area type="monotone" dataKey="ndvi" stroke="#1B4332" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ring-soft rounded-xl border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">Cumulative forest loss</div>
            <div className="font-display text-xl">Monthly hectares</div>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <BarChart data={trend.slice(-18)} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7df" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7568" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7568" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7df", fontSize: 12 }} />
                  <Bar dataKey="loss" fill="#b54a2a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Land cover + alerts */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <div className="ring-soft rounded-xl border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">Land cover classification</div>
            <div className="font-display text-xl">CNN model output</div>
            <div className="mt-2 h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={landCoverMix} dataKey="pct" nameKey="class" innerRadius={50} outerRadius={88} paddingAngle={2}>
                    {landCoverMix.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ring-soft rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-medium">Recent alerts</div>
              <button className="text-xs text-moss hover:text-forest-deep">Export CSV</button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 text-left font-normal">ID</th>
                  <th className="px-5 py-2 text-left font-normal">Region</th>
                  <th className="px-5 py-2 text-right font-normal">ΔNDVI</th>
                  <th className="px-5 py-2 text-right font-normal">Hectares</th>
                  <th className="px-5 py-2 text-right font-normal">Date</th>
                  <th className="px-5 py-2 text-right font-normal">Severity</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.map((a) => {
                  const tone = a.severity === "critical" ? "bg-alert/15 text-alert" : a.severity === "warning" ? "bg-earth/15 text-earth" : "bg-moss/15 text-moss";
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{a.id}</td>
                      <td className="px-5 py-2.5">{a.region}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-alert">{a.deltaNdvi}</td>
                      <td className="px-5 py-2.5 text-right">{a.hectares.toLocaleString()}</td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">{a.date}</td>
                      <td className="px-5 py-2.5 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{a.severity}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
