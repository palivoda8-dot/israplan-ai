import localities from '../data/localities.json';

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();
    const { destination, maxMinutes, travelMode } = body;

    if (!destination || !destination.lat || !destination.lng) {
      return new Response(JSON.stringify({ error: "Missing destination coordinates" }), { status: 400 });
    }

    if (!maxMinutes) {
      return new Response(JSON.stringify({ error: "Missing maxMinutes" }), { status: 400 });
    }

    // Map travelMode to OSRM profiles
    let profile = 'driving';
    if (travelMode === 'WALK' || travelMode === 'walking') profile = 'foot';
    if (travelMode === 'BICYCLE' || travelMode === 'bicycling') profile = 'bike';

    const OSRM_BASE_URL = `http://router.project-osrm.org/table/v1/${profile}`;
    const BATCH_SIZE = 40;
    const allResults = [];

    // Pre-filter localities based on straight-line distance to save OSRM requests
    const maxEstimatedKm = maxMinutes * 2.5; 
    const filteredLocalities = localities.filter(loc => {
        const dist = getDistanceFromLatLonInKm(destination.lat, destination.lng, loc.lat, loc.lng);
        return dist <= maxEstimatedKm;
    });

    for (let i = 0; i < filteredLocalities.length; i += BATCH_SIZE) {
        const batch = filteredLocalities.slice(i, i + BATCH_SIZE);
        const batchCoords = [
            `${destination.lng},${destination.lat}`,
            ...batch.map(l => `${l.lng},${l.lat}`)
        ];
        const sources = batch.map((_, idx) => idx + 1).join(';');
        const destinations = '0';
        const url = `${OSRM_BASE_URL}/${batchCoords.join(';')}?sources=${sources}&destinations=${destinations}`;

        let success = false;
        let retries = 2;

        while (!success && retries > 0) {
            try {
                const response = await fetch(url);
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 500));
                    retries--;
                    continue;
                }
                
                if (!response.ok) throw new Error(`OSRM batch failed: ${response.status}`);
                
                const data = await response.json();
                if (data.code !== 'Ok' || !data.durations) {
                    retries--;
                    continue;
                }

                success = true;
                batch.forEach((loc, idx) => {
                    const durationRow = data.durations[idx];
                    if (!durationRow) return;
                    
                    const durationSeconds = durationRow[0];
                    if (durationSeconds === null) return;

                    const multiplier = profile === 'driving' ? (
                        (loc.lat > 31.9 && loc.lat < 32.35 && loc.lng > 34.7 && loc.lng < 35.0) ? 1.30 : 
                        (loc.lat > 31.7 && loc.lat < 31.85 && loc.lng > 35.1 && loc.lng < 35.3) ? 1.25 :
                        (loc.lat > 32.7 && loc.lat < 32.9 && loc.lng > 34.9 && loc.lng < 35.1) ? 1.20 :
                        (loc.lat >= 32.35) ? 1.15 :
                        (loc.lat <= 31.3 && loc.lat >= 30.0) ? 1.12 :
                        (loc.lat < 30.0) ? 1.10 :
                        1.15
                    ) : 1.0;
                    
                    const durationMinutes = Math.round((durationSeconds * multiplier) / 60);

                    if (durationMinutes <= maxMinutes) {
                        allResults.push({
                            ...loc,
                            durationText: `${durationMinutes} דק׳`,
                            durationValue: durationSeconds * multiplier,
                            distanceText: `${(durationSeconds * 0.015).toFixed(1)} ק״מ`,
                            distanceValue: durationSeconds * 0.015 * 1000
                        });
                    }
                });
            } catch (err) {
                console.error(`Batch retry failed`, err);
                retries--;
                if (retries > 0) await new Promise(r => setTimeout(r, 300));
            }
        }
    }

    // FINAL FALLBACK: If OSRM returned nothing or failed completely, use calculation logic
    if (allResults.length === 0) {
        return calculateFallback(destination, maxMinutes);
    }

    allResults.sort((a, b) => a.durationValue - b.durationValue);
    return new Response(JSON.stringify({ results: allResults }), {
        headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

function calculateFallback(destination, maxMinutes) {
    const results = [];
    const maxKm = maxMinutes * 1.0; 

    for (const loc of localities) {
        const distKm = getDistanceFromLatLonInKm(destination.lat, destination.lng, loc.lat, loc.lng);
        if (distKm <= maxKm) {
             results.push({
                ...loc,
                durationText: `~${Math.round(distKm)} דק׳`,
                durationValue: distKm * 60,
                distanceText: `${distKm.toFixed(1)} ק״מ`,
                distanceValue: distKm * 1000
            });
        }
    }
    results.sort((a, b) => a.durationValue - b.durationValue);
    
    return new Response(JSON.stringify({ 
        results, 
        warning: "Used straight-line distance fallback (OSRM unavailable)" 
    }), {
        headers: { "Content-Type": "application/json" },
    });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}