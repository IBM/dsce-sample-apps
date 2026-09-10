import { ArrowRight } from '@carbon/icons-react';
import { getActions } from '../demo/demoStore';
import './ActionDetail.scss';

/**
 * ActionFooter — Shared footer component for all Action detail pages
 * Displays Related Actions section with consistent UI/UX patterns
 * Handles navigation to related actions via onOpen callback
 */
export default function ActionFooter({ relatedActionIds = [], onOpen }) {
  if (!relatedActionIds || relatedActionIds.length === 0) {
    return null;
  }

  const related = relatedActionIds
    .map((rid) => getActions().find((a) => a.id === rid))
    .filter(Boolean);

  if (related.length === 0) {
    return null;
  }

  return (
    <div className="ad-footer">
      <div className="ad-footer__related">
        <h3 className="ad-footer__title">Related Actions</h3>
        <div className="ad-footer__list">
          {related.map((action) => (
            <button
              key={action.id}
              className="ad-footer__item"
              onClick={() => onOpen && onOpen(action.id)}
              type="button"
              aria-label={`Open ${action.type}: ${action.title}`}
            >
              <div className="ad-footer__item-content">
                <span className="ad-footer__item-type">{action.type}</span>
                <div className="ad-footer__item-main">
                  <span className="ad-footer__item-title">{action.title}</span>
                  <ArrowRight size={16} className="ad-footer__item-arrow" />
                </div>
                {action.description && (
                  <div className="ad-footer__item-desc">{action.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
