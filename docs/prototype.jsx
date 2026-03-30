import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { id: "all", label: "All", icon: "✦" },
  { id: "music", label: "Music", icon: "♫" },
  { id: "food", label: "Food & Drink", icon: "🍕" },
  { id: "outdoors", label: "Outdoors", icon: "⛰" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧" },
  { id: "nightlife", label: "Nightlife", icon: "🌙" },
  { id: "arts", label: "Arts", icon: "🎭" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "community", label: "Community", icon: "🤝" },
  { id: "free", label: "Free", icon: "🆓" },
];

const TIME_FILTERS = [
  { id: "now", label: "Now" },
  { id: "today", label: "Today" },
  { id: "weekend", label: "This Weekend" },
  { id: "week", label: "This Week" },
];

const UV_CITIES = [
  "Provo", "Orem", "Lehi", "American Fork", "Pleasant Grove",
  "Spanish Fork", "Springville", "Vineyard", "Saratoga Springs",
  "Eagle Mountain", "Lindon", "Highland", "Alpine", "Mapleton",
  "Payson", "Cedar Hills"
];

// Seed data representing Utah Valley events
const SEED_EVENTS = [
  {
    id: 1, title: "Provo Farmers Market", venue: "Pioneer Park",
    city: "Provo", category: "food", price: "Free",
    date: "2026-03-29", startTime: "09:00", endTime: "14:00",
    description: "Fresh local produce, handmade crafts, live music, and food trucks every Saturday morning.",
    lat: 40.2338, lng: -111.6585, source: "provo.gov",
    tags: ["free", "family", "food"], happeningNow: true,
    img: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&h=400&fit=crop"
  },
  {
    id: 2, title: "Live Jazz at Velour", venue: "Velour Live Music Gallery",
    city: "Provo", category: "music", price: "$12",
    date: "2026-03-29", startTime: "20:00", endTime: "23:00",
    description: "Local jazz trio performing original compositions and classic standards in an intimate venue.",
    lat: 40.2335, lng: -111.6595, source: "community",
    tags: ["music", "nightlife"], happeningNow: false,
    img: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&h=400&fit=crop"
  },
  {
    id: 3, title: "Y Mountain Sunrise Hike", venue: "Y Mountain Trailhead",
    city: "Provo", category: "outdoors", price: "Free",
    date: "2026-03-29", startTime: "06:00", endTime: "09:00",
    description: "Group hike to the Y. Meet at the trailhead parking lot. All skill levels welcome. Bring water and layers.",
    lat: 40.2468, lng: -111.6345, source: "community",
    tags: ["free", "outdoors", "sports"], happeningNow: false,
    img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&h=400&fit=crop"
  },
  {
    id: 4, title: "Oremfest Planning Kickoff", venue: "SCERA Center for the Arts",
    city: "Orem", category: "community", price: "Free",
    date: "2026-03-30", startTime: "18:00", endTime: "20:00",
    description: "Volunteer meeting for this summer's Oremfest. Help plan concerts, parades, and carnival events.",
    lat: 40.2969, lng: -111.6946, source: "orem.gov",
    tags: ["free", "community"], happeningNow: false,
    img: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop"
  },
  {
    id: 5, title: "Thanksgiving Point Tulip Festival", venue: "Ashton Gardens",
    city: "Lehi", category: "family", price: "$22",
    date: "2026-04-10", startTime: "10:00", endTime: "20:00",
    description: "Hundreds of thousands of tulips in bloom. Utah Valley's most iconic spring experience. Runs through May.",
    lat: 40.4313, lng: -111.9021, source: "thanksgivingpoint.org",
    tags: ["family", "outdoors"], happeningNow: false,
    img: "https://images.unsplash.com/photo-1524386416438-98b9b2d4b433?w=600&h=400&fit=crop"
  },
  {
    id: 6, title: "Trivia Night at Roosters", venue: "Roosters Brewing Co.",
    city: "Orem", category: "nightlife", price: "Free",
    date: "2026-03-29", startTime: "19:00", endTime: "21:30",
    description: "Weekly pub trivia. Teams of up to 6. Prizes for top 3. Great food and local brews on tap.",
    lat: 40.2849, lng: -111.6947, source: "community",
    tags: ["free", "nightlife", "food"], happeningNow: true,
    img: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600&h=400&fit=crop"
  },
  {
    id: 7, title: "BYU vs Utah Baseball", venue: "Larry H. Miller Field",
    city: "Provo", category: "sports", price: "$8",
    date: "2026-03-29", startTime: "14:00", endTime: "17:00",
    description: "Rivalry game under the lights. Student section opens early. Family-friendly atmosphere.",
    lat: 40.2518, lng: -111.6493, source: "byucougars.com",
    tags: ["sports", "family"], happeningNow: true,
    img: "https://images.unsplash.com/photo-1529768167801-9173d94c2a42?w=600&h=400&fit=crop"
  },
  {
    id: 8, title: "Pottery Workshop for Beginners", venue: "The Clay Space",
    city: "Springville", category: "arts", price: "$35",
    date: "2026-03-30", startTime: "10:00", endTime: "12:30",
    description: "Hands-on intro to wheel throwing. All materials included. Take home your creation after firing.",
    lat: 40.1653, lng: -111.6107, source: "community",
    tags: ["arts"], happeningNow: false,
    img: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&h=400&fit=crop"
  },
  {
    id: 9, title: "Spanish Fork Food Truck Rally", venue: "Spanish Fork Sports Park",
    city: "Spanish Fork", category: "food", price: "Free entry",
    date: "2026-03-29", startTime: "17:00", endTime: "21:00",
    description: "12+ food trucks, live DJ, lawn games. Bring blankets and chairs. Dogs welcome on leash.",
    lat: 40.1149, lng: -111.6548, source: "community",
    tags: ["free", "food", "family", "music"], happeningNow: true,
    img: "https://images.unsplash.com/photo-1567129937968-cdad8f07e2f8?w=600&h=400&fit=crop"
  },
  {
    id: 10, title: "Noorda Center: Contemporary Dance", venue: "Noorda Center for the Performing Arts",
    city: "Orem", category: "arts", price: "$15",
    date: "2026-04-03", startTime: "19:30", endTime: "21:30",
    description: "UVU School of the Arts presents an evening of original contemporary dance works.",
    lat: 40.2783, lng: -111.7146, source: "nowplayingutah.com",
    tags: ["arts"], happeningNow: false,
    img: "https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?w=600&h=400&fit=crop"
  },
  {
    id: 11, title: "Pickup Basketball — Open Gym", venue: "Orem Rec Center",
    city: "Orem", category: "sports", price: "$3",
    date: "2026-03-29", startTime: "10:00", endTime: "13:00",
    description: "Open gym pickup games. All skill levels. $3 drop-in or free with rec pass.",
    lat: 40.2969, lng: -111.6946, source: "community",
    tags: ["sports"], happeningNow: true,
    img: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop"
  },
  {
    id: 12, title: "Festival of Colors 2026", venue: "Sri Sri Radha Krishna Temple",
    city: "Spanish Fork", category: "community", price: "$5",
    date: "2026-03-28", startTime: "11:00", endTime: "18:00",
    description: "Utah Valley's most vibrant spring celebration. Music, dancing, food, and colorful powder throws.",
    lat: 40.0786, lng: -111.6196, source: "utahvalley.com",
    tags: ["community", "music", "family", "food"], happeningNow: false,
    img: "https://images.unsplash.com/photo-1576473108869-0e8b2e8e0e5e?w=600&h=400&fit=crop"
  },
];

