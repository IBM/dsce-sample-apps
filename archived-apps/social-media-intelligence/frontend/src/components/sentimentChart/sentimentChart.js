import React, { useEffect, useState } from 'react';
import telData from './csvjson.json';
import { Chart } from "react-google-charts";
import { Button } from 'carbon-components-react';

const SentimentAnalysis = ({selectedComponent}) => {
  // Example JSON dataset with a "sentiment" column
  const jsonData =telData;
  const categoryAData = [];
  const categoryBData = [];
  const categoryCData = [];

  jsonData.forEach((item) => {
    switch (item.Carrier) {
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
    }});

  // State to store sentiment percentages
  const [sentimentPercentagesA, setSentimentPercentagesA] = useState([
    ["Sentiment", "Percentage"],
    ["Positive", 0],
    ["Neutral", 0],
    ["Negative", 0],
  ]);

  const [sentimentPercentagesB, setSentimentPercentagesB] = useState([
    ["Sentiment", "Percentage"],
    ["Positive", 0],
    ["Neutral", 0],
    ["Negative", 0],
  ]);

  const [sentimentPercentagesC, setSentimentPercentagesC] = useState([
    ["Sentiment", "Percentage"],
    ["Positive", 0],
    ["Neutral", 0],
    ["Negative", 0],
  ]);

  const [sentimentPercentages, setSentimentPercentages] = useState([
    ["Sentiment", "Percentage"],
    ["Positive", 0],
    ["Neutral", 0],
    ["Negative", 0],
  ]);

  // Function to calculate sentiment percentages
  const calculateSentimentPercentages = () => {
    const totalTweets = jsonData.length;

    // Calculate counts for each sentiment
    const positiveCount = jsonData.filter((item) => item.Sentiment === 'Positive').length;
    const neutralCount = jsonData.filter((item) => item.Sentiment === 'Neutral').length;
    const negativeCount = jsonData.filter((item) => item.Sentiment === 'Negative').length;

    // Calculate percentages
    const positivePercentage = (positiveCount / totalTweets) * 100;
    const neutralPercentage = (neutralCount / totalTweets) * 100;
    const negativePercentage = (negativeCount / totalTweets) * 100;

    // Update state with sentiment percentages
    setSentimentPercentages([
        ["Sentiment", "Percentage"],
        ["Positive", positivePercentage],
        ["Neutral", neutralPercentage],
        ["Negative", negativePercentage],
      ]);
    };

    const calculateSentimentPercentagesA = () => {
        const totalTweets = categoryAData.length;
    
        // Calculate counts for each sentiment
        const positiveCount = categoryAData.filter((item) => item.Sentiment === 'Positive').length;
        const neutralCount = categoryAData.filter((item) => item.Sentiment === 'Neutral').length;
        const negativeCount = categoryAData.filter((item) => item.Sentiment === 'Negative').length;
    
        // Calculate percentages
        const positivePercentage = (positiveCount / totalTweets) * 100;
        const neutralPercentage = (neutralCount / totalTweets) * 100;
        const negativePercentage = (negativeCount / totalTweets) * 100;
    
        // Update state with sentiment percentages
        setSentimentPercentagesA([
            ["Sentiment", "Percentage"],
            ["Positive", positivePercentage],
            ["Neutral", neutralPercentage],
            ["Negative", negativePercentage],
          ]);
        };

        const calculateSentimentPercentagesB = () => {
            const totalTweets = categoryBData.length;
        
            // Calculate counts for each sentiment
            const positiveCount = categoryBData.filter((item) => item.Sentiment === 'Positive').length;
            const neutralCount = categoryBData.filter((item) => item.Sentiment === 'Neutral').length;
            const negativeCount = categoryBData.filter((item) => item.Sentiment === 'Negative').length;
        
            // Calculate percentages
            const positivePercentage = (positiveCount / totalTweets) * 100;
            const neutralPercentage = (neutralCount / totalTweets) * 100;
            const negativePercentage = (negativeCount / totalTweets) * 100;
        
            // Update state with sentiment percentages
            setSentimentPercentagesB([
                ["Sentiment", "Percentage"],
                ["Positive", positivePercentage],
                ["Neutral", neutralPercentage],
                ["Negative", negativePercentage],
              ]);
            };

            const calculateSentimentPercentagesC = () => {
              const totalTweets = categoryCData.length;
          
              // Calculate counts for each sentiment
              const positiveCount = categoryCData.filter((item) => item.Sentiment === 'Positive').length;
              const neutralCount = categoryCData.filter((item) => item.Sentiment === 'Neutral').length;
              const negativeCount = categoryCData.filter((item) => item.Sentiment === 'Negative').length;
          
              // Calculate percentages
              const positivePercentage = (positiveCount / totalTweets) * 100;
              const neutralPercentage = (neutralCount / totalTweets) * 100;
              const negativePercentage = (negativeCount / totalTweets) * 100;
          
              // Update state with sentiment percentages
              setSentimentPercentagesC([
                  ["Sentiment", "Percentage"],
                  ["Positive", positivePercentage],
                  ["Neutral", neutralPercentage],
                  ["Negative", negativePercentage],
                ]);
              };
  
  // useEffect to trigger sentiment calculation on component mount
  useEffect(() => {
    calculateSentimentPercentages();
  }, [selectedComponent]);

  useEffect(() => {
    calculateSentimentPercentagesA();
  }, [selectedComponent]);
  useEffect(() => {
    calculateSentimentPercentagesB();
  }, [selectedComponent]);
  useEffect(() => {
    calculateSentimentPercentagesC();
  }, [selectedComponent]);


  

  const options = {
    slices: {
      0: { color: "#009d9a" },
      1: { color: "#3ddbd9" },
      2: {color: "#9ef0f0"}
    },
  };

  return (
    <div>
      <div style={{maxHeight:'400px'}}>
        {selectedComponent === 'ComponentA' && 
        <Chart
        chartType="PieChart"
        data={sentimentPercentages}
        options={options}
        width={"700px"}
        height={"600px"}
      />}
        {selectedComponent === 'ComponentB' && <Chart
      chartType="PieChart"
      data={sentimentPercentagesA}
      options={options}
      width={"700px"}
      height={"600px"}
    />}
        {selectedComponent === 'ComponentC' && 
        <Chart
        chartType="PieChart"
        data={sentimentPercentagesB}
        options={options}
        width={"700px"}
        height={"600px"}
      />}

  {selectedComponent === 'ComponentD' && 
          <Chart
          chartType="PieChart"
          data={sentimentPercentagesC}
          options={options}
          width={"700px"}
          height={"600px"}
        />}
        </div>


    </div>
  );
};

export default SentimentAnalysis;
