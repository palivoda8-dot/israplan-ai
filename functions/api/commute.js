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
    // OSRM public demo doesn't support 'transit'. Fallback to driving or just warn.
    // For now, driving is the safest default for "commute".

    const OSRM_BASE_URL = `http://router.project-osrm.org/table/v1/${profile}`;

    // OSRM expects: /table/v1/driving/{lon},{lat};{lon},{lat}...?sources=...&destinations=...

    // 3. Construct URL
    // Public OSRM server limits are strict. 
    // Instead of one giant request which might hit length limits, let's batch them.
    // 25 localities per batch is safer.

    // We allow a larger batch size to process more localities at once.
    // Note: Public OSRM server has URL length limits. If localities grow > 100, we might need to lower this or switch to POST.
    const BATCH_SIZE = 50;
    const allResults = [];
    
    // We process localities in chunks
    for (let i = 0; i < localities.length; i += BATCH_SIZE) {
        const batch = localities.slice(i, i + BATCH_SIZE);
        
        // Prepare coords for this batch: [destination, ...batchLocalities]
        // Index 0 is destination. Indices 1..batch.length are the batch localities.
        const batchCoords = [
            `${destination.lng},${destination.lat}`,
            ...batch.map(l => `${l.lng},${l.lat}`)
        ];

        // Sources: indices 1 to batch.length
        const sources = batch.map((_, idx) => idx + 1).join(';');
        // Destination: index 0
        const destinations = '0';

        const url = `${OSRM_BASE_URL}/${batchCoords.join(';')}?sources=${sources}&destinations=${destinations}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`OSRM batch failed: ${response.status}`);
            
            const data = await response.json();
            if (data.code !== 'Ok' || !data.durations) continue;

            // data.durations is array of arrays: [ [dur_src1_to_dest], [dur_src2_to_dest]... ]
            // correspond to batch[0], batch[1]...
            
            batch.forEach((loc, idx) => {
                const durationRow = data.durations[idx];
                if (!durationRow) return;
                
                const durationSeconds = durationRow[0];
                if (durationSeconds === null) return;

                // Accuracy improvement: Add traffic buffer (15%) for driving
                // OSRM provides free-flow speeds. Real life has traffic.
                const trafficMultiplier = profile === 'driving' ? 1.15 : 1.0;
                const durationMinutes = Math.round((durationSeconds * trafficMultiplier) / 60);

                if (durationMinutes <= maxMinutes) {
                    allResults.push({
                        ...loc,
                        durationText: `${durationMinutes} min`,
                        durationValue: durationSeconds * trafficMultiplier,
                        distanceText: "Calc by OSRM",
                        distanceValue: 0
                    });
                }
            });

        } catch (err) {
            console.error(`Batch ${i} failed`, err);
        }
        
        // Removed artificial delay to speed up processing
    }

    // Sort by duration
    allResults.sort((a, b) => a.durationValue - b.durationValue);

    return new Response(JSON.stringify({ results: allResults }), {
        headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Fallback function: Straight line distance estimation
// Rough estimation: 1km ~ 1-1.5 minutes driving in mixed conditions (very rough)
function calculateFallback(destination, maxMinutes) {
    const results = [];
    // Assume 60km/h average speed => 1km per minute. 
    // This is optimistic but sufficient for a fallback "radius".
    const maxKm = maxMinutes * 1.0; 

    for (const loc of localities) {
        const distKm = getDistanceFromLatLonInKm(destination.lat, destination.lng, loc.lat, loc.lng);
        if (distKm <= maxKm) {
             results.push({
                ...loc,
                durationText: `~${Math.round(distKm)} min (est)`,
                durationValue: distKm * 60,
                distanceText: `${distKm.toFixed(1)} km`,
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
  const R = 6371; // Radius of the earth in km
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
