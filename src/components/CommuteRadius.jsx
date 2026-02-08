import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';

const CommuteRadius = () => {
  const [map, setMap] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [travelMode, setTravelMode] = useState('DRIVE');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const markerRef = useRef(null);

  // Default center: Tel Aviv
  const defaultCenter = { lat: 32.0853, lng: 34.7818 };

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    // Initialize with default center if no location selected yet
    if (!selectedLocation) {
        setSelectedLocation(defaultCenter);
    }
  }, []);

  const onMapClick = useCallback((e) => {
    setSelectedLocation({
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    });
  }, []);

  const onMarkerDragEnd = useCallback((e) => {
    setSelectedLocation({
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    });
  }, []);

  const handleSearch = async () => {
    if (!selectedLocation) {
      setError("Please select a location on the map.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
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
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    width: '100%',
    height: '500px'
  };

  if (!isLoaded) return <div>Loading Map...</div>;

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
             {/* Add more options if supported by backend logic later */}
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

      <div className="mb-4 border rounded-lg overflow-hidden">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={selectedLocation || defaultCenter}
          zoom={10}
          onClick={onMapClick}
          onLoad={onMapLoad}
        >
          {selectedLocation && (
            <Marker 
              position={selectedLocation} 
              draggable={true}
              onDragEnd={onMarkerDragEnd}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
              }}
            />
          )}

          {results.map((loc, index) => (
            <Marker
              key={index}
              position={{ lat: loc.lat, lng: loc.lng }}
              label={{
                text: `${loc.durationText}`,
                className: "bg-white text-black p-1 rounded shadow text-xs font-bold"
              }}
              title={`${loc.name} - ${loc.durationText}`}
            />
          ))}
        </GoogleMap>
      </div>

      {results.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Results ({results.length} localities found)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto">
            {results.map((loc, idx) => (
              <div key={idx} className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                <div className="flex-1 min-w-0">
                  <a href="#" className="focus:outline-none">
                    <span className="absolute inset-0" aria-hidden="true" />
                    <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                    <p className="text-sm text-gray-500 truncate">{loc.durationText} ({loc.distanceText})</p>
                  </a>
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
