export interface DayActivity {
  id: string;
  category: string;
  detail: string | null;
  durationMs: number | null;
  time: string;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface CategoryUsage {
  category: string;
  count: number;
  totalMs?: number;
}
