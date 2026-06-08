export const NOTIFICATION_BADGE_KEYS = {
  accounts: "accounts",
  escalations: "escalations",
};

function normalizeRoleName(role) {
  const value = String(role ?? "").trim().toLowerCase();
  if (!value) return "";
  if (value === "kam" || value === "key account manager") return "KAM";
  if (value.includes("head") && value.includes("kam")) return "Head of KAM";
  if (value.includes("c level") || value.includes("c-level") || value === "ceo") {
    return "CEO";
  }
  return String(role);
}

export function isNotificationRole(role) {
  const normalized = normalizeRoleName(role);
  return normalized === "Head of KAM" || normalized === "KAM";
}

function isKamHead(role) {
  return normalizeRoleName(role) === "Head of KAM";
}

function isKam(role) {
  return normalizeRoleName(role) === "KAM";
}

function isMissingNotificationSchema(error) {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("notifications") && message.includes("schema cache")
  );
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function todayIsoWithOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fetchProfiles(client, columns = "id, name, role, is_active") {
  let response = await client.from("profiles").select(columns);
  if (response.error?.code === "42703" || response.error?.code === "PGRST204") {
    response = await client.from("profiles").select("id, name, role");
  }
  if (response.error) throw response.error;
  return (response.data ?? []).filter((profile) => profile.is_active !== false);
}

