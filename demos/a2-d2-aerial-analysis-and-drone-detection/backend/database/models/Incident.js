const mongoose = require('mongoose');

// Incident Location Schema (GeoJSON format for geospatial queries)
const LocationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point',
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
  },
}, { _id: false });

// Incident Resolution Schema
const ResolutionSchema = new mongoose.Schema({
  resolved_by: { type: String, default: null },
  resolved_at: { type: Date, default: null },
  resolution_notes: { type: String, default: null },
  resolution_action: {
    type: String,
    enum: ['dismissed', 'investigated', 'escalated', 'false_positive'],
    default: null,
  },
}, { _id: false });

// Main Incident Schema
const IncidentSchema = new mongoose.Schema({
  // Unique incident identifier
  incident_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // Related entities
  drone_id: { 
    type: String, 
    required: true,
    index: true,
  },
  flight_id: { 
    type: String, 
    required: true,
    index: true,
  },
  
  // Incident details
  type: {
    type: String,
    required: true,
    enum: [
      'zone_breach',
      'unauthorized_drone',
      'payload_detected',
      'loitering',
      'restricted_area',
      'altitude_violation',
      'speed_violation',
      'suspicious_behavior',
    ],
  },
  
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  
  // Incident timestamp
  timestamp: { 
    type: Date, 
    required: true,
    index: true,
  },
  
  // Location (GeoJSON for geospatial queries)
  location: {
    type: LocationSchema,
    required: true,
  },
  
  // Additional location details
  altitude: { type: Number, default: null },
  zone: { type: String, default: null }, // e.g., "inner_circle", "protected_zone"
  
  // Incident description
  description: { type: String, default: null },
  
  // Status tracking
  status: {
    type: String,
    enum: ['open', 'investigating', 'closed'],
    default: 'open',
    index: true,
  },
  
  // Resolution details
  resolution: { type: ResolutionSchema, default: {} },
  
  // Alert/notification tracking
  alert_sent: { type: Boolean, default: false },
  alert_recipients: [{ type: String }], // Array of email/phone numbers
  
  // Metadata
  sensor_type: {
    type: String,
    enum: ['dji', 'df', 'camera'],
    default: null,
  },
  sensor_id: { type: String, default: null },
  
  // Evidence/attachments
  evidence: [{
    type: { type: String }, // 'image', 'video', 'log'
    url: { type: String },
    timestamp: { type: Date },
  }],
  
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'incidents',
});

// Indexes for efficient queries
IncidentSchema.index({ incident_id: 1 });
IncidentSchema.index({ drone_id: 1, timestamp: -1 });
IncidentSchema.index({ flight_id: 1 });
IncidentSchema.index({ status: 1, timestamp: -1 });
IncidentSchema.index({ severity: 1, timestamp: -1 });
IncidentSchema.index({ location: '2dsphere' }); // Geospatial index

// Instance methods
IncidentSchema.methods.close = function(resolvedBy, notes, action) {
  this.status = 'closed';
  this.resolution = {
    resolved_by: resolvedBy,
    resolved_at: new Date(),
    resolution_notes: notes,
    resolution_action: action,
  };
  return this.save();
};

IncidentSchema.methods.investigate = function() {
  this.status = 'investigating';
  return this.save();
};

IncidentSchema.methods.addEvidence = function(type, url) {
  this.evidence.push({
    type,
    url,
    timestamp: new Date(),
  });
  return this.save();
};

// Static methods
IncidentSchema.statics.findByIncidentId = function(incident_id) {
  return this.findOne({ incident_id });
};

IncidentSchema.statics.findByDroneId = function(drone_id) {
  return this.find({ drone_id }).sort({ timestamp: -1 });
};

IncidentSchema.statics.findByFlightId = function(flight_id) {
  return this.find({ flight_id }).sort({ timestamp: -1 });
};

IncidentSchema.statics.findOpenIncidents = function() {
  return this.find({ status: 'open' }).sort({ timestamp: -1 });
};

IncidentSchema.statics.findBySeverity = function(severity) {
  return this.find({ severity }).sort({ timestamp: -1 });
};

IncidentSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    timestamp: { $gte: startDate, $lte: endDate },
  }).sort({ timestamp: -1 });
};

IncidentSchema.statics.findNearLocation = function(longitude, latitude, maxDistanceMeters = 1000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistanceMeters,
      },
    },
  });
};

IncidentSchema.statics.getIncidentStats = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] },
        },
        closed: {
          $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] },
        },
        critical: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] },
        },
        high: {
          $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] },
        },
        medium: {
          $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] },
        },
        low: {
          $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] },
        },
      },
    },
  ]);
};

const Incident = mongoose.model('Incident', IncidentSchema);

module.exports = Incident;

// Made with Bob
