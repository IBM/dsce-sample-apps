// Dummy data utilities for DPDP demo

export const indianNames = [
  { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@example.com', phone: '+91 98765 43210' },
  { firstName: 'Arjun', lastName: 'Mehta', email: 'arjun.mehta@example.com', phone: '+91 98765 43211' },
  { firstName: 'Kavitha', lastName: 'Iyer', email: 'kavitha.iyer@example.com', phone: '+91 98765 43212' },
  { firstName: 'Ravi', lastName: 'Kumar', email: 'ravi.kumar@example.com', phone: '+91 98765 43213' },
  { firstName: 'Anjali', lastName: 'Patel', email: 'anjali.patel@example.com', phone: '+91 98765 43214' },
  { firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@example.com', phone: '+91 98765 43215' },
  { firstName: 'Deepa', lastName: 'Reddy', email: 'deepa.reddy@example.com', phone: '+91 98765 43216' },
  { firstName: 'Rahul', lastName: 'Gupta', email: 'rahul.gupta@example.com', phone: '+91 98765 43217' },
];

export const generateAadhaar = (index: number): string => {
  const base = 1234 + index;
  return `${base} ${base + 1000} ${base + 2000}`;
};

export const generatePAN = (name: string): string => {
  const firstLetter = name.charAt(0).toUpperCase();
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${firstLetter}ABCD${randomNum}${firstLetter}`;
};

export const maskAadhaar = (aadhaar: string): string => {
  const parts = aadhaar.split(' ');
  return `XXXX XXXX ${parts[2]}`;
};

export const maskPAN = (pan: string): string => {
  return `${pan.substring(0, 2)}XXX${pan.substring(5)}`;
};

export const generateCustomerData = () => {
  return indianNames.map((person, index) => ({
    id: `CUST-${1000 + index}`,
    name: `${person.firstName} ${person.lastName}`,
    email: person.email,
    phone: person.phone,
    nationalId: generateAadhaar(index),
    taxId: generatePAN(person.firstName),
    referenceNumber: `REF${10000000 + index}`,
  }));
};

export const databases = [
  { name: 'Customer_DB', records: 450000, sensitiveFields: 8 },
  { name: 'Records_DB', records: 1200000, sensitiveFields: 5 },
  { name: 'Identity_DB', records: 380000, sensitiveFields: 12 },
  { name: 'Services_DB', records: 150000, sensitiveFields: 6 },
  { name: 'Profiles_DB', records: 220000, sensitiveFields: 7 },
  { name: 'Documents_DB', records: 95000, sensitiveFields: 4 },
  { name: 'Analytics_DB', records: 75000, sensitiveFields: 3 },
];

export const sensitiveFields = [
  'National ID Number',
  'Tax Identification Number',
  'Reference Number',
  'Payment Instrument ID',
  'Phone Number',
  'Email Address',
  'Date of Birth',
  'Address',
  'Employment Information',
  'Medical Records',
  'Biometric Data',
  'Activity History',
];

// Made with Bob
