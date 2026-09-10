import React from 'react';
import { motion } from 'framer-motion';

interface ProductCardProps {
  name: string;
  logo: string;
  description: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ name, logo, description }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-white rounded-2xl p-6 shadow-lg"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-4">IBM Product</h3>
      <div className="flex items-center gap-6">
        <div className="text-6xl">{logo}</div>
        <div className="flex-1">
          <h4 className="text-2xl font-bold text-ibm-blue mb-2">{name}</h4>
          <p className="text-gray-700">{description}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;

// Made with Bob
