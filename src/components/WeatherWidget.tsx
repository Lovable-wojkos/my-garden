import { useEffect, useRef, useState } from "react";
import type { WeatherData } from "@/lib/services/open-meteo";
import { getWeatherIconUrl } from "@/lib/services/weather-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pl } from "@/lib/copy/pl";
import { displayRainfall7dMm } from "@/lib/weather-display";
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
  reloadOnSelect?: boolean;
  /** When false, location is display-only (dashboard). When true, click to edit (settings). */
  editable?: boolean;
  rainfall7dMmFromDb?: number | null;
  rainfallStale?: boolean;
  /** Etykieta wiersza „7 dni”; domyślnie same opady, na panelu — nawodnienie łącznie. */
  rainfall7dLabel?: string;
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

function parseLocationDisplay(cityInput: string): { primary: string; rest: string | null } {
  const commaIdx = cityInput.indexOf(",");
  if (commaIdx === -1) return { primary: cityInput.trim(), rest: null };
  return {
    primary: cityInput.slice(0, commaIdx).trim(),
    rest: cityInput.slice(commaIdx + 1).trim(),
  };
}

function formatRelativeRainDate(dateStr: string): string {
  const rainDay = new Date(dateStr);
  rainDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - rainDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return pl.weather.relativeToday;
  if (diffDays === 1) return pl.weather.relativeYesterday;
  return pl.weather.relativeDaysAgo(diffDays);
}

export default function WeatherWidget({
  initialCity,
  reloadOnSelect,
  editable = false,
  rainfall7dMmFromDb,
  rainfallStale = false,
  rainfall7dLabel,
}: WeatherWidgetProps) {
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
  const [isEditingLocation, setIsEditingLocation] = useState(editable && !initialCity?.cityName);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        setError(pl.weather.fetchError);
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
    setIsEditingLocation(false);
    setLoading(true);

    const res = await fetch("/api/user-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city_name: suggestion.displayName,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      }),
    });

    if (res.ok && reloadOnSelect) {
      window.location.reload();
    }
  };

  const staleTime = weatherState.data?.fetchedAt
    ? new Date(weatherState.data.fetchedAt).toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const displayRainfall7d = displayRainfall7dMm(rainfall7dMmFromDb, weatherState.data?.rainfall7dMm);

  const showStaleBadge = weatherState.stale || rainfallStale;

  const showLocationInput = editable && (isEditingLocation || !cityInput.trim());
  const { primary: locationPrimary } = parseLocationDisplay(cityInput);

  useEffect(() => {
    if (editable && isEditingLocation) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editable, isEditingLocation]);

  return (
    <Card className="border-border bg-card text-foreground w-full max-w-sm shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{pl.weather.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative text-left">
          {weatherState.data && (
            <img
              src={getWeatherIconUrl(weatherState.data.weatherCode)}
              alt=""
              width={64}
              height={64}
              className="mb-1 h-16 w-16"
            />
          )}
          {showLocationInput ? (
            <Input
              ref={inputRef}
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
                  if (cityInput.trim()) setIsEditingLocation(false);
                }, 150)
              }
              placeholder={pl.weather.searchPlaceholder}
            />
          ) : cityInput.trim() ? (
            editable ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditingLocation(true);
                }}
                className="hover:bg-muted/50 w-full rounded-md px-1 py-1 text-left transition-colors"
                aria-label={`${pl.settings.changeCity}: ${locationPrimary}`}
              >
                <span className="text-foreground block truncate text-4xl leading-tight font-bold">
                  {locationPrimary}
                </span>
              </button>
            ) : (
              <p className="text-foreground truncate px-1 text-4xl leading-tight font-bold">{locationPrimary}</p>
            )
          ) : null}
          {showLocationInput && showSuggestions && suggestions.length > 0 && (
            <ul className="border-border bg-popover text-popover-foreground absolute z-10 mt-1 w-full rounded-md border shadow-lg">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => void handleSelectSuggestion(s)}
                  className="hover:bg-muted cursor-pointer px-3 py-2 text-sm"
                >
                  {s.displayName}
                </li>
              ))}
            </ul>
          )}
          {showLocationInput && showSuggestions && cityInput.trim().length >= 2 && suggestions.length === 0 && (
            <div className="border-border bg-popover text-muted-foreground absolute z-10 mt-1 w-full rounded-md border px-3 py-2 text-sm">
              {pl.weather.noResults}
            </div>
          )}
        </div>

        {loading && <p className="text-muted-foreground text-sm">{pl.weather.loading}</p>}

        {error && !weatherState.data && <p className="text-destructive text-sm">{error}</p>}

        {weatherState.data && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{pl.weather.temperature}</span>
              <span className={cn("text-3xl font-bold")}>{weatherState.data.temperatureC}&#176;C</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{rainfall7dLabel ?? pl.weather.rainfall7d}</span>
              <span className="font-semibold">
                {displayRainfall7d != null ? `${displayRainfall7d} mm` : pl.weather.lastRainNoData}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{pl.weather.lastRain}</span>
              <span className="font-semibold">
                {weatherState.data.lastRainDate
                  ? `${formatRelativeRainDate(weatherState.data.lastRainDate)} · ${weatherState.data.lastRainMm} mm`
                  : pl.weather.lastRainNoData}
              </span>
            </div>
            {showStaleBadge && (
              <Badge variant="outline" className="border-border text-muted-foreground">
                {pl.weather.stale}
                {staleTime ? ` (${staleTime})` : ""}
              </Badge>
            )}
          </div>
        )}

        {!loading && !weatherState.data && !error && editable && (
          <p className="text-muted-foreground text-sm">{pl.weather.searchPrompt}</p>
        )}
      </CardContent>
    </Card>
  );
}
