const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB connection configuration
const MONGODB_URI =
	process.env.MONGODB_URI ||
	'mongodb://localhost:27017/airsight-drone-detection';

// Check environment: 'local' or 'production' (default: auto-detect)
const NODE_ENV = process.env.NODE_ENV || 'local';
const isLocal =
	NODE_ENV === 'local' ||
	MONGODB_URI.includes('localhost') ||
	MONGODB_URI.includes('127.0.0.1');

// Connection options (Mongoose 6+ doesn't need useNewUrlParser and useUnifiedTopology)
const options = {
	serverSelectionTimeoutMS: 5000,
	socketTimeoutMS: 45000,
};

// Only apply SSL/TLS options for production (IBM Cloud MongoDB)
if (!isLocal) {
	const caCertPath =
		process.env.MONGODB_CA_CERT_PATH ||
		path.join(__dirname, '../certs/mongodb-ca.crt');
	
	// Check if path exists and is a file (not a directory)
	let hasCACert = false;
	try {
		const stats = fs.statSync(caCertPath);
		hasCACert = stats.isFile();
	} catch (err) {
		// File doesn't exist
		hasCACert = false;
	}

	options.tls = true;

	if (hasCACert) {
		// Use provided CA certificate for secure connection
		options.tlsCAFile = caCertPath;
		console.log('🔒 Production mode - Using CA certificate:', caCertPath);
	} else {
		// Fallback: Allow self-signed certificates
		options.tlsAllowInvalidCertificates = true;
		options.tlsAllowInvalidHostnames = true;
		console.log(
			':lock: Production mode - SSL/TLS enabled (self-signed certs allowed)',
		);
	}
} else {
	console.log(':house: Local development mode - Connecting to local MongoDB');
}

// Connect to MongoDB
const connectDB = async () => {
	try {
		await mongoose.connect(MONGODB_URI, options);
		console.log(':white_check_mark: MongoDB connected successfully');
		console.log(`:bar_chart: Database: ${mongoose.connection.name}`); // Handle connection events

		mongoose.connection.on('error', (err) => {
			console.error(':x: MongoDB connection error:', err);
		});

		mongoose.connection.on('disconnected', () => {
			console.warn(':warning:  MongoDB disconnected');
		});

		mongoose.connection.on('reconnected', () => {
			console.log(':arrows_counterclockwise: MongoDB reconnected');
		});

		return mongoose.connection;
	} catch (error) {
		console.error(':x: MongoDB connection failed:', error.message);
		console.error(
			':bulb: Make sure MongoDB is running: mongod --dbpath /path/to/data',
		);
		process.exit(1);
	}
};

// Graceful shutdown
const disconnectDB = async () => {
	try {
		await mongoose.connection.close();
		console.log(':wave: MongoDB connection closed');
	} catch (error) {
		console.error(':x: Error closing MongoDB connection:', error);
	}
};

// Handle process termination
process.on('SIGINT', async () => {
	await disconnectDB();
	process.exit(0);
});

module.exports = { connectDB, disconnectDB };
