import localities from '../data/localities.json';

export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const body = await request.json();
    const { destination, maxMinutes, travelMode } = body;

    if (!destination || !destination.lat || !destination.lng) {
      return new Response(JSON.stringify({ error: "Missing destination" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const profile = (travelMode === 'WALK' || travelMode === 'walking') ? 'foot' :
                    (travelMode === 'BICYCLE' || travelMode === 'bicycling') ? 'bicycle' : 'car';

    const candidates = localities
      .map(loc => ({
        ...loc,
        airDist: Math.sqrt(Math.pow(loc.lat - destination.lat, 2) + Math.pow(loc.lng - destination.lng, 2))
      }))
      .sort((a, b) => a.airDist - b.airDist)
      .slice(0, 250);

    const coords = candidates.map(loc => `${loc.lng},${loc.lat}`).join(';');
    const allCoords = `${destination.lng},${destination.lat};${coords}`;
    const sourceIndices = Array.from({length: candidates.length}, (_, i) => i + 1).join(';');
    
    const osrmUrl = `https://router.project-osrm.org/table/v1/${profile}/${allCoords}?sources=${sourceIndices}&destinations=0&annotations=duration,distance`;

    const osrmResponse = await fetch(osrmUrl);
    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok') {
      throw new Error("OSRM API error: " + osrmData.code);
    }

    const results = candidates.map((loc, i) => {
      const durationSeconds = osrmData.durations[i][0];
      const distanceMeters = osrmData.distances ? osrmData.distances[i][0] : 0;
      const km = distanceMeters / 1000;
      
      // Fine-tuned Multiplier Logic
      let multiplier = getTrafficMultiplier(loc.lat, loc.lng);
      
      // Distance-based adjustment: Short trips in urban areas take relatively more time due to traffic lights
      if (km < 5 && multiplier >= 1.3) {
        multiplier += 0.15; // Extra penalty for short urban trips (Givatayim style)
      } else if (km > 20) {
        multiplier -= 0.05; // Slightly faster on long inter-city stretches
      }
      
      const rawMinutes = durationSeconds / 60;
      const adjustedMinutes = Math.round(rawMinutes * multiplier);
      const displayKm = km.toFixed(1);
      
      return {
        ...loc,
        minutes: adjustedMinutes,
        km: parseFloat(displayKm),
        durationText: `${adjustedMinutes} דקות`,
        distanceText: `${displayKm} ק"מ`
      };
    }).filter(loc => loc.minutes <= (maxMinutes || 30));

    results.sort((a, b) => a.minutes - b.minutes);

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function getTrafficMultiplier(lat, lng) {
  // Jerusalem Area (Wider radius)
  if (lat > 31.65 && lat < 31.95 && lng > 35.05 && lng < 35.35) return 1.45;
  
  // Gush Dan / Central Israel (The heavy core)
  if (lat > 31.95 && lat < 32.25 && lng > 34.70 && lng < 34.95) return 1.55; // Increased to handle short urban lags
  
  // Sharon Area (Herzliya to Netanya)
  if (lat >= 32.25 && lat < 32.5 && lng > 34.75 && lng < 35.0) return 1.35;
  
  // Haifa & Krayot
  if (lat > 32.7 && lat < 33.05 && lng > 34.9 && lng < 35.2) return 1.25;
  
  // South & Beer Sheva
  if (lat > 30.5 && lat < 31.5) return 1.15;
  
  // North / Galilee
  if (lat >= 33.05) return 1.18;

  return 1.20;
}