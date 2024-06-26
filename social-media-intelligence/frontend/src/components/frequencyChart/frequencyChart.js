import React, { useState, useEffect } from 'react';
import { Chart, Tooltip } from 'chart.js';
import 'chartjs-plugin-datalabels';
import data from './csvjson.json';


Chart.register(require('chartjs-plugin-datalabels')); 


const jsonData = data;

function FrequencyChart(){
  const [filteredData, setFilteredData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const frequencies = {};
    data.forEach((item) => {
      frequencies[item.category] = (frequencies[item.category] || 0) + 1;
    });

    const chartData = Object.entries(frequencies).map(([category, frequency]) => ({
        label: category,
        data: [frequency],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      }));

      setFilteredData(chartData);
  }, [data]);

  const handleCategoryChange = (event) => {
    setSelectedCategory(event.target.value);
    setFilteredData(
      filteredData.filter((item) => item.label === selectedCategory)
    );
  };

  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    plugins: {
        datalabels: {
          anchor: 'end', // Adjust position as needed
          align: 'top',
          formatter: (value, context) => {
            // Customize label formatting based on value and context
            return `${context.chart.data.labels[context.dataIndex]}: ${value}`;
          }, // Adjust alignment as needed
        },
      },
  };

  return (
    <></>
    );

};

export default FrequencyChart;