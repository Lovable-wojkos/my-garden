/** WMO weather_code → Airy icon name (Open-Meteo community icon set). */
const WMO_ICON_NAMES: Record<number, string> = {
  0: "clear",
  1: "mostly-clear",
  2: "partly-cloudy",
  3: "overcast",
  45: "fog",
  48: "rime-fog",
  51: "light-drizzle",
  53: "moderate-drizzle",
  55: "dense-drizzle",
  56: "light-freezing-drizzle",
  57: "dense-freezing-drizzle",
  61: "light-rain",
  63: "moderate-rain",
  65: "heavy-rain",
  66: "light-freezing-rain",
  67: "heavy-freezing-rain",
  71: "slight-snowfall",
  73: "moderate-snowfall",
  75: "heavy-snowfall",
  77: "snowflake",
  80: "light-rain",
  81: "moderate-rain",
  82: "heavy-rain",
  85: "slight-snowfall",
  86: "heavy-snowfall",
  95: "thunderstorm",
  96: "thunderstorm-with-hail",
  99: "thunderstorm-with-hail",
};

const ICON_CDN = "https://cdn.jsdelivr.net/gh/Leftium/weather-sense@main/static/icons/airy";

export function getWeatherIconUrl(weatherCode: number): string {
  const iconName = WMO_ICON_NAMES[weatherCode] ?? WMO_ICON_NAMES[0];
  return `${ICON_CDN}/${iconName}@4x.png`;
}
