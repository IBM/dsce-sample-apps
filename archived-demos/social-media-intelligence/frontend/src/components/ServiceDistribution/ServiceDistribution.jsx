// import React, { useState, useEffect } from 'react';
// import { Bar } from 'react-chartjs-2';
// import Chart from 'chart.js/auto';

// const ServiceDistribution = ({jsonData}) => {
//   const [chartData, setChartData] = useState({});

//   const dynamicColors = () => {
//     const r = Math.floor(Math.random() * 255);
//     const g = Math.floor(Math.random() * 255);
//     const b = Math.floor(Math.random() * 255);
//     return `rgba(${r},${g},${b},0.5)`;
//   };

//   useEffect(() => {
//     const serviceCounts = {};
//     jsonData.forEach(item => {
//       const service = item['Concern_llama'];
//       if (serviceCounts[service]) {
//         serviceCounts[service] += 1; // Increment count if already exists
//       } else {
//         serviceCounts[service] = 1; // Initialize count if does not exist
//       }
//     });

//     const backgroundColors = Object.keys(serviceCounts).map(() => dynamicColors()); // Assign a dynamic color for each service
//     console.log('backgroundColors', backgroundColors)
//     console.log('serviceCounts', serviceCounts)
//     const labeled_data = Object.keys(serviceCounts).map((serviceCount, index) => {
//       return {
//         label: serviceCount,
//         data: serviceCounts[serviceCount], // Wrapping in an array
//         backgroundColor: backgroundColors[index], // Assuming you have a corresponding color for each service
//         borderWidth: 1
//       };
//     });
//     labeled_data.sort((a, b) => {
//       // If 'data' is an array, use a[0] and b[0] or the appropriate index
//       // If 'data' is just a number, use a and b directly
//       return b.data - a.data;
//     });
    
//     // Get the top 10
//     const top10 = labeled_data.slice(0, 10);
//     const new_data = {
//       labels: Object.keys(top10),
//       datasets: top10,
//     };
//     console.log('data', new_data)
//     setChartData(new_data);
//   }, []);

//   const options = {
//     indexAxis: 'y',
//     elements: {
//       bar: {
//         borderWidth: 2,
//       },
//     },
//     responsive: true,
//     plugins: {
//       legend: {
//         display: false,
//       },
//       title: {
//         display: true,
//         text: 'Service Distribution',
//       },
//     },
//   };

//   return (<>
//   <Bar data={chartData} options={options} />
//     </>)
// }

// export default ServiceDistribution

// import React, { useState, useEffect } from 'react';
// import { Bar } from 'react-chartjs-2';
// import Chart from 'chart.js/auto';

// const ServiceDistribution = ({ jsonData }) => {
//   const [chartData, setChartData] = useState({});

//   const dynamicColors = () => {
//     const r = Math.floor(Math.random() * 255);
//     const g = Math.floor(Math.random() * 255);
//     const b = Math.floor(Math.random() * 255);
//     return `rgba(${r},${g},${b},0.5)`;
//   };

//   useEffect(() => {
//     const serviceCounts = {};
//     jsonData.forEach(item => {
//       const service = item['Concern_llama'];
//       if (serviceCounts[service]) {
//         serviceCounts[service] += 1;
//       } else {
//         serviceCounts[service] = 1;
//       }
//     });

//     const labels = Object.keys(serviceCounts);
//     const data = Object.values(serviceCounts);
//     const backgroundColors = labels.map(dynamicColors);

//     setChartData({
//       labels: labels,
//       datasets: [
//         {
//           label: 'Service Count',
//           data: data,
//           backgroundColor: backgroundColors,
//           borderWidth: 1,
//         },
//       ],
//     });
//   }, [jsonData]); // Make sure to add jsonData as a dependency here

//   const options = {
//     indexAxis: 'y', // This will create a horizontal bar chart
//     elements: {
//       bar: {
//         borderWidth: 2,
//       },
//     },
//     responsive: true,
//     plugins: {
//       legend: {
//         display: false, // Set to true if you want to display legend
//       },
//       title: {
//         display: true,
//         text: 'Service Distribution',
//       },
//     },
//     scales: {
//       x: {
//         beginAtZero: true, // Ensures that the scale starts at 0
//       },
//     },
//   };

//   return <Bar data={chartData} options={options} />;
// };

// export default ServiceDistribution;


import React, { useState, useEffect } from 'react';
import Chart from 'react-google-charts';
import cleaned_df from "./cleaned_df.json"

const ServiceDistribution = ({ jsonData,selectedComponent }) => {
 // console.log('selectedComponent', selectedComponent);
  const data = cleaned_df.filter(obj => obj['Concern'] !== "Unknown");
  //console.log("This is data")
  //console.log(data)
  const [chartData, setChartData] = useState([]);
  const [options, setOptions] = useState({
    bars: 'horizontal',
    
    legend: 'none',
    hAxis: {
      title: '# of Messages',
      minValue: 0,
    },
    vAxis: {
      title: 'Service',
    },
    colors: [],
    isStacked: true
  });

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
    //console.log('data', data);
    // Now filter jsonData based on the category, unless it's 'overall'
    const filteredData = category === "overall" 
      ? data 
      : data.filter(item => item['Carrier'] === category && !item.Concern.includes('Unknown'));
      //console.log(filteredData)
      // sortedData = sortedData.filter(obj => obj.carrier !== "Unknown");

    const serviceCounts = {};
    filteredData.forEach(item => {
      const service = item['Concern'];
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    });
    // console.log('filteredData', filteredData)
    // Convert to an array, sort by count, and take the top k
    const sortedServiceArray = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by the count
      .slice(1, 6); // Take the top k

    const chartDataArray = [['Service', 'Messages'], ...sortedServiceArray];
    // console.log('chartDataArray', chartDataArray)
     // Generate a unique color for each service
     const colorsArray = sortedServiceArray.map(() => {
      let color = '#009d9a';
      // for (let i = 0; i < 6; i++) {
      //   color += Math.floor(Math.random() * 16).toString(16);
      // }
      return color;
    });

    // console.log('colors', colorsArray)
    setChartData(chartDataArray);

    // Update the options with the generated colors
    setOptions(prevOptions => ({
      ...prevOptions,
      colors:colorsArray,
      
    }));

  }, [data,selectedComponent]);

  return (
    <div >
      
    <Chart
      width={'600px'}
      height={'460px'}
      chartType="BarChart"
      isStacked= "true"
      loader={<div>Loading Chart</div>}
      data={chartData}
      options={options}
      // For tests
      rootProps={{ 'data-testid': '2' }}
    />
    </div>
  );
};

export default ServiceDistribution;
