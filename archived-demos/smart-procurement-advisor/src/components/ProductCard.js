import React from 'react';

const ProductCard = ({ name, brand, price }) => {
  return (
    <div>
      <h3>{name}</h3>
      <p>Brand: {brand}</p>
      <p>Price: {price}</p>
      {/* Add other details as needed */}
    </div>
  );
};

export default ProductCard;