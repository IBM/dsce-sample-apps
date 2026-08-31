import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import ReactDOM from 'react-dom';
import "mapbox-gl/dist/mapbox-gl.css";
import "./geomap.css";
import locations from "./locations.json";

const Circle = ({ radius, opacity,category }) => {
  let r = 255;
  let g = 0;
  let b = 0;
  if(category === "TelcoA"){
    r=3;
    g=69;
    b=201;
}
else if(category === "TelcoB"){
      r=130;
      g=207;
      b = 255;
  }
  else{
      r=165;
          g=110;
          b=255;
  }
    
  const style = {
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    borderRadius: '50%',
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`, // Assuming a black circle, change the color as needed
    display: 'inline-block'
  };

  return <div style={style}></div>;
};

function normalize(value, min, max) {
  return (value - min) / (max - min);
}

const GeoMap = ({selectedComponent}) => {
    const mapContainerRef = useRef(null);
    mapboxgl.accessToken = process.env.REACT_APP_GEO_MAP_ACCESS_TOKEN;

    useEffect(() => {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-100, 50],
        zoom: 2,
      });
      // console.log('locations', locations)
      let category = "overall";
          switch (selectedComponent) {
            case 'ComponentB':
              category = "TelcoA";
              break;
            case 'ComponentC':
              category = "TelcoB";
              break;
            case 'ComponentD':
              category = "TelcoC";
              break;
            default:
              // No action needed for 'overall' as it should include all data
              break;
          }
      const filteredLocations = category === "overall" 
      ? locations 
      : locations.filter(item => item['Category'] === category );
      console.log('filteredLocations', filteredLocations)
      filteredLocations.forEach((location) => {
        // Create a React element for each marker
        const markerNode = document.createElement('div');
        ReactDOM.render(
          <Circle radius={`${5 +  (location.Frequency/8)}`} 
          opacity={`${normalize(location.Frequency,1,100) + 0.2}`} 
          category={location.Category} />,
          markerNode
        );

        // Add the marker to the map
        new mapboxgl.Marker(markerNode)
          .setLngLat([location.Long, location.Lat])
          .addTo(map);
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      return () => map.remove();
    }, [selectedComponent]);

    return (
      <div style={{position:'absolute' ,minWidth:'60%'}}>
        <div ref={mapContainerRef} className="map-container" />
      </div>
    );
};

export default GeoMap;

