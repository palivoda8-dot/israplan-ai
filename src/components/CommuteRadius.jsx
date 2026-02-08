import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
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
            <Popup>Destination (Drag me!)</Popup>
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

    const handleSearch = async () => {
        if (!selectedLocation) {
            setError("Please select a location on the map.");
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);

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
                // If backend fails (e.g. 404 because not implemented yet), we might fall back to mock data or just show error
                // For now, let's assume it works or fail gracefully. 
                // If the user didn't have the API key before, maybe the backend also uses Google Maps API?
                // The prompt says "Remove the need for VITE_GOOGLE_MAPS_BROWSER_KEY".
                // If the backend uses Google Maps API (server-side), that's a separate issue, but the prompt is about frontend.
                // I will keep the fetch call active as per original code.
                throw new Error('Failed to fetch commute data');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            setResults(data.results || []);

        } catch (err) {
            console.error(err);
            setError(err.message || "An error occurred.");
            
            // Fallback for demo purposes if API fails (optional, but good for testing without backend)
            // console.warn("Using dummy data due to API error");
            // setResults([...]); 
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4">Commute Radius Calculator</h2>

            <div className="mb-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Max Travel Time (Minutes): {maxMinutes}</label>
                    <input
                        type="range"
                        min="5"
                        max="120"
                        value={maxMinutes}
                        onChange={(e) => setMaxMinutes(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Travel Mode</label>
                    <select
                        value={travelMode}
                        onChange={(e) => setTravelMode(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option value="DRIVE">Driving</option>
                        <option value="TRANSIT">Public Transit</option>
                    </select>
                </div>

                <button
                    onClick={handleSearch}
                    disabled={loading || !selectedLocation}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${loading || !selectedLocation ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                >
                    {loading ? 'Calculating...' : 'Find Commutable Localities'}
                </button>

                {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
            </div>

            <div className="mb-4 border rounded-lg overflow-hidden h-[500px]">
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

                    {results.map((loc, index) => (
                        <Marker
                            key={index}
                            position={{ lat: loc.lat, lng: loc.lng }}
                        >
                            <Popup>
                                <strong>{loc.name}</strong><br />
                                {loc.durationText} ({loc.distanceText})
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {results.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Results ({results.length} localities found)</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto">
                        {results.map((loc, idx) => (
                            <div key={idx} className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                <div className="flex-1 min-w-0">
                                    <span className="absolute inset-0" aria-hidden="true" />
                                    <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                                    <p className="text-sm text-gray-500 truncate">{loc.durationText} ({loc.distanceText})</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommuteRadius;
