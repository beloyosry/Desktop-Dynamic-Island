/** Timers accept whole minutes; reject invalid input instead of silently changing it. */
export function timerMinutes(input: string): number | null {
  const minutes = Number(input);
  return input.trim() && Number.isInteger(minutes) && minutes >= 1 && minutes <= 240 ? minutes : null;
}
