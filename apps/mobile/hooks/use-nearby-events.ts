import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useFiltersStore, useLocationStore } from "@/store/filters";

export interface NearbyEvent {
  id: string;
  title: string;
  description: string | null;
  venue_name: string | null;
  address: string | null;
  city: string;
  category: string;
  tags: string[];
  price: string | null;
  start_time: string;
  end_time: string | null;
  image_url: string | null;
  source: string;
  source_url: string | null;
  lat: number;
  lng: number;
  distance_miles: number;
  is_happening_now: boolean;
}

export function useNearbyEvents() {
  const { latitude, longitude } = useLocationStore();
  const { timeFilter, category, radiusMiles } = useFiltersStore();

  return useQuery<NearbyEvent[]>({
    queryKey: ["nearby-events", latitude, longitude, timeFilter, category, radiusMiles],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_events", {
        user_lat: latitude,
        user_lng: longitude,
        radius_miles: radiusMiles,
        category_filter: category === "all" ? null : category,
        time_filter: timeFilter,
      });

      if (error) throw error;
      return (data as NearbyEvent[]) ?? [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

export function useHappeningNow() {
  const { latitude, longitude } = useLocationStore();
  const { radiusMiles } = useFiltersStore();

  return useQuery<NearbyEvent[]>({
    queryKey: ["happening-now", latitude, longitude, radiusMiles],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_events", {
        user_lat: latitude,
        user_lng: longitude,
        radius_miles: radiusMiles,
        category_filter: null,
        time_filter: "now",
      });

      if (error) throw error;
      return (data as NearbyEvent[]) ?? [];
    },
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });
}
