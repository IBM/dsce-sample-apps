import React, { useEffect, useState } from 'react'
import Chart from '../Chart/Chart'
import styles from './AppContent.module.scss'
import { Column, Grid, Loading, Row } from '@carbon/react'
import Selector from '../Selector/Selector'
import axios from 'axios'
import Papa from 'papaparse';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import _ from 'lodash'

const AppContent = ({selectedColumn}) => {
    const [chartData, setChartData] = useState([])
    const [currentDataset, setCurrentDataset] = useState('Energy dataset')
    const [columnsSelected, setColumnSelected] = useState(['total load actual'])
    const [allColumns, setAllColumns] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [actualData, setActualData] = useState([])
    const [threshold, setThreshold] = useState()
    
    useEffect(()=>
        {
            if(currentDataset){
                fetch(`${currentDataset}.csv`)
                .then(response => response.text())
                .then((csvData) => {
                 Papa.parse(csvData, {
                     header: true,
                     skipEmptyLines: true,
                     complete: (resp) => {
                        setAllColumns(resp.meta.fields)
                            const parsedData = columnsSelected.map((column)=>{
                                return resp.data.map((row) => ({
                                    date: row['time'].split('+')[0],
                                    value: parseFloat(row[column]),
                                    group:column,
                                })).slice(-512); 
                             })                      
                         setChartData(parsedData)
                         setActualData(parsedData)
                     },
                     error: (error) => {
                         console.error('Error while parsing CSV:', error);
                       },
                 })
                })
            }

        
    },[currentDataset, columnsSelected])

    const chartSelectionHandler = (e) =>{
        setCurrentDataset(e)
    }

    const selectColumn = (e)=>{
        selectedColumn(e)
        setColumnSelected(e)
    }

    const getData = ({dataset, targetedColumns, forecastLength}) =>{
        setChartData(actualData)
        setIsLoading(true)
        const payload = { "filename": `data/${dataset.split(' ').join('_').toLowerCase()}.csv`, "time-column": "time", "target-columns": targetedColumns, 'forecast-length':forecastLength, 'forecast-timestamp': actualData[0][actualData[0].length-forecastLength-1].date}
        const header = {'Content-Type': 'application/json', 'Access-Control-Request-Method': 'POST'}
        axios.post(`${process.env.REACT_APP_BACKEND_URL}/forecasting`, payload, {headers: header}).then((ans)=>{
            console.log("API response: ", ans.data)
            setThreshold(ans.data[0].date)
            setChartData(chartData=>{
                return chartData.map((cData)=>[...cData, ..._.filter(ans.data, (obj)=>_.includes([cData[0].group, `${cData[0].group}-forecasted`], obj.group))])
            })
            setIsLoading(false)
        }).catch((err)=>{
            setIsLoading(false)
            toast.error(err.message)
        })
    }
  return (
    <>
        <ToastContainer/>
        <Grid className={styles.container}>
            <Column lg={4} md={2} sm={4} className={styles.leftChild}>
                <div>
                    <Selector chart={chartSelectionHandler} selectColumn={selectColumn} allColumns={allColumns} forecast={getData}/>
                </div>
            </Column>
            <Column lg={12} md={6} sm={4} className={styles.rightChild}>
            {chartData?.map((data)=>
                <Row>
                    {isLoading?<Loading />:<Chart data={data} thresholdVal={threshold} chartTitle={data[0].group}/>}
                    <br/>
                    <br/>
                </Row>
            )}
            </Column>
        </Grid>
    </>
  )
}

export default AppContent