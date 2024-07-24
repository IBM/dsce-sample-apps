import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { IoHomeOutline } from "react-icons/io5";



const ChargerCatalog = () => {
  const navigate = useNavigate();
  const onReturnHome = () => {
    navigate('/');
    // Add your navigation logic or other actions here
  };
  function Footer() {
    return (
      <footer style={{
        padding: '5px',
        backgroundColor: '#212529',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'IBM Plex Sans, sans-serif',
        marginTop: 'auto',
        position: 'fixed',
        bottom: 0,
        width: '100%',
        color: 'white',
        fontSize:'14px'
    }}>
        {/* Powered by&nbsp; <a href="https://www.ibm.com/watsonx" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline', cursor: 'pointer' }}>watsonx</a> */}
        Do not input personal data, or data that is sensitive or confidential into demo app. This app is built using the watsonx.ai SDK and may include systems and methods pending patent with the USPTO, protected under US Patent Laws. © Copyright IBM Corporation
    </footer>
    );
}
  /* const handleOrderClick = (orderNumber) => {
    alert(`Clicked on ${orderNumber}`);
  }; */
  return (
    <div>
      <div>
      <header style={{ backgroundColor: '#212529', height: '3rem', color: 'white', display: 'flex', justifyContent: 'left', alignItems: 'center' }}>
                <div style={{ marginLeft: '1%' }}>
                    <IoHomeOutline style={{ color: 'white', cursor: 'pointer', fontSize: '20px' }} onClick={onReturnHome} />
                </div>
                <div style={{ marginLeft: '1%', fontSize: '14px', color: 'white', fontWeight: 'bold', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    <p style={{ margin: 0 }}> Smart Procurement Advisor</p>
                </div>
                <div></div>
            </header>
        <div>
          <h2 style={{ textAlign: 'center', fontFamily: 'IBM Plex Sans, sans-serif' }}>Chargers</h2>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'IBM Plex Sans, sans-serif' }}>
          <div  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
            <img src="images/apple.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
            <div>
              <h3>iPhone C to C adapter</h3>
              <p>Brand: Apple</p>
            </div>
          </div>
          <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
            <img src="images/magsafe.png" alt="Cables" style={{ width: 'auto', height: '100px' }} />
            <div>
              <h3>Magsafe Charger</h3>
              <p>Brand: Apple</p>
            </div>
          </div>
          <div  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
            <img src="images/2mapplecable.png" alt="Cables" style={{ width: 'auto', height: '100px' }} />
            <div>
              <h3>2m USB C to Lightning Cable</h3>
              <p>Brand: Apple</p>
            </div>
          </div>
          <div  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
            <img src="images/sony.png" alt="Cables" style={{ width: 'auto', height: '100px' }} />
            <div>
              <h3>Adapter with Cable</h3>
              <p>Brand: OnePlus</p>
            </div>
          </div>
          <div  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', marginRight: '10px' }}>
            <img src="images/appleaircharger.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
            <div>
              <h3>Macbook Air Adapter</h3>
              <p>Brands: Apple</p>
            </div>
          </div>
          <div  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px' }}>
            <img src="images/ctolightcable.png" alt="Cables" style={{ width: '100px', height: '100px' }} />
            <div>
              <h3>C to Lightning Adapter & Cable</h3>
              <p>Brand: Apple</p>
            </div>
          </div>
        </div>
      </div>
      <Routes>
        <Route path="/ChargerCatalog" element={<ChargerCatalog />} />
      </Routes>
      <Footer />
    </div>
  );
};



export default ChargerCatalog;
