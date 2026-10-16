import {
LoaderCircle,
Search,
TriangleAlert
} from "lucide-react";
import { type ReactNode } from "react";
export const date = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString() : "Not recorded";
export const display = (v: unknown): string =>
  v === null || v === undefined
    ? "Not recorded"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function State({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  retry?: () => void;
}) {
  return loading ? (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={22} /> Reading connected evidence…
    </div>
  ) : error ? (
    <div className="state error" role="alert">
      <TriangleAlert />
      <div>
        <b>Data could not be loaded</b>
        <p>{error}</p>
        {retry && <button onClick={retry}>Retry connection</button>}
      </div>
    </div>
  ) : empty ? (
    <div className="state">
      <Search />
      <div>
        <b>No records found</b>
        <p>Seed the synthetic graph or adjust your filter to get started.</p>
      </div>
    </div>
  ) : null;
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
