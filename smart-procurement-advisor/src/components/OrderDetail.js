import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { IoHomeOutline } from "react-icons/io5";
import { ListGroup } from 'react-bootstrap';
import './style.css';

function OrderList({ orders, onSelectOrder, selectedOrder }) {
  return (
    <ListGroup style={{ marginBottom: '20px' }}>
            {orders.map((order) => (
                <ListGroup.Item
                    key={order.id}
                    action
                    onClick={() => onSelectOrder(order)}
                    style={{
                        cursor: 'pointer',
                        width: '70%',
                        border: '2px solid #ddd',
                        borderRadius: '10px',
                        marginBottom: '5px',
                        backgroundColor: selectedOrder && selectedOrder.id === order.id ? '#0e62fe' : 'white',
                        color: selectedOrder && selectedOrder.id === order.id ? 'white' : 'black',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        <span>Order ID: {order.id}</span>
                        <span>Order Date: {order.date}</span>
                        <span style={{ color: selectedOrder && selectedOrder.id === order.id ? 'white' : '#0e62fe' }}>More Details</span>
                    </div>
                </ListGroup.Item>
            ))}
        </ListGroup>
  );
}

function OrderDetails({ selectedOrder }) {

  return (
    <article>
      <address>
        <p>📦 Order Number: {selectedOrder.number} </p>
        <h4 style={{ backgroundColor: '#0e62fe', color: 'white' }}> Status: {selectedOrder.status} </h4>
      </address>

      <table className="firstTable">
        <tr>
          <th><span >Invoice #</span></th>
          <td><span >{selectedOrder.id}</span></td>
        </tr>
        <tr>
          <th><span >Date(YYYY-MM-DD)</span></th>
          <td><span >{selectedOrder.date}</span></td>
        </tr>
        <tr>
          <th><span >Amount Due</span></th>
          <td><span id="prefix" ></span><span>{selectedOrder.amtD}</span></td>
        </tr>
      </table>

      <table className="secondTable">
        <thead>
          <tr>
            <th><span >Item</span></th>
            <th><span >Description</span></th>
            <th><span >Rate</span></th>
            <th><span >Quantity</span></th>
            <th><span >Price</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span >{selectedOrder.name}</span></td>
            <td><span >{selectedOrder.brand}</span></td>
            <td><span data-prefix></span><span >{selectedOrder.unitprice}</span></td>
            <td><span >{selectedOrder.qty}</span></td>
            <td><span data-prefix></span><span>{selectedOrder.price}</span></td>
          </tr>
        </tbody>
      </table>
      <table className="firstTable">
        <tr>
          <th><span >Total</span></th>
          <td><span data-prefix></span><span>{selectedOrder.price}</span></td>
        </tr>
        <tr>
          <th><span >Amount Paid</span></th>
          <td><span data-prefix></span><span >{selectedOrder.amtP}</span></td>
        </tr>
        <tr>
          <th><span >Balance Due</span></th>
          <td><span data-prefix></span><span>{selectedOrder.amtD}</span></td>
        </tr>
      </table>
    </article>
  );
}

function OrderDetail() {
  const navigate = useNavigate();
  const onReturnHome = () => {
    navigate('/');
  };
  const [selectedOrder, setSelectedOrder] = useState(null);
  
const handleSelectOrder = (order) => {
  setSelectedOrder(order);
};
function Footer() {
  return (
      /* <footer style={{
          backgroundImage: 'url(/images/watsonXbg.png)',
          backgroundSize: 'cover',
          padding: '5px',
          color: 'black',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'IBM Plex Sans, sans-serif',
          marginTop: 'auto',
          position: 'fixed',
          bottom: 0,
          width: '100%',
          fontWeight:'bold'
      }}>
          Powered by&nbsp; <a href="https://www.ibm.com/watsonx" target="_blank" rel="noopener noreferrer" style={{ color: 'black', textDecoration: 'underline', cursor: 'pointer' }}>watsonx</a>
      </footer> */
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

return (
  <div>
    {/* <header style={{
      backgroundImage: 'url(/images/watsonXbg.png)',
      backgroundSize: 'cover',
      padding: '10px 20px',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: 'IBM Plex Sans, sans-serif',
    }}> */}
    <header style={{ backgroundColor: '#212529', height: '3rem', color: 'white', display: 'flex', justifyContent: 'left', alignItems: 'center' }}>
      <div style={{marginLeft: '1%'}}>
        <IoHomeOutline style={{ color: 'white', cursor: 'pointer', fontSize: '20px' }} onClick={onReturnHome} />
      </div>
      {/* <div>
        <h1 style={{ margin: 0, color: 'black', textAlign: 'center', }}>IBM Smart Procurement Advisor</h1>
      </div> */}
      <div style={{ marginLeft: '1%', fontSize: '14px', color: 'white', fontWeight: 'bold', fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    <p style={{ margin: 0 }}>  Smart Procurement Advisor</p>
                </div>
      <div></div>
    </header>
    <h3 style={{ textAlign: 'center', fontFamily: 'IBM Plex Sans, sans-serif', textDecoration: 'underline' }}>All Order Details</h3>

    <div style={{ display: 'flex', fontFamily: 'IBM Plex Sans, sans-serif' }}>

      <OrderList orders={[{ status: "🚚 Order on it's way", amtD: "100 EUR", amtP: "0.00 EUR", id: 1, date: '2023-12-01', number: '123', name: 'Apple C-to-C Adpater', brand: 'Apple', qty: 5, price: '100 EUR', unitprice: '20 EUR' },
      { status: "🕜 Delivered on 27th Nov'23", amtD: "0.00 EUR", amtP: "300 EUR", id: 2, date: '2023-11-26', number: '124', name: 'Honda Heavy Liquid Pump', brand: 'Honda', qty: 3, price: '300 EUR', unitprice: '100 EUR' },
      { status: "💸 Payment Processing", amtD: "1000 EUR", amtP: "0.00 EUR", id: 3, date: '2023-11-27', number: '125', name: 'Mini Refrigerator', brand: 'Samsung', qty: 10, price: '1000 EUR', unitprice: '100 EUR' },
      { status: "🕜 Delivered on 28th Nov'23", amtD: "0.00 EUR", amtP: "1200 EUR", id: 4, date: '2023-11-25', number: '126', name: 'Air Conditioner', brand: 'Mitsubishi', qty: 3, price: '1200 EUR', unitprice: '400 EUR' },
      { status: "🛵 Order Out for Delivery", amtD: "2000 EUR", amtP: "0.00 EUR", id: 5, date: '2023-11-29', number: '127', name: 'Heavy Liquid Pump', brand: 'Kirloskar', qty: 5, price: '2000 EUR', unitprice: '500 EUR' }]} onSelectOrder={handleSelectOrder} selectedOrder={selectedOrder} />
      {selectedOrder && <OrderDetails selectedOrder={selectedOrder} />}
    </div>
    <Routes>
      <Route path="/OrderDetail" element={<OrderDetail />} />
    </Routes>
    <Footer />
  </div>
);
}

export default OrderDetail;
