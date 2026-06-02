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

interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

export async function getDailyWeather(lat: number, lng: number): Promise<DailyWeatherRecord[]> {
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
      }
    }
  }

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m`,
  );
  const data = (await res.json()) as OpenMeteoResponse;

  return {
    temperatureC: data.current?.temperature_2m ?? 0,
    rainfall7dMm,
    lastRainDate,
    fetchedAt: new Date().toISOString(),
  };
}
