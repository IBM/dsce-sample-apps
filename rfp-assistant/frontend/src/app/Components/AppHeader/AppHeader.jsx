import React from 'react'
import styles from './AppHeader.module.scss'
import {
    Header,
    HeaderName,
  } from '@carbon/react';


const AppHeader = () => {
  return (
        <Header aria-label="IBM Platform Name" className={styles.uiShellHeader}>
          <HeaderName prefix="">
            RFP Assistant
          </HeaderName>
        </Header>
  )
}

export default AppHeader