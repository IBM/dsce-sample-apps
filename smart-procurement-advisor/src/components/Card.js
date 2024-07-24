import React from 'react';
import Card from 'react-bootstrap/Card';

const CustomCard = ({ title }) => {
  let cardContent;

  switch (title) {
    case 'Your SAP UI5-like App':
      cardContent = <p>This is your SAP UI5-like App. Welcome!</p>;
      break;
    case 'All Orders':
      cardContent = <p>Show all orders here...</p>;
      break;
    case 'Automated':
      cardContent = <p>Show automated orders here...</p>;
      break;
    case 'Declined':
      cardContent = <p>Show declined orders here...</p>;
      break;
    case 'On the Way':
      cardContent = <p>Show orders on the way here...</p>;
      break;
    default:
      cardContent = <p>No content available for this card.</p>;
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>{title}</Card.Title>
        <Card.Text>{cardContent}</Card.Text>
      </Card.Body>
    </Card>
  );
};

export default CustomCard;
