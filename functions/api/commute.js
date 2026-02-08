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

    // Phase 1: Pre-filter by air distance to limit OSRM batch size (250 closest)
    const candidates = localities
      .map(loc => ({
        ...loc,
        airDist: Math.sqrt(Math.pow(loc.lat - destination.lat, 2) + Math.pow(loc.lng - destination.lng, 2))
      }))
      .sort((a, b) => a.airDist - b.airDist)
      .slice(0, 250);

    const coords = candidates.map(loc => `${loc.lng},${loc.lat}`).join(';');
    const allCoords = `${destination.lng},${destination.lat};${coords}`;
    
    // sourceIndices 1..N (localities), destinations 0 (user point)
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
      
      // Calculate multiplier based on location
      const multiplier = getTrafficMultiplier(loc.lat, loc.lng);
      
      const rawMinutes = durationSeconds / 60;
      const adjustedMinutes = Math.round(rawMinutes * multiplier);
      const km = (distanceMeters / 1000).toFixed(1);
      
      return {
        ...loc,
        minutes: adjustedMinutes,
        km: parseFloat(km),
        durationText: `${adjustedMinutes} דקות`,
        distanceText: `${km} ק"מ`
      };
    }).filter(loc => loc.minutes <= (maxMinutes || 30));

    results.sort((a, b) => a.minutes - b.minutes);

    return new Response(JSON.stringify({ results }), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function getTrafficMultiplier(lat, lng) {
  // גבולות גיאוגרפיים משוערים לישראל
  
  // ירושלים (רדיוס סביב העיר) - הוחמר ל-1.40
  if (lat > 31.7 && lat < 31.9 && lng > 35.1 && lng < 35.3) return 1.40;
  
  // מרכז / גוש דן (נתניה עד אשדוד) - הוחמר ל-1.45
  if (lat > 31.8 && lat < 32.4 && lng > 34.7 && lng < 35.0) return 1.45;
  
  // חיפה והקריות
  if (lat > 32.7 && lat < 33.0 && lng > 34.9 && lng < 35.2) return 1.20;
  
  // אילת והערבה (דרומית למצפה רמון)
  if (lat < 30.0) return 1.10;
  
  // דרום / באר שבע
  if (lat > 30.0 && lat < 31.5) return 1.12;
  
  // צפון (צפונית לחיפה/טבריה)
  if (lat >= 33.0) return 1.15;

  // ברירת מחדל
  return 1.15;
}