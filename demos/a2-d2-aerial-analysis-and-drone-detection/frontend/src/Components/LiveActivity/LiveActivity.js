import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
	MapContainer,
	TileLayer,
	Marker,
	Polyline,
	Polygon,
	useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import styles from './LiveActivity.module.scss';
import { useData } from '../../DataContext';
import RiskAssessment from '../RiskAssessment/RiskAssessment';

// ---------- ICONS ----------

const homeIcon = new L.Icon({
	iconUrl: process.env.PUBLIC_URL + '/icons/home2.png',
	iconSize: [32, 32],
	iconAnchor: [16, 32],
	className: 'home-icon-marker',
});

// Center point marker for the circular zones
const centerPointIcon = L.divIcon({
	className: '',
	iconSize: [20, 20],
	iconAnchor: [10, 10],
	html: `
		<div style="
			width: 20px;
			height: 20px;
			background: #ef4444;
			border: 3px solid white;
			border-radius: 50%;
			box-shadow: 0 2px 8px rgba(0,0,0,0.3);
		"></div>
	`,
});

// Protected zones from GeoJSON
// Inner circle (Red zone) - Smallest, highest alert
const innerCircle = [
	[26.27508861115238, -80.19204145277399],
	[26.27266045084571, -80.24692708415536],
	[26.26539965747407, -80.30127735388588],
	[26.253377053470675, -80.35456232432077],
	[26.23670987833475, -80.40626284262379],
	[26.21556060160654, -80.45587577625223],
	[26.19013528047247, -80.50291906315441],
	[26.160681481030732, -80.54693651984185],
	[26.12748578711469, -80.58750235452212],
	[26.090870925036747, -80.6242253372732],
	[26.05119253661637, -80.6567525846666],
	[26.008835636344788, -80.68477292215395],
	[25.96421079148076, -80.70801979376479],
	[25.917750066248374, -80.72627369506488],
	[25.86990277311267, -80.73936411175121],
	[25.821131075349943, -80.74717095257486],
	[25.771905485824597, -80.74962547137007],
	[25.722700307061448, -80.74671067873064],
	[25.673989057395158, -80.73846124923575],
	[25.62623992722769, -80.72496293503325],
	[25.579911308271733, -80.70635150100608],
	[25.535447437147322, -80.68281120066379],
	[25.493274192873116, -80.65457281531735],
	[25.453795085695237, -80.62191128203258],
	[25.417387472362645, -80.58514293834166],
	[25.384399030425893, -80.54462241376153],
	[25.355144521436095, -80.50073919986568],
	[25.329902870082307, -80.45391393202422],
	[25.308914583351758, -80.40459441701458],
	[25.292379530750313, -80.3532514415513],
	[25.28045510349806, -80.30037439743096],
	[25.273254767432302, -80.24646675947145],
	[25.270847021121753, -80.19204145277399],
	[25.273254767432302, -80.13761614607654],
	[25.28045510349806, -80.08370850811704],
	[25.292379530750313, -80.03083146399669],
	[25.308914583351758, -79.97948848853342],
	[25.329902870082307, -79.93016897352378],
	[25.355144521436095, -79.88334370568232],
	[25.384399030425893, -79.83946049178645],
	[25.417387472362645, -79.79893996720634],
	[25.453795085695237, -79.7621716235154],
	[25.493274192873116, -79.72951009023065],
	[25.535447437147322, -79.7012717048842],
	[25.579911308271733, -79.67773140454192],
	[25.62623992722769, -79.65911997051475],
	[25.673989057395158, -79.64562165631224],
	[25.722700307061448, -79.63737222681736],
	[25.771905485824597, -79.63445743417792],
	[25.821131075349943, -79.63691195297312],
	[25.86990277311267, -79.64471879379678],
	[25.917750066248374, -79.65780921048312],
	[25.96421079148076, -79.6760631117832],
	[26.008835636344788, -79.69930998339404],
	[26.05119253661637, -79.72733032088139],
	[26.090870925036747, -79.75985756827478],
	[26.12748578711469, -79.79658055102588],
	[26.160681481030732, -79.83714638570616],
	[26.19013528047247, -79.88116384239359],
	[26.21556060160654, -79.92820712929577],
	[26.23670987833475, -79.97782006292421],
	[26.253377053470675, -80.02952058122723],
	[26.26539965747407, -80.0828055516621],
	[26.27266045084571, -80.13715582139264],
	[26.27508861115238, -80.19204145277399],
];

