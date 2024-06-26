import React, { useState } from "react";

const Dropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const selectOption = (option) => {
    // Do something with the selected option
    setIsOpen(false);
  };

  return (
    <div>
      <button onClick={toggleDropdown}>Dropdown</button>
      {isOpen && (
        <ul>
          <li onClick={() => selectOption("Option 1")}>Option 1</li>
          <li onClick={() => selectOption("Option 2")}>Option 2</li>
          <li onClick={() => selectOption("Option 3")}>Option 3</li>
        </ul>
      )}
    </div>
  );
};

export default Dropdown;