async function fetchAccount(client, accountId) {
  const { data, error } = await client
    .from("accounts")
    .select("id, name, assigned_kam_id, renewal_date")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function uniqueProfiles(profiles) {
  const byId = new Map();
  for (const profile of profiles) {
    if (profile?.id && !byId.has(profile.id)) {
      byId.set(profile.id, profile);
    }
  }
  return [...byId.values()];
}

async function fetchRecipientsForAccount(client, accountId, extraProfileIds = []) {
  const [profiles, account] = await Promise.all([
    fetchProfiles(client),
    accountId ? fetchAccount(client, accountId) : Promise.resolve(null),
  ]);

  const heads = profiles.filter((profile) => isKamHead(profile.role));
  const profileIds = new Set([
    account?.assigned_kam_id,
    ...extraProfileIds,
  ].filter(Boolean));
  const accountKams = profiles.filter(
    (profile) => profileIds.has(profile.id) && isKam(profile.role),
  );

  return {
    account,
    recipients: uniqueProfiles([...heads, ...accountKams]),
    heads,
    profiles,
  };
}

async function insertNotifications(client, rows) {
  const notifications = rows.filter(Boolean);
  if (!notifications.length) return [];

  const keys = notifications
    .map((notification) => notification.notification_key)
    .filter(Boolean);

  let existingKeys = new Set();
  if (keys.length) {
    const { data, error } = await client
      .from("notifications")
      .select("notification_key")
      .in("notification_key", keys);
    if (isMissingNotificationSchema(error)) return [];
    if (error) throw error;
    existingKeys = new Set((data ?? []).map((row) => row.notification_key));
  }

  const newRows = notifications.filter(
    (notification) => !existingKeys.has(notification.notification_key),
  );
  if (!newRows.length) return [];

  const { data, error } = await client
    .from("notifications")
    .insert(newRows)
    .select("*");
  if (error?.code === "23505") return [];
  if (isMissingNotificationSchema(error)) return [];
  if (error) throw error;
  return data ?? [];
}

function notificationRow({
  recipient,
  key,
  title,
  body,
  accountId,
  type = "info",
  badgeKey = null,
  targetPath = null,
}) {
  return {
    id: randomId(),
    recipient_profile_id: recipient.id,
    notification_key: key,
    badge_key: badgeKey,
    target_path: targetPath,
    account_id: accountId ?? null,
    title,
    body,
    type,
    time: "Just now",
    read: false,
    read_at: null,
  };
}

export async function createAccountAssignmentNotifications(client, { accountId, kamId }) {
  if (!accountId || !kamId) return [];
  const { account, recipients, profiles } = await fetchRecipientsForAccount(
    client,
    accountId,
    [kamId],
  );
  if (!account) return [];

  const kam = profiles.find((profile) => profile.id === kamId);
  const accountName = account.name ?? "Account";
  const rows = recipients.map((recipient) => {
    const isAssignedKam = recipient.id === kamId;
    return notificationRow({
      recipient,
      key: `account-assigned:${accountId}:${kamId}:${recipient.id}`,
      accountId,
      title: isAssignedKam
        ? `New account assigned: ${accountName}`
        : `Account assigned: ${accountName}`,
      body: isAssignedKam
        ? "This account has been added to your portfolio."
        : `${kam?.name ?? "A KAM"} is now assigned to this account.`,
      type: "info",
      badgeKey: NOTIFICATION_BADGE_KEYS.accounts,
      targetPath: `/accounts/${accountId}`,
    });
  });

  return insertNotifications(client, rows);
}

export async function createEscalationNotifications(
  client,
  { accountId, escalationId, title },
) {
  if (!accountId || !escalationId) return [];
  const { account, recipients } = await fetchRecipientsForAccount(client, accountId);
  if (!account) return [];

  const accountName = account.name ?? "Account";
  const rows = recipients.map((recipient) =>
    notificationRow({
      recipient,
      key: `escalation-created:${escalationId}:${recipient.id}`,
      accountId,
      title: `New escalation: ${accountName}`,
      body: title || "A new escalation was created for this account.",
      type: "alert",
      badgeKey: NOTIFICATION_BADGE_KEYS.escalations,
      targetPath: "/escalations",
    }),
  );

  return insertNotifications(client, rows);
}

export async function createActionItemNotifications(
  client,
  { accountId, actionItemId, title },
) {
  if (!accountId || !actionItemId) return [];
  const { account, recipients } = await fetchRecipientsForAccount(client, accountId);
  if (!account) return [];

  const accountName = account.name ?? "Account";
  const rows = recipients.map((recipient) =>
    notificationRow({
      recipient,
      key: `action-item-created:${actionItemId}:${recipient.id}`,
      accountId,
      title: `New action item: ${accountName}`,
      body: title || "A new action item was created for this account.",
      type: "action",
      targetPath: `/accounts/${accountId}`,
    }),
  );

  return insertNotifications(client, rows);
}

export async function ensureContractRenewalNotifications(client) {
  const renewalWindows = [
    { days: 30, date: todayIsoWithOffset(30), label: "in 30 days" },
    { days: 7, date: todayIsoWithOffset(7), label: "in 7 days" },
    { days: 0, date: todayIsoWithOffset(0), label: "today" },
  ];
  const renewalDates = renewalWindows.map((window) => window.date);

  const { data: accounts, error } = await client
    .from("accounts")
    .select("id, name, assigned_kam_id, renewal_date")
    .in("renewal_date", renewalDates);
  if (isMissingNotificationSchema(error)) return [];
  if (error) throw error;
  if (!accounts?.length) return [];

  const profiles = await fetchProfiles(client);
  const heads = profiles.filter((profile) => isKamHead(profile.role));
  const rows = [];

  for (const account of accounts) {
    const renewalWindow = renewalWindows.find(
      (window) => window.date === account.renewal_date,
    );
    if (!renewalWindow) continue;

    const assignedKam = profiles.find(
      (profile) => profile.id === account.assigned_kam_id && isKam(profile.role),
    );
    const recipients = uniqueProfiles([...heads, assignedKam]);
    const accountName = account.name ?? "Account";

    for (const recipient of recipients) {
      rows.push(
        notificationRow({
          recipient,
          key: `contract-renewal:${account.id}:${renewalWindow.days}:${account.renewal_date}:${recipient.id}`,
          accountId: account.id,
          title:
            renewalWindow.days === 0
              ? `Contract renewal today: ${accountName}`
              : `Contract renewal ${renewalWindow.label}: ${accountName}`,
          body: "Review the contract before the renewal window closes.",
          type: "alert",
          targetPath: `/accounts/${account.id}`,
        }),
      );
    }
  }

  return insertNotifications(client, rows);
}