// Helpers
function getRelativeDate(dateStr) {
  const today = new Date("2026-03-29");
  const d = new Date(dateStr);
  const diff = Math.floor((d - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return "Yesterday";
  if (diff <= 6) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(t) {
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}${m !== "00" ? `:${m}` : ""} ${hr >= 12 ? "PM" : "AM"}`;
}

function distanceMi(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// User location (Orem center as default)
const USER_LAT = 40.2969;
const USER_LNG = -111.6946;

// ─── Components ─────────────────────────────────────────────

function PulsingDot() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: "#ef4444",
        animation: "pulse-dot 1.5s ease-in-out infinite",
        boxShadow: "0 0 0 0 rgba(239,68,68,0.5)"
      }} />
      <style>{`
        @keyframes pulse-dot {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
      `}</style>
    </span>
  );
}

function EventCard({ event, compact, onSelect }) {
  const dist = distanceMi(USER_LAT, USER_LNG, event.lat, event.lng).toFixed(1);
  
  if (compact) {
    return (
      <button onClick={() => onSelect(event)} style={{
        all: "unset", cursor: "pointer", display: "flex", gap: 12,
        padding: "12px 0", borderBottom: "1px solid var(--border)",
        width: "100%", alignItems: "center"
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12, overflow: "hidden", flexShrink: 0,
          background: "var(--surface2)"
        }}>
          <img src={event.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { e.target.style.display = "none"; }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {event.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            {formatTime(event.startTime)} · {event.venue} · {dist} mi
          </div>
        </div>
        {event.happeningNow && <PulsingDot />}
      </button>
    );
  }

  return (
    <button onClick={() => onSelect(event)} style={{
      all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
      borderRadius: 16, overflow: "hidden", background: "var(--surface1)",
      border: "1px solid var(--border)", transition: "transform 0.2s, box-shadow 0.2s",
      width: "100%"
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position: "relative", height: 180, background: "var(--surface2)" }}>
        <img src={event.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { e.target.style.display = "none"; }} />
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
          {event.happeningNow && (
            <span style={{
              background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700,
              padding: "3px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4,
              letterSpacing: "0.03em"
            }}>
              <PulsingDot /> LIVE
            </span>
          )}
          <span style={{
            background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontWeight: 600,
            padding: "3px 8px", borderRadius: 6, backdropFilter: "blur(8px)"
          }}>
            {event.price}
          </span>
        </div>
        <div style={{
          position: "absolute", bottom: 10, right: 10,
          background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11,
          padding: "3px 8px", borderRadius: 6, backdropFilter: "blur(8px)"
        }}>
          {dist} mi
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {getRelativeDate(event.date)} · {formatTime(event.startTime)}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text1)", marginTop: 4, lineHeight: 1.3 }}>
          {event.title}
        </div>
        <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
          {event.venue} · {event.city}
        </div>
      </div>
    </button>
  );
}

function EventDetail({ event, onClose }) {
  if (!event) return null;
  const dist = distanceMi(USER_LAT, USER_LNG, event.lat, event.lng).toFixed(1);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: "24px 24px 0 0", width: "100%",
        maxWidth: 480, maxHeight: "85vh", overflowY: "auto",
        animation: "slide-up 0.3s ease"
      }}>
        <style>{`@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        <div style={{ position: "relative", height: 220 }}>
          <img src={event.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={e => { e.target.style.display = "none"; }} />
          <button onClick={onClose} style={{
            all: "unset", cursor: "pointer", position: "absolute", top: 12, right: 12,
            background: "rgba(0,0,0,0.5)", color: "#fff", width: 32, height: 32,
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, backdropFilter: "blur(8px)"
          }}>✕</button>
          {event.happeningNow && (
            <span style={{
              position: "absolute", top: 12, left: 12,
              background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700,
              padding: "4px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 5
            }}><PulsingDot /> Happening Now</span>
          )}
        </div>
        <div style={{ padding: "20px 20px 32px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {getRelativeDate(event.date)} · {formatTime(event.startTime)} – {formatTime(event.endTime)}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text1)", margin: "6px 0 0", lineHeight: 1.2 }}>
            {event.title}
          </h2>
          <div style={{ fontSize: 14, color: "var(--text3)", marginTop: 6 }}>
            {event.venue} · {event.city} · {dist} mi away
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ background: "var(--surface2)", color: "var(--text2)", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8 }}>
              {event.price}
            </span>
            {event.tags.map(t => (
              <span key={t} style={{ background: "var(--surface2)", color: "var(--text3)", fontSize: 12, padding: "4px 10px", borderRadius: 8 }}>
                {CATEGORIES.find(c => c.id === t)?.icon} {t}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.6, marginTop: 16 }}>
            {event.description}
          </p>
          <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 14 }}>
            Source: {event.source}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{
              flex: 1, padding: "14px 0", border: "none", borderRadius: 12,
              background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: "pointer"
            }}>Save Event</button>
            <button style={{
              padding: "14px 18px", border: "1px solid var(--border)", borderRadius: 12,
              background: "var(--surface1)", color: "var(--text2)", fontSize: 15, fontWeight: 600,
              cursor: "pointer"
            }}>Share</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────

export default function Hapn() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTime, setActiveTime] = useState("today");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [view, setView] = useState("feed"); // feed | map
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = SEED_EVENTS.filter(e => {
    if (activeCategory !== "all" && e.category !== activeCategory && !e.tags.includes(activeCategory)) return false;
    if (activeTime === "now" && !e.happeningNow) return false;
    if (activeTime === "today" && e.date !== "2026-03-29") return false;
    if (activeTime === "weekend" && !["2026-03-28", "2026-03-29", "2026-03-30"].includes(e.date)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.city.toLowerCase().includes(q) && !e.venue.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.happeningNow && !b.happeningNow) return -1;
    if (!a.happeningNow && b.happeningNow) return 1;
    return distanceMi(USER_LAT, USER_LNG, a.lat, a.lng) - distanceMi(USER_LAT, USER_LNG, b.lat, b.lng);
  });

  const happeningNow = SEED_EVENTS.filter(e => e.happeningNow);

  return (
    <div style={{
      "--bg": "#f8f7f4",
      "--surface1": "#ffffff",
      "--surface2": "#f0eeea",
      "--border": "#e5e2dc",
      "--text1": "#1a1815",
      "--text2": "#4a4640",
      "--text3": "#8a857d",
      "--text4": "#b5b0a8",
      "--accent": "#d4642a",
      "--accent-soft": "#fef3ed",
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      background: "var(--bg)",
      minHeight: "100vh",
      maxWidth: 480,
      margin: "0 auto",
      position: "relative"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "16px 20px 0", position: "sticky", top: 0, background: "var(--bg)", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text1)", letterSpacing: "-0.02em" }}>
              hapn
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: -2 }}>
              Utah Valley · Orem
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setView(v => v === "feed" ? "map" : "feed")} style={{
              all: "unset", cursor: "pointer", width: 38, height: 38, borderRadius: 12,
              border: "1px solid var(--border)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18, background: "var(--surface1)"
            }}>
              {view === "feed" ? "🗺" : "☰"}
            </button>
            <button style={{
              all: "unset", cursor: "pointer", width: 38, height: 38, borderRadius: 12,
              border: "1px solid var(--border)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 16, background: "var(--surface1)"
            }}>+</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginTop: 14 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--text4)" }}>⌕</span>
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search events, venues, cities..."
            style={{
              width: "100%", padding: "11px 12px 11px 36px", borderRadius: 12,
              border: "1px solid var(--border)", background: "var(--surface1)",
              fontSize: 14, color: "var(--text1)", outline: "none", boxSizing: "border-box",
              fontFamily: "inherit"
            }}
          />
        </div>

        {/* Time filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, paddingBottom: 2 }}>
          {TIME_FILTERS.map(t => (
            <button key={t.id} onClick={() => setActiveTime(t.id)} style={{
              all: "unset", cursor: "pointer", fontSize: 13, fontWeight: 600,
              padding: "6px 14px", borderRadius: 20,
              background: activeTime === t.id ? "var(--text1)" : "var(--surface2)",
              color: activeTime === t.id ? "#fff" : "var(--text3)",
              transition: "all 0.2s", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 5
            }}>
              {t.id === "now" && <PulsingDot />}
              {t.label}
            </button>
          ))}
        </div>

        {/* Category scroller */}
        <div style={{
          display: "flex", gap: 4, overflowX: "auto", paddingTop: 10, paddingBottom: 14,
          scrollbarWidth: "none", msOverflowStyle: "none"
        }}>
          <style>{`::-webkit-scrollbar { display: none; }`}</style>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{
              all: "unset", cursor: "pointer", fontSize: 12, fontWeight: 500,
              padding: "6px 12px", borderRadius: 10, whiteSpace: "nowrap",
              border: `1px solid ${activeCategory === c.id ? "var(--accent)" : "var(--border)"}`,
              background: activeCategory === c.id ? "var(--accent-soft)" : "transparent",
              color: activeCategory === c.id ? "var(--accent)" : "var(--text3)",
              transition: "all 0.2s"
            }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === "feed" ? (
        <div style={{ padding: "0 20px 100px" }}>
          {/* Happening Now strip */}
          {activeTime !== "now" && happeningNow.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text1)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <PulsingDot /> Happening Now
              </div>
              <div style={{
                display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4,
                scrollbarWidth: "none"
              }}>
                {happeningNow.map(e => (
                  <button key={e.id} onClick={() => setSelectedEvent(e)} style={{
                    all: "unset", cursor: "pointer", flexShrink: 0, width: 200,
                    borderRadius: 14, overflow: "hidden", background: "var(--surface1)",
                    border: "1px solid var(--border)"
                  }}>
                    <div style={{ height: 100, position: "relative" }}>
                      <img src={e.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={ev => { ev.target.style.display = "none"; }} />
                      <span style={{
                        position: "absolute", bottom: 6, left: 6,
                        background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10,
                        padding: "2px 6px", borderRadius: 4, backdropFilter: "blur(4px)"
                      }}>{e.price}</span>
                    </div>
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                        {e.venue} · {e.city}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results count */}
          <div style={{ fontSize: 12, color: "var(--text4)", marginBottom: 12 }}>
            {filtered.length} event{filtered.length !== 1 ? "s" : ""} found
          </div>

          {/* Event grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>No events found</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Try a different filter or time range</div>
              </div>
            )}
            {filtered.map(e => (
              <EventCard key={e.id} event={e} onSelect={setSelectedEvent} />
            ))}
          </div>
        </div>
      ) : (
        /* Map View - Simple visual representation */
        <div style={{ padding: "0 20px 100px" }}>
          <div style={{
            background: "var(--surface2)", borderRadius: 16, height: 400,
            position: "relative", overflow: "hidden",
            border: "1px solid var(--border)"
          }}>
            {/* Simple map placeholder with positioned dots */}
            <div style={{
              position: "absolute", inset: 0,
              background: `
                radial-gradient(circle at 30% 60%, rgba(212,100,42,0.08) 0%, transparent 50%),
                radial-gradient(circle at 70% 30%, rgba(212,100,42,0.06) 0%, transparent 50%),
                var(--surface2)
              `
            }}>
              <div style={{ position: "absolute", top: 14, left: 14, fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>
                Utah Valley · {filtered.length} events
              </div>
              {/* City labels */}
              {[
                { name: "Lehi", top: "15%", left: "25%" },
                { name: "Am. Fork", top: "22%", left: "45%" },
                { name: "Orem", top: "38%", left: "40%" },
                { name: "Provo", top: "48%", left: "50%" },
                { name: "Springville", top: "62%", left: "45%" },
                { name: "Spanish Fork", top: "75%", left: "42%" },
              ].map(c => (
                <span key={c.name} style={{
                  position: "absolute", top: c.top, left: c.left,
                  fontSize: 10, color: "var(--text4)", fontWeight: 500
                }}>{c.name}</span>
              ))}
              {/* Event pins */}
              {filtered.map((e, i) => {
                // Normalize lat/lng to position in box
                const yPct = ((40.45 - e.lat) / 0.4) * 100;
                const xPct = ((e.lng + 111.95) / 0.4) * 100;
                return (
                  <button key={e.id} onClick={() => setSelectedEvent(e)} title={e.title} style={{
                    all: "unset", cursor: "pointer",
                    position: "absolute",
                    top: `${Math.min(90, Math.max(8, yPct))}%`,
                    left: `${Math.min(90, Math.max(8, xPct))}%`,
                    width: e.happeningNow ? 28 : 22,
                    height: e.happeningNow ? 28 : 22,
                    borderRadius: "50%",
                    background: e.happeningNow ? "#ef4444" : "var(--accent)",
                    border: "3px solid #fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff", fontWeight: 700,
                    transform: "translate(-50%, -50%)",
                    transition: "transform 0.2s",
                    zIndex: e.happeningNow ? 2 : 1
                  }}
                    onMouseEnter={ev => { ev.currentTarget.style.transform = "translate(-50%, -50%) scale(1.2)"; }}
                    onMouseLeave={ev => { ev.currentTarget.style.transform = "translate(-50%, -50%)"; }}
                  >
                    {CATEGORIES.find(c => c.id === e.category)?.icon}
                  </button>
                );
              })}
            </div>
          </div>
          {/* List below map */}
          <div style={{ marginTop: 16 }}>
            {filtered.map(e => (
              <EventCard key={e.id} event={e} compact onSelect={setSelectedEvent} />
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, background: "var(--surface1)",
        borderTop: "1px solid var(--border)", display: "flex",
        justifyContent: "space-around", padding: "10px 0 env(safe-area-inset-bottom, 14px)",
        zIndex: 50
      }}>
        {[
          { icon: "⌂", label: "Discover", active: true },
          { icon: "🗺", label: "Map", active: false },
          { icon: "+", label: "Post", active: false },
          { icon: "♡", label: "Saved", active: false },
          { icon: "⋯", label: "More", active: false },
        ].map(n => (
          <button key={n.label} style={{
            all: "unset", cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 2, fontSize: 10, fontWeight: 500,
            color: n.active ? "var(--accent)" : "var(--text4)"
          }}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
