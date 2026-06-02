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

<<<<<<< HEAD
interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    precipitation_sum: (number | null)[];
=======
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
  // We might not need forecast days, but default is 7. Let's explicitly set forecast_days=1 (today) or 0 (if valid, but 1 is safer to ensure we get today's data and current).
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
>>>>>>> feature/nightly-weather-job-scaffold
  };
}

export async function getDailyWeather(lat: number, lng: number): Promise<DailyWeatherRecord[]> {
<<<<<<< HEAD
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&daily=temperature_2m_max,precipitation_sum&past_days=7`,
  );
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = (await res.json()) as OpenMeteoResponse;

  const records: DailyWeatherRecord[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (let i = 0; i < data.daily.time.length; i++) {
    const date = data.daily.time[i];
    if (date < today) {
      records.push({
        date,
        temperatureC: data.daily.temperature_2m_max[i],
        rainfallMm: data.daily.precipitation_sum[i],
      });
    }
  }
  return records;
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData> {
  const daily = await getDailyWeather(lat, lng);
  let rainfall7dMm = 0;
  let lastRainDate: string | null = null;

  for (const record of daily) {
    if (record.rainfallMm) {
      rainfall7dMm += record.rainfallMm;
      if (!lastRainDate || record.date > lastRainDate) {
        lastRainDate = record.date;
=======
  const data = await fetchOpenMeteoForecast(lat, lng);

  if (!data.daily?.time) {
    return [];
  }

  const result: DailyWeatherRecord[] = [];

  // Find "today" in the response timezone (derived from current time or taking the last elements based on past_days)
  // Actually, we can get today's date in local timezone directly from JS but it's better to rely on API's "today" if possible.
  // The API returns YYYY-MM-DD strings in `daily.time`.
  // To identify "today", we can just format `new Date()` as YYYY-MM-DD or use the last returned date if past_days=7 and forecast_days=0.
  // Let's format today according to the returned timezone or simply UTC+?
  // Let's just use `new Date().toISOString().split('T')[0]` or safer: we just take the first 7 elements out of 8, since past_days=7 and forecast_days=1 yields 8 elements (7 past days + today).

  // To be perfectly robust, let's format current date in JS:
  // But wait, "auto" timezone means the API returns dates in the requested location's timezone.
  // We can just filter where daily.time[i] < "today_in_local_tz" or we just take the first 7 elements assuming the last one is today.

  // Let's filter by checking if the date string is strictly less than today's local date or just use the first 7 since past_days=7 and forecast=1 = 8 days total.
  // The array length is 8: indices 0 to 6 are past, index 7 is today.
  const times: string[] = data.daily.time ?? [];
  const tempMax: (number | null)[] = data.daily.temperature_2m_max ?? [];
  const precip: (number | null)[] = data.daily.precipitation_sum ?? [];

  // Get today's date in YYYY-MM-DD in UTC as a reasonable fallback, or use Date object.
  // But actually, the safest is to take the first 7 since past_days=7 guarantees the first 7 are past.
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

  // Extract daily records from the same data to avoid double fetch
  const times: string[] = data.daily?.time ?? [];
  const precip: (number | null)[] = data.daily?.precipitation_sum ?? [];

  let rainfall7dMm = 0;
  let lastRainDate: string | null = null;

  // We want the past 7 days (indices 0 to 6)
  const pastDaysCount = 7;
  const limit = Math.min(times.length, pastDaysCount);

  for (let i = limit - 1; i >= 0; i--) {
    const rMm = precip[i];
    if (rMm != null) {
      rainfall7dMm += rMm;
      if (rMm > 0 && !lastRainDate) {
        lastRainDate = times[i];
>>>>>>> feature/nightly-weather-job-scaffold
      }
    }
  }

<<<<<<< HEAD
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m`,
  );
  const data = (await res.json()) as OpenMeteoResponse;

  return {
    temperatureC: data.current?.temperature_2m ?? 0,
    rainfall7dMm,
=======
  return {
    temperatureC: currentTemp,
    rainfall7dMm: Number(rainfall7dMm.toFixed(1)),
>>>>>>> feature/nightly-weather-job-scaffold
    lastRainDate,
    fetchedAt: new Date().toISOString(),
  };
}
