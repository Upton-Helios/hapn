import { useEffect, useCallback } from "react";
import * as Location from "expo-location";
import { useLocationStore } from "@/store/filters";

/**
 * Requests device GPS location and updates the location store.
 * Falls back to default (Orem, UT) if permission is denied.
 * Reverse-geocodes to get the city name for display.
 */
export function useDeviceLocation() {
  const setLocation = useLocationStore((s) => s.setLocation);

  const refresh = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("[location] permission denied, using default");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      // Reverse-geocode to get city name
      let city: string | undefined;
      try {
        const [result] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (result?.city) {
          city = result.city;
        } else if (result?.subregion) {
          city = result.subregion;
        }
      } catch (geoErr) {
        console.log("[location] reverse geocode failed:", geoErr);
      }

      setLocation(latitude, longitude, city);
      console.log(
        `[location] updated: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}${city ? ` (${city})` : ""}`
      );
    } catch (err) {
      console.log("[location] error getting position:", err);
    }
  }, [setLocation]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { refresh };
}
