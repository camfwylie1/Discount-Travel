/**
 * AIRPORTS
 *
 * We launch in Canada, so the Canadian gateways are marked `isGateway` and
 * shown first. Nothing about the schema is Canada-specific: adding
 * international origin markets is a data change.
 */
export interface AirportSeed {
  iata: string
  icao?: string
  name: string
  city: string
  region?: string
  country: string
  continent: string
  timezone?: string
  latitude: number
  longitude: number
  isGateway?: boolean
  sortOrder?: number
}

export const AIRPORT_SEEDS: AirportSeed[] = [
  // ── Primary Canadian gateways (launch market) ─────────────────────────────
  { iata: 'YYZ', icao: 'CYYZ', name: 'Toronto Pearson International', city: 'Toronto', region: 'ON', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 43.6777, longitude: -79.6248, isGateway: true, sortOrder: 1 },
  { iata: 'YVR', icao: 'CYVR', name: 'Vancouver International', city: 'Vancouver', region: 'BC', country: 'CA', continent: 'North America', timezone: 'America/Vancouver', latitude: 49.1967, longitude: -123.1815, isGateway: true, sortOrder: 2 },
  { iata: 'YYC', icao: 'CYYC', name: 'Calgary International', city: 'Calgary', region: 'AB', country: 'CA', continent: 'North America', timezone: 'America/Edmonton', latitude: 51.1315, longitude: -114.0106, isGateway: true, sortOrder: 3 },
  { iata: 'YEG', icao: 'CYEG', name: 'Edmonton International', city: 'Edmonton', region: 'AB', country: 'CA', continent: 'North America', timezone: 'America/Edmonton', latitude: 53.3097, longitude: -113.5801, isGateway: true, sortOrder: 4 },
  { iata: 'YWG', icao: 'CYWG', name: 'Winnipeg Richardson International', city: 'Winnipeg', region: 'MB', country: 'CA', continent: 'North America', timezone: 'America/Winnipeg', latitude: 49.91, longitude: -97.2399, isGateway: true, sortOrder: 5 },
  { iata: 'YOW', icao: 'CYOW', name: 'Ottawa Macdonald–Cartier International', city: 'Ottawa', region: 'ON', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 45.3225, longitude: -75.6692, isGateway: true, sortOrder: 6 },
  { iata: 'YUL', icao: 'CYUL', name: 'Montréal–Trudeau International', city: 'Montréal', region: 'QC', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 45.4706, longitude: -73.7408, isGateway: true, sortOrder: 7 },
  { iata: 'YHZ', icao: 'CYHZ', name: 'Halifax Stanfield International', city: 'Halifax', region: 'NS', country: 'CA', continent: 'North America', timezone: 'America/Halifax', latitude: 44.8808, longitude: -63.5086, isGateway: true, sortOrder: 8 },
  { iata: 'YYT', icao: 'CYYT', name: "St. John's International", city: "St. John's", region: 'NL', country: 'CA', continent: 'North America', timezone: 'America/St_Johns', latitude: 47.6186, longitude: -52.7519, isGateway: true, sortOrder: 9 },

  // ── Secondary Canadian airports (nearby-airport searches) ─────────────────
  { iata: 'YTZ', icao: 'CYTZ', name: 'Billy Bishop Toronto City', city: 'Toronto', region: 'ON', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 43.6275, longitude: -79.3962, sortOrder: 20 },
  { iata: 'YHM', icao: 'CYHM', name: 'John C. Munro Hamilton International', city: 'Hamilton', region: 'ON', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 43.1736, longitude: -79.935, sortOrder: 21 },
  { iata: 'YKF', icao: 'CYKF', name: 'Region of Waterloo International', city: 'Kitchener', region: 'ON', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 43.4608, longitude: -80.3786, sortOrder: 22 },
  { iata: 'YXU', icao: 'CYXU', name: 'London International', city: 'London', region: 'ON', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 43.0356, longitude: -81.1539, sortOrder: 23 },
  { iata: 'YQB', icao: 'CYQB', name: 'Québec City Jean Lesage International', city: 'Québec City', region: 'QC', country: 'CA', continent: 'North America', timezone: 'America/Toronto', latitude: 46.7911, longitude: -71.3933, sortOrder: 24 },
  { iata: 'YXE', icao: 'CYXE', name: 'Saskatoon John G. Diefenbaker International', city: 'Saskatoon', region: 'SK', country: 'CA', continent: 'North America', timezone: 'America/Regina', latitude: 52.1708, longitude: -106.6997, sortOrder: 25 },
  { iata: 'YQR', icao: 'CYQR', name: 'Regina International', city: 'Regina', region: 'SK', country: 'CA', continent: 'North America', timezone: 'America/Regina', latitude: 50.4319, longitude: -104.6658, sortOrder: 26 },
  { iata: 'YXX', icao: 'CYXX', name: 'Abbotsford International', city: 'Abbotsford', region: 'BC', country: 'CA', continent: 'North America', timezone: 'America/Vancouver', latitude: 49.0253, longitude: -122.3606, sortOrder: 27 },
  { iata: 'YYJ', icao: 'CYYJ', name: 'Victoria International', city: 'Victoria', region: 'BC', country: 'CA', continent: 'North America', timezone: 'America/Vancouver', latitude: 48.6469, longitude: -123.426, sortOrder: 28 },
  { iata: 'YSJ', icao: 'CYSJ', name: 'Saint John Airport', city: 'Saint John', region: 'NB', country: 'CA', continent: 'North America', timezone: 'America/Halifax', latitude: 45.3161, longitude: -65.8903, sortOrder: 29 },
  { iata: 'YQM', icao: 'CYQM', name: 'Greater Moncton Roméo LeBlanc International', city: 'Moncton', region: 'NB', country: 'CA', continent: 'North America', timezone: 'America/Halifax', latitude: 46.1122, longitude: -64.6786, sortOrder: 30 },

  // ── Common arrival airports (destination side of a deal) ──────────────────
  { iata: 'SJO', name: 'Juan Santamaría International', city: 'San José', country: 'CR', continent: 'North America', latitude: 9.9939, longitude: -84.2088, sortOrder: 100 },
  { iata: 'LIR', name: 'Daniel Oduber Quirós International', city: 'Liberia', country: 'CR', continent: 'North America', latitude: 10.5933, longitude: -85.5444, sortOrder: 101 },
  { iata: 'CUN', name: 'Cancún International', city: 'Cancún', country: 'MX', continent: 'North America', latitude: 21.0365, longitude: -86.8771, sortOrder: 102 },
  { iata: 'PVR', name: 'Licenciado Gustavo Díaz Ordaz International', city: 'Puerto Vallarta', country: 'MX', continent: 'North America', latitude: 20.6801, longitude: -105.2544, sortOrder: 103 },
  { iata: 'PUJ', name: 'Punta Cana International', city: 'Punta Cana', country: 'DO', continent: 'North America', latitude: 18.5674, longitude: -68.3634, sortOrder: 104 },
  { iata: 'MBJ', name: 'Sangster International', city: 'Montego Bay', country: 'JM', continent: 'North America', latitude: 18.5037, longitude: -77.9134, sortOrder: 105 },
  { iata: 'LIS', name: 'Humberto Delgado Airport', city: 'Lisbon', country: 'PT', continent: 'Europe', latitude: 38.7813, longitude: -9.1359, sortOrder: 106 },
  { iata: 'OPO', name: 'Francisco Sá Carneiro Airport', city: 'Porto', country: 'PT', continent: 'Europe', latitude: 41.2481, longitude: -8.6814, sortOrder: 107 },
  { iata: 'FCO', name: 'Leonardo da Vinci–Fiumicino', city: 'Rome', country: 'IT', continent: 'Europe', latitude: 41.8003, longitude: 12.2389, sortOrder: 108 },
  { iata: 'VCE', name: 'Venice Marco Polo', city: 'Venice', country: 'IT', continent: 'Europe', latitude: 45.5053, longitude: 12.3519, sortOrder: 109 },
  { iata: 'BCN', name: 'Josep Tarradellas Barcelona–El Prat', city: 'Barcelona', country: 'ES', continent: 'Europe', latitude: 41.2974, longitude: 2.0833, sortOrder: 110 },
  { iata: 'ATH', name: 'Athens International', city: 'Athens', country: 'GR', continent: 'Europe', latitude: 37.9364, longitude: 23.9445, sortOrder: 111 },
  { iata: 'KEF', name: 'Keflavík International', city: 'Reykjavík', country: 'IS', continent: 'Europe', latitude: 63.985, longitude: -22.6056, sortOrder: 112 },
  { iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'FR', continent: 'Europe', latitude: 49.0097, longitude: 2.5479, sortOrder: 113 },
  { iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'GB', continent: 'Europe', latitude: 51.47, longitude: -0.4543, sortOrder: 114 },
  { iata: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'JP', continent: 'Asia', latitude: 35.7647, longitude: 140.3864, sortOrder: 115 },
  { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'TH', continent: 'Asia', latitude: 13.69, longitude: 100.7501, sortOrder: 116 },
  { iata: 'DPS', name: 'Ngurah Rai International', city: 'Denpasar', country: 'ID', continent: 'Asia', latitude: -8.7482, longitude: 115.1672, sortOrder: 117 },
  { iata: 'SCL', name: 'Arturo Merino Benítez International', city: 'Santiago', country: 'CL', continent: 'South America', latitude: -33.393, longitude: -70.7858, sortOrder: 118 },
  { iata: 'LIM', name: 'Jorge Chávez International', city: 'Lima', country: 'PE', continent: 'South America', latitude: -12.0219, longitude: -77.1143, sortOrder: 119 },
  { iata: 'JRO', name: 'Kilimanjaro International', city: 'Arusha', country: 'TZ', continent: 'Africa', latitude: -3.4294, longitude: 37.0745, sortOrder: 120 },
  { iata: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'ZA', continent: 'Africa', latitude: -33.9715, longitude: 18.6021, sortOrder: 121 },
  { iata: 'GVA', name: 'Geneva Airport', city: 'Geneva', country: 'CH', continent: 'Europe', latitude: 46.2381, longitude: 6.1089, sortOrder: 122 },
  { iata: 'YLW', icao: 'CYLW', name: 'Kelowna International', city: 'Kelowna', region: 'BC', country: 'CA', continent: 'North America', latitude: 49.9561, longitude: -119.3778, sortOrder: 123 },
]

export const CANADIAN_GATEWAYS = AIRPORT_SEEDS.filter((a) => a.isGateway)
