import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FileText, Search, ListFilter, BookOpen, Home } from "lucide-react";

const links = [
  { to: "/start", label: "Start Here", icon: Home },
  { to: "/shortlist", label: "Shortlist", icon: ListFilter },
  { to: "/sourcing", label: "Sourcing", icon: Search },
  { to: "/approach", label: "Sourcing Methodology", icon: BookOpen },
  { to: "/job", label: "Job Desc", icon: FileText },
];

export function NavBar() {
  const location = useLocation();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center h-14 gap-6">
        <Link to="/" className="font-bold text-foreground text-sm tracking-tight">
          Hiring Tool
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
