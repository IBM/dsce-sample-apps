// ui/src/components/shared/EvidenceBlock.tsx
// Displays a single RAG evidence citation (spec/07 UX: show evidence for grounded claims)
import React from 'react';
import { Tag } from '@carbon/react';
import type { Evidence } from '../../types';

interface Props {
  evidence: Evidence;
}

export const EvidenceBlock: React.FC<Props> = ({ evidence }) => (
  <div className="tsci-evidence-block">
    <div className="tsci-evidence-title">
      {evidence.title}
      <Tag type="blue" size="sm" className="tsci-evidence-tag">
        {evidence.revision}
      </Tag>
      <Tag type="cool-gray" size="sm" className="tsci-evidence-tag">
        {evidence.section}
      </Tag>
      <Tag type="teal" size="sm" className="tsci-evidence-tag">
        {Math.round(evidence.relevance_score * 100)}% match
      </Tag>
    </div>
    <div className="tsci-evidence-excerpt">"{evidence.excerpt}"</div>
    <div className="tsci-evidence-meta">
      ID: {evidence.evidence_id} · {evidence.document_id}
    </div>
  </div>
);
