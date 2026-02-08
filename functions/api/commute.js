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

    // OSRM Table API limits. We'll take the 150 closest by air distance
    const sortedLocalities = localities
      .map(loc => ({
        ...loc,
        airDist: Math.sqrt(Math.pow(loc.lat - destination.lat, 2) + Math.pow(loc.lng - destination.lng, 2))
      }))
      .sort((a, b) => a.airDist - b.airDist)
      .slice(0, 150);

    const coords = sortedLocalities.map(loc => `${loc.lng},${loc.lat}`).join(';');
    const allCoords = `${destination.lng},${destination.lat};${coords}`;
    
    const sourceIndices = Array.from({length: sortedLocalities.length}, (_, i) => i + 1).join(';');
    const osrmUrl = `https://router.project-osrm.org/table/v1/${profile}/${allCoords}?sources=${sourceIndices}&destinations=0`;

    const osrmResponse = await fetch(osrmUrl);
    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok') {
      throw new Error("OSRM API error: " + osrmData.code);
    }

    const results = sortedLocalities.map((loc, i) => {
      const durationSeconds = osrmData.durations[i][0];
      return {
        ...loc,
        minutes: Math.round(durationSeconds / 60)
      };
    }).filter(loc => loc.minutes <= (maxMinutes || 30));

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