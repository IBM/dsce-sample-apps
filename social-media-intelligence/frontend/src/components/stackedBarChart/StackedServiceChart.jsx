import React from "react";
import { Chart } from "react-google-charts";

export const data = [
  ["Service", "TelcoA", "TelcoB", "TelcoC"],
  ["Service Quality", 1200, 1020, 2400],
  ["Service Outage", 520, 400, 1900],
  ["Pricing", 350, 250, 700],
  ["Billing Issues", 200, 230, 600],
  ["Security", 50, 10, 20],
];

export const data1 = [
  ["Service", "TelcoA"],
  ["Service Quality", 1200],
  ["Service Outage", 520],
  ["Pricing", 350],
  ["Billing Issues", 200],
  ["Security", 50],
];

export const data2 = [
  ["Service", "TelcoB"],
  ["Service Quality", 1020],
  ["Service Outage", 400],
  ["Pricing", 250],
  ["Billing Issues", 230],
  ["Security", 10],
];

export const data3 = [
  ["Service", "TelcoC"],
  ["Service Quality", 2400],
  ["Service Outage", 1900],
  ["Pricing", 700],
  ["Billing Issues", 600],
  ["Security", 20],
];

export const options = {
  title: "Issues reported",
  chartArea: { width: "550px" },
  colors: ["#0345C9", "#82cfff", "#a56eff"],
  isStacked: true,
  hAxis: {
    title: "# of messages",
    minValue: 0,
  },
  vAxis: {
    title: "Service",
  },
};

export const options1 = {
  title: "Issues reported",
  chartArea: { width: "550px" },
  colors: ["#0345C9"],
  isStacked: true,
  hAxis: {
    title: "# of messages",
    minValue: 0,
  },
  vAxis: {
    title: "Service",
  },
};

export const options2 = {
  title: "Issues reported",
  chartArea: { width: "550px" },
  colors: ["#82cfff"],
  isStacked: true,
  hAxis: {
    title: "# of messages",
    minValue: 0,
  },
  vAxis: {
    title: "Service",
  },
};

export const options3 = {
  title: "Issues reported",
  chartArea: { width: "550px" },
  colors: ["#a56eff"],
  legend: { position: "none" },
  isStacked: true,
  hAxis: {
    title: "# of messages",
    minValue: 0,
  },
  vAxis: {
    title: "Service",
  },
};

export default function StackedServiceChart({ selectedComponent }) {
  return (
    <>
      {selectedComponent === "ComponentA" && (
        <Chart
          chartType="BarChart"
          width="550px"
          height="400px"
          data={data}
          options={options}
        />
      )}

      {selectedComponent === "ComponentB" && (
        <Chart
          chartType="BarChart"
          width="550px"
          height="400px"
          data={data1}
          options={options1}
        />
      )}

      {selectedComponent === "ComponentC" && (
        <Chart
          chartType="BarChart"
          width="550px"
          height="400px"
          data={data2}
          options={options2}
        />
      )}

      {selectedComponent === "ComponentD" && (
        <Chart
          chartType="BarChart"
          width="550px"
          height="400px"
          data={data3}
          options={options3}
        />
      )}
    </>
  );
}
