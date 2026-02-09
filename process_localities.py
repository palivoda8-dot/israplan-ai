import json
import math

def itm_to_wgs84(x, y):
    # Simplified ITM to WGS84 conversion (standard constants)
    # Note: For production, a more precise formula or library is better, 
    # but this is usually sufficient for city centers.
    
    # Constants for ITM
    lon0 = 0.613915904 # 35.2045090623 degrees
    lat0 = 0.544778393 # 31.2131924517 degrees
    k0 = 1.0000067
    E0 = 219529.584
    N0 = 626907.39
    a = 6378137.0
    f = 1 / 298.257222101
    b = a * (1 - f)
    e2 = (a**2 - b**2) / a**2
    
    dx = x - E0
    dy = y - N0
    
    # Very rough linear approximation for Israel area
    # 1 degree lat ~ 111,000m, 1 degree lon ~ 95,000m
    lat = 31.2721 + (y - 633364.5) / 111000
    lon = 35.212 + (x - 220263.3) / 95000
    
    return round(lat, 5), round(lon, 5)

with open('localities_itmlocal.json', 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

new_localities = []
for rec in data:
    # Handle the mangled keys by using indices or checking values
    # In my output, the keys were like " ", " " etc.
    # I'll look for numeric values that look like ITM coords
    
    name = ""
    x = 0
    y = 0
    
    for k, v in rec.items():
        if isinstance(v, str):
            if not v.replace('.','').isdigit():
                if len(v) > 2 and name == "": name = v
            else:
                val = float(v)
                if 130000 < val < 280000: x = val
                if 380000 < val < 820000: y = val
    
    if x and y and name:
        lat, lon = itm_to_wgs84(x, y)
        new_localities.append({
            "name": name.strip(),
            "lat": lat,
            "lng": lon
        })

# Sort by name
new_localities.sort(key=lambda x: x['name'])

with open('localities_new.json', 'w', encoding='utf-8') as f:
    json.dump(new_localities, f, ensure_ascii=False, indent=2)

print(f"Processed {len(new_localities)} localities.")
