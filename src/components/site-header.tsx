import { BookOpenText } from "lucide-react";
import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <BookOpenText className="size-4.5" aria-hidden />
          </span>
          <span className="leading-tight font-semibold tracking-tight">
            Altegra{" "}
            <span className="hidden font-normal text-muted-foreground sm:inline">
              Knowledge Sharing
            </span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <MainNav />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
