import React, { useEffect , useState} from 'react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
  } from "chart.js";
  import { Scatter } from "react-chartjs-2";
import telData from './csvjson.json';
import { type } from '@testing-library/user-event/dist/type';
import { Chart } from "react-google-charts";
import { Button } from 'carbon-components-react';
import TelcoData from './dataFile';



ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

export const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Chart.js Bar Chart',
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


const ScatterChart = ({selectedComponent}) => {


  // Example JSON dataset
  const jsonData = telData.map(({ date, Days_Affected, category }) => ({ date, Days_Affected, category }));;

  // Constants to store divided datasets
  const categoryAData = [];
  const categoryBData = [];
  const categoryCData = [];

  const uniqueDates = [];
  const categoryADataWithFrequency = {};
  const categoryBDataWithFrequency = {};
  const categoryCDataWithFrequency = {};
  const [mergedData, setMergedData] = useState([]);
  

  // ... add more categories as needed

  // Function to divide the dataset based on category
    jsonData.forEach((item) => {
      switch (item.category) {
        case 'TelcoA':
          categoryAData.push(item);
          break;
        case 'TelcoB':
          categoryBData.push(item);
          break;
        case 'TelcoC':
          categoryCData.push(item);
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
        console.log("Frequency", typeof(frequency));
        categoryADataWithFrequency[date]= frequency;
      });
  
      // Calculate frequency for Category B
      uniqueDates.forEach((date) => {
        const frequency = categoryBData.filter((item) => item.date === date).length;
        categoryBDataWithFrequency[date]= frequency;
      });

      uniqueDates.forEach((date) => {
        const frequency = categoryBData.filter((item) => item.date === date).length;
        categoryCDataWithFrequency[date]= frequency;
      });
  

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

// const labels= uniqueDates

//   const data = {
//     labels,
//     datasets: [
//       {
//         label: 'Dataset TelcoA',
//         data: uniqueDates.map((date) => categoryADataWithFrequency[date]),
//         backgroundColor: '#B80000',
//       },
//       {
//         label: 'Dataset TelcoB',
//         data: uniqueDates.map((date) => categoryBDataWithFrequency[date]),
//         backgroundColor: '#FF9800',
//       },
//       {
//         label: 'Dataset TelcoC',
//         data: uniqueDates.map((date) => categoryCDataWithFrequency[date]),
//         backgroundColor: '#1640D6',
//       },
//     ],
//   };


 
const telco= jsonData.map(({ date, Days_Affected }) => ({ date, Days_Affected }));;
const telcoA= categoryAData.map(({ date, Days_Affected }) => ({ date, Days_Affected }));;
const telcoB= categoryBData.map(({ date, Days_Affected }) => ({ date, Days_Affected }));;
const telcoC= categoryCData.map(({ date, Days_Affected }) => ({ date, Days_Affected }));;
// const [selectedComponent, setSelectedComponent] = useState();
  // const handleButtonClick = (componentName) => {
  //   setSelectedComponent(componentName);
  // };




 
  
  const telcoDays = [['Days_Affected', 'Date'],
  [ '2023-06-12', 2],
[ '2023-06-08', 4],
[ '2023-06-07', 3],
['2023-06-07', 12],
['2023-06-07', 12],
[ '2023-06-07',6],
[ '2023-06-07', 4],
['2023-06-07', 7],
];

const telcoDaysA = [['Days_Affected', 'Date'],
  [ '2023-06-12', 7],
[ '2023-06-08', 9],
[ '2023-06-07', 3],
['2023-06-07', 8],
['2023-06-07', 8],
[ '2023-06-07',0],
[ '2023-06-07', 4],
['2023-06-07', 7],
];

const telcoDaysB = [['Days_Affected', 'Date'],
  [ '2023-06-12', 8],
[ '2023-06-08', 4],
[ '2023-06-07', 3],
['2023-06-07', 1],
['2023-06-06', 12],
[ '2023-06-07',65],
[ '2023-06-07', 7],
['2023-06-07', 5],
];

const telcoDaysC = [['Days_Affected', 'Date'],
  [ '2023-06-12', 20],
[ '2023-06-08', 4],
[ '2023-06-07', 3],
['2023-06-07', 9],
['2023-06-07', 12],
[ '2023-06-07',60],
[ '2023-06-07', 4],
['2023-06-08', 7],
];




  const data= telcoDays;

  const options = {
    title: "No. of days customer was impacted",
    curveType: "function",
    legend: { position: "bottom" },
    colors: ['#8400C7']
    
  };
  

  
  return (

    <div style={{zIndex: "100", opacity: "100"}}>
     




      <div >
        {selectedComponent === 'ComponentA' && 
        <Chart
        chartType="ScatterChart"
        width="80%"
        height="400px"
        data={telcoDays}
        options={options}
      />}
        {selectedComponent === 'ComponentB' && <Chart
      chartType="ScatterChart"
      width="80%"
      height="400px"
      data={telcoDaysA}
      options={options}
    />}
        {selectedComponent === 'ComponentC' && 
        <Chart
        chartType="ScatterChart"
        width="80%"
        height="400px"
        data={telcoDaysB}
        options={options}
      />}

  {selectedComponent === 'ComponentD' && 
          <Chart
          chartType="ScatterChart"
          width="80%"
          height="400px"
          data={telcoDaysC}
          options={options}
        />}
        </div>


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




export default ScatterChart;
