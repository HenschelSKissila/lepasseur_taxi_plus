/* Graphiques (Recharts) aux couleurs de la charte, lisibles en clair comme en sombre. */
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { court, fmt, fcfa } from "../lib/format";

export const COULEURS = ["#0E7A40", "#D9603F", "#E0A400", "#2F6FB5", "#7A5AC4", "#1A9AA0", "#C2417E", "#8A6B3F", "#5B7A2E", "#6B7A71"];
const V = { c1: "var(--chart-1)", c2: "var(--chart-2)", c3: "var(--chart-3)", c4: "var(--chart-4)" };

function Tip({ active, payload, label, titre }: any) {
  if (!active || !payload?.length) return null;
  return <div className="rtip"><b>{titre ? titre(label, payload) : label}</b>
    {payload.map((p: any) => <div key={p.dataKey}><span style={{ fontFamily: "var(--sans)" }}>
      <i style={{ background: p.color || p.payload?.fill }} />{p.name}</span><span>{fmt(p.value)}</span></div>)}
  </div>;
}
const axeY = { tickFormatter: (v: number) => court(v), width: 44, axisLine: false, tickLine: false } as const;
const axeX = { axisLine: false, tickLine: false, minTickGap: 12 } as const;

/** Entrées / sorties par mois + ligne de solde. */
export function FluxChart({ data }: { data: Array<{ label: string; entrees: number; sorties: number; solde: number }> }) {
  return <div className="rc"><ResponsiveContainer>
    <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={3}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" {...axeX} />
      <YAxis {...axeY} />
      <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-3)", opacity: .5 }} />
      <ReferenceLine y={0} stroke="var(--faint)" />
      <Bar dataKey="entrees" name="Entrées" fill={V.c1} radius={[4, 4, 0, 0]} maxBarSize={22} />
      <Bar dataKey="sorties" name="Sorties" fill={V.c2} radius={[4, 4, 0, 0]} maxBarSize={22} />
      <Line dataKey="solde" name="Solde" stroke={V.c3} strokeWidth={2.5} dot={{ r: 3, fill: "var(--surface)", strokeWidth: 2 }} type="monotone" />
    </ComposedChart>
  </ResponsiveContainer></div>;
}

/** Marge cumulée face à l'investissement, avec projection. */
export function CumulChart({ data, invest }: { data: Array<{ label: string; cumul: number | null; projection?: number | null }>; invest: number }) {
  return <div className="rc"><ResponsiveContainer>
    <AreaChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
      <defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--chart-1)" stopOpacity={.3} /><stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
      </linearGradient></defs>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" {...axeX} />
      <YAxis {...axeY} domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(max, invest * 1.08)]} />
      <Tooltip content={<Tip />} />
      {invest > 0 && <ReferenceLine y={invest} stroke={V.c2} strokeDasharray="6 5" strokeWidth={1.6}
        label={{ value: `Investissement ${court(invest)}`, position: "insideTopRight", fill: "var(--chart-2)", fontSize: 11, fontWeight: 600 }} />}
      <Area dataKey="cumul" name="Marge cumulée" stroke={V.c1} strokeWidth={2.6} fill="url(#gc)" type="monotone" connectNulls={false} />
      <Area dataKey="projection" name="Projection" stroke={V.c3} strokeWidth={2.2} strokeDasharray="4 5" fill="none" type="monotone" connectNulls />
    </AreaChart>
  </ResponsiveContainer></div>;
}

/** Barres journalières (marge du jour). */
export function JoursChart({ data }: { data: Array<{ label: string; marge: number; info: string }> }) {
  return <div className="rc sm"><ResponsiveContainer>
    <ComposedChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" {...axeX} interval="preserveStartEnd" />
      <YAxis {...axeY} />
      <Tooltip content={<Tip titre={(_: string, p: any) => p[0]?.payload?.info} />} cursor={{ fill: "var(--surface-3)", opacity: .5 }} />
      <ReferenceLine y={0} stroke="var(--faint)" />
      <Bar dataKey="marge" name="Marge" radius={[3, 3, 0, 0]} maxBarSize={14}>
        {data.map((d, i) => <Cell key={i} fill={d.marge < 0 ? V.c2 : V.c1} />)}
      </Bar>
    </ComposedChart>
  </ResponsiveContainer></div>;
}

/** Donut de répartition, avec légende chiffrée. */
export function Donut({ items }: { items: Array<{ nom: string; total: number }> }) {
  const tot = items.reduce((s, i) => s + i.total, 0);
  if (!tot) return null;
  return <div className="donut-wrap">
    <div style={{ width: 160, height: 160, position: "relative", flex: "0 0 auto" }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={items} dataKey="total" nameKey="nom" innerRadius={52} outerRadius={76} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
            {items.map((_, i) => <Cell key={i} fill={COULEURS[i % COULEURS.length]} />)}
          </Pie>
          <Tooltip content={({ active, payload }: any) => active && payload?.length ? <div className="rtip">
            <b>{payload[0].name}</b><div><span>{fcfa(payload[0].value)}</span><span>{Math.round(payload[0].value / tot * 100)} %</span></div></div> : null} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", textAlign: "center" }}>
        <div><div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 650 }}>Total</div>
          <div className="mono" style={{ fontSize: 16 }}>{court(tot)}</div></div>
      </div>
    </div>
    <div className="donut-list">{items.slice(0, 8).map((it, i) =>
      <div key={it.nom}><i style={{ background: COULEURS[i % COULEURS.length] }} /><span>{it.nom}</span>
        <b>{fmt(it.total)}</b><em>{Math.round(it.total / tot * 100)} %</em></div>)}</div>
  </div>;
}

/** Anneau de progression du héros. */
export function Ring({ part, size = 132, stroke = 11 }: { part: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, part));
  return <svg viewBox={`0 0 ${size} ${size}`}>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={stroke} />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F4B304" strokeWidth={stroke} strokeLinecap="round"
      strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }} />
  </svg>;
}
