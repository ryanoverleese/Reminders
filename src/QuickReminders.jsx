import { useState, useEffect, useRef, useCallback } from "react";

const PRESET_DURATIONS = [
  { label: "1 min", seconds: 60 },
  { label: "5 min", seconds: 300 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
  { label: "45 min", seconds: 2700 },
  { label: "1 hour", seconds: 3600 },
  { label: "2 hours", seconds: 7200 },
  { label: "5 hours", seconds: 18000 },
  { label: "12 hours", seconds: 43200 },
  { label: "24 hours", seconds: 86400 },
  { label: "2 days", seconds: 172800 },
  { label: "4 days", seconds: 345600 },
  { label: "1 week", seconds: 604800 },
];

const REPEAT_OPTIONS = [
  { label: "None", seconds: null },
  { label: "1 min", seconds: 60 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
];

function formatCountdown(seconds) {
  if (seconds <= 0) return "Now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDueTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + `, ${time}`;
}

const CheckCircle = ({ checked, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      width: 22, height: 22, borderRadius: "50%",
      border: checked ? "none" : "2px solid #C7C7CC",
      background: checked ? "#007AFF" : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", flexShrink: 0, padding: 0, transition: "all 0.2s ease",
    }}
  >
    {checked && (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 3V15M3 9H15" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ direction = "right", color = "#C7C7CC", size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={{
    transform: direction === "down" ? "rotate(90deg)" : direction === "left" ? "rotate(180deg)" : "none",
    transition: "transform 0.2s ease",
  }}>
    <path d="M4.5 2L9 6.5L4.5 11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BellIcon = ({ size = 16, color = "#FF9500" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5C5.5 1.5 4 3.5 4 5.5C4 8 3 9.5 2 10.5H14C13 9.5 12 8 12 5.5C12 3.5 10.5 1.5 8 1.5Z" fill={color} />
    <path d="M6.5 11.5C6.5 12.3 7.2 13 8 13C8.8 13 9.5 12.3 9.5 11.5" fill={color} />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 4.5H13M6 4.5V3C6 2.4 6.4 2 7 2H9C9.6 2 10 2.4 10 3V4.5M4.5 4.5L5 13H11L11.5 4.5" stroke="#FF3B30" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

async function sendSystemNotification(title) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  // Use service worker registration when available (required for mobile PWAs)
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg?.showNotification) {
      reg.showNotification("Reminder", {
        body: title,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "reminder-" + Date.now(),
        requireInteraction: true,
      });
      return;
    }
  }
  // Fallback for desktop browsers
  try {
    new Notification("Reminder", {
      body: title,
      tag: "reminder-" + Date.now(),
      requireInteraction: true,
    });
  } catch (e) {
    // Notification constructor may fail in some environments
  }
}

