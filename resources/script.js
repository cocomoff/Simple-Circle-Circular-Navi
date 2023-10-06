mapboxgl.accessToken = 'pk.eyJ1IjoiY29jb21vZmYiLCJhIjoiY2xqZmdjcHZjMDBzMDNlcHE2bmpsamo1ayJ9.9192GebOXRPVOWlXu-zvPw'
const method = "POST"

const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

// nihonbashi
var map_center = [139.7727, 35.677]

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v9',
    center: map_center,
    zoom: 15
});

var canvas = map.getCanvasContainer();
var currentTrackingID = -1;
var pathColorAlpha = 0.8;

// marker point
var point_geojson = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": map_center
        },
        properties: {
            "id": 1
        }
    }]
};

// intermediate markers
var midpoint_geojson = {
    "type": "FeatureCollection",
    "features": []
}

// polyline (path)
var line = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": []
        }
    }]
};


function onMove(e) {
    var coords = e.lngLat;

    listLngLat.push(e.lngLat);

    // Set a UI indicator for dragging.
    map.setPaintProperty('line', 'line-opacity', 0.2);
    canvas.style.cursor = 'grabbing';

    // 表示更新
    // setLatLngStr(coords);
    // info_distance.innerHTML = '';
    canvas.style.cursor = '';

    // クリックしたマーカーの位置を更新
    point_geojson.features[0].geometry.coordinates = [coords.lng, coords.lat];
    map.getSource('point').setData(point_geojson);
}


function onUp(e) {
    var coords = e.lngLat;

    // 表示更新
    // setLatLngStr(coords);
    canvas.style.cursor = '';

    // Unbind mouse/touch events
    map.off('mousemove', onMove);
    map.off('touchmove', onMove);
}

map.on('load', function () {
    map.resize();
    map.loadImage(
        'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
        (error, image) => {
        if (error)
            throw error;
        map.addImage('custom-marker', image);
    });

    // マーカー点の情報
    map.addSource('point', {
        "type": "geojson",
        "data": point_geojson
    });
    map.addSource('midpoint', {
        "type": "geojson",
        "data": midpoint_geojson
    });
    
    // 検索した経路
    map.addLayer({
        'id': 'line',
        'type': 'line',
        'source': {
            'type': 'geojson',
            'data': line
        },
        'layout': {
            'line-cap': 'round',
            'line-join': 'round'
        },
        'paint': {
            'line-color': '#ed6498',
            'line-width': 5,
            'line-opacity': pathColorAlpha
        }
    });

    // マーカー点のレイヤー
    map.addLayer({
        "id": "point",
        "type": "circle",
        "source": "point",
        paint: {
            'circle-color': '#6B7FD7',
            'circle-radius': 12,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#000'
        }
    });

    map.addLayer({
        "id": "midpoint",
        "type": "circle",
        "source": "midpoint",
        paint: {
            'circle-color': '#FF00CC',
            'circle-radius': 6,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#000'
        }
    });
    
    /** START point */
    map.on('mouseenter', 'point', function () {
        map.setPaintProperty('point', 'circle-color', '#3bb2d0');
        canvas.style.cursor = 'move';
    });

    map.on('mouseleave', 'point', function () {
        map.setPaintProperty('point', 'circle-color', '#3887be');
        canvas.style.cursor = '';
    });

    map.on('mousedown', 'point', function (e) {
        currentTrackingID = e.features[0].properties.id;
        e.preventDefault();

        // clear prev history
        listLngLat = [];
        canvas.style.cursor = 'grab';

        map.on('mousemove', onMove);
        map.once('mouseup', onUp);
    });

    map.on('touchstart', 'point', function (e) {
        if (e.points.length !== 1) return;

        // Prevent the default map drag behavior.
        e.preventDefault();

        map.on('touchmove', onMove);
        map.once('touchend', onUp);
    });
});

function generatePoints(px, py, R, K) {
    // Generate a random angle between 0 and 2*pi
    let sampleTheta = Math.random() * 2 * Math.PI;
    
    // Calculate a second point (ox, oy) that is 2*R away from (px, py)
    let ox = px + 2 * R * Math.cos(sampleTheta);
    let oy = py + 2 * R * Math.sin(sampleTheta);
    
    // Calculate the center (cx, cy) of the circle
    let cx = (px + ox) / 2;
    let cy = (py + oy) / 2;
    
    // Calculate the angle of (px, py) relative to (cx, cy)
    let ptheta = Math.atan2(oy - py, ox - px);
    
    // Initialize an array to store the points
    let points = new Array(K).fill(null).map(() => [0, 0]);
    
    // Generate K points on the circle
    for (let i = 0; i < K; i++) {
        // Divide the circle into K segments
        let angle = ptheta + (2 * Math.PI * i) / K + Math.PI;
        
        // Add a small random noise to the angle, except for the first point
        let Ki = i === 0 ? 0 : Math.floor(Math.random() * 36) + 1;
        
        // Convert the polar coordinates to Cartesian coordinates
        let xi = cx + R * Math.cos(angle + (Math.PI / 180) * Ki);
        let yi = cy + R * Math.sin(angle + (Math.PI / 180) * Ki);
        
        // Store the point
        points[i] = [xi, yi];
    }
    
    return points;
}


// circular function
async function computeCircularByAPI(pS, dist) {
    let K = 3
    let points = generatePoints(pS[0], pS[1], dist * 1e-3, K)
    midpoint_geojson.features = [];
    for (var i = 1; i < points.length; i++) {
        console.log(points[i]);
        midpoint_geojson.features.push({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [points[i][0], points[i][1]]
            }
        })
    }

    // routes
    line.features[0].geometry.coordinates = [];
    for (let i = 0; i < points.length; i++) {
        let j = (i + 1) % K;
        var query_str = points[i][0] + "," + points[i][1] + ";" + points[j][0] + "," + points[j][1];
        var url_dir = "https://api.mapbox.com/directions/v5/mapbox/walking/" + query_str;
        url_dir += "?alternatives=true&continue_straight=true&geometries=geojson&overview=simplified&steps=true";
        url_dir += "&access_token=" + mapboxgl.accessToken
        console.log(i + " --> " + j);
        console.log(url_dir);

        res = await fetch(url_dir)
        .then(res => res.json())
        .then(route => {
            console.log(route);
            if (route.code == "Ok") {
                var R = route.routes[0];
                var res = R.geometry.coordinates;
                for (let j of res) {
                    console.log(j)
                    line.features[0].geometry.coordinates.push(j);
                }
            }
        })
    }

    console.log(line.features[0].geometry.coordinates)
    map.getSource('line').setData(line);
    map.getSource('midpoint').setData(midpoint_geojson);
}


// HTML5
async function run_compute_route() {
    // get algorithm setting
    const elements = document.getElementsByName('algorithm');

    // get routing setting
    var input_distance = Number(document.getElementById('num').value)
    var pS = point_geojson.features[0].geometry.coordinates
    console.log("[FROM] " + pS)
    console.log("[UPTO] " + input_distance)
    computeCircularByAPI(pS, input_distance)


    // update visualized color
    map.setPaintProperty('line', 'line-opacity', pathColorAlpha);
}