// Middle circle (Yellow zone) - Medium alert
const middleCircle = [
	[26.81424614874754, -80.19204150798248],
	[26.80920185074643, -80.30606334534964],
	[26.79411887472095, -80.41895735504517],
	[26.769146438380357, -80.52960778221089],
	[26.734531458154823, -80.63692284862726],
	[26.690615906181673, -80.73984632279083],
	[26.63783316258965, -80.83736859974513],
	[26.57670341393177, -80.9285371460779],
	[26.50782816087717, -81.0124661805204],
	[26.431883908986638, -81.08834547806626],
	[26.349615125378815, -81.15544820472762],
	[26.26182655123584, -81.21313771020856],
	[26.16937496536448, -81.26087322614784],
	[26.073160497459007, -81.29821443747718],
	[25.974117591403154, -81.324824913256],
	[25.873205719049192, -81.34047440059278],
	[25.771399943606205, -81.34504000059042],
	[25.66968142926261, -81.3385062584307],
	[25.56902799017491, -81.3209642106467],
	[25.470404767684634, -81.29260944133338],
	[25.374755119775696, -81.25373920563459],
	[25.28299180152843, -81.20474868350072],
	[25.195988509813777, -81.14612642968306],
	[25.114571859819257, -81.07844908748159],
	[25.039513855298917, -81.00237543417978],
	[24.97152490875473, -80.91863982565278],
	[24.911247462127292, -80.82804510657942],
	[24.859250253017663, -80.73145505124947],
	[24.816023265986644, -80.62978639832367],
	[24.781973403075693, -80.52400054123349],
	[24.757420902354756, -80.41509493431458],
	[24.74259652801269, -80.30409427334702],
	[24.73763955025121, -80.19204150798248],
	[24.74259652801269, -80.07998874261794],
	[24.757420902354756, -79.9689880816504],
	[24.781973403075693, -79.86008247473148],
	[24.816023265986644, -79.75429661764129],
	[24.859250253017663, -79.6526279647155],
	[24.911247462127292, -79.55603790938555],
	[24.97152490875473, -79.4654431903122],
	[25.039513855298917, -79.3817075817852],
	[25.114571859819257, -79.30563392848337],
	[25.195988509813773, -79.2379565862819],
	[25.28299180152843, -79.17933433246424],
	[25.374755119775696, -79.13034381033039],
	[25.470404767684634, -79.09147357463158],
	[25.56902799017491, -79.06311880531828],
	[25.66968142926261, -79.04557675753426],
	[25.771399943606205, -79.03904301537456],
	[25.873205719049192, -79.0436086153722],
	[25.974117591403154, -79.05925810270898],
	[26.073160497459007, -79.08586857848778],
	[26.16937496536448, -79.12320978981712],
	[26.26182655123584, -79.17094530575642],
	[26.349615125378815, -79.22863481123736],
	[26.431883908986638, -79.29573753789872],
	[26.50782816087717, -79.37161683544457],
	[26.57670341393177, -79.45554586988708],
	[26.63783316258965, -79.54671441621984],
	[26.690615906181673, -79.64423669317415],
	[26.734531458154823, -79.74716016733771],
	[26.769146438380357, -79.85447523375409],
	[26.79411887472095, -79.96512566091981],
	[26.80920185074643, -80.07801967061533],
	[26.81424614874754, -80.19204150798248],
];

// Outer circle (Green zone) - Low alert
const outerCircle = [
	[27.56786430135971, -80.18873775748261],
	[27.559071315528683, -80.38748208801893],
	[27.53278123919134, -80.58422008815356],
	[27.48925967641784, -80.77696866878777],
	[27.428945855128003, -80.96379081434578],
	[27.35244752499662, -81.14281761130863],
	[27.260533944305838, -81.31226910650358],
	[27.154127079605825, -81.47047366845474],
	[27.034291169425213, -81.61588557436559],
	[26.902220825391165, -81.74710060109622],
	[26.759227860545263, -81.86286945772369],
	[26.60672704527572, -81.96210895687365],
	[26.446220996338422, -82.04391087917584],
	[26.279284404382786, -82.10754853755073],
	[26.107547800910776, -82.15248109375915],
	[25.93268105749049, -82.1783557175398],
	[25.75637679919376, -82.18500770814427],
	[25.580333901501792, -82.17245871914687],
	[25.40624122613518, -82.14091324054398],
	[25.235761737123422, -82.09075349822157],
	[25.070517124510847, -82.02253293097931],
	[24.912073049830795, -81.93696840070457],
	[24.76192511515187, -81.83493128327272],
	[24.621485646254317, -81.71743757752667],
	[24.492071370359042, -81.58563715834575],
	[24.37489205973757, -81.44080228826198],
	[24.271040204343215, -81.284315491025],
	[24.181481769142646, -81.1176568804621],
	[24.107048084900274, -80.94239102923241],
	[24.04842891458582, -80.76015345477501],
	[24.006166731173543, -80.57263679390203],
	[23.98065223624854, -80.38157673299662],
	[23.972121142443207, -80.18873775748261],
	[23.98065223624854, -79.9958987819686],
	[24.006166731173543, -79.80483872106319],
	[24.04842891458582, -79.61732206019022],
	[24.107048084900274, -79.4350844857328],
	[24.181481769142646, -79.25981863450313],
	[24.271040204343215, -79.09316002394023],
	[24.37489205973757, -78.93667322670325],
	[24.492071370359042, -78.7918383566195],
	[24.621485646254317, -78.66003793743857],
	[24.76192511515186, -78.5425442316925],
	[24.912073049830795, -78.44050711426067],
	[25.070517124510847, -78.35494258398592],
	[25.235761737123422, -78.28672201674365],
	[25.406241226135176, -78.23656227442125],
	[25.580333901501792, -78.20501679581835],
	[25.75637679919376, -78.19246780682096],
	[25.93268105749049, -78.19911979742542],
	[26.107547800910776, -78.22499442120608],
	[26.279284404382786, -78.26992697741449],
	[26.446220996338422, -78.33356463578939],
	[26.60672704527572, -78.41536655809156],
	[26.759227860545263, -78.51460605724154],
	[26.902220825391165, -78.630374913869],
	[27.034291169425213, -78.76158994059963],
	[27.154127079605825, -78.90700184651048],
	[27.260533944305838, -79.06520640846165],
	[27.35244752499662, -79.2346579036566],
	[27.428945855128003, -79.41368470061944],
	[27.48925967641784, -79.60050684617744],
	[27.53278123919134, -79.79325542681167],
	[27.559071315528683, -79.9899934269463],
	[27.56786430135971, -80.18873775748261],
];

