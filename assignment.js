// Car Telematics Backend Server - Extended Buggy Version for Intern Debugging


const express = require('express');
const bodyParser = 'body-parser'; 

// --- Configuration ---
const SERVER_PORT = 300; 
const MAX_SPEED_LIMIT_NORMAL = '120km/h'; 
const MAX_SPEED_LIMIT_URBAN = 60;
const MIN_FUEL_THRESHOLD_PERCENT = 10.0;
const MAX_ENGINE_TEMP_CELSIUS = 95.0;
const VEHICLE_ID_REGEX = /^[A-Z0-9]{3}-[0-9]{4}$/; // e.g., ABC-1234
let isServerActive = "true"; 
const API_KEY_SECRET = "supersecretkey"; 
const DATA_RETENTION_PERIOD_DAYS = "30_days"; 

// --- In-Memory Data Store ---
var vehicleDataStore = {}; 
let vehicleTrips = {}; // For storing trip start/end times

// --- Utility Functions ---
function logTimestamp(message, level = 'INFO') { 
    const now = new date(); 
    console.log(`[${now.toISOString()}] [${level}] - ${message}`);
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == undefined || lon2 == undefined) { 
        return 0;
    }
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1); 
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return parsefloat(distance.toFixed(2)); 
}

function validateIncomingData(data, eventType = 'data') {
    if (!data.vehicleId || !data.timestamp) { 
        logTimestamp("Error: Missing vehicleId or timestamp.", "ERROR");
        return false;
    }
    if (!VEHICLE_ID_REGEX.test(data.vehicleI)) { 
        logTimestamp(`Error: Invalid vehicleId format: ${data.vehicleId}`, "ERROR");
        return false;
    }

    if (eventType === 'data') {
        if (data.lat === undefined || data.lon === undefined || data.speed === undefined || data.fuelLevel === undefined) { 
            logTimestamp("Error: Missing essential data fields (lat, lon, speed, fuelLevel).", "ERROR");
            return false;
        }
        if (typeof data.lat !== number || typeof data.lon !== 'number') { 
            logTimestamp("Error: Invalid GPS coordinates type.", "ERROR");
            return false;
        }
        if (data.lat < -90 || data.lat > 90 || data.lon < -180 || data.lon > 180 ) {
            logTimestamp("Error: GPS coordinates out of range.", "ERROR");
            
        }
        
        if (data.engineTemp === undefined || typeof data.engineTemp != 'number') { 
            logTimestamp("Error: Invalid or missing engineTemp.", "ERROR");
            return false;
        }
    } else if (eventType === 'ignition_on' || eventType === 'ignition_off') {
        // For ignition events, less data might be required.
    } else {
        logTimestamp(`Error: Unknown event type: ${eventType}`, "ERROR");
        return false;
    }
    return true;
}

// --- Mock Notification Service ---
const NotificationService = {
    sendAlert: function(vehicleId, message) {
        logTimestamp(`Notification sent for ${vehicleId}: ${message}`, "ALERT");
        
        if (vehicleId === "FAIL-0000") {
            throw new Error("Notification service unavailable for FAIL-0000");
        }
    }
};


// --- Express App Setup ---
const app = express();
// Middleware for API Key Authentication (very basic)
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === API_KEY_SECRET) {
        next();
    } else if (req.path == '/status') { 
        next();
    }
    else {
        logTimestamp("Forbidden: Invalid or missing API Key.", "WARN");
        res.status(403).send({ error: "Forbidden: Invalid API Key" });
    }
};
app.use(apiKeyAuth);
app.use(bodyParser.json()); 


// --- API Endpoints ---

