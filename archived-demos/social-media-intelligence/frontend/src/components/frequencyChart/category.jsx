import React, { useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import telData from "./csvjson.json";
import { type } from "@testing-library/user-event/dist/type";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const options = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    legend: {
      display: true,
    },

    scales: {
      xAxis: {
        display: true,
      },
      yAxis: {
        display: true,
      },
    },
  },
  height: 500,
};

const DatasetDivider = ({ selectedComponent }) => {
  // Example JSON dataset
  // const jsonData = telData;
  const jsonData1 = telData
    .slice()
    .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
  // this.setState({ data: sortedData });
  const jsonData = jsonData1;

  // Constants to store divided datasets
  const categoryAData = [];
  const categoryBData = [];
  const categoryCData = [];

  const uniqueDates = [];
  const categoryADataWithFrequency = {};
  const categoryBDataWithFrequency = {};
  const categoryCDataWithFrequency = {};
  const categoryALLDataWithFrequency = {};

  // ... add more categories as needed

  // Function to divide the dataset based on category
  jsonData.forEach((item) => {
    switch (item.Carrier) {
      case "TelcoA":
        categoryAData.push(item);
        break;
      case "TelcoB":
        categoryBData.push(item);
        break;
      case "TelcoC":
        categoryCData.push(item);
        break;
      // Add more cases for additional categories
      default:
        break;
    }
    if (!uniqueDates.includes(item.Timestamp)) {
      uniqueDates.push(item.Timestamp);
    }
  });

  uniqueDates.forEach((Timestamp) => {
    const frequency = categoryAData.filter(
      (item) => item.Timestamp === Timestamp
    ).length;
    console.log("Frequency", typeof frequency);
    categoryADataWithFrequency[Timestamp] = frequency;
  });

  uniqueDates.forEach((Timestamp) => {
    const frequency = categoryAData.filter(
      (item) => item.Timestamp === Timestamp
    ).length;
    console.log("Frequency", typeof frequency);
    categoryALLDataWithFrequency[Timestamp] = frequency;
  });

  // Calculate frequency for Category B
  uniqueDates.forEach((Timestamp) => {
    const frequency = categoryBData.filter(
      (item) => item.Timestamp === Timestamp
    ).length;
    categoryBDataWithFrequency[Timestamp] = frequency;
  });

  uniqueDates.forEach((Timestamp) => {
    const frequency = categoryCData.filter(
      (item) => item.Timestamp === Timestamp
    ).length;
    categoryCDataWithFrequency[Timestamp] = frequency;
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

  const labels = uniqueDates;

  const dataAll = {
    labels,
    datasets: [
      {
        label: "TelcoA",
        data: uniqueDates.map(
          (Timestamp) => categoryADataWithFrequency[Timestamp]
        ),
        backgroundColor: "#0345C9",
      },
      {
        label: "TelcoB",
        data: uniqueDates.map(
          (Timestamp) => categoryBDataWithFrequency[Timestamp]
        ),
        backgroundColor: "#82cfff",
      },
      {
        label: "TelcoC",
        data: uniqueDates.map(
          (Timestamp) => categoryCDataWithFrequency[Timestamp]
        ),
        backgroundColor: "#a56eff",
      },
    ],
  };
  const dataA = {
    labels,
    datasets: [
      {
        label: "TelcoA",
        data: uniqueDates.map(
          (Timestamp) => categoryADataWithFrequency[Timestamp]
        ),
        backgroundColor: "#0345c9",
      },
    ],
  };
  const dataB = {
    labels,
    datasets: [
      {
        label: "TelcoB",
        data: uniqueDates.map(
          (Timestamp) => categoryBDataWithFrequency[Timestamp]
        ),
        backgroundColor: "#82cfff",
      },
    ],
  };
  const dataC = {
    labels,
    datasets: [
      {
        label: "TelcoC",
        data: uniqueDates.map(
          (Timestamp) => categoryCDataWithFrequency[Timestamp]
        ),
        backgroundColor: "#a56eff",
      },
    ],
  };
  let data;
  console.log("data", data);
  console.log(selectedComponent);
  console.log("THIS IS THE PRINTING");

  return (
    <div
      style={{
        border: "1px solid lightgray",
        borderRadius: "4px",
        padding: "2rem",
      }}
    >
      <h6 style={{ fontSize: "12px", marginBottom: "1rem" }}>
        {" "}
        Social media post
      </h6>
      {/* 
    <Bar options={options} data={data} />
  */}
      <div>
        <div>
          {selectedComponent === "ComponentA" && (
            <Bar data={dataAll} options={options} />
          )}
          {selectedComponent === "ComponentB" && (
            <Bar data={dataA} options={options} />
          )}
          {selectedComponent === "ComponentC" && (
            <Bar data={dataB} options={options} />
          )}

          {selectedComponent === "ComponentD" && (
            <Bar data={dataC} options={options} />
          )}
        </div>
      </div>
      {/*} <Bar
          data={dataA}
          options={options}
          width={"100%"}
          height={"400px"}
/> */}
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

export default DatasetDivider;
