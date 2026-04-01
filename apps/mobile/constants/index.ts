export const CATEGORIES = [
  { id: "all", label: "All", icon: "✦" },
  { id: "music", label: "Music", icon: "♫" },
  { id: "food", label: "Food & Drink", icon: "🍕" },
  { id: "outdoors", label: "Outdoors", icon: "⛰" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧" },
  { id: "nightlife", label: "Nightlife", icon: "🌙" },
  { id: "performing_arts", label: "Performing Arts", icon: "🎭" },
  { id: "arts_crafts", label: "Arts & Crafts", icon: "🎨" },
  { id: "exhibits", label: "Exhibits", icon: "🖼" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "community", label: "Community", icon: "🤝" },
  { id: "free", label: "Free", icon: "🆓" },
] as const;

export const TIME_FILTERS = [
  { id: "now", label: "Now" },
  { id: "today", label: "Today" },
  { id: "weekend", label: "This Weekend" },
  { id: "week", label: "This Week" },
] as const;

export const DISTANCE_OPTIONS = [
  { miles: 5, label: "5 mi" },
  { miles: 10, label: "10 mi" },
  { miles: 25, label: "25 mi" },
  { miles: 50, label: "50 mi" },
  { miles: 100, label: "100 mi" },
  { miles: 300, label: "Statewide" },
] as const;

export const COLORS = {
  bg: "#f8f7f4",
  surface1: "#ffffff",
  surface2: "#f0eeea",
  border: "#e5e2dc",
  text1: "#1a1815",
  text2: "#4a4640",
  text3: "#8a857d",
  text4: "#b5b0a8",
  accent: "#d4642a",
  accentSoft: "#fef3ed",
  live: "#ef4444",
} as const;

// Utah Valley cities covered by Hapn
export const UV_CITIES = [
  "Provo", "Orem", "Lehi", "American Fork", "Pleasant Grove",
  "Spanish Fork", "Springville", "Vineyard", "Saratoga Springs",
  "Eagle Mountain", "Lindon", "Highland", "Alpine", "Mapleton",
  "Payson", "Cedar Hills", "Salem", "Santaquin",
] as const;
