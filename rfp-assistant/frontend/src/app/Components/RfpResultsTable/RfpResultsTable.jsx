"use client";

import React, { useState } from 'react';
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Search
} from '@carbon/react';

const RfpResultsTable = ({ opportunities }) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!opportunities || opportunities.length === 0) {
    return <p>No results to display.</p>;
  }

  const filteredData = opportunities.filter((item) => {
    const combined = `${item.title} ${item.customer} ${item.region_of_delivery.join(', ')}`.toLowerCase();
    return combined.includes(searchTerm.toLowerCase());
  });

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Search
          closeButtonLabelText="Clear search input"
          id="search-default"
          labelText="Search Opportunities"
          placeholder="Search by title, customer, region..."
          size="md"
          type="text"
          role="searchbox"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Table aria-label="RFP Opportunities Table">
        <TableHead>
          <TableRow>
            <TableHeader>Title</TableHeader>
            <TableHeader>Customer</TableHeader>
            <TableHeader>Region</TableHeader>
            <TableHeader>Closing Date</TableHeader>
            <TableHeader>Match Score</TableHeader>
            <TableHeader>Link</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.map((item, index) => (
            <TableRow key={index}>
              <TableCell>{item.title}</TableCell>
              <TableCell>{item.customer}</TableCell>
              <TableCell>{item.region_of_delivery.join(', ')}</TableCell>
              <TableCell>{new Date(item.closing_date).toLocaleDateString()}</TableCell>
              <TableCell>{item.match_score.toFixed(2)}</TableCell>
              <TableCell>
                <a
                  href={item.posting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default RfpResultsTable;
