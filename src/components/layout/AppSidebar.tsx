import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Compass,
  AlertTriangle,
  FileText,
  GraduationCap,
  Settings,
  Bell,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { notifications as initialNotifications, currentUser, ROLE_PERMISSIONS, getAccount } from "@/data/kam-data";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts Portfolio", icon: Users },
  { to: "/strategy", label: "Strategy Builder", icon: Compass },
  { to: "/escalations", label: "Escalations", icon: AlertTriangle, badge: 3 },
  { to: "/contracts", label: "Contracts", icon: FileText },
  { to: "/educate", label: "Education", icon: GraduationCap },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [notifs, setNotifs] = useState(initialNotifications);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = notifs.filter((n) => !n.read).length;
  const perms = ROLE_PERMISSIONS[currentUser.role];

  // close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const SidebarBody = (
    <>
      <div className="p-6 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-accent flex items-center justify-center text-white font-bold text-sm">A</div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Aether KAM</div>
            <div className="text-[10px] text-slate-500 font-mono">v2.4.0</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative size-8 rounded-md hover:bg-white/5 flex items-center justify-center text-slate-300"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-crit text-white text-[9px] font-bold rounded-full size-4 flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden size-8 rounded-md hover:bg-white/5 flex items-center justify-center text-slate-300"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {showNotifs && (
        <div className="mx-3 mb-3 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Notifications</span>
            <button
              onClick={() => setNotifs((n) => n.map((x) => ({ ...x, read: true })))}
              className="text-[10px] text-accent hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
            {notifs.map((n) => {
              const acc = n.accountId ? getAccount(n.accountId) : undefined;
              const dot = n.type === "alert" ? "bg-crit" : n.type === "action" ? "bg-warn" : "bg-accent";
              return (
                <div key={n.id} className={`px-3 py-2.5 ${!n.read ? "bg-white/[0.03]" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className={`size-1.5 rounded-full mt-1.5 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-white leading-tight">{n.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{n.body}</p>
                      <p className="text-[9px] text-slate-500 mt-1 font-mono uppercase">
                        {n.time}{acc ? ` · ${acc.name}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-3">
                <item.icon className="size-4" />
                {item.label}
              </span>
              {item.badge ? (
                <span className="bg-crit px-1.5 py-0.5 rounded text-[10px] text-white font-bold">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors">
          <Settings className="size-4" /> Settings
        </button>
        <div className="flex items-center gap-3 px-3">
          <div className="size-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-[10px] text-white font-semibold">
            {currentUser.initials}
          </div>
          <div className="text-xs min-w-0 flex-1">
            <p className="font-medium text-white truncate">{currentUser.name}</p>
            <div className="flex items-center gap-1 text-slate-500">
              <Shield className="size-3" />
              <span className="truncate">{currentUser.role}</span>
              <span className={`ml-1 px-1 py-px rounded text-[9px] font-bold uppercase ${perms.write ? "bg-success/20 text-success" : "bg-muted/20 text-slate-300"}`}>
                {perms.write ? "RW" : "RO"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4 border-b border-white/10">
        <button
          onClick={() => setMobileOpen(true)}
          className="size-9 rounded-md hover:bg-white/5 flex items-center justify-center"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-accent flex items-center justify-center text-white font-bold text-xs">A</div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Aether KAM</span>
        </div>
        <div className="size-9" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — slide-over on mobile, sticky on desktop */}
      <aside
        className={`bg-sidebar text-sidebar-foreground flex flex-col shrink-0 z-50
          fixed md:sticky top-0 h-screen w-72 md:w-64
          transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {SidebarBody}
      </aside>
    </>
  );
}
