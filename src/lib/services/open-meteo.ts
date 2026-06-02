export interface GeocodingResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  country_code: string;
}

export async function geocodeCity(city: string): Promise<GeocodingResult[]> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5`);
  if (!res.ok) throw new Error("Geocoding failed");
  const data = (await res.json()) as {
    results?: {
      name: string;
      admin1?: string;
      country: string;
      country_code: string;
      latitude: number;
      longitude: number;
    }[];
  };
  if (!data.results) return [];
  return data.results.map((r) => ({
    name: r.name,
    displayName: `${r.name}${r.admin1 ? ", " + r.admin1 : ""}, ${r.country}`,
    latitude: r.latitude,
    longitude: r.longitude,
    country_code: r.country_code,
  }));
}

export interface WeatherData {
  temperatureC: number;
  rainfall7dMm: number;
  lastRainDate: string | null;
  fetchedAt: string;
}

export interface DailyWeatherRecord {
  date: string;
  temperatureC: number | null;
  rainfallMm: number | null;
}

// Internal helper for fetching data used by both getWeather and getDailyWeather
async function fetchOpenMeteoForecast(lat: number, lng: number) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  // We want the past 7 days, so we can use past_days=7. We also need current temperature.
  url.searchParams.set("current", "temperature_2m");
  url.searchParams.set("daily", "temperature_2m_max,precipitation_sum");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("past_days", "7");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast API error: ${response.statusText}`);
  }

  return (await response.json()) as {
    current?: {
      temperature_2m?: number;
    };
    daily?: {
      time?: string[];
      temperature_2m_max?: (number | null)[];
      precipitation_sum?: (number | null)[];
    };
  };
}

export async function getDailyWeather(lat: number, lng: number): Promise<DailyWeatherRecord[]> {
  const data = await fetchOpenMeteoForecast(lat, lng);

  if (!data.daily?.time) {
    return [];
  }

  const result: DailyWeatherRecord[] = [];

  const times: string[] = data.daily.time ?? [];
  const tempMax: (number | null)[] = data.daily.temperature_2m_max ?? [];
  const precip: (number | null)[] = data.daily.precipitation_sum ?? [];

  const pastDaysCount = 7;

  for (let i = 0; i < Math.min(times.length, pastDaysCount); i++) {
    result.push({
      date: times[i],
      temperatureC: tempMax[i] ?? null,
      rainfallMm: precip[i] ?? null,
    });
  }

  return result;
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData> {
  const data = await fetchOpenMeteoForecast(lat, lng);

  const currentTemp = data.current?.temperature_2m ?? 0;

  const times: string[] = data.daily?.time ?? [];
  const precip: (number | null)[] = data.daily?.precipitation_sum ?? [];

  let rainfall7dMm = 0;
  let lastRainDate: string | null = null;

  const pastDaysCount = 7;
  const limit = Math.min(times.length, pastDaysCount);

  for (let i = limit - 1; i >= 0; i--) {
    const rMm = precip[i];
    if (rMm != null) {
      rainfall7dMm += rMm;
      if (rMm > 0 && !lastRainDate) {
        lastRainDate = times[i];
      }
    }
  }

  return {
    temperatureC: currentTemp,
    rainfall7dMm: Number(rainfall7dMm.toFixed(1)),
    lastRainDate,
    fetchedAt: new Date().toISOString(),
  };
}