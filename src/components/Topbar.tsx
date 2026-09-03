import Link from "next/link";

export function Topbar() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        TradeDocAI
      </Link>
      <nav className="nav">
        <Link href="/pricing">Pricing</Link>
        <Link href="/login">Login</Link>
        <Link className="button" href="/register">
          Start free
        </Link>
      </nav>
    </header>
  );
}
