export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const body = await request.json();
    const { destination, maxMinutes, travelMode } = body;

    console.log("Commute Request:", { destination, maxMinutes, travelMode });

    if (!destination || !destination.lat || !destination.lng) {
      return new Response(JSON.stringify({ error: "Missing destination" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch localities.json using a relative URL to ensure it works in Pages
    const url = new URL(request.url);
    const localitiesUrl = `${url.origin}/data/localities.json`;
    const locRes = await fetch(localitiesUrl);
    
    if (!locRes.ok) {
      return new Response(JSON.stringify({ error: "Could not load localities data from " + localitiesUrl }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const localities = await locRes.json();

    const profile = (travelMode === 'WALK' || travelMode === 'walking') ? 'foot' :
                    (travelMode === 'BICYCLE' || travelMode === 'bicycling') ? 'bicycle' : 'car';

    // Haversine distance for initial filtering (100km radius) to stay efficient
    const filteredLocalities = localities.filter(loc => {
      const dLat = (loc.lat - destination.lat) * Math.PI / 180;
      const dLon = (loc.lng - destination.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(destination.lat * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return (6371 * c) <= 100; // Only check places within 100km
    }).slice(0, 100);

    if (filteredLocalities.length === 0) {
      return new Response(JSON.stringify({ results: [], message: "No localities within 100km" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const coords = filteredLocalities.map(loc => `${loc.lng},${loc.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/table/v1/${profile}/${destination.lng},${destination.lat};${coords}?sources=0&annotations=duration,distance`;

    const osrmResponse = await fetch(osrmUrl);
    const osrmData = await osrmResponse.json();

    if (osrmData.code !== 'Ok') {
      throw new Error("OSRM error: " + osrmData.code);
    }

    const results = filteredLocalities.map((loc, i) => {
      const durationSeconds = osrmData.durations[0][i+1]; // index 0 is destination, sources are 1..N
      const distanceMeters = osrmData.distances ? osrmData.distances[0][i+1] : 0;
      
      return {
        ...loc,
        minutes: Math.round(durationSeconds / 60),
        km: parseFloat((distanceMeters / 1000).toFixed(1))
      };
    }).filter(loc => loc.minutes <= (maxMinutes || 30));

    results.sort((a, b) => a.minutes - b.minutes);

    return new Response(JSON.stringify({ results }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}