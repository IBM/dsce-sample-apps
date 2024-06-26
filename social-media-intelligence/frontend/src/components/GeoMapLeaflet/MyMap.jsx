import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import * as d3 from "d3";
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


const MyMap = ({selectedComponent}) => {
  const [data, setData] = useState([]);

  // Simulate some data with latitude, longitude, and frequency
  useEffect(() => {
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
    const points = locations;
    setData(filteredLocations);
  }, []);

  const getColor = (freq) => {
    const maxFrequency = Math.max(...data.map(point => point.Frequency));
    const colorScale = d3.scaleLinear()
      .domain([0, maxFrequency])
      .range(['yellow', 'red']);
    return colorScale(freq);
  };

  return (
    <MapContainer center={[46.7128, -80.0059]} zoom={4} style={{height: "380px", width: "350px"}}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {data.map(point => (
        <CircleMarker
          key={point.Lat + point.Long}
          center={[point.Lat, point.Long]}
          radius={point.Frequency/4} // Adjust radius based on frequency
          fillColor={getColor(point.Frequency+6)}
          fillOpacity={0.7}
          stroke={false}
        />
      ))}
    </MapContainer>
  );
};

export default MyMap;