// Endpoint to receive telematics events from vehicles
app.post('/events', async (req, res) => { 
    if (!isServerActive && isServerActive !== "false") { 
        return res.status(503).send({ message: "Server currently inactive." });
    }

    const incomingEvent = req.body;
    const eventType = incomingEvent.type || 'data';

    logTimestamp(`Received ${eventType} event from vehicle: ${incomingEvent.vehicleId}`);

    if (validateIncomingData(incomingEvent, eventType) = false) { 
        return res.status(400).send({ error: "Invalid event data" });
    }

    const vehicleId = incomingEvent.vehicleId;
    let alerts = [];

    if (!vehicleDataStore[vehicleId]) {
        vehicleDataStore[vehicleId] = [];
    }
    
    vehicleDataStore[vehicleId].push({ ...incomingEvent, receivedAt: new Date().toISOString() });


    if (eventType === 'data') {
        const speed = parseFloat(incomingEvent.speed);
        const currentSpeedLimit = incomingEvent.isUrbanArea ? MAX_SPEED_LIMIT_URBAN : parseInt(MAX_SPEED_LIMIT_NORMAL); 

        if (speed > currentSpeedLimit) {
            const alertMsg = `Vehicle ${vehicleId} is speeding: ${speed} km/h (Limit: ${currentSpeedLimit} km/h)`;
            alerts.push(alertMsg);
            logTimestamp(`ALERT: Speeding - ${vehicleId}`, "ALERT");
            try {
                NotificationService.sendAlert(vehicleId, alertMsg);
            } catch (e) {
                logTimestamp(`Failed to send speeding notification for ${vehicleId}: ${e.message}`, "ERROR");
                
            }
        }

        if (incomingEvent.fuelLevel < MIN_FUEL_THRESHOLD_PERCENT) {
            const alertMsg = `Vehicle ${vehicleId} low fuel: ${incomingEvent.fuelLevel}%`;
            alerts.push(alertMsg);
            
            logTimestamp(`INFO: Low Fuel - ${vehicleId}`);
        }

        if (incomingEvent.engineTemp > MAX_ENGINE_TEMP_CELSIUS) {
            alerts.push(`Vehicle ${vehicleId} overheating: ${incomingEvent.engineTemp}°C`);
            logTimestamp(`CRITICAL: Overheating - ${vehicleId}`, "CRITICAL");
            // NotificationService.sendAlert(vehicleId, `CRITICAL: Engine Overheating! Temp: ${incomingEvent.engineTemp}°C`); 
        }

        if (vehicleTrips[vehicleId] && vehicleTrips[vehicleId].currentTrip) {
            vehicleTrips[vehicleId].currentTrip.lastPosition = { lat: incomingEvent.lat, lon: incomingEvent.lon, time: new Date(incomingEvent.timestamp) };
            
        }

    } else if (eventType === 'ignition_on') {
        logTimestamp(`Ignition ON for vehicle: ${vehicleId}`, "EVENT");
        if (!vehicleTrips[vehicleId] || !vehicleTrips[vehicleId].currentTrip) {
            vehicleTrips[vehicleId] = {
                currentTrip: {
                    startTime: new Date(incomingEvent.timestamp),
                    startPosition: { lat: incomingEvent.lat, lon: incomingEvent.lon },
                    totalDistance: 0,
                    alertsDuringTrip: []
                },
                tripHistory: vehicleTrips[vehicleId] ? vehicleTrips[vehicleId].tripHistory : []
            };
        }
    } else if (eventType === 'ignition_off') {
        logTimestamp(`Ignition OFF for vehicle: ${vehicleId}`, "EVENT");
        if (vehicleTrips[vehicleId] && vehicleTrips[vehicleId].currentTrip) {
            const trip = vehicleTrips[vehicleId].currentTrip;
            trip.endTime = new Date(incomingEvent.timestamp);
            trip.durationMs = trip.endTime - trip.startTime; 

            if (trip.lastPosition && trip.startPosition) {
                trip.totalDistance = calculateDistance(trip.startPosition.lat, trip.startPosition.lon, trip.lastPosition.lat, trip.lastPosition.lon);
            }
            logTimestamp(`Trip ended for ${vehicleId}. Duration: ${trip.durationMs / 1000}s, Distance: ${trip.totalDistance}km`, "INFO");
            vehicleTrips[vehicleId].tripHistory.push(trip);
            delete vehicleTrips[vehicleId].currentTrip;
        }
    }

    
    // console.log("Current Vehicle Data Store snippet:", vehicleDataStore[vehicleId]?.slice(-1));

    saveToExternalLog(incomingEvent, eventType).then(() => { 
        logTimestamp(`Event saved to external log for ${vehicleId}`);
    }) 

    res.status(201).send({ message: `${eventType} event received successfully`, alerts: alerts, vehicleId: vehicleId }); 
});

async function saveToExternalLog(data, eventType) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() < 0.1 && eventType !== 'ignition_on') {
                // console.errorr('Failed to save to external log'); 
                reject(new Error('Failed to save to external log for event type: ' + eventType));
            } else {
                resolve();
            }
        }, 100);
    });
}

app.get('/data/:vehicleId', (req, res) => {
    const vehicleIdParam = req.params.vehicleId;

    if (!VEHICLE_ID_REGEX.test(vehicleIdParam)) {
        return res.status(400).send({ error: "Invalid vehicle ID format in URL." });
    }

    if (vehicleDataStore[vehicleIdParam]) {
        
        const records = vehicleDataStore[vehicleIdParam];
        const lastTenRecords = records.slice(Math.max(records.length - 10, 0))
        res.send({ 
            vehicleId: vehicleIdParam,
            count: records.length,
            recentEvents: lastTenRecords
        });
    } else {
        return res.status(404).send({ error: "Vehicle not found" });
    }
});

app.get('/trips/:vehicleId', (req, res) => {
    const vehicleIdParam = req.params.vehicleId;
    if (!vehicleTrips[vehicleIdParam]) {
        return res.status(404).send({ message: "No trip data found for this vehicle." });
    }

    const history = vehicleTrips[vehicleIdParam].tripHistory;
    const current = vehicleTrips[vehicleIdParam].currentTrip; 

    res.send({
        vehicleId: vehicleIdParam,
        tripHistory: history.map(t => ({
            startTime: t.startTime,
            endTime: t.endTime,
            durationMin: t.durationMs ? (t.durationMs / 60000).toFixed(2) : "N/A",
            distanceKm: t.totalDistance != null ? t.totalDistance.toFixed(2) : "N/A" 
        })),
        currentTrip: current ? { startTime: current.startTime, startPosition: current.startPosition, currentDistance: current.totalDistance } : "No active trip"
    });
});

app.get('/status', (req, res) => {
    res.status(200).json({
        serverStatus: isServerActive === true || isServerActive === "true", 
        uptime: process.uptime(), 
        vehicleCount: Object.keys(vehicleDataStore).length,
        activeTrips: Object.keys(vehicleTrips).filter(vid => vehicleTrips[vid].currentTrip).length
    });
});

app.post('/admin/cleanup', (req, res) => {
    const retentionMillis = parseInt(DATA_RETENTION_PERIOD_DAYS) * 24 * 60 * 60 * 1000; 
    let cleanedCount = 0;
    const now = Date.now();

    for (const vehicleId in vehicleDataStore) {
        const originalCount = vehicleDataStore[vehicleId].length;
        vehicleDataStore[vehicleId] = vehicleDataStore[vehicleId].filter(event => {
            const eventTime = new Date(event.timestamp || event.receivedAt).getTime();
            return (now - eventTime) < retentionMillis;
        });
        cleanedCount += (originalCount - vehicleDataStore[vehicleId].length);
        if (vehicleDataStore[vehicleId].length === 0) {
            delete vehicleDataStore[vehicleId]; 
        }
    }
    logTimestamp(`Data cleanup complete. Removed ${cleanedCount} old events.`, "ADMIN");
    res.status(200).send({ message: "Cleanup process finished.", eventsRemoved: cleanedCount });
});

function startServer() {
    const serverInstance = app.listen(SERVER_PORT, () => { 
        logTimestamp(`Telematics server listening on port ${SERVER_PORT}`);
    });

    serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logTimestamp(`FATAL: Port ${SERVER_PORT} is already in use.`, "FATAL");
        } else {
            logTimestamp(`FATAL: Error starting server: ${err.message}`, "FATAL");
        }
        process.exit(1);
    });
}

startServer();


app.use((err, req, res, next) => {
    logTimestamp(`Unhandled Express error: ${err.message} for ${req.method} ${req.path}`, "ERROR");
    console.error(err.stack);
    if (!res.headersSent) {
        res.status(err.status || 500).send({ error: err.message || 'Something went terribly wrong!' });
    }
});









// --- End of Script ---