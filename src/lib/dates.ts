/**
 * Returns the target Saturday and Sunday to check.
 *
 * Mon/Tue/Wed: upcoming Sat/Sun (+3 to +5 days)
 * Thu/Fri/Sat: following Sat/Sun (+7 to +9 days)
 * Sun:         upcoming Sat/Sun (+6 days)
 *
 * This keeps the target always 3–9 days out, cycling Thursday to Thursday.
 */
export function getTargetWeekend(): { saturday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  const daysUntilSat = (6 - day + 7) % 7;

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSat);
  saturday.setHours(0, 0, 0, 0);

  if (day === 4 || day === 5 || day === 6) {
    saturday.setDate(saturday.getDate() + 7);
  }

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { saturday: fmt(saturday), sunday: fmt(sunday) };
}
