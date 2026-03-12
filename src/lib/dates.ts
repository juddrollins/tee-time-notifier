/**
 * Returns the target Saturday and Sunday to check.
 *
 * Sun/Mon/Tue/Wed/Thu: upcoming Sat/Sun
 * Fri/Sat:             following Sat/Sun
 *
 * Switches to the following weekend at midnight Friday,
 * giving the full week Mon–Thu to track the upcoming weekend.
 */
export function getTargetWeekend(): { saturday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

  const daysUntilSat = (6 - day + 7) % 7;

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSat);
  saturday.setHours(0, 0, 0, 0);

  if (day === 5 || day === 6) {
    saturday.setDate(saturday.getDate() + 7);
  }

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { saturday: fmt(saturday), sunday: fmt(sunday) };
}
