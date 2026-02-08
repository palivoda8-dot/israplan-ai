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

    // To provide a "serious and good" answer, we sort by air distance first 
    // but we increase the limit to 200 localities to be more comprehensive.
    const sortedLocalities = localities
      .map(loc => ({
        ...loc,
        airDist: Math.sqrt(Math.pow(loc.lat - destination.lat, 2) + Math.pow(loc.lng - destination.lng, 2))
      }))
      .sort((a, b) => a.airDist - b.airDist)
      .slice(0, 200);

    const coords = sortedLocalities.map(loc => `${loc.lng},${loc.lat}`).join(';');
    const allCoords = `${destination.lng},${destination.lat};${coords}`;
    
    const sourceIndices = Array.from({length: sortedLocalities.length}, (_, i) => i + 1).join(';');
    const osrmUrl = `https://router.project-osrm.org/table/v1/${profile}/${allCoords}?sources=${sourceIndices}&destinations=0&annotations=duration,distance`;

    const osrmResponse = await fetch(osrmUrl);
    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok') {
      throw new Error("OSRM API error: " + osrmData.code);
    }

    const results = sortedLocalities.map((loc, i) => {
      const durationSeconds = osrmData.durations[i][0];
      const distanceMeters = osrmData.distances ? osrmData.distances[i][0] : 0;
      const minutes = Math.round(durationSeconds / 60);
      const km = (distanceMeters / 1000).toFixed(1);
      
      return {
        ...loc,
        minutes: minutes,
        km: parseFloat(km),
        durationText: `${minutes} דקות`,
        distanceText: `${km} ק"מ`
      };
    }).filter(loc => loc.minutes <= (maxMinutes || 30));

    results.sort((a, b) => a.minutes - b.minutes);

    return new Response(JSON.stringify({ results }), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache" // Ensure no caching for live testing
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}