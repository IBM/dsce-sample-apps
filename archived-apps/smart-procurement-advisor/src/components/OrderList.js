import React from 'react';
import { ListGroup } from 'react-bootstrap';

function OrderList({ orders, onSelectOrder }) {
  return (
    <ListGroup style={{ marginBottom: '20px' }}>
      {orders.map((order) => (
        <ListGroup.Item
          key={order}
          action
          onClick={() => onSelectOrder(order)}
          style={{ cursor: 'pointer', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '5px', flexDirection: 'row' }}
        >
          <span style={{ marginBottom: '5px' }}>Order {order}</span>
          <span>View Details</span>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}

export default OrderList;
