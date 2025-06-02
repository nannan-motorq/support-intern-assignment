const axios = require('axios');
const BASE_URL = 'http';
const API_KEY = 'supersecretkey'; 

async function request(method, endpoint, data = null, headers = {}, description = "") {
    console.log(`\n--- ${description} ---`);
    console.log(`Sending ${method.toUpperCase()} request to ${BASE_URL}${endpoint}`);
    if (data) console.log('Request data:', JSON.stringify(data));
        try {
        const response = await axios({
            method,
            url: `${BASE_URL}${endpoint}`,
            data,
            headers: {
                'x-api-key': API_KEY, 
                'Content-Type': 'application/json',
                ...headers,
            },
            validateStatus: function (status) {
                return status >= 200 && status < 500; 
            },
        });
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data));
        return response;
    } catch (error) {
        if (error.response) {
            console.error('Error Status:', error.response.status);
            console.error('Error Data:', JSON.stringify(error.response.data));
        } else if (error.request) {
            console.error('Error: No response received. Is the server running at ' + BASE_URL + '?');
            console.error(error.message);
        } else {
            console.error('Error setting up request:', error.message);
        }
        return error.response || { status: 500, data: { error: error.message } }; 
    }
}
async function runTests() {
    console.log("Starting Telematics Server Tests...");
    console.log("NOTE: Observe server logs for more details, especially for server-side errors.");

    await request('get', '/status', null, { 'x-api-key': '' }, "Test /status without API Key (Hint 36 - should allow)");
    await request('get', '/status/', null, { 'x-api-key': '' }, "Test /status/ (trailing slash) without API Key (Hint 36)");
    await request('get', '/data/TEST-0001', null, { 'x-api-key': 'wrongkey' }, "Test endpoint with WRONG API Key");
    await request('get', '/data/TEST-0001', null, {}, "Test endpoint with NO API Key header");

    
    
    
    
    
    const validEventData = {
        type: 'data',
        vehicleId: 'CAR-1234',
        timestamp: new Date().toISOString(),
        lat: 40.7128,
        lon: -74.0060,
        speed: 60,
        fuelLevel: 75.5,
        engineTemp: 88.0,
        isUrbanArea: true
    };
    await request('post', '/events', validEventData, {}, "Post valid 'data' event");

    const speedingEventData = { ...validEventData, vehicleId: 'SPD-0001', speed: 130, isUrbanArea: false };
    await request('post', '/events', speedingEventData, {}, "Post 'data' event - potential speeding (Hint 3, 13)");

    const overheatingEventData = { ...validEventData, vehicleId: 'HOT-0001', engineTemp: 100 };
    await request('post', '/events', overheatingEventData, {}, "Post 'data' event - overheating (Hint 40)");

    const notificationFailEvent = { ...validEventData, vehicleId: 'FAIL-0000', speed: 10 }; 
    await request('post', '/events', notificationFailEvent, {}, "Post 'data' event for FAIL-0000 (Hint 35, 39)");

    
    const missingDataEvent = {
        type: 'data',
        vehicleId: 'MIS-0001',
        timestamp: new Date().toISOString(),
        lat: 40.7128,
        lon: -74.0060,
        
        fuelLevel: 75.5,
        
    };
    await request('post', '/events', missingDataEvent, {}, "Post 'data' event with missing speed & engineTemp (Hint 8, 10)");

    const invalidTypesEvent = { ...validEventData, vehicleId: 'TYP-0001', lat: "not-a-number", speed: "fast" };
    await request('post', '/events', invalidTypesEvent, {}, "Post 'data' event with invalid data types (Hint 9)");

    const invalidVehicleIdFormatEvent = { ...validEventData, vehicleId: 'INVALIDID' };
    await request('post', '/events', invalidVehicleIdFormatEvent, {}, "Post 'data' event with invalid vehicleId format (Hint 32, 33)");

    const outOfRangeGPSEvent = { ...validEventData, vehicleId: 'GPS-0001', lat: 200, lon: -300 };
    await request('post', '/events', outOfRangeGPSEvent, {}, "Post 'data' event with out-of-range GPS (Hint 34/52)");
    
    
    const tripVehicleId = 'TRP-0001';
    await request('post', '/events', {
        type: 'ignition_on',
        vehicleId: tripVehicleId,
        timestamp: new Date(Date.now() - 60000 * 5).toISOString(), 
        lat: 40.7000, lon: -74.0000
    }, {}, `Ignition ON for ${tripVehicleId}`);
        await request('post', '/events', {
        type: 'data', vehicleId: tripVehicleId, timestamp: new Date(Date.now() - 60000 * 4).toISOString(),
        lat: 40.7050, lon: -74.0020, speed: 30, fuelLevel: 70, engineTemp: 80
    }, {}, `Data point 1 for ${tripVehicleId}`);
        await request('post', '/events', {
        type: 'data', vehicleId: tripVehicleId, timestamp: new Date(Date.now() - 60000 * 3).toISOString(),
        lat: 40.7100, lon: -74.0040, speed: 35, fuelLevel: 68, engineTemp: 82
    }, {}, `Data point 2 for ${tripVehicleId}`);

    const earlyIgnitionOffTime = new Date(Date.now() - 60000 * 10).toISOString(); 
    
    await request('post', '/events', {
        type: 'ignition_off',
        vehicleId: tripVehicleId,
        timestamp: earlyIgnitionOffTime, 
        lat: 40.7150, lon: -74.0050
    }, {}, `Ignition OFF for ${tripVehicleId} with early timestamp (Hint 31, 42)`);

    const tripVehicleId2 = 'TRP-0002';
    const ignitionOnTime2 = new Date(Date.now() - 60000 * 15).toISOString();
    const ignitionOffTime2 = new Date(Date.now() - 60000 * 1).toISOString();
        await request('post', '/events', {
        type: 'ignition_on', vehicleId: tripVehicleId2, timestamp: ignitionOnTime2,
        lat: 40.8000, lon: -73.9000
    }, {}, `Ignition ON for ${tripVehicleId2}`);
    await request('post', '/events', {
        type: 'data', vehicleId: tripVehicleId2, timestamp: new Date(Date.now() - 60000 * 10).toISOString(),
        lat: 40.8050, lon: -73.9020, speed: 30, fuelLevel: 70, engineTemp: 80
    }, {}, `Data point for ${tripVehicleId2}`);
     await request('post', '/events', {
        type: 'ignition_off', vehicleId: tripVehicleId2, timestamp: ignitionOffTime2,
        lat: 40.8100, lon: -73.9040 
    }, {}, `Ignition OFF for ${tripVehicleId2} (normal) (Hint 31, 41/51)`);

    
    
    await request('get', `/data/${validEventData.vehicleId}`, null, {}, `Get data for ${validEventData.vehicleId} (Hint 20, 21)`);
    await request('get', '/data/UNKNOWN-VEHICLE', null, {}, "Get data for unknown vehicle");
    await request('get', '/data/INVALIDVEHICLEID', null, {}, "Get data with invalid vehicle ID format in URL");

    
    
    await request('post', '/events', { 
        type: 'ignition_on', vehicleId: 'ACTIVE-TRIP', timestamp: new Date().toISOString(),
        lat: 40.0, lon: -74.0
    }, {}, "Start an active trip for ACTIVE-TRIP");
    await request('get', '/trips/ACTIVE-TRIP', null, {}, "Get trips for ACTIVE-TRIP (Hint 44)");
    await request('get', `/trips/${tripVehicleId2}`, null, {}, `Get trips for ${tripVehicleId2} (Hint 45)`);

    
    
    await request('get', '/status', null, {}, "Test /status again (Hint 4, 46)");

    console.log("\nINFO: To effectively test cleanup, ensure some data is older than retention period or adjust server config.");
    
    const veryOldEvent = {
        ...validEventData,
        vehicleId: "OLD-0001",        
    };
    
    await request('post', '/admin/cleanup', null, {}, "Run admin cleanup (Hint 28, 47, 48)");
    await request('get', `/data/${veryOldEvent.vehicleId}`, null, {}, `Check data for ${veryOldEvent.vehicleId} after cleanup`);

    console.log("\n--- Check server logs for unhandled errors or crashes related to Hints 6, 19, 24, etc. ---");
    console.log("--- Some issues like Hint 5 (var), Hint 16 (logging sensitive data), Hint 23/49 (server lifecycle) are not directly testable via HTTP client but are code/practice issues. ---");

    console.log("\nAll tests completed.");
    console.log("Please review server logs and responses for issues corresponding to the hints.");
}
runTests().catch(err => {
    console.error("FATAL TEST SCRIPT ERROR:", err);
});