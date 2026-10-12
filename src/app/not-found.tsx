import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">Сторінку не знайдено</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Можливо, посилання застаріло або об&apos;єкт було видалено з навчального акаунта.</p>
      <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
        Повернутися до огляду
      </Link>
    </div>
  );
}
