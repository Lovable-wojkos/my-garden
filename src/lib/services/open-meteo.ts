export interface GeocodingResult {
  name: string;
  displayName: string; // "Kraków, powiat krakowski, Małopolskie, Polska"
  latitude: number;
  longitude: number;
  country_code: string;
}

export async function geocodeCity(city: string): Promise<GeocodingResult[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "pl");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding failed: ${res.statusText}`);

  const data = (await res.json()) as {
    results?: {
      name: string;
      admin1?: string; // voivodeship
      admin2?: string; // powiat
      country: string;
      country_code: string;
      latitude: number;
      longitude: number;
    }[];
  };

  if (!data.results) return [];

  return data.results.map((r) => ({
    name: r.name,
    displayName: [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
    country_code: r.country_code,
  }));
}

export interface WeatherData {
  temperatureC: number;
  rainfall7dMm: number;
  lastRainDate: string | null;
  lastRainMm: number | null;
  fetchedAt: string;
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set("current", "temperature_2m,precipitation");
  url.searchParams.set("daily", "precipitation_sum");
  url.searchParams.set("past_days", "7");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast API error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    timezone?: string;
    current?: {
      temperature_2m?: number;
      precipitation?: number;
    };
    daily?: {
      time?: string[];
      precipitation_sum?: (number | null)[];
    };
  };

  const currentTemp = data.current?.temperature_2m ?? 0;
  const times: string[] = data.daily?.time ?? [];
  const precip: (number | null)[] = data.daily?.precipitation_sum ?? [];
  const timezone = data.timezone ?? "UTC";

  // Get today's date (YYYY-MM-DD) in the response's timezone
  const todayInTz = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date());

  // Sum only the past-only window: indices where time[i] is strictly before today.
  // Never include today or any forecast day to avoid leaking future predictions.
  let rainfall7dMm = 0;
  let lastRainDate: string | null = null;
  let lastRainMm: number | null = null;

  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i] >= todayInTz) continue;
    const rMm = precip[i];
    if (rMm != null) {
      rainfall7dMm += rMm;
      if (rMm > 0 && !lastRainDate) {
        lastRainDate = times[i];
        lastRainMm = rMm;
      }
    }
  }

  return {
    temperatureC: currentTemp,
    rainfall7dMm: Number(rainfall7dMm.toFixed(1)),
    lastRainDate,
    lastRainMm: lastRainMm != null ? Number(lastRainMm.toFixed(1)) : null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getWeatherForCity(city: string): Promise<WeatherData> {
  const results = await geocodeCity(city);
  if (results.length === 0) {
    throw new Error(`City not found: ${city}`);
  }
  const { latitude, longitude } = results[0];
  return getWeather(latitude, longitude);
}

export interface DailyWeatherRecord {
  date: string;
  temperatureC: number | null;
  rainfallMm: number | null;
}

export async function getDailyWeather(lat: number, lng: number): Promise<DailyWeatherRecord[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set("daily", "temperature_2m_max,precipitation_sum");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("past_days", "7");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast API error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    timezone?: string;
    daily?: {
      time?: string[];
      temperature_2m_max?: (number | null)[];
      precipitation_sum?: (number | null)[];
    };
  };

  if (!data.daily?.time) return [];

  const timezone = data.timezone ?? "UTC";
  const todayInTz = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date());

  const times: string[] = data.daily.time;
  const tempMax: (number | null)[] = data.daily.temperature_2m_max ?? [];
  const precip: (number | null)[] = data.daily.precipitation_sum ?? [];

  const result: DailyWeatherRecord[] = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= todayInTz) continue;
    result.push({ date: times[i], temperatureC: tempMax[i] ?? null, rainfallMm: precip[i] ?? null });
  }
  return result;
}
