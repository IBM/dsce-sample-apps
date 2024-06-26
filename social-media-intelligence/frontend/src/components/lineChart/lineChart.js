import * as d3 from 'd3';
import React, { useEffect, useRef } from 'react';
import dataset from './data.json';




const MultiLineChart = ({selectedComponent}) => {
  const ref = useRef();
  const getDataset = (selectedComponent) => {
    if (selectedComponent==='ComponentA'){
      return dataset;
    }
    else if ( selectedComponent=== 'ComponentB'){
      console.log(dataset.filter(item => item['carrier'] === 'TelcoA'))
      return dataset.filter(item => item['carrier'] === 'TelcoA')
      

    }
    else if ( selectedComponent=== 'ComponentC'){
      console.log(dataset.filter(item => item['carrier'] === 'TelcoB'))
      return dataset.filter(item => item['carrier'] === 'TelcoB')
      

    }
    else {
      console.log(dataset.filter(item => item['carrier'] === 'TelcoC'))
      return dataset.filter(item => item['carrier'] === 'TelcoC')
      

    }

  }
  
  const dimensions = { width: 400, height: 400, };

  const carrierColors = {
    'TelcoA': '#0345C9', // Teal
    'TelcoB': '#82cfff', // Mustard
    'TelcoC': '#a56eff'  // Ruby
  };



  
  
  useEffect(() => {
    const data = getDataset(selectedComponent);


    
    if (data && data.length === 0) return;
    console.log("DAAAATTTTA", data);

    // Clear the SVG to prevent duplication
    d3.select(ref.current).selectAll("*").remove();
    // Set the dimensions and margins of the graph
    const margin = { top: 10, right: 30, bottom: 30, left: 60 },
     // width = dimensions.width - margin.left - margin.right,
      width = 350,
      //height = dimensions.height - margin.top - margin.bottom;
      height = 375;

    // Append the svg object to the body of the page
    const svg = d3.select(ref.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const parseTime = d3.timeParse("%d-%b-%y");
    // Format the data
    const formattedData = data.map(d => ({
      ...d,
      Date: parseTime(d.Date)
    }));

    // Group the data: one array for each value of the X axis.
    const sumstat = d3.group(formattedData, d => d.carrier);

    // Add X axis --> it is a date format
    const x = d3.scaleTime()
      .domain(d3.extent(formattedData, d => d.Date))
      .range([0, width]);
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5));

    // Add Y axis
    const y = d3.scaleLinear()
      .domain([0, d3.max(formattedData, d => d.repeat_user_messages)])
      .range([height, 0]);
    svg.append("g")
      .call(d3.axisLeft(y));

    // color palette
    const color = d3.scaleOrdinal()
      .domain(Object.keys(carrierColors))
      .range(Object.values(carrierColors));

    // Draw the line
    svg.selectAll(".line")
      .data(sumstat)
      .join("path")
        .attr("fill", "none")
        .attr("stroke", d => color(d[0]))
        .attr("stroke-width", 1.5)
        .attr("d", function(d){
          return d3.line()
            .x(d => x(d.Date))
            .y(d => y(d.repeat_user_messages))
            (d[1])
        });

  }, [ selectedComponent, dimensions]); // Redraw chart if data or dimensions change

  return (
    <div>

      <br></br>
    <svg ref={ref}></svg>
    </div>
  );
}

export default MultiLineChart;