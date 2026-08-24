import { WeatherDay } from '../types';

// Newcastle, NSW. Open-Meteo requires no API key for non-commercial use.
const NEWCASTLE = { latitude: -32.9283, longitude: 151.7817 };

type OpenMeteoResponse = {
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
  };
};

export async function getNewcastleWeather(): Promise<WeatherDay[]> {
  const params = new URLSearchParams({
    latitude: String(NEWCASTLE.latitude),
    longitude: String(NEWCASTLE.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    timezone: 'Australia/Sydney',
    forecast_days: '5',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error('Weather is unavailable right now.');
  const data = (await response.json()) as OpenMeteoResponse;
  return data.daily.time.map((date, index) => ({
    date,
    min: Math.round(data.daily.temperature_2m_min[index]),
    max: Math.round(data.daily.temperature_2m_max[index]),
    rainMm: Math.round(data.daily.precipitation_sum[index] * 10) / 10,
    rainChance: Math.round(data.daily.precipitation_probability_max[index]),
    weatherCode: data.daily.weather_code[index],
  }));
}

export function weatherWaterNote(day?: WeatherDay) {
  if (!day) return 'Check the top few centimetres of soil before watering.';
  if (day.rainMm >= 5) return `${day.rainMm} mm is forecast. Check the soil first — you may be able to skip watering.`;
  if (day.max >= 30) return `A hot ${day.max}°C day is forecast. Water early and check seedlings again late afternoon.`;
  if (day.rainChance >= 60) return `Rain is possible (${day.rainChance}%). Check the bed before watering.`;
  return 'Little rain is forecast. Check moisture and water early if the surface is dry.';
}
