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

    const url = new URL(request.url);
    const localitiesUrl = `${url.origin}/data/localities.json`;
    const locRes = await fetch(localitiesUrl);
    
    if (!locRes.ok) {
      throw new Error("Could not load localities data");
    }
    
    const localities = await locRes.json();
    const profile = (travelMode === 'WALK' || travelMode === 'walking') ? 'foot' :
                    (travelMode === 'BICYCLE' || travelMode === 'bicycling') ? 'bicycle' : 'car';

    // Haversine filter
    const filteredLocalities = localities.filter(loc => {
      const dLat = (loc.lat - destination.lat) * Math.PI / 180;
      const dLon = (loc.lng - destination.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(destination.lat * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return (6371 * c) <= 120; // Up to 120km
    }).slice(0, 150);

    if (filteredLocalities.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const coords = filteredLocalities.map(loc => `${loc.lng},${loc.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/table/v1/${profile}/${destination.lng},${destination.lat};${coords}?sources=0&annotations=duration,distance`;

    const osrmResponse = await fetch(osrmUrl);
    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok') {
      throw new Error("OSRM error");
    }

    const results = filteredLocalities.map((loc, i) => {
      const durationSeconds = osrmData.durations[0][i+1];
      const distanceMeters = osrmData.distances ? osrmData.distances[0][i+1] : 0;
      const minutes = Math.round(durationSeconds / 60);
      const km = parseFloat((distanceMeters / 1000).toFixed(1));
      
      return {
        ...loc,
        minutes: minutes,
        km: km,
        durationText: `${minutes} דק'`,
        distanceText: `${km} ק"מ`
      };
    }).filter(loc => loc.minutes <= (maxMinutes || 30));

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