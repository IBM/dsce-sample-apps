const mongoose = require('mongoose');

// Telemetry Point Schema (for route tracking)
const TelemetryPointSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  altitude: { type: Number, default: null },
  speed: { type: Number, default: null },
  azimuth: { type: Number, default: null },
  timestamp: { type: Date, required: true },
  // Additional telemetry fields
  distance: { type: Number, default: null },
  frequency: { type: String, default: null },
  rssi: { type: Number, default: null },
  snr: { type: Number, default: null },
}, { _id: false });

// Flight Summary Schema
const FlightSummarySchema = new mongoose.Schema({
  max_altitude: { type: Number, default: null },
  max_speed: { type: Number, default: null },
  duration_seconds: { type: Number, default: null },
  distance_meters: { type: Number, default: null },
  zone_breaches: { type: Number, default: 0 },
  total_points: { type: Number, default: 0 },
}, { _id: false });

// Flight Schema (embedded in Drone)
const FlightSchema = new mongoose.Schema({
  flight_id: { type: String, required: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date, default: null },
  sensor_type: {
    type: String,
    required: true,
    enum: ['dji', 'df', 'camera', 'bluvec2.0', 'apolloshield_df', 'apolloshield_dji', 'skytracker'],
  },
  sensor_id: { type: String, default: null },
  
  // Flight route (array of telemetry points)
  route: [TelemetryPointSchema],
  
  // Incident references
  incidents: [{ type: String }], // Array of incident_ids
  
  // Flight summary statistics
  summary: { type: FlightSummarySchema, default: {} },
  
  // Flight status
  status: {
    type: String,
    enum: ['active', 'completed', 'lost'],
    default: 'active',
  },
  
  // Last update timestamp
  last_update: { type: Date, default: Date.now },
}, { _id: false });

// Drone Metadata Schema
const DroneMetadataSchema = new mongoose.Schema({
  model: { type: String, default: null },
  manufacturer: { type: String, default: null },
  has_payload: { type: Boolean, default: false },
  operator: { type: String, default: 'unknown' },
  registration: { type: String, default: null },
  is_authorized: { type: Boolean, default: false },
}, { _id: false });

// Main Drone Schema
const DroneSchema = new mongoose.Schema({
  // Unique drone identifier
  drone_id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true,
  },
  
  // Timestamps
  first_seen: { type: Date, required: true },
  last_seen: { type: Date, required: true },
  
  // Flight tracking
  total_flights: { type: Number, default: 0 },
  flights: [FlightSchema],
  
  // Current/last known position
  current_position: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    altitude: { type: Number, default: null },
    timestamp: { type: Date, default: null },
  },
  
  // Drone metadata
  metadata: { type: DroneMetadataSchema, default: {} },
  
  // Alert status
  alert_level: {
    type: String,
    enum: ['none', 'low', 'medium', 'high', 'critical'],
    default: 'none',
  },
  
  // Blacklist status
  is_blacklisted: { type: Boolean, default: false },
  blacklist_reason: { type: String, default: null },
  
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'drones',
});

// Indexes for efficient queries
DroneSchema.index({ drone_id: 1 });
DroneSchema.index({ last_seen: -1 });
DroneSchema.index({ 'flights.flight_id': 1 });
DroneSchema.index({ 'flights.start_time': -1 });
DroneSchema.index({ 'metadata.is_authorized': 1 });

// Instance methods
DroneSchema.methods.addFlight = function(flightData) {
  this.flights.push(flightData);
  this.total_flights = this.flights.length;
  this.last_seen = new Date();
  return this.save();
};

DroneSchema.methods.updateCurrentPosition = function(lat, lng, altitude) {
  this.current_position = {
    lat,
    lng,
    altitude,
    timestamp: new Date(),
  };
  this.last_seen = new Date();
  return this.save();
};

DroneSchema.methods.getActiveFlight = function() {
  return this.flights.find(f => f.status === 'active');
};

DroneSchema.methods.getFlightById = function(flight_id) {
  return this.flights.find(f => f.flight_id === flight_id);
};

// Static methods
DroneSchema.statics.findByDroneId = function(drone_id) {
  return this.findOne({ drone_id });
};

DroneSchema.statics.findActiveDrones = function(minutesThreshold = 3) {
  const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
  return this.find({ last_seen: { $gte: thresholdTime } });
};

DroneSchema.statics.findInactiveDrones = function(minutesThreshold = 3) {
  const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
  return this.find({ last_seen: { $lt: thresholdTime } });
};

DroneSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    $or: [
      { first_seen: { $gte: startDate, $lte: endDate } },
      { last_seen: { $gte: startDate, $lte: endDate } },
    ],
  });
};

const Drone = mongoose.model('Drone', DroneSchema);

module.exports = Drone;

// Made with Bob
