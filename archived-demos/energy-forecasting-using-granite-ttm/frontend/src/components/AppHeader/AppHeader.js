import React from 'react'
import styles from './AppHeader.module.scss'
import {
    Header,
    HeaderName,
    HeaderGlobalBar,
    HeaderGlobalAction
  } from '@carbon/react';
import {Settings} from '@carbon/icons-react'


const AppHeader = ({iconClick}) => {
  const iconClickHandler = ()=>{
    iconClick()
  }
  return (
        <Header aria-label="IBM Platform Name" className={styles.uiShellHeader}>
          <HeaderName prefix="Energy forecasting using Granite TTM">
          </HeaderName>
          <HeaderGlobalBar>
            <HeaderGlobalAction aria-label="Search" onClick={iconClickHandler}>
              <Settings />
            </HeaderGlobalAction>
            </HeaderGlobalBar>
        </Header>
  )
}

export default AppHeader