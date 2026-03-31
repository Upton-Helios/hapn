import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocationStore } from "@/store/filters";
import type { NearbyEvent } from "./use-nearby-events";

export function useEvent(id: string | undefined) {
  const { latitude, longitude } = useLocationStore();

  return useQuery<NearbyEvent | null>({
    queryKey: ["event", id, latitude, longitude],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase.rpc("get_event_detail", {
        event_id: id,
        user_lat: latitude,
        user_lng: longitude,
      });

      if (error) throw error;
      const rows = data as NearbyEvent[];
      return rows?.[0] ?? null;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
