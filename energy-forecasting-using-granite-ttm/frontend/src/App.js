import { Modal, Theme } from '@carbon/react';
import './App.scss';
import AppHeader from './components/AppHeader/AppHeader';
import Footer from './components/Footer/Footer';
import AppContent from './components/AppContent/AppContent';
import { useState } from 'react';

function App() {
  const [openModal, setOpenModal] = useState(false)
  const [columnsSelected, setColumnSelected] = useState([])
  const columnSelection = (e) =>{
    setColumnSelected(e)
  }
  const iconClick = ()=>{
    setOpenModal(true)
  }
  return (
    <div className="App">
      <Theme theme='g100'>
        <AppHeader iconClick={iconClick}/>
      </Theme>
      <Modal open={openModal} onRequestClose={() => setOpenModal(false)} passiveModal modalHeading="Payload" size='md'>
        <pre>&#123;<br/>
        &nbsp;model_id="ibm-granite/granite-timeseries-ttm-v1",<br/>
          &nbsp;parameters=dict(),<br/>
            &nbsp;metadata=dict(<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;timestamp_column="time",<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;id_columns='a',<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;target_columns=[{columnsSelected.map((item, i)=>{
                if(i!==0)
                  return `, '${item}'`
                return `'${item}'`})}]<br/>
              &nbsp;),<br/>
              &nbsp;data=&lt;actual data&gt;<br/>&#125;<br/>
        </pre>
      </Modal>
      <AppContent selectedColumn={columnSelection}/>
      <Theme theme='g100'>
        <Footer/>
      </Theme>
    </div>
  );
}

export default App;
