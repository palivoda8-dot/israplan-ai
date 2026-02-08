import React, { useState, useMemo, useRef } from 'react';
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

    const handleSearch = async () => {
        if (!selectedLocation) {
            setError("אנא בחר מיקום על המפה.");
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

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg" dir="rtl">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">מחשבון אזורי יוממות</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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

                    {results.map((loc, index) => (
                        <Marker
                            key={index}
                            position={{ lat: loc.lat, lng: loc.lng }}
                        >
                            <Popup>
                                <div className="text-right" dir="rtl">
                                    <strong className="text-lg">{loc.name}</strong><br />
                                    <span className="text-gray-600">{loc.durationText} ({loc.distanceText})</span>
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
