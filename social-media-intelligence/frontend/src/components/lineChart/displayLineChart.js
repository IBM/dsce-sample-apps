import React from 'react';
import LineChart from './lineChart';
import * as d3 from 'd3';
import dataset from './data.json';

const DisplayLine = () => {
  const jsonDataset = dataset;

  const parseTime = d3.timeParse("%d-%b-%y");
  // You may need to parse the date strings to a valid Date object
  const formattedData = jsonDataset.map((entry) => ({
    ...entry,
    Date: parseTime(entry.Date),
  }));
  

  return (
    <div>
      <h1>Your Line Chart</h1>
      <LineChart data={formattedData} />
    </div>
  );
};

export default DisplayLine;