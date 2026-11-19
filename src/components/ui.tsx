/* Briques d'interface : fournisseur (toasts, confirmations), feuille modale, champs, KPI. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { fmt, parseNum } from "../lib/format";

/* ================================================================ contexte */
type Toast = { msg: string; action?: { label: string; fn: () => void } } | null;
type Confirm = { titre: string; texte: string; libelle: string; danger: boolean; ok: (v: boolean) => void } | null;
interface UI {
  toast: (msg: string, action?: { label: string; fn: () => void }) => void;
  confirmer: (titre: string, texte: string, libelle?: string, danger?: boolean) => Promise<boolean>;
}
const Ctx = createContext<UI>(null as unknown as UI);
export const useUI = () => useContext(Ctx);

/** Nombre de feuilles ouvertes : la mise à jour automatique attend qu'il retombe à zéro. */
export const feuillesOuvertes = { n: 0, ecoute: new Set<() => void>() };
const changeFeuilles = (d: number) => { feuillesOuvertes.n += d; feuillesOuvertes.ecoute.forEach(f => f()); };

export function UIProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  const [conf, setConf] = useState<Confirm>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const api: UI = {
    toast: useCallback((msg, action) => {
      setToast({ msg, action });
      clearTimeout(t.current);
      t.current = setTimeout(() => setToast(null), action ? 5500 : 2800);
    }, []),
    confirmer: useCallback((titre, texte, libelle = "Confirmer", danger = false) =>
      new Promise<boolean>(ok => setConf({ titre, texte, libelle, danger, ok })), [])
  };
  const fin = (v: boolean) => { conf?.ok(v); setConf(null); };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className={`toast ${toast ? "on" : ""}`} role="status" aria-live="polite">
        <span>{toast?.msg}</span>
        {toast?.action && <button onClick={() => { toast.action!.fn(); setToast(null); }}>{toast.action.label}</button>}
      </div>
      <Sheet open={!!conf} onClose={() => fin(false)} titre={conf?.titre || ""}>
        <p className="lead" style={{ marginTop: -6 }}>{conf?.texte}</p>
        <div className="btns">
          <button className="btn ghost" onClick={() => fin(false)}>Annuler</button>
          <button className={`btn ${conf?.danger ? "danger" : ""}`} onClick={() => fin(true)}>{conf?.libelle}</button>
        </div>
      </Sheet>
    </Ctx.Provider>
  );
}

/* ============================================================ feuille modale */
export function Sheet({ open, onClose, titre, sous, children, pied }: {
  open: boolean; onClose: () => void; titre: ReactNode; sous?: ReactNode; children: ReactNode; pied?: ReactNode;
}) {
  const [monte, setMonte] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMonte(true); changeFeuilles(1);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      addEventListener("keydown", esc);
      document.body.style.overflow = "hidden";
      return () => { cancelAnimationFrame(r); removeEventListener("keydown", esc); document.body.style.overflow = ""; changeFeuilles(-1); };
    }
    setVisible(false);
    const tm = setTimeout(() => setMonte(false), 320);
    return () => clearTimeout(tm);
  }, [open]);
  if (!monte) return null;
  return createPortal(<>
    <div className={`scrim ${visible ? "on" : ""}`} onClick={onClose} />
    <div className={`sheet ${visible ? "on" : ""}`} role="dialog" aria-modal="true" aria-label={typeof titre === "string" ? titre : undefined}>
      <div className="grab" />
      <div className="sheet-h">
        <div><h3>{titre}</h3>{sous && <p>{sous}</p>}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon n="x" /></button>
      </div>
      {children}
      {pied && <div className="sheet-f">{pied}</div>}
    </div>
  </>, document.body);
}

/* ================================================================== champs */
export function Money({ value, onChange, xl, autoFocus, placeholder = "0", id, sansUnite }: {
  value: number; onChange: (n: number) => void; xl?: boolean; autoFocus?: boolean; placeholder?: string; id?: string; sansUnite?: boolean;
}) {
  return (
    <div className={`money-wrap ${xl ? "xl" : ""}`} style={sansUnite ? { ["--u" as string]: "none" } : undefined}>
      <input id={id} className="input" inputMode="numeric" autoComplete="off" autoFocus={autoFocus} placeholder={placeholder}
        value={value ? fmt(value) : ""} onChange={e => onChange(parseNum(e.target.value))} />
    </div>
  );
}
export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}{hint && <em>{hint}</em>}</span>{children}</label>;
}
export function Seg<T extends string>({ value, onChange, options, className = "" }: {
  value: T; onChange: (v: T) => void; options: Array<[T, ReactNode]>; className?: string;
}) {
  return <div className={`seg ${className}`} role="group">
    {options.map(([v, l]) => <button key={v} type="button" data-v={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
  </div>;
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className="toggle" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

/* ================================================================ affichage */
export function Kpi({ l, v, d, c, neg, unit }: { l: ReactNode; v: ReactNode; d?: ReactNode; c?: string; neg?: boolean; unit?: string }) {
  return <div className={`kpi ${neg ? "neg" : ""}`}>
    <div className="l">{c && <i style={{ background: c }} />}{l}</div>
    <div className="v">{v}{unit && <small>{unit}</small>}</div>
    {d && <div className="d">{d}</div>}
  </div>;
}
export function Empty({ icon = "info", titre, children }: { icon?: string; titre: string; children?: ReactNode }) {
  return <div className="empty"><Icon n={icon} /><b>{titre}</b>{children}</div>;
}
export function Sec({ titre, children }: { titre: ReactNode; children?: ReactNode }) {
  return <div className="sec"><h2>{titre}</h2>{children}</div>;
}
export function Bar({ part, tone = "" }: { part: number; tone?: "" | "gold" | "red" }) {
  return <div className={`bar ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, part * 100))}%` }} /></div>;
}
