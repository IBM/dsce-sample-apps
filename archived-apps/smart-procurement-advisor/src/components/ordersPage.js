import React, { useState } from 'react';
import OrderList from './OrderList';
import OrderDetail from './OrderDetail';

const OrdersPage = () => {
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
  };

  return (
    <div>
      <OrderList onOrderClick={handleOrderClick} />
      {selectedOrder && <OrderDetail order={selectedOrder} />}
    </div>
  );
};

export default OrdersPage;