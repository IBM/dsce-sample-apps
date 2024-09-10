import { Button, NumberInput, RadioTile, TileGroup, Checkbox, CheckboxGroup } from '@carbon/react'
import React, { useEffect, useState } from 'react'
import SideModal from '../SideModal/SideModal'
import styles from './Selector.module.scss'

const sampleCSV = ["Energy dataset"]
const listOfColumns = {"Energy dataset": ["total load actual", "generation solar", "price actual"]}

const Selector = ({chart, selectColumn, allColumns, forecast, sampleData}) => {
  const [dataset, setSDataset] = useState('Energy dataset')
  const [targetedColumns, setTargetedColumns] = useState(['total load actual'])
  const [openSidePanel, setOpenSidePanel] = useState(false)
  const [forecastLength, setForecastLength] = useState(96)
  const [btnDisable, setBtnDisable] = useState(false)

  useEffect(()=>{
    if(targetedColumns.length){
      setBtnDisable(false)
    }
    else{
      setBtnDisable(true)
    }
    selectColumn(targetedColumns)
  }, [targetedColumns])

  const selectDataset = (e) =>{
    setSDataset(e)
    chart(e)
  }
  const columnSelectorHandler = (e) =>{
    const column = e.target.id
    if(e.target.checked){
      setTargetedColumns(columns => [...columns, column])
    }
    else{
      var index = targetedColumns.indexOf(column)
      setTargetedColumns((items) => items.filter((_, i) => i !== index));
    }
  }

  const forecastData = () =>{
    forecast({dataset, targetedColumns, forecastLength})
  }

  const updateForecastLength = (e, {value}) =>{
    if(value<=96 && value>=1)
    {
      setBtnDisable(false)
      setForecastLength(value)
    }
    else{
      setBtnDisable(true)
    }
  }

  const openSideModal = () =>{
    setOpenSidePanel(true)
  }
  return (
    <div className={styles.container}>
        <SideModal
        open={openSidePanel}
        setOpenSidePanel={setOpenSidePanel}
        sampleData={sampleData}
        title={dataset}
        ></SideModal>
          <TileGroup legend="Dataset" defaultSelected={sampleCSV[0]} onChange={selectDataset}>
            {sampleCSV.map((item, i)=><RadioTile id={item} value={item}>{item}</RadioTile>)}
          </TileGroup>
        <br/>
        {dataset && <a onClick={openSideModal} className={styles.linkText}>View dataset (hourly)</a>}
        <br/>
        <br/>
        {dataset && (
          <CheckboxGroup legendText='Target columns'>
            {listOfColumns[dataset].map((column, i)=>(<Checkbox defaultChecked={i===0} labelText={column}  id={column} onChange={columnSelectorHandler}/>))}
          </CheckboxGroup>
        )}
        <br/>
        <NumberInput min={1} max={96} value={forecastLength} label="Forecast horizon (in 1-96 hours)" invalidText="value must in between 1-96" onChange={updateForecastLength}/>
        <br/>
        <br/>
        <Button onClick={forecastData} disabled={btnDisable}>Forecast</Button>
    </div>
  )
}

export default Selector