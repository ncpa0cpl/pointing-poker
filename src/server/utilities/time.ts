export class Time {
  static SECOND = 1000; // (ms)
  static MINUTE = 60 * Time.SECOND;
  static HOUR = 60 * Time.MINUTE;
  static DAY = 24 * Time.HOUR;
  static MONTH = 30 * Time.DAY;
}

export function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}