export default function QuickReminders() {
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem("reminders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [selectedRepeat, setSelectedRepeat] = useState(0); // index into REPEAT_OPTIONS, 0 = None
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [tick, setTick] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [firedReminders, setFiredReminders] = useState(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [notifStatus, setNotifStatus] = useState("idle"); // idle | asking | error
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  const inputRef = useRef(null);

  // Re-read permission any time the app is focused (e.g. after granting in Settings)
  useEffect(() => {
    const sync = () => {
      if (typeof Notification !== "undefined") {
        setNotifPermission(Notification.permission);
      }
    };
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") {
      setNotifStatus("error");
      return;
    }
    setNotifStatus("asking");
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      setNotifStatus(perm === "granted" ? "idle" : "error");
    } catch (e) {
      setNotifStatus("error");
    }
  };

  // Persist reminders to localStorage
  useEffect(() => {
    localStorage.setItem("reminders", JSON.stringify(reminders));
  }, [reminders]);

  // Tick every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check for fired reminders and send system notifications
  useEffect(() => {
    const now = Date.now();
    const toReschedule = [];
    reminders.forEach((r) => {
      if (!r.completed && r.dueAt <= now && !firedReminders.has(r.id)) {
        sendSystemNotification(r.title);
        if (r.repeat) {
          toReschedule.push(r.id);
        } else {
          setFiredReminders((prev) => new Set([...prev, r.id]));
        }
      }
    });
    if (toReschedule.length > 0) {
      setReminders((prev) =>
        prev.map((r) =>
          toReschedule.includes(r.id)
            ? { ...r, dueAt: Date.now() + r.repeat }
            : r
        )
      );
    }
  }, [tick, reminders, firedReminders]);

  const addReminder = useCallback(() => {
    if (!newTitle.trim() || selectedDuration === null) return;
    const repeatSeconds = REPEAT_OPTIONS[selectedRepeat].seconds;
    const newReminder = {
      id: Date.now(),
      title: newTitle.trim(),
      dueAt: Date.now() + PRESET_DURATIONS[selectedDuration].seconds * 1000,
      repeat: repeatSeconds ? repeatSeconds * 1000 : null,
      completed: false,
    };
    setReminders((prev) => [newReminder, ...prev]);
    setNewTitle("");
    setSelectedDuration(null);
    setSelectedRepeat(0);
    setShowNewForm(false);
    setShowDurationPicker(false);
    setShowRepeatPicker(false);
  }, [newTitle, selectedDuration, selectedRepeat]);

  const toggleComplete = (id) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r))
    );
    setDismissedAlerts((prev) => new Set([...prev, id]));
  };

  const deleteReminder = (id) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setDismissedAlerts((prev) => new Set([...prev, id]));
  };

  const activeReminders = reminders.filter((r) => !r.completed);
  const completedReminders = reminders.filter((r) => r.completed);
  const alertReminders = reminders.filter(
    (r) => !r.completed && firedReminders.has(r.id) && !dismissedAlerts.has(r.id)
  );

  const styles = {
    container: {
      maxWidth: 420,
      margin: "0 auto",
      minHeight: "100vh",
      background: "#F2F2F7",
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif',
      WebkitFontSmoothing: "antialiased",
      position: "relative",
      overflow: "hidden",
    },
    header: {
      padding: "56px 20px 12px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontSize: 34,
      fontWeight: 700,
      color: "#000",
      letterSpacing: "-0.5px",
    },
    section: {
      background: "#fff",
      borderRadius: 12,
      margin: "0 16px 12px",
      overflow: "hidden",
    },
    sectionHeader: {
      padding: "14px 16px 8px",
      fontSize: 20,
      fontWeight: 700,
      color: "#000",
      letterSpacing: "-0.3px",
    },
    row: {
      display: "flex",
      alignItems: "flex-start",
      padding: "12px 16px",
      gap: 12,
      position: "relative",
    },
    separator: {
      height: 0.5,
      background: "#E5E5EA",
      marginLeft: 50,
      marginRight: 0,
    },
    reminderTitle: (completed, overdue) => ({
      fontSize: 17,
      color: overdue ? "#FF3B30" : completed ? "#8E8E93" : "#000",
      textDecoration: completed ? "line-through" : "none",
      fontWeight: 400,
      letterSpacing: "-0.2px",
      lineHeight: 1.35,
    }),
    subtitle: (overdue) => ({
      fontSize: 13,
      color: overdue ? "#FF3B30" : "#8E8E93",
      marginTop: 2,
      display: "flex",
      alignItems: "center",
      gap: 4,
    }),
    fab: {
      position: "fixed",
      bottom: 34,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: "8px 4px",
      fontSize: 17,
      fontWeight: 600,
      color: "#007AFF",
      fontFamily: "inherit",
      letterSpacing: "-0.2px",
    },
    formOverlay: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.32)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      zIndex: 100,
      animation: "fadeIn 0.2s ease",
    },
    formCard: {
      background: "#F2F2F7",
      borderRadius: "14px 14px 0 0",
      width: "100%",
      maxWidth: 420,
      maxHeight: "85vh",
      overflowY: "auto",
      animation: "slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
    },
    formHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 20px",
      borderBottom: "0.5px solid #E5E5EA",
      background: "#F9F9FB",
      borderRadius: "14px 14px 0 0",
      position: "sticky",
      top: 0,
      zIndex: 2,
    },
    formBtn: (active) => ({
      fontSize: 17,
      fontWeight: active ? 600 : 400,
      color: active ? "#007AFF" : "#8E8E93",
      background: "none",
      border: "none",
      cursor: active ? "pointer" : "default",
      fontFamily: "inherit",
      padding: 0,
      opacity: active ? 1 : 0.5,
    }),
    input: {
      width: "100%",
      fontSize: 17,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "inherit",
      color: "#000",
      letterSpacing: "-0.2px",
      padding: "14px 16px",
    },
    durationChip: (selected) => ({
      padding: "8px 16px",
      borderRadius: 20,
      fontSize: 15,
      fontWeight: 500,
      background: selected ? "#007AFF" : "#E9E9EB",
      color: selected ? "#fff" : "#000",
      border: "none",
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "all 0.15s ease",
      whiteSpace: "nowrap",
      letterSpacing: "-0.1px",
    }),
    alertBanner: {
      background: "#fff",
      borderRadius: 14,
      margin: "0 16px 12px",
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      border: "1px solid #FFD60A33",
      animation: "fadeIn 0.3s ease",
    },
    deleteBtn: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 4,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: "auto",
      flexShrink: 0,
    },
    emptyState: {
      textAlign: "center",
      padding: "40px 20px",
      color: "#8E8E93",
      fontSize: 17,
    },
  };

  return (
    <div style={styles.container}>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } } * { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 0; } input::placeholder { color: #C7C7CC; }`}</style>

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Reminders</span>
        <span style={{ fontSize: 15, color: "#8E8E93", fontWeight: 500 }}>
          {activeReminders.length} active
        </span>
      </div>

      {/* Notification permission banner */}
      {notifPermission !== "granted" && (
        <div style={{
          background: "#fff",
          borderRadius: 14,
          margin: "0 16px 12px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "#FF9500",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <BellIcon size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#000" }}>Enable Notifications</div>
            <div style={{ fontSize: 13, color: "#8E8E93" }}>
              {!isStandalone
                ? "Open from Home Screen icon to enable"
                : notifPermission === "denied"
                ? "Blocked — enable in Settings → Reminders"
                : notifStatus === "error"
                ? "Could not request permission — try Settings"
                : "Required to alert you when time is up"}
            </div>
          </div>
          {isStandalone && notifPermission !== "denied" && (
            <button
              onClick={requestNotifPermission}
              style={{
                background: notifStatus === "asking" ? "#8E8E93" : "#007AFF",
                color: "#fff",
                border: "none", borderRadius: 8,
                padding: "7px 14px", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              }}
            >
              {notifStatus === "asking" ? "…" : "Allow"}
            </button>
          )}
        </div>
      )}

      {/* Alert banners for fired reminders */}
      {alertReminders.map((r) => (
        <div key={`alert-${r.id}`} style={styles.alertBanner}>
          <div style={{ animation: "pulse 1.5s infinite" }}>
            <BellIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#000" }}>{r.title}</div>
            <div style={{ fontSize: 13, color: "#FF9500", fontWeight: 500 }}>Time's up</div>
          </div>
          <button
            style={{ ...styles.formBtn(true), fontSize: 15 }}
            onClick={() => {
              toggleComplete(r.id);
            }}
          >
            Done
          </button>
        </div>
      ))}

      {/* Active Reminders */}
      <div style={styles.section}>
        {activeReminders.length === 0 ? (
          <div style={styles.emptyState}>No reminders</div>
        ) : (
          activeReminders.map((r, i) => {
            const now = Date.now();
            const remaining = Math.max(0, Math.round((r.dueAt - now) / 1000));
            const overdue = r.dueAt <= now;
            return (
              <div key={r.id}>
                {i > 0 && <div style={styles.separator} />}
                <div
                  style={{
                    ...styles.row,
                    cursor: "pointer",
                  }}
                  onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <CheckCircle checked={false} onToggle={() => toggleComplete(r.id)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.reminderTitle(false, overdue)}>{r.title}</div>
                    <div style={styles.subtitle(overdue)}>
                      {overdue ? (
                        <>
                          <BellIcon size={12} color="#FF3B30" />
                          <span>Overdue — {formatDueTime(r.dueAt)}</span>
                        </>
                      ) : (
                        <span style={{ color: "#8E8E93" }}>
                          {formatCountdown(remaining)} — {formatDueTime(r.dueAt)}
                          {r.repeat && ` · Repeats every ${REPEAT_OPTIONS.find(o => o.seconds && o.seconds * 1000 === r.repeat)?.label ?? ""}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, alignSelf: "center" }}>
                    {editingId === r.id && (
                      <button
                        style={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteReminder(r.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Completed */}
      {completedReminders.length > 0 && (
        <>
          <div style={{ ...styles.sectionHeader, padding: "14px 20px 8px" }}>Completed</div>
          <div style={styles.section}>
            {completedReminders.map((r, i) => (
              <div key={r.id}>
                {i > 0 && <div style={styles.separator} />}
                <div style={styles.row}>
                  <CheckCircle checked={true} onToggle={() => toggleComplete(r.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.reminderTitle(true, false)}>{r.title}</div>
                    <div style={styles.subtitle(false)}>
                      <span>{formatDueTime(r.dueAt)}</span>
                    </div>
                  </div>
                  <button
                    style={styles.deleteBtn}
                    onClick={() => deleteReminder(r.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New Reminder FAB */}
      <div style={{ height: 80 }} />
      {!showNewForm && (
        <button style={styles.fab} onClick={() => {
          setShowNewForm(true);
          setTimeout(() => inputRef.current?.focus(), 300);
        }}>
          <PlusIcon />
          New Reminder
        </button>
      )}

      {/* New Reminder Sheet */}
      {showNewForm && (
        <div style={styles.formOverlay} onClick={() => {
          setShowNewForm(false);
          setNewTitle("");
          setSelectedDuration(null);
          setShowDurationPicker(false);
    setShowRepeatPicker(false);
        }}>
          <div style={styles.formCard} onClick={(e) => e.stopPropagation()}>
            {/* Form header */}
            <div style={styles.formHeader}>
              <button
                style={styles.formBtn(true)}
                onClick={() => {
                  setShowNewForm(false);
                  setNewTitle("");
                  setSelectedDuration(null);
                  setShowDurationPicker(false);
    setShowRepeatPicker(false);
                }}
              >
                Cancel
              </button>
              <span style={{ fontSize: 17, fontWeight: 600, color: "#000" }}>New Reminder</span>
              <button
                style={styles.formBtn(newTitle.trim() && selectedDuration !== null)}
                onClick={addReminder}
              >
                Add
              </button>
            </div>

            {/* Title input */}
            <div style={{ background: "#fff", borderRadius: 12, margin: "16px 16px 0" }}>
              <input
                ref={inputRef}
                style={styles.input}
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTitle.trim() && selectedDuration !== null) addReminder();
                }}
              />
            </div>

            {/* Duration picker toggle */}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                margin: "12px 16px 0",
                cursor: "pointer",
              }}
              onClick={() => setShowDurationPicker(!showDurationPicker)}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: "#FF9500",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1.5" />
                      <path d="M8 4.5V8L10.5 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 17, color: "#000" }}>Remind in</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selectedDuration !== null && (
                    <span style={{ fontSize: 17, color: "#007AFF", fontWeight: 500 }}>
                      {PRESET_DURATIONS[selectedDuration].label}
                    </span>
                  )}
                  <ChevronIcon direction={showDurationPicker ? "down" : "right"} color="#C7C7CC" />
                </div>
              </div>
            </div>

            {/* Duration chips */}
            {showDurationPicker && (
              <div style={{
                background: "#fff",
                borderRadius: 12,
                margin: "12px 16px 0",
                padding: "14px 16px",
              }}>
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}>
                  {PRESET_DURATIONS.map((d, i) => (
                    <button
                      key={d.seconds}
                      style={styles.durationChip(selectedDuration === i)}
                      onClick={() => setSelectedDuration(i)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Repeat picker toggle */}
            <div
              style={{ background: "#fff", borderRadius: 12, margin: "12px 16px 0", cursor: "pointer" }}
              onClick={() => setShowRepeatPicker(!showRepeatPicker)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 7, background: "#34C759",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8C2 11.3 4.7 14 8 14C11.3 14 14 11.3 14 8C14 4.7 11.3 2 8 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M2 4V8H6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 17, color: "#000" }}>Repeat</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selectedRepeat !== 0 && (
                    <span style={{ fontSize: 17, color: "#007AFF", fontWeight: 500 }}>
                      {REPEAT_OPTIONS[selectedRepeat].label}
                    </span>
                  )}
                  <ChevronIcon direction={showRepeatPicker ? "down" : "right"} color="#C7C7CC" />
                </div>
              </div>
            </div>

            {/* Repeat chips */}
            {showRepeatPicker && (
              <div style={{ background: "#fff", borderRadius: 12, margin: "12px 16px 0", padding: "14px 16px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {REPEAT_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      style={styles.durationChip(selectedRepeat === i)}
                      onClick={() => setSelectedRepeat(i)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {selectedDuration !== null && (
              <div style={{
                padding: "12px 20px 24px",
                color: "#8E8E93",
                fontSize: 13,
                textAlign: "center",
              }}>
                Will fire at {formatDueTime(Date.now() + PRESET_DURATIONS[selectedDuration].seconds * 1000)}
              </div>
            )}

            <div style={{ height: 24 }} />
          </div>
        </div>
      )}
    </div>
  );
}
