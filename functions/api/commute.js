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

    // Selection of 150 closest by air distance to stay within OSRM limits
    const sortedLocalities = localities
      .map(loc => ({
        ...loc,
        airDist: Math.sqrt(Math.pow(loc.lat - destination.lat, 2) + Math.pow(loc.lng - destination.lng, 2))
      }))
      .sort((a, b) => a.airDist - b.airDist)
      .slice(0, 150);

    const coords = sortedLocalities.map(loc => `${loc.lng},${loc.lat}`).join(';');
    const allCoords = `${destination.lng},${destination.lat};${coords}`;
    
    // sourceIndices 1..N (localities), destinations 0 (user point)
    const sourceIndices = Array.from({length: sortedLocalities.length}, (_, i) => i + 1).join(';');
    // Requesting both durations and distances
    const osrmUrl = `https://router.project-osrm.org/table/v1/${profile}/${allCoords}?sources=${sourceIndices}&destinations=0&annotations=duration,distance`;

    const osrmResponse = await fetch(osrmUrl);
    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok') {
      throw new Error("OSRM API error: " + osrmData.code);
    }

    const results = sortedLocalities.map((loc, i) => {
      const durationSeconds = osrmData.durations[i][0];
      const distanceMeters = osrmData.distances ? osrmData.distances[i][0] : 0;
      
      return {
        ...loc,
        minutes: Math.round(durationSeconds / 60),
        km: parseFloat((distanceMeters / 1000).toFixed(1))
      };
    }).filter(loc => loc.minutes <= (maxMinutes || 30));

    // Sort by minutes for a cleaner result
    results.sort((a, b) => a.minutes - b.minutes);

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}