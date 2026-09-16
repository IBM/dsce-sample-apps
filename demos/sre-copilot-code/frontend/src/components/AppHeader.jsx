/**
 * AppHeader.jsx
 * IBM Carbon Header with app branding and the "Create Incident" action button.
 */
import React from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';

export default function AppHeader({ onCreateIncident, isCreating }) {
  return (
    <Header aria-label="SRE Copilot">
      <HeaderName href="#" prefix="IBM watsonx">
        SRE Copilot
      </HeaderName>
      <HeaderGlobalBar>
        <HeaderGlobalAction
          aria-label={isCreating ? 'Creating...' : 'Create Incident'}
          tooltipAlignment="end"
          onClick={onCreateIncident}
          disabled={isCreating}
        >
          <Add size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  );
}
