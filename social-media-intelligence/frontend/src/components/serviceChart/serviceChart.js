import React, { useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
  } from 'chart.js';
  import { Bar } from 'react-chartjs-2';
import telData from './csvjson.json';
import { type } from '@testing-library/user-event/dist/type';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
  );

export const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Days Affected metrics',
      },
      scales:{
        xAxis:{
            display: true,
      }
      , 
      yAxis:{
        display:true,
      }}
    },
  };


const ServiceChart = () => {
  // Example JSON dataset
  const jsonData = telData;

  // Constants to store divided datasets
  const categoryAData = [];
  const categoryBData = [];
  const uniqueDates = [];
  const categoryADataWithFrequency = {};
  const categoryBDataWithFrequency = {};
  const daysAffectedA={};
  const daysAffectedB={};
  // ... add more categories as needed

  // Function to divide the dataset based on category
    jsonData.forEach((item) => {
      switch (item.category) {
        case 'Rogers':
          categoryAData.push(item);
          break;
        case 'Bell':
          categoryBData.push(item);
          break;
        // Add more cases for additional categories
        default:
          break;
      }
    if (!uniqueDates.includes(item.date)) {
        uniqueDates.push(item.date);
      }
    });

    uniqueDates.forEach((date) => {
        const frequency = categoryAData.filter((item) => item.date === date).length;
        // console.log("Frequency", typeof(frequency));
        categoryADataWithFrequency[date]= frequency;
      });
  
      // Calculate frequency for Category B
      uniqueDates.forEach((date) => {
        const frequency = categoryBData.filter((item) => item.date === date).length;
        categoryBDataWithFrequency[date]= frequency;
      });

    uniqueDates.forEach((date)=>{
        const dayNo= categoryAData.filter((item)=> item.date== date);
        // console.log("DAY CHECK", dayNo);
        daysAffectedA[date]= dayNo;
    });

    uniqueDates.forEach((date)=>{
        const dayNo= categoryBData.filter((item)=> item.date== date);
        // console.log("DAY CHECK", dayNo);
        daysAffectedB[date]= dayNo;
    })
  

    // You can console.log or perform any action with the divided datasets
    // console.log('Category A Data:', categoryAData);
    // console.log('Category B Data:', categoryBData);
    // console.log('Unique Dates:', uniqueDates);
    // console.log('Category A Data:', categoryADataWithFrequency);
    // console.log('Category B Data:', categoryBDataWithFrequency);
    // console.log(typeof(uniqueDates[0]))
    // console.log(uniqueDates.map((date) => categoryBDataWithFrequency[date]));
    // console.log(typeof(categoryADataWithFrequency.frequency))
    // ... perform actions for other categories

  // useEffect to trigger the dataset division on component mount
//   useEffect(() => {
//     divideDatasetByCategory();
//   }, []);

const labels= uniqueDates

  const data = {
    labels,
    datasets: [
      {
        label: 'Dataset Roger',
        data: uniqueDates.map((date) => daysAffectedA[date]),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
      {
        label: 'Dataset Bell',
        data: uniqueDates.map((date) => daysAffectedB[date]),
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };
  console.log("data", data);

  return (
    <div>
        success
        <Bar options={options} data={data} />
    </div>
  );
};
// export const data = {
//     uniqueDates,
//     datasets: [
//       {
//         label: 'Dataset Roger',
//         data: labels.map(() => categoryADataWithFrequency.frequency),
//         backgroundColor: 'rgba(255, 99, 132, 0.5)',
//       },
//       {
//         label: 'Dataset Bell',
//         data: labels.map(() => categoryBDataWithFrequency.frequency),
//         backgroundColor: 'rgba(53, 162, 235, 0.5)',
//       },
//     ],
//   };

// export function BarData(){
//     return <Bar options={options} data={data} />;

// }


export default ServiceChart;
