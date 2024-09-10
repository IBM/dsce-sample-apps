import React, { useEffect, useState } from 'react'
import { LineChart } from '@carbon/charts-react'
import '@carbon/charts-react/styles.css'
import styles from './Chart.module.scss';


const Chart = ({data, thresholdVal, chartTitle}) => {
  const [dataLoaded, setDataLoaded] = useState(false)
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
      setDataLoaded(true)
    }
  }, [data])

    return (
        <LineChart
        data={data}
        options={options}
      ></ LineChart>
    )
}

export default Chart