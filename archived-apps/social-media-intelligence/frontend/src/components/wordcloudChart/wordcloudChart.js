import React, { useEffect, useState } from 'react';
import telData from './csvdata.json';
import { WordCloudChart } from "@carbon/charts-react";
import "@carbon/charts/styles.css";
import './plex-and-carbon-component.css';
import WordCloud from './WordCloud';
import allData from './allData.json';
const initialData = telData;



const generateNewDataset = (originalData) => {
  const newData = [];
  

  // Initialize an object to store counts for each tone and carrier
  const toneCarrierCounts = {};

  // console.log("originalData",originalData);
  // Iterate through the original dataset
  originalData.forEach(({ tone, carrier }) => {
    // Check if the tone exists in the counts object
    if (!toneCarrierCounts[tone]) {
      toneCarrierCounts[tone] = {};
    }

    // Check if the carrier exists for the tone
    if (!toneCarrierCounts[tone][carrier]) {
      toneCarrierCounts[tone][carrier] = 1;
    } else {
      toneCarrierCounts[tone][carrier]++;
    }
  });

  // Convert the counts into the desired format
  Object.keys(toneCarrierCounts).forEach((tone) => {
    Object.keys(toneCarrierCounts[tone]).forEach((carrier) => {
      const value = toneCarrierCounts[tone][carrier];
      newData.push({ text: tone, value: value, group: carrier });
    });
  });
  return newData;
};

const WordChart= ({selectedComponent}) => {
  const [newDataset, setNewDataset] = useState([]);
  const [data,setData] = useState(null);

  useEffect(() => {
    // Call the function to generate the new dataset
    const generatedData = generateNewDataset(initialData);
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
    const filteredData = category === "overall" 
      ? allData
      : generatedData.filter(item => item['group'] === category );
    setNewDataset(filteredData);
    setData(filteredData);

  }, [selectedComponent]);

  

//   const state= {
//     data: worddata,
//     options: {
//         "title": "Word cloud",
//         "resizable": true,
//         "color": {
//             "pairing": {
//                 "option": 3
//             }
//         },
//         "height": "400px"
//     }
//         };
  
const options= {
                "title": "Word cloud",
                "resizable": true,
                "color": {
                    "pairing": {
                        "option": 3
                    }
                },
                "height": "400px"
            }

  return (
    <div>
     
      {data &&
      
      <WordCloud words={data} selectedComponent={selectedComponent}/>
      }
        {/* {data && 
        <WordCloudChart>
            data={data}
			options={options}
        </WordCloudChart>
            } */}
    </div>
  );
};

export default WordChart;
