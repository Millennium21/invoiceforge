import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-16">
      <Link href="/" className="font-serif text-xl font-semibold">
        Invoice<span className="text-primary">Forge</span>
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">{children}</div>
    </div>
  );
}
