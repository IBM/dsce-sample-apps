import React from 'react'
import styles from './Footer.module.scss';

const Footer = () => {
 return(<footer className={styles.container}>
    <p>Do not input personal data, or data that is sensitive or confidential into demo app. This app is built using the watsonx.ai SDK and may include systems and methods pending patent with the USPTO, protected under US Patent Laws. &#169; Copyright IBM Corporation</p>
  </footer>
 )
}

export default Footer