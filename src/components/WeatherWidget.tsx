import { useEffect, useRef, useState } from "react";
import type { WeatherData } from "@/lib/services/open-meteo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface GeocodingResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  country_code: string;
}

interface WeatherWidgetProps {
  initialCity?: {
    cityName: string;
    latitude: number;
    longitude: number;
  } | null;
}

interface WeatherState {
  data: WeatherData | null;
  stale: boolean;
}

// Pure fetch helpers (outside component — no setState, stable references)
async function doFetchWeather(lat: number, lng: number, signal: AbortSignal): Promise<WeatherData> {
  const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, { signal });
  if (!res.ok) throw new Error("weather_unavailable");
  return (await res.json()) as WeatherData;
}

async function doFetchSuggestions(q: string, signal: AbortSignal): Promise<GeocodingResult[]> {
  const res = await fetch(`/api/geocoding-suggestions?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  return (await res.json()) as GeocodingResult[];
}

export default function WeatherWidget({ initialCity }: WeatherWidgetProps) {
  const [cityInput, setCityInput] = useState(initialCity?.cityName ?? "");
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialCity ? { lat: initialCity.latitude, lng: initialCity.longitude } : null,
  );
  const [weatherState, setWeatherState] = useState<WeatherState>({ data: null, stale: false });
  // Initialize loading=true when we have an initialCity to avoid setState in effect body
  const [loading, setLoading] = useState(Boolean(initialCity));
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Primitive deps to avoid effect re-runs on object identity changes
  const lat = coords?.lat;
  const lng = coords?.lng;
  const fetchedAt = weatherState.data?.fetchedAt;

  // Fetch weather when coordinates change; setState only in .then/.catch/.finally (not synchronously in effect body)
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    doFetchWeather(lat, lng, controller.signal)
      .then((data) => {
        setWeatherState({ data, stale: false });
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setWeatherState((prev) => (prev.data ? { ...prev, stale: true } : prev));
        setError("Nie udalo sie pobrac danych pogodowych.");
      })
      .finally(() => {
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [lat, lng]);

  // 30-min refresh interval with visibility hygiene
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;

    const runRefresh = () => {
      if (document.hidden) return;
      const controller = new AbortController();
      doFetchWeather(lat, lng, controller.signal)
        .then((data) => {
          setWeatherState({ data, stale: false });
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setWeatherState((prev) => (prev.data ? { ...prev, stale: true } : prev));
        });
    };

    const interval = setInterval(runRefresh, 30 * 60 * 1000);

    const onVisibilityChange = () => {
      if (!document.hidden && fetchedAt) {
        const age = Date.now() - new Date(fetchedAt).getTime();
        if (age > 30 * 60 * 1000) runRefresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [lat, lng, fetchedAt]);

  // Debounced geocoding search with AbortController
  const handleInputChange = (value: string) => {
    setCityInput(value);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      doFetchSuggestions(value, controller.signal)
        .then((results) => {
          setSuggestions(results);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setSuggestions([]);
        });
    }, 300);
  };

  const handleSelectSuggestion = async (suggestion: GeocodingResult) => {
    setCityInput(suggestion.displayName);
    setCoords({ lat: suggestion.latitude, lng: suggestion.longitude });
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(true);

    await fetch("/api/user-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city_name: suggestion.displayName,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      }),
    });
  };

  const staleTime = weatherState.data?.fetchedAt
    ? new Date(weatherState.data.fetchedAt).toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="w-full max-w-sm border-white/10 bg-white/10 text-white backdrop-blur-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Pogoda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            value={cityInput}
            onChange={(e) => {
              handleInputChange(e.target.value);
            }}
            onFocus={() => {
              setShowSuggestions(suggestions.length > 0);
            }}
            onBlur={() =>
              setTimeout(() => {
                setShowSuggestions(false);
              }, 150)
            }
            placeholder="Wpisz nazwe miasta..."
            className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border border-white/20 bg-slate-800 shadow-lg">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => void handleSelectSuggestion(s)}
                  className="cursor-pointer px-3 py-2 text-sm text-white hover:bg-white/10"
                >
                  {s.displayName}
                </li>
              ))}
            </ul>
          )}
          {showSuggestions && cityInput.trim().length >= 2 && suggestions.length === 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white/50">
              Brak wynikow
            </div>
          )}
        </div>

        {loading && <p className="text-sm text-white/60">Ladowanie danych pogodowych...</p>}

        {error && !weatherState.data && <p className="text-sm text-red-300">{error}</p>}

        {weatherState.data && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Temperatura</span>
              <span className={cn("text-xl font-bold")}>{weatherState.data.temperatureC}&#176;C</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Opady (7 dni)</span>
              <span className="font-semibold">{weatherState.data.rainfall7dMm} mm</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Ostatni deszcz</span>
              <span className="font-semibold">
                {weatherState.data.lastRainDate
                  ? `${new Date(weatherState.data.lastRainDate).toLocaleDateString("pl-PL")} · ${weatherState.data.lastRainMm} mm`
                  : "Brak danych"}
              </span>
            </div>
            {weatherState.stale && staleTime && (
              <Badge variant="outline" className="border-yellow-400/40 text-yellow-300">
                dane z {staleTime}
              </Badge>
            )}
          </div>
        )}

        {!loading && !weatherState.data && !error && (
          <p className="text-sm text-white/50">Wyszukaj miasto, aby zobaczyc pogode.</p>
        )}
      </CardContent>
    </Card>
  );
}
