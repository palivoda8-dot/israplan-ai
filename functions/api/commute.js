import localities from '../data/localities.json';

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();
    const { destination, maxMinutes, travelMode } = body;

    if (!destination || !destination.lat || !destination.lng) {
      return new Response(JSON.stringify({ error: "Missing destination coordinates" }), { status: 400 });
    }

    let profile = 'driving';
    if (travelMode === 'WALK' || travelMode === 'walking') profile = 'foot';
    if (travelMode === 'BICYCLE' || travelMode === 'bicycling') profile = 'bike';

    const OSRM_BASE_URL = `http://router.project-osrm.org/table/v1/${profile}`;
    const BATCH_SIZE = 40;
    const allResults = [];
    
    for (let i = 0; i < localities.length; i += BATCH_SIZE) {
        const batch = localities.slice(i, i + BATCH_SIZE);
        const batchCoords = [
            `${destination.lng},${destination.lat}`,
            ...batch.map(l => `${l.lng},${l.lat}`)
        ];
        const sources = batch.map((_, idx) => idx + 1).join(';');
        const destinations = '0';
        const url = `${OSRM_BASE_URL}/${batchCoords.join(';')}?sources=${sources}&destinations=${destinations}`;

        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            
            const data = await response.json();
            if (data.code !== 'Ok' || !data.durations) continue;

            batch.forEach((loc, idx) => {
                const durationSeconds = data.durations[idx][0];
                if (durationSeconds === null) return;

                const trafficMultiplier = profile === 'driving' ? (
                    (loc.lat > 31.9 && loc.lat < 32.35 && loc.lng > 34.7 && loc.lng < 35.0) ? 1.30 : 
                    (loc.lat > 31.7 && loc.lat < 31.85 && loc.lng > 35.1 && loc.lng < 35.3) ? 1.25 :
                    (loc.lat > 32.7 && loc.lat < 32.9 && loc.lng > 34.9 && loc.lng < 35.1) ? 1.20 :
                    (loc.lat >= 32.35) ? 1.15 :
                    (loc.lat <= 31.3 && loc.lat >= 30.0) ? 1.12 :
                    (loc.lat < 30.0) ? 1.10 :
                    1.15
                ) : 1.0;
                
                const durationMinutes = Math.round((durationSeconds * trafficMultiplier) / 60);

                if (durationMinutes <= maxMinutes) {
                    allResults.push({
                        ...loc,
                        durationText: `${durationMinutes} דק׳`,
                        durationValue: durationSeconds * trafficMultiplier,
                        distanceText: `${(durationSeconds * 0.015).toFixed(1)} ק״מ`,
                        distanceValue: durationSeconds * 0.015 * 1000
                    });
                }
            });
        } catch (err) {
            console.error(`Batch ${i} failed`, err);
        }
    }

    allResults.sort((a, b) => a.durationValue - b.durationValue);
    return new Response(JSON.stringify({ results: allResults }), {
        headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
