import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import type { NearbyEvent } from "./use-nearby-events";
import { useLocationStore } from "@/store/filters";

/** Returns the set of event IDs the current user has saved. */
export function useSavedEventIds() {
  const user = useAuthStore((s) => s.user);

  return useQuery<Set<string>>({
    queryKey: ["saved-event-ids", user?.id],
    queryFn: async () => {
      if (!user) return new Set();
      const { data, error } = await supabase
        .from("saved_events")
        .select("event_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.event_id));
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });
}

/** Toggle save/unsave for an event. */
export function useToggleSave() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, isSaved }: { eventId: string; isSaved: boolean }) => {
      if (!user) throw new Error("Not authenticated");

      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from("saved_events")
          .delete()
          .eq("user_id", user.id)
          .eq("event_id", eventId);
        if (error) throw error;
      } else {
        // Save
        const { error } = await supabase
          .from("saved_events")
          .insert({ user_id: user.id, event_id: eventId });
        if (error) throw error;
      }
    },
    onMutate: async ({ eventId, isSaved }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["saved-event-ids", user?.id] });
      const prev = queryClient.getQueryData<Set<string>>(["saved-event-ids", user?.id]);
      const next = new Set(prev);
      if (isSaved) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      queryClient.setQueryData(["saved-event-ids", user?.id], next);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["saved-event-ids", user?.id], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-event-ids", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["saved-events", user?.id] });
    },
  });
}

/** Fetch full event data for all saved events, sorted by start_time. */
export function useSavedEvents() {
  const user = useAuthStore((s) => s.user);
  const { latitude, longitude } = useLocationStore();

  return useQuery<NearbyEvent[]>({
    queryKey: ["saved-events", user?.id, latitude, longitude],
    queryFn: async () => {
      if (!user) return [];

      // Get saved event IDs
      const { data: saved, error: savedErr } = await supabase
        .from("saved_events")
        .select("event_id")
        .eq("user_id", user.id);
      if (savedErr) throw savedErr;
      if (!saved || saved.length === 0) return [];

      const ids = saved.map((r) => r.event_id);

      // Fetch full event data with distance using the RPC
      const { data, error } = await supabase.rpc("nearby_events", {
        user_lat: latitude,
        user_lng: longitude,
        radius_miles: 100, // large radius to get all saved events
        category_filter: null,
        time_filter: "upcoming",
      });
      if (error) throw error;

      const allEvents = (data as NearbyEvent[]) ?? [];
      return allEvents
        .filter((e) => ids.includes(e.id))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });
}