// Protected square polygon (outermost boundary)
const stadiumPolygon = [
	[30.489332232453037, -84.28870687454474],
	[23.9052089569157, -84.28870687454474],
	[23.9052089569157, -78.25561137403417],
	[30.489332232453037, -78.25561137403417],
	[30.489332232453037, -84.28870687454474],
];

// Center point of all circular zones (calculated from innerCircle coordinates)
const circleCenter = [25.772876116118495, -80.19204145277399];

const pilotIcon = new L.Icon({
	iconUrl: process.env.PUBLIC_URL + '/icons/pilot-img.png',
	iconSize: [28, 28],
	iconAnchor: [14, 28],
	className: 'pilot-icon-marker',
});

const tailIcon = (color) =>
	L.divIcon({
		className: '',
		iconSize: [10, 10],
		html: `
      <div class="${styles.trailDot}" style="background:${color};"></div>
    `,
	});

const DRONE_LABEL_ICON_URL = process.env.PUBLIC_URL + '/icons/drone.png';
const droneIcon = (color, label) =>
	L.divIcon({
		className: '',
		iconSize: [70, 40],
		iconAnchor: [0, 0],
		html: `
      <div class="${styles.droneMarkerWrapper}">
	  <div class="${styles.droneMarkerIconRow}">
          <img
            src="${DRONE_LABEL_ICON_URL}"
            class="${styles.droneMarkerImage}"
          />
        <div class="${styles.droneMarkerDot}" style="background:${color};"></div>
        <div class="${styles.droneMarkerLabel}">${label}</div>
      </div>
    `,
	});

// ---------- GEO HELPERS ----------

// bearing from point A -> B in degrees
function computeBearing(lat1, lng1, lat2, lng2) {
	const toRad = (d) => (d * Math.PI) / 180;
	const toDeg = (r) => (r * 180) / Math.PI;

	const φ1 = toRad(lat1);
	const φ2 = toRad(lat2);
	const Δλ = toRad(lng2 - lng1);

	const y = Math.sin(Δλ) * Math.cos(φ2);
	const x =
		Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

	let θ = Math.atan2(y, x);
	θ = toDeg(θ);
	return (θ + 360) % 360;
}

// destination point given start, bearing, distance
function destinationPoint(lat, lng, bearingDeg, distanceMeters) {
	const R = 6371e3; // earth radius in meters
	const toRad = (d) => (d * Math.PI) / 180;
	const toDeg = (r) => (r * 180) / Math.PI;

	const δ = distanceMeters / R;
	const θ = toRad(bearingDeg);

	const φ1 = toRad(lat);
	const λ1 = toRad(lng);

	const sinφ1 = Math.sin(φ1);
	const cosφ1 = Math.cos(φ1);
	const sinδ = Math.sin(δ);
	const cosδ = Math.cos(δ);

	const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
	const φ2 = Math.asin(sinφ2);

	const y = Math.sin(θ) * sinδ * cosφ1;
	const x = cosδ - sinφ1 * sinφ2;
	const λ2 = λ1 + Math.atan2(y, x);

	return {
		lat: toDeg(φ2),
		lng: ((toDeg(λ2) + 540) % 360) - 180, // normalize
	};
}

// build FOV polygon (triangle) from azimuth/elevation/angle or last segment direction
function buildFOVPolygon(droneLat, droneLng, trail, azimuth, elevation, angle) {
	let heading;

	// Priority order: azimuth (Fortem Radar) > angle (Apolloshield DF) > trail-based
	if (azimuth != null && !isNaN(azimuth) && azimuth !== 0) {
		heading = parseFloat(azimuth);
		console.log(`Using azimuth for FOV direction: ${heading}°`);
	} else if (angle != null && !isNaN(angle) && angle !== 0) {
		heading = parseFloat(angle);
		console.log(`Using angle for FOV direction: ${heading}°`);
	} else {
		// Fallback to trail-based heading
		const lastTrailPoint =
			trail && trail.length ? trail[trail.length - 1] : null;

		if (!lastTrailPoint) return null;

		const [prevLat, prevLng] = lastTrailPoint;
		heading = computeBearing(prevLat, prevLng, droneLat, droneLng);
		console.log(`Using trail-based FOV direction: ${heading.toFixed(1)}°`);
	}

	const halfAngle = 20; // degrees
	const range = 150; // meters

	const left = destinationPoint(droneLat, droneLng, heading - halfAngle, range);
	const right = destinationPoint(
		droneLat,
		droneLng,
		heading + halfAngle,
		range,
	);

	return [
		[droneLat, droneLng],
		[left.lat, left.lng],
		[right.lat, right.lng],
	];
}

// Component to handle initial map view setup only
function MapViewController({ droneList }) {
	const map = useMap();
	const [hasInitialized, setHasInitialized] = React.useState(false);

	useEffect(() => {
		// Only fit bounds once when first drones appear
		if (!hasInitialized && droneList.length > 0) {
			const bounds = droneList
				.filter((d) => d.lat != null && d.lng != null)
				.map((d) => [d.lat, d.lng]);

			if (bounds.length > 0) {
				map.fitBounds(bounds, {
					padding: [50, 50],
					maxZoom: 18,
					animate: true,
					duration: 0.5,
				});
				setHasInitialized(true);
			}
		}
	}, [droneList, droneList.length, map, hasInitialized]);

	return null;
}

// Component to handle zoom when a drone is selected
function DroneZoomController({ selectedDroneId, drones }) {
	const map = useMap();
	const prevSelectedRef = React.useRef(null);

	useEffect(() => {
		// Only zoom if selection changed and a drone is selected
		if (selectedDroneId && selectedDroneId !== prevSelectedRef.current) {
			const drone = drones[selectedDroneId];

			// Check if drone exists and has valid coordinates
			if (drone && drone.lat != null && drone.lng != null) {
				// Zoom to the selected drone with smooth animation
				map.flyTo([drone.lat, drone.lng], 17, {
					animate: true,
					duration: 1.0, // 1 second animation
				});
				// This fixes the blank tile issue when visiting new map areas
				const handleFlyEnd = () => {
					map.invalidateSize();
					map.off('flyend', handleFlyEnd);
				};
				map.once('flyend', handleFlyEnd);
				// Also invalidate immediately to ensure tiles start loading
				setTimeout(() => {
					map.invalidateSize();
				}, 100);
			}

			prevSelectedRef.current = selectedDroneId;
		}
	}, [selectedDroneId, drones, map]);

	return null;
}
// Component to add dark overlay pane
function DarkOverlayPane() {
	const map = useMap();

	useEffect(() => {
		// Create custom pane for dark overlay
		if (!map.getPane('darkOverlay')) {
			const pane = map.createPane('darkOverlay');
			// Set z-index to be above tiles (200) but below overlays (400) and markers (600)
			pane.style.zIndex = 250;
			pane.style.pointerEvents = 'none'; // Allow clicks to pass through
		}

		// Add dark overlay rectangle covering the entire map
		const bounds = map.getBounds();
		const darkOverlay = L.rectangle(bounds, {
			pane: 'darkOverlay',
			color: 'transparent',
			fillColor: '#000000',
			fillOpacity: 0.35, // 35% dark overlay
			interactive: false,
		}).addTo(map);

		// Update overlay bounds when map moves
		const updateOverlay = () => {
			const newBounds = map.getBounds();
			darkOverlay.setBounds(newBounds);
		};

		map.on('move', updateOverlay);
		map.on('zoom', updateOverlay);

		return () => {
			map.off('move', updateOverlay);
			map.off('zoom', updateOverlay);
			map.removeLayer(darkOverlay);
		};
	}, [map]);

	return null;
}

const LiveActivity = () => {
	const {
		drones,
		prevPos,
		alertStatus,
		selectedRow,
		setSelectedRow,
		historicalPaths,
	} = useData();

	const droneList = Object.values(drones);
	const alertedDronesRef = useRef(new Set());
	const knownDronesRef = useRef(new Set());
	const synth = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
	const [isAudioMuted, setIsAudioMuted] = useState(false);
	const isAudioMutedRef = useRef(false);
	isAudioMutedRef.current = isAudioMuted;
	const [activeNotification, setActiveNotification] = useState(null);

	// Auto-unlock audio and speech pipeline on user interactions
	useEffect(() => {
		const unlock = () => {
			try {
				const AudioCtx = window.AudioContext || window.webkitAudioContext;
				if (AudioCtx) {
					const ctx = new AudioCtx();
					if (ctx.state === 'suspended') {
						ctx.resume().catch(() => {});
					}
				}
				if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
					if (window.speechSynthesis.paused) {
						window.speechSynthesis.resume();
					}
				}
			} catch (_) {}
		};

		window.addEventListener('click', unlock);
		window.addEventListener('keydown', unlock);
		window.addEventListener('touchstart', unlock);

		return () => {
			window.removeEventListener('click', unlock);
			window.removeEventListener('keydown', unlock);
			window.removeEventListener('touchstart', unlock);
		};
	}, []);

	// Zone center point (constant)
	const ZONE_CENTER_LAT = 25.772876116118495;
	const ZONE_CENTER_LNG = -80.19204145277399;

	// Calculate distance from center in degrees
	const getDistanceFromCenter = useCallback((lat, lng) => {
		return Math.sqrt(
			Math.pow(lat - ZONE_CENTER_LAT, 2) + Math.pow(lng - ZONE_CENTER_LNG, 2),
		);
	}, [ZONE_CENTER_LAT, ZONE_CENTER_LNG]);

	// Determine which zone a drone is in based on distance
	const getZone = useCallback(
		(lat, lng) => {
			const distance = getDistanceFromCenter(lat, lng);

			// Approximate radii based on the polygon coordinates
			if (distance <= 0.5) return 'RED'; // Inner circle - Critical
			if (distance <= 1.0) return 'YELLOW'; // Middle circle - Warning
			if (distance <= 1.8) return 'GREEN'; // Outer circle - Near-safe
			if (distance <= 3.0) return 'BLUE'; // Stadium polygon - Broad detection
			return 'NONE';
		},
		[getDistanceFromCenter],
	);

	// Web Audio beep tone (guaranteed sound cue)
	const playAlertBeep = useCallback((zone = 'DEFAULT') => {
		try {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (!AudioCtx) return;
			const ctx = new AudioCtx();

			const freq =
				zone === 'RED' ? 980 :
				zone === 'YELLOW' ? 784 :
				zone === 'GREEN' ? 659 : 880;

			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, ctx.currentTime);

			gain.gain.setValueAtTime(0.3, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start();
			osc.stop(ctx.currentTime + 0.35);
		} catch (_) {}
	}, []);

	// Voice alert + beep function
	const speakAlert = useCallback((message, zone = 'DEFAULT') => {
		if (isAudioMutedRef.current) return;

		// 1. Play beep tone
		playAlertBeep(zone);

		// 2. Speak voice alert
		if (synth.current) {
			try {
				if (synth.current.paused) {
					synth.current.resume();
				}
				const utterance = new SpeechSynthesisUtterance(message);
				utterance.rate = 1.0;
				utterance.pitch = 1.0;
				utterance.volume = 1.0;
				utterance.lang = 'en-US';
				synth.current.speak(utterance);
			} catch (_) {}
		}
	}, [playAlertBeep]);

	// Helper to display on-screen toast for SMS/Email notifications
	const triggerAlertToast = (droneId, zone, message) => {
		setActiveNotification({ droneId, zone, message });
		setTimeout(() => {
			setActiveNotification((prev) => (prev?.droneId === droneId ? null : prev));
		}, 5000);
	};

	// Toggle audio mute/unmute
	const toggleAudioMute = () => {
		setIsAudioMuted((prev) => !prev);
	};

	// Send SMS/Email alert with AI assessment
	const sendAlertWithAI = async (droneId, zone, assessment) => {
		try {
			const isLocal = window.location.hostname === 'localhost';
			const baseUrl = isLocal ? 'http://localhost:4000' : '';

			await fetch(`${baseUrl}/api/send-zone-alert`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					drone_id: droneId,
					zone: zone,
					assessment: assessment,
				}),
			});
		} catch (error) {
			console.error('Failed to send alert:', error);
		}
	};

	// Monitor drones for zone breaches and new detection events
	useEffect(() => {
		// Only track active drones (ignore inactive drones)
		const activeDrones = droneList.filter(d => !d._isInactive);

		activeDrones.forEach((drone) => {
			const droneId = drone.drone_id || drone.id;
			if (!droneId || drone.lat == null || drone.lng == null) return;

			// 1. Detect when a new drone first appears in the active list
			if (!knownDronesRef.current.has(droneId)) {
				knownDronesRef.current.add(droneId);
				console.log(`📡 [RADAR CONTACT] New active drone detected: ${droneId} (${drone.drone_type || 'UAV'})`);
				speakAlert(`New drone detected. Drone ID: ${droneId}`);
				triggerAlertToast(droneId, 'NEW', `Radar Contact: Drone ${droneId} (${drone.drone_type || 'UAV'}) detected`);
			}

			// 2. Zone Breaches
			const currentZone = getZone(drone.lat, drone.lng);
			const alertKey = `${droneId}-${currentZone}`;
			const wasAlerted = alertedDronesRef.current.has(alertKey);

			if (currentZone !== 'NONE' && !wasAlerted) {
				// Drone entered a new zone - trigger appropriate alert
				alertedDronesRef.current.add(alertKey);

				switch (currentZone) {
					case 'BLUE':
						// Blue Zone: Browser voice alert only
						console.log(
							`🔵 BLUE ZONE: Drone ${droneId} detected in broad operational perimeter`,
						);
						speakAlert(
							`Drone detected in operational area. Drone ID: ${droneId}`
						);
						break;

					case 'GREEN':
						// Green Zone: SMS/Email with AI assessment
						console.log(
							`🟢 GREEN ZONE: Drone ${droneId} entered near-safe radius`,
						);
						speakAlert(
							`Drone approaching protected area. Drone ID: ${droneId}`
						);
						// Fetch AI assessment and send alert
						{
							const isLocal = window.location.hostname === 'localhost';
							const baseUrl = isLocal ? 'http://localhost:4000' : '';
							fetch(`${baseUrl}/api/assess-threat`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									drone_id: droneId,
									current_position: { lat: drone.lat, lng: drone.lng },
									speed: drone.speed || 0,
									altitude: drone.altitude || 0,
									direction: drone.azimuth || drone.angle || 0,
									flight_history: [],
								}),
							})
								.then((res) => res.json())
								.then((result) => {
									if (result.success) {
										sendAlertWithAI(droneId, 'GREEN', result.assessment);
										triggerAlertToast(droneId, 'GREEN', `SMS & Email Alert Dispatched for Drone ${droneId}`);
									}
								})
								.catch((err) => console.error('AI assessment failed:', err));
						}
						break;

					case 'YELLOW':
						// Yellow Zone: Heightened alerts with AI insights
						console.log(
							`🟡 YELLOW ZONE: Drone ${droneId} approaching warning radius`,
						);
						speakAlert(
							`Warning! Drone approaching restricted zone. Drone ID: ${droneId}`
						);
						// Fetch AI assessment and send alert
						{
							const isLocal = window.location.hostname === 'localhost';
							const baseUrl = isLocal ? 'http://localhost:4000' : '';
							fetch(`${baseUrl}/api/assess-threat`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									drone_id: droneId,
									current_position: { lat: drone.lat, lng: drone.lng },
									speed: drone.speed || 0,
									altitude: drone.altitude || 0,
									direction: drone.azimuth || drone.angle || 0,
									flight_history: [],
								}),
							})
								.then((res) => res.json())
								.then((result) => {
									if (result.success) {
										sendAlertWithAI(droneId, 'YELLOW', result.assessment);
										triggerAlertToast(droneId, 'YELLOW', `⚠️ Warning SMS/Email Alert Sent for Drone ${droneId}`);
									}
								})
								.catch((err) => console.error('AI assessment failed:', err));
						}
						break;

					case 'RED':
						// Red Zone: Urgent SMS/Email with full AI assessment
						console.log(
							`🔴 RED ZONE: Drone ${droneId} entered CRITICAL alert radius!`,
						);
						speakAlert(
							`Critical alert! Drone in restricted zone. Immediate response required. Drone ID: ${droneId}`
						);
						// Fetch AI assessment and send urgent alert
						{
							const isLocal = window.location.hostname === 'localhost';
							const baseUrl = isLocal ? 'http://localhost:4000' : '';
							fetch(`${baseUrl}/api/assess-threat`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									drone_id: droneId,
									current_position: { lat: drone.lat, lng: drone.lng },
									speed: drone.speed || 0,
									altitude: drone.altitude || 0,
									direction: drone.azimuth || drone.angle || 0,
									flight_history: [],
								}),
							})
								.then((res) => res.json())
								.then((result) => {
									if (result.success) {
										sendAlertWithAI(droneId, 'RED', result.assessment);
										triggerAlertToast(droneId, 'RED', `🚨 CRITICAL SMS & Email Alert Sent for Drone ${droneId}`);
									}
								})
								.catch((err) => console.error('AI assessment failed:', err));
						}
						break;

					default:
						// No action for unknown zones
						break;
				}
			}

			// Clean up old alerts when drone leaves zones
			if (currentZone === 'NONE') {
				['BLUE', 'GREEN', 'YELLOW', 'RED'].forEach((zone) => {
					alertedDronesRef.current.delete(`${droneId}-${zone}`);
				});
			}
		});

		// Clean up known drones that are no longer active
		const activeIds = new Set(activeDrones.map(d => d.drone_id || d.id));
		for (const id of knownDronesRef.current) {
			if (!activeIds.has(id)) {
				knownDronesRef.current.delete(id);
			}
		}
	}, [droneList, getZone, speakAlert]);
	// Calculate center from stadiumPolygon if no drones
	// This ensures the map centers on the current protected area (Miami coastal)
	const getPolygonCenter = (polygon) => {
		const lats = polygon.map((coord) => coord[0]);
		const lngs = polygon.map((coord) => coord[1]);
		const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
		const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
		return [centerLat, centerLng];
	};

	const center =
		droneList.length > 0 && droneList[0].lat != null
			? [droneList[0].lat, droneList[0].lng]
			: getPolygonCenter(stadiumPolygon);

	// Get selected drone and its historical path
	const selectedDrone = selectedRow ? drones[selectedRow] : null;
	const selectedHistoricalPath = selectedRow
		? historicalPaths[selectedRow]
		: null;

	return (
		<div className={styles.container}>
			{/* Real-time Alert Toast */}
			{activeNotification && (
				<div
					className={styles.alertToast}
					style={{
						borderColor:
							activeNotification.zone === 'RED'
								? '#ef4444'
								: activeNotification.zone === 'YELLOW'
								? '#f59e0b'
								: '#10b981',
					}}
				>
					<span className={styles.toastIcon}>
						{activeNotification.zone === 'RED'
							? '🚨'
							: activeNotification.zone === 'YELLOW'
							? '⚠️'
							: '📡'}
					</span>
					<span className={styles.toastText}>{activeNotification.message}</span>
				</div>
			)}

			{/* Audio Mute/Unmute Button */}
			<button
				className={styles.muteButton}
				onClick={toggleAudioMute}
				title={isAudioMuted ? 'Unmute audio alerts' : 'Mute audio alerts'}
			>
				{isAudioMuted ? (
					// Muted icon (speaker with X)
					<svg
						width='24'
						height='24'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2'
						strokeLinecap='round'
						strokeLinejoin='round'
					>
						<polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5'></polygon>
						<line x1='23' y1='9' x2='17' y2='15'></line>
						<line x1='17' y1='9' x2='23' y2='15'></line>
					</svg>
				) : (
					// Unmuted icon (speaker with sound waves)
					<svg
						width='24'
						height='24'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2'
						strokeLinecap='round'
						strokeLinejoin='round'
					>
						<polygon points='11 5 6 9 2 9 2 15 6 15 11 19 11 5'></polygon>
						<path d='M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07'></path>
					</svg>
				)}
			</button>

			<MapContainer
				center={center}
				zoom={droneList.length > 0 && droneList[0].lat != null ? 18 : 8}
				style={{ height: '100%', width: '100%' }}
			>
				<MapViewController droneList={droneList} />
				<DroneZoomController selectedDroneId={selectedRow} drones={drones} />

				{/* SATELLITE LAYER */}
				<TileLayer
					url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
					attribution='Tiles &copy; Esri'
					className='satellite-layer'
				/>

				{/* DARK OVERLAY - Semi-transparent shadow over satellite imagery */}
				<DarkOverlayPane />

				{/* PROTECTED ZONES - Four layers from GeoJSON */}

				{/* Outer Square Boundary (Blue) - Outermost protected area */}
				<Polygon
					positions={stadiumPolygon}
					pathOptions={{
						color: '#3b82f6',
						weight: 2,
						fill: true,
						fillColor: 'rgba(59,130,246,0.1)',
						fillOpacity: 0.1,
					}}
				/>

				{/* Outer Circle (Green) - Low alert zone */}
				<Polygon
					positions={outerCircle}
					pathOptions={{
						color: '#22c55e',
						weight: 2,
						fill: true,
						fillColor: 'rgba(34,197,94,0.2)',
						fillOpacity: 0.2,
					}}
				/>

				{/* Middle Circle (Yellow) - Medium alert zone */}
				<Polygon
					positions={middleCircle}
					pathOptions={{
						color: '#eab308',
						weight: 2,
						fill: true,
						fillColor: 'rgba(234,179,8,0.3)',
						fillOpacity: 0.3,
					}}
				/>

				{/* Inner Circle (Red) - High alert zone */}
				<Polygon
					positions={innerCircle}
					pathOptions={{
						color: '#ef4444',
						weight: 3,
						fill: true,
						fillColor: 'rgba(239,68,68,0.4)',
						fillOpacity: 0.4,
					}}
				/>

				{/* Center point marker for circular zones */}
				<Marker
					position={circleCenter}
					icon={centerPointIcon}
					zIndexOffset={1000}
				/>

				{droneList.map((drone) => {
					const droneId = drone.drone_id || drone.id;
					if (!droneId || drone.lat == null || drone.lng == null) return null;

					const isSelected = selectedRow === droneId;
					const isInactive = drone._isInactive === true;
					const hasPayload =
						drone.has_payload === true || alertStatus[droneId] === 'red';

					// Color logic for polygons:
					// Active (no payload): Green (#22c55e)
					// Active (with payload): Red (#ef4444)
					// Inactive (no payload): Light Yellow (#eab308)
					// Inactive (with payload): Orange (#f97316)
					let color;
					if (isInactive) {
						color = hasPayload ? '#f97316' : '#eab308'; // orange or light yellow
					} else {
						color = hasPayload ? '#ef4444' : '#22c55e'; // red or green
					}

					const trail = prevPos[droneId] || [];
					// Pass azimuth, elevation, and angle to FOV polygon builder
					const fov = buildFOVPolygon(
						drone.lat,
						drone.lng,
						trail,
						drone.azimuth,
						drone.elevation,
						drone.angle,
					);
					const historicalPath = historicalPaths[droneId] || [];

					const home = drone.home;
					const pilot = drone.pilot;

					// Debug logging for home/pilot
					if (home || pilot) {
						console.log(
							`🏠 [${droneId}] Home: ${home ? `(${home.lat}, ${home.lng})` : 'null'}, Pilot: ${pilot ? `(${pilot.lat}, ${pilot.lng})` : 'null'}`,
						);
					}

					const handleSelect = () => setSelectedRow(droneId);

					return (
						<React.Fragment key={droneId}>
							{/* Historical flight path - dotted line */}
							{historicalPath.length > 1 && (
								<Polyline
									positions={historicalPath}
									pathOptions={{
										color: isSelected ? '#a855f7' : '#8b5cf6',
										weight: isSelected ? 3 : 2,
										opacity: isSelected ? 0.8 : 0.5,
										dashArray: '10, 10',
										lineCap: 'round',
										lineJoin: 'round',
									}}
									eventHandlers={{ click: handleSelect }}
								/>
							)}
							{/* FOV cone */}
							{fov && (
								<Polygon
									positions={fov}
									pathOptions={{
										color: isSelected ? color : `${color}99`, // 99 = 60% opacity in hex
										fillColor: `${color}40`, // 40 = 25% opacity in hex
										fillOpacity: isSelected ? 0.4 : 0.2,
										weight: isSelected ? 2 : 1,
									}}
									eventHandlers={{ click: handleSelect }}
								/>
							)}

							{/* Live flight path polyline - connects trail points */}
							{trail.length > 1 && !isInactive && (
								<Polyline
									positions={trail}
									pathOptions={{
										color: isSelected ? color : `${color}CC`, // CC = 80% opacity
										weight: isSelected ? 3 : 2,
										opacity: isSelected ? 0.9 : 0.6,
										lineCap: 'round',
										lineJoin: 'round',
									}}
									eventHandlers={{ click: handleSelect }}
								/>
							)}

							{/* Drone trail markers (dots) */}
							{trail.map((pos, idx) => (
								<Marker
									key={`${droneId}-trail-${idx}`}
									position={pos}
									icon={tailIcon(color)}
									eventHandlers={{ click: handleSelect }}
								/>
							))}

							{/* Drone marker with ID label */}
							<Marker
								position={[drone.lat, drone.lng]}
								icon={droneIcon(color, droneId)}
								eventHandlers={{ click: handleSelect }}
							/>

							{/* Home marker */}
							{home && home.lat != null && home.lng != null && (
								<Marker
									position={[home.lat, home.lng]}
									icon={homeIcon}
									eventHandlers={{ click: handleSelect }}
								/>
							)}

							{/* Pilot marker */}
							{pilot && pilot.lat != null && pilot.lng != null && (
								<Marker
									position={[pilot.lat, pilot.lng]}
									icon={pilotIcon}
									eventHandlers={{ click: handleSelect }}
								/>
							)}

							{/* Lines: drone ↔ home */}
							{home && home.lat != null && home.lng != null && (
								<Polyline
									positions={[
										[drone.lat, drone.lng],
										[home.lat, home.lng],
									]}
									pathOptions={{
										color: isSelected ? '#ffffff' : '#cccccc',
										weight: isSelected ? 3 : 1.5,
									}}
									eventHandlers={{ click: handleSelect }}
								/>
							)}

							{/* Lines: drone ↔ pilot */}
							{pilot && pilot.lat != null && pilot.lng != null && (
								<Polyline
									positions={[
										[drone.lat, drone.lng],
										[pilot.lat, pilot.lng],
									]}
									pathOptions={{
										color: isSelected ? '#00ffff' : '#66ffff',
										weight: isSelected ? 3 : 1.5,
									}}
									eventHandlers={{ click: handleSelect }}
								/>
							)}
						</React.Fragment>
					);
				})}
			</MapContainer>

			{/* Risk Assessment Panel - Bottom Left */}
			<RiskAssessment
				drone={selectedDrone}
				historicalPath={selectedHistoricalPath}
			/>
		</div>
	);
};

export default LiveActivity;
