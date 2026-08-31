"""FleetOps Cold-Chain Simulation Backend - Main Application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from .services.simulation_engine import simulation_engine
from .services.persistence_service import get_persistence_service
from .config.settings import load_config
from .api import trucks, weather, routes, cargo, stations, alerts, persistence, admin, agents


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI application"""
    # Startup
    print("=" * 60)
    print("Starting FleetOps Simulation Backend...")
    print("=" * 60)
    
    # Load configuration
    config = load_config()
    print(f"✓ Configuration loaded")
    
    # Initialize persistence service
    persistence_service = get_persistence_service()
    if persistence_service.enabled:
        print(f"✓ Persistence enabled: {config.persistence.type}")
    else:
        print("○ Persistence disabled")
    
    # Inject persistence service into API modules
    persistence.set_persistence_service(persistence_service)
    admin.set_persistence_service(persistence_service)
    
    # Initialize simulation
    await simulation_engine.initialize()
    
    # Save initial data if persistence enabled
    if persistence_service.enabled and config.persistence.levels.initial_data:
        print("→ Saving initial data...")
        from .services.truck_service import truck_service
        from .services.station_service import station_service
        from .services.weather_service import weather_service
        
        trucks = list(truck_service.trucks.values())
        stations = list(station_service.stations.values())
        
        # Collect weather data from all trucks
        weather = []
        for truck_id, segments in weather_service.weather_by_truck.items():
            for segment in segments:
                weather.append(segment.dict())
        
        alerts = list(simulation_engine.alerts.values())
        incidents = list(simulation_engine.incidents.values())
        
        await persistence_service.save_state(trucks, stations, weather, alerts, incidents)
        print("✓ Initial data saved")
    
    # Start simulation in background
    simulation_task = asyncio.create_task(simulation_engine.start())
    
    # Start periodic persistence task if enabled
    persistence_task = None
    if persistence_service.enabled and persistence_service.should_persist_on_interval():
        async def periodic_save():
            """Periodically save simulation state"""
            interval = persistence_service.get_interval_seconds()
            while True:
                await asyncio.sleep(interval)
                try:
                    from .services.truck_service import truck_service
                    from .services.station_service import station_service
                    from .services.weather_service import weather_service
                    
                    trucks = list(truck_service.trucks.values())
                    stations = list(station_service.stations.values())
                    
                    # Collect weather data from all trucks
                    weather = []
                    for truck_id, segments in weather_service.weather_by_truck.items():
                        for segment in segments:
                            weather.append(segment.dict())
                    
                    alerts = list(simulation_engine.alerts.values())
                    incidents = list(simulation_engine.incidents.values())
                    
                    await persistence_service.save_state(trucks, stations, weather, alerts, incidents)
                except Exception as e:
                    print(f"✗ Periodic save error: {e}")
        
        persistence_task = asyncio.create_task(periodic_save())
        print(f"✓ Periodic persistence enabled (every {persistence_service.get_interval_seconds()}s)")
    
    print("=" * 60)
    print("✓ FleetOps Simulation Backend started successfully")
    print(f"  API Base: http://localhost:8085")
    print(f"  API Docs: http://localhost:8085/docs")
    print(f"  Simulation Speed: {config.simulation.speed_multiplier}x")
    print(f"  Update Interval: {config.simulation.update_interval}s")
    if persistence_service.enabled:
        print(f"  Persistence: {config.persistence.type} (interval: {persistence_service.get_interval_seconds()}s)")
    print("=" * 60)
    
    yield
    
    # Shutdown
    print("\n" + "=" * 60)
    print("Shutting down FleetOps Simulation Backend...")
    print("=" * 60)
    
    # Save final state if persistence enabled
    if persistence_service.enabled:
        print("→ Saving final state...")
        from .services.truck_service import truck_service
        from .services.station_service import station_service
        from .services.weather_service import weather_service
        
        trucks = list(truck_service.trucks.values())
        stations = list(station_service.stations.values())
        
        # Collect weather data from all trucks
        weather = []
        for truck_id, segments in weather_service.weather_by_truck.items():
            for segment in segments:
                weather.append(segment.dict())
        
        alerts = list(simulation_engine.alerts.values())
        incidents = list(simulation_engine.incidents.values())
        
        await persistence_service.save_state(trucks, stations, weather, alerts, incidents)
    
    await simulation_engine.stop()
    simulation_task.cancel()
    try:
        await simulation_task
    except asyncio.CancelledError:
        pass
    
    # Cancel persistence task if running
    if persistence_task:
        persistence_task.cancel()
        try:
            await persistence_task
        except asyncio.CancelledError:
            pass
    
    print("✓ FleetOps Simulation Backend shut down successfully")
    print("=" * 60)


# Create FastAPI application
app = FastAPI(
    title="FleetOps Cold-Chain Simulation Backend",
    description="Python-based stateful simulation backend for FleetOps cold-chain logistics",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - health check"""
    return {
        "status": "running",
        "service": "FleetOps Cold-Chain Simulation Backend",
        "version": "1.0.0",
        "simulation_active": simulation_engine.running
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "simulation_running": simulation_engine.running,
        "trucks_count": len(simulation_engine.trucks_with_incidents),
        "incidents_count": len(simulation_engine.incidents),
        "alerts_count": len(simulation_engine.alerts)
    }


# Include API routers
app.include_router(trucks.router, prefix="/api", tags=["Trucks"])
app.include_router(weather.router, prefix="/api", tags=["Weather"])
app.include_router(routes.router, prefix="/api", tags=["Routes"])
app.include_router(cargo.router, prefix="/api", tags=["Cargo"])
app.include_router(stations.router, prefix="/api", tags=["Stations"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(persistence.router, prefix="/api/persistence", tags=["Persistence"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8085)

# Made with Bob
