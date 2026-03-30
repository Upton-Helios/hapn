import { create } from "zustand";

export type TimeFilter = "now" | "today" | "weekend" | "week";
export type Category =
  | "all"
  | "music"
  | "food"
  | "outdoors"
  | "family"
  | "nightlife"
  | "arts"
  | "sports"
  | "community"
  | "free";

interface FiltersState {
  timeFilter: TimeFilter;
  category: Category;
  radiusMiles: number;
  searchQuery: string;
  setTimeFilter: (f: TimeFilter) => void;
  setCategory: (c: Category) => void;
  setRadiusMiles: (r: number) => void;
  setSearchQuery: (q: string) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  timeFilter: "today",
  category: "all",
  radiusMiles: 15,
  searchQuery: "",
  setTimeFilter: (timeFilter) => set({ timeFilter }),
  setCategory: (category) => set({ category }),
  setRadiusMiles: (radiusMiles) => set({ radiusMiles }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  reset: () =>
    set({ timeFilter: "today", category: "all", radiusMiles: 15, searchQuery: "" }),
}));

interface LocationState {
  latitude: number;
  longitude: number;
  city: string;
  setLocation: (lat: number, lng: number, city?: string) => void;
}

// Default: Orem, UT
export const useLocationStore = create<LocationState>((set) => ({
  latitude: 40.2969,
  longitude: -111.6946,
  city: "Orem",
  setLocation: (latitude, longitude, city) =>
    set({ latitude, longitude, ...(city ? { city } : {}) }),
}));
