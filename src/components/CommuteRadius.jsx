import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Configure the default icon globally
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
});

// Component to handle map clicks and draggable marker
const LocationMarker = ({ position, setPosition }) => {
    const markerRef = useRef(null);
    const map = useMap();

    useEffect(() => {
        if (position) {
            map.flyTo(position, 13);
        }
    }, [position, map]);

    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (marker != null) {
                    setPosition(marker.getLatLng());
                }
            },
        }),
        [setPosition],
    );

    useMapEvents({
        click(e) {
            setPosition(e.latlng);
        },
    });

    return position === null ? null : (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
        >
            <Popup>גרור אותי כדי לשנות מיקום</Popup>
        </Marker>
    );
};

const CommuteRadius = () => {
    const defaultCenter = { lat: 32.0853, lng: 34.7818 }; // Tel Aviv
    const [selectedLocation, setSelectedLocation] = useState(defaultCenter);
    const [maxMinutes, setMaxMinutes] = useState(30);
    const [travelMode, setTravelMode] = useState('DRIVE');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // New state variables
    const [addressQuery, setAddressQuery] = useState('');
    const [addressResults, setAddressResults] = useState([]);
    const [detailedRoute, setDetailedRoute] = useState(null); // For storing geometry of a specific route

    const handleAddressSearch = async () => {
        if (!addressQuery) return;
        
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&countrycodes=il`);
            const data = await response.json();
            setAddressResults(data);
        } catch (err) {
            console.error("Address search failed", err);
            setError("שגיאה בחיפוש כתובת");
        }
    };

    const selectAddress = (result) => {
        const newLocation = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
        setSelectedLocation(newLocation);
        setAddressResults([]); // Clear search results
        setAddressQuery(result.display_name); // Update input with full name
        setDetailedRoute(null); // Clear any previous route
        setResults([]); // Clear previous commute results
    };

    const handleSearch = async () => {
        if (!selectedLocation) {
            setError("אנא בחר מיקום על המפה.");
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);
        setDetailedRoute(null);

        try {
            // Use the real API endpoint
            const response = await fetch('/api/commute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination: selectedLocation,
                    maxMinutes: maxMinutes,
                    travelMode: travelMode
                })
            });

            if (!response.ok) {
                throw new Error('שגיאה בחישוב הנתונים');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            setResults(data.results || []);

        } catch (err) {
            console.error(err);
            setError(err.message || "אירעה שגיאה.");
        } finally {
            setLoading(false);
        }
    };

    const fetchDetailedRoute = async (destination) => {
        if (!selectedLocation) return;
        
        try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${selectedLocation.lng},${selectedLocation.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`);
            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // Swap to lat,lng
                setDetailedRoute({
                    positions: coordinates,
                    summary: route.legs[0]?.summary
                });
            }
        } catch (err) {
            console.error("Failed to fetch route", err);
            // Non-critical error, maybe just alert or log
        }
    };

    const NavigationLinks = ({ destLat, destLng, mode, originLat, originLng }) => {
        if (mode === 'DRIVE') {
            return (
                <div className="flex gap-2 mt-2 flex-wrap">
                    <a 
                        href={`https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes&from=${originLat},${originLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 border border-blue-200"
                        title="נווט עם Waze"
                    >
                        🚗 Waze
                    </a>
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 border border-green-200"
                        title="נווט עם Google Maps"
                    >
                        🗺️ Maps
                    </a>
                </div>
            );
        } else {
            // Transit / Other
            return (
                <div className="flex gap-2 mt-2 flex-wrap">
                    <a 
                        href={`https://moovitapp.com/?from=Lat_${originLat}_Lon_${originLng}&to=Lat_${destLat}_Lon_${destLng}&tll=${destLat}_${destLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 border border-orange-200"
                        title="נווט עם Moovit"
                    >
                        🚌 Moovit
                    </a>
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=transit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 border border-green-200"
                        title="נווט עם Google Maps (תחב״צ)"
                    >
                        🗺️ Maps
                    </a>
                </div>
            );
        }
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg" dir="rtl">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">מחשבון אזורי יוממות</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                
                {/* Address Search */}
                <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100 relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">הכנס כתובת מוצא</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={addressQuery}
                            onChange={(e) => setAddressQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                            placeholder="תל אביב, ירושלים..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button 
                            onClick={handleAddressSearch}
                            className="bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700"
                        >
                            חפש
                        </button>
                    </div>
                    {addressResults.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                            {addressResults.map((result) => (
                                <li 
                                    key={result.place_id} 
                                    onClick={() => selectAddress(result)}
                                    className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b last:border-0"
                                >
                                    {result.display_name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        זמן נסיעה מקסימלי: <span className="text-indigo-600">{maxMinutes} דקות</span>
                    </label>
                    <input
                        type="range"
                        min="5"
                        max="120"
                        value={maxMinutes}
                        onChange={(e) => setMaxMinutes(parseInt(e.target.value))}
                        className="w-full h-2 bg-gradient-to-r from-blue-300 to-indigo-500 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">אופן הגעה</label>
                    <select
                        value={travelMode}
                        onChange={(e) => setTravelMode(e.target.value)}
                        className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                        <option value="DRIVE">רכב פרטי</option>
                        <option value="TRANSIT">תחבורה ציבורית</option>
                    </select>
                </div>

                <div className="flex items-end">
                    <button
                        onClick={handleSearch}
                        disabled={loading || !selectedLocation}
                        className={`w-full py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white transition-colors duration-200 
                            ${loading || !selectedLocation 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                    >
                        {loading ? 'מחשב...' : 'חשב אזורי יוממות'}
                    </button>
                </div>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">{error}</div>}

            <div className="mb-6 border-2 border-gray-200 rounded-xl overflow-hidden h-[500px] shadow-inner relative z-0">
                <MapContainer
                    center={defaultCenter}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    <LocationMarker position={selectedLocation} setPosition={setSelectedLocation} />

                    {/* Spider Lines (Star Pattern) */}
                    {selectedLocation && results.map((loc, index) => (
                        <Polyline
                            key={`line-${index}`}
                            positions={[
                                [selectedLocation.lat, selectedLocation.lng],
                                [loc.lat, loc.lng]
                            ]}
                            pathOptions={{ color: '#8b5cf6', weight: 3, opacity: 0.6, dashArray: '10, 10' }}
                        />
                    ))}

                    {/* Detailed Route */}
                    {detailedRoute && (
                         <Polyline
                            positions={detailedRoute.positions}
                            pathOptions={{ color: 'blue', weight: 5, opacity: 0.8 }}
                        >
                             <Popup>מסלול נסיעה {detailedRoute.summary ? `(דרך ${detailedRoute.summary})` : ''}</Popup>
                        </Polyline>
                    )}

                    {results.map((loc, index) => (
                        <Marker
                            key={index}
                            position={{ lat: loc.lat, lng: loc.lng }}
                        >
                            <Popup>
                                <div className="text-right" dir="rtl">
                                    <strong className="text-lg">{loc.name}</strong><br />
                                    <span className="text-gray-600">{loc.durationText} ({loc.distanceText})</span><br/>
                                    <div className="flex flex-col gap-1 mt-2">
                                        <button 
                                            onClick={() => fetchDetailedRoute(loc)}
                                            className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 w-full text-center"
                                        >
                                            הצג מסלול
                                        </button>
                                        <NavigationLinks destLat={loc.lat} destLng={loc.lng} mode={travelMode} originLat={selectedLocation.lat} originLng={selectedLocation.lng} />
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {results.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 px-2 border-r-4 border-indigo-500">תוצאות ({results.length} ישובים נמצאו)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-2 custom-scrollbar">
                        {results.map((loc, idx) => (
                            <div key={idx} className="relative group bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-indigo-300">
                                <div className="flex flex-col">
                                    <p className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{loc.name}</p>
                                    <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">{loc.durationText}</span>
                                        <span>{loc.distanceText}</span>
                                    </div>
                                    <div className="flex flex-col gap-2 mt-3">
                                        <button 
                                            onClick={() => fetchDetailedRoute(loc)}
                                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium text-right"
                                        >
                                            הצג מסלול על המפה
                                        </button>
                                        <NavigationLinks destLat={loc.lat} destLng={loc.lng} mode={travelMode} originLat={selectedLocation.lat} originLng={selectedLocation.lng} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        <strong>שימו לב:</strong> זמני הנסיעה מחושבים על סמך ממוצעים (OSRM) וכוללים תוספת משוערת לפקקים. 
                        לזמן אמת מדויק, מומלץ להשתמש בקישורי Waze/Google Maps המצורפים לכל תוצאה.
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                        <p className="text-gray-600 mb-4">נהנים מהכלי? עזרו לנו להחזיק את השרתים באוויר 🚀</p>
                        <div className="flex justify-center gap-4">
                            <a href="#" className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2 px-6 rounded-full shadow-md transition-colors flex items-center gap-2">
                                ☕ תמיכה באתר
                            </a>
                            <div className="bg-gray-100 border border-gray-300 text-gray-500 py-2 px-6 rounded-full text-xs flex items-center">
                                [מקום לפרסומת / חסות]
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommuteRadius;