import React, { useEffect, useState } from 'react'
import { LineChart } from '@carbon/charts-react'
import '@carbon/charts-react/styles.css'
import styles from './Chart.module.scss';


const Chart = ({data, thresholdVal, chartTitle}) => {
  const [dataLoaded, setDataLoaded] = useState(false)
  const [newChartData, setNewChartData] = useState([data])
  const options = {
    title: chartTitle,
    axes: {
      left: {
        mapsTo: 'value',
        title: "Value"
      },
      bottom: {
        scaleType: 'time',
        mapsTo: 'date',
        title: "Date-Time",
        thresholds: thresholdVal?[{
          value: thresholdVal,
        }]:[]
      }
    },
    curve: 'curveMonotoneX',
    legend:{
      clickable: true,
      truncation: {
        numCharacter: 60
      }
    },
    points:{
      enabled:false
    },
    data:{
      loading:!dataLoaded
    },
    height: '20rem'
  }

  useEffect(()=>{
    if(data.length){
      const finalData =  data.map((innerData)=>{
        if(innerData.group !== chartTitle){
            return {...innerData, group: 'Granite TTM zero-shot forecast'}
        }
        return {...innerData, group: 'Ground truth'}
      })
      setNewChartData(finalData)
      setDataLoaded(true)
    }
  }, [data, chartTitle])

    return (
        <LineChart
        data={newChartData}
        options={options}
      ></ LineChart>
    )
}

export default Chart