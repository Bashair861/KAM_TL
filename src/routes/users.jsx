import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Lock,
  Power,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ROLE_PERMISSIONS } from "@/data/kam-data";
import {
  createUserProfile,
  deleteUserProfile,
  fetchUsers,
  updateUserRole,
  updateUserStatus,
} from "@/services/db";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "All Users - tkxel KAM" },
      { name: "description", content: "Manage user access, roles, and active status." },
    ],
  }),
  component: UsersPage,
});

const ROLE_OPTIONS = ["KAM", "Head of KAM", "CEO"];
const emptyForm = { name: "", email: "", role: "KAM" };

function UsersPage() {
  const { profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const canManage = profile?.role === "Head of KAM";

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: canManage,
  });

  const totals = useMemo(
    () => ({
      all: users.length,
      active: users.filter((user) => user.isActive).length,
      inactive: users.filter((user) => !user.isActive).length,
      heads: users.filter((user) => user.role === "Head of KAM").length,
    }),
    [users],
  );

  const createMutation = useMutation({
    mutationFn: createUserProfile,
    onSuccess: (createdUser) => {
      setCreatedInvite({
        email: createdUser.email,
      });
      setForm(emptyForm);
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["kamUsers"] });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["kamUsers"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }) => updateUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["kamUsers"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUserProfile,
    onMutate: (userId) => setDeletingUserId(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["kamUsers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onSettled: () => setDeletingUserId(null),
  });

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    createMutation.mutate(form);
  }

  function handleDeleteUser(user) {
    const isSelf = user.id === profile?.id || user.email === profile?.email;
    if (isSelf) return;
    const confirmed = window.confirm(
      `Delete ${user.name}? This will remove their profile and sign-in user. Accounts assigned to this user will become unassigned.`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(user.id);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading users
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="border rounded-xl bg-card p-8 text-center">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold">Access restricted</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Only Head of KAM users can manage user accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">
            User Administration
          </p>
          <h1 className="text-2xl font-bold">All Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage activation status and roles for KAM platform access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate((value) => !value);
            setCreatedInvite(null);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          {showCreate ? <X className="size-4" /> : <UserPlus className="size-4" />}
          {showCreate ? "Close" : "Create User"}
        </button>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryTile label="Total" value={totals.all} icon={Users} />
        <SummaryTile label="Active" value={totals.active} icon={CheckCircle2} />
        <SummaryTile label="Inactive" value={totals.inactive} icon={Power} />
        <SummaryTile label="Heads" value={totals.heads} icon={Shield} />
      </section>

      {showCreate && (
        <form
          onSubmit={handleSubmit}
          className="border rounded-xl bg-card p-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_180px_auto] gap-3 items-end"
        >
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Name
            </span>
            <input
              value={form.name}
              onChange={(event) => setForm((next) => ({ ...next, name: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Full name"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Email
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((next) => ({ ...next, email: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="user@company.com"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Role
            </span>
            <select
              value={form.role}
              onChange={(event) => setForm((next) => ({ ...next, role: event.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending || !form.name.trim() || !form.email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Create
          </button>
          {createMutation.error && (
            <p className="md:col-span-4 text-sm text-crit">{createMutation.error.message}</p>
          )}
        </form>
      )}

      {createdInvite && (
        <section className="border border-success/20 bg-success/5 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-success/10 text-success flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold">Invitation email sent</h2>
              <p className="text-xs text-muted-foreground mt-1">{createdInvite.email}</p>
              <p className="text-xs text-muted-foreground mt-2">
                The user can open the email invite, set a password, and then sign in.
              </p>
            </div>
          </div>
        </section>
      )}

      {deleteMutation.error && (
        <div className="border border-crit/20 bg-crit/5 rounded-lg px-4 py-3 text-sm text-crit">
          {deleteMutation.error.message}
        </div>
      )}

      <section className="border rounded-xl bg-card overflow-hidden">
        <div className="hidden md:grid md:grid-cols-[1.4fr_1fr_180px_120px_250px] gap-4 px-5 py-3 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>User</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading users
          </div>
        ) : error ? (
          <div className="p-8 text-center text-crit">{error.message}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No users found.</div>
        ) : (
          users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              currentUser={profile}
              onRoleChange={(role) => roleMutation.mutate({ userId: user.id, role })}
              onStatusChange={() =>
                statusMutation.mutate({ userId: user.id, isActive: !user.isActive })
              }
              onDelete={() => handleDeleteUser(user)}
              rolePending={roleMutation.isPending}
              statusPending={statusMutation.isPending}
              deletePending={deleteMutation.isPending && deletingUserId === user.id}
            />
          ))
        )}
      </section>
    </div>
  );
}

function SummaryTile({ label, value, icon: Icon }) {
  return (
    <div className="border rounded-xl bg-card p-4 flex items-center gap-3">
      <span className="size-10 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function UserRow({
  user,
  currentUser,
  onRoleChange,
  onStatusChange,
  onDelete,
  rolePending,
  statusPending,
  deletePending,
}) {
  const perms = ROLE_PERMISSIONS[user.role] ?? ROLE_PERMISSIONS.KAM;
  const isSelf = user.id === currentUser?.id || user.email === currentUser?.email;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_180px_120px_250px] gap-4 px-5 py-4 border-b last:border-b-0 items-center">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
          {user.initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{user.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {perms.write ? "Read + write" : "Read only"}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground truncate">{user.email || "-"}</p>
      <select
        value={user.role}
        onChange={(event) => onRoleChange(event.target.value)}
        disabled={isSelf || rolePending}
        className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
      >
        {ROLE_OPTIONS.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <span
        className={`w-fit px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
          user.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
        }`}
      >
        {user.isActive ? "Active" : "Inactive"}
      </span>
      <div className="flex flex-col sm:flex-row md:justify-end gap-2">
        <button
          type="button"
          onClick={onStatusChange}
          disabled={isSelf || statusPending || deletePending}
          className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            user.isActive
              ? "border text-muted-foreground hover:bg-muted"
              : "bg-success text-white hover:bg-success/90"
          }`}
        >
          {statusPending ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isSelf || deletePending}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-crit/30 px-3 py-2 text-sm font-semibold text-crit hover:bg-crit/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete
        </button>
      </div>
    </div>
  );
}
