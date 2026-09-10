import { findAction } from '../demo/demoStore';
import InvestigationDetail  from './InvestigationDetail';
import AnalysisDetail       from './AnalysisDetail';
import ReportDetail         from './ReportDetail';
import RecommendationDetail from './RecommendationDetail';
import TaskDetail           from './TaskDetail';
import './ActionDetail.scss';

const TYPE_MAP = {
  Investigation:   InvestigationDetail,
  Analysis:        AnalysisDetail,
  Report:          ReportDetail,
  Recommendation:  RecommendationDetail,
  Task:            TaskDetail,
};

export default function ActionDetail({ actionId, onBack, onOpen }) {
  const action = findAction(String(actionId));

  if (!action) {
    return (
      <div className="ad-page">
        <nav className="ad-breadcrumb">
          <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        </nav>
        <div className="ad-content" style={{ padding: '2rem' }}>
          <p style={{ color: '#525252' }}>Action not found.</p>
        </div>
      </div>
    );
  }

  const DetailPage = TYPE_MAP[action.type];

  if (!DetailPage) {
    return (
      <div className="ad-page">
        <nav className="ad-breadcrumb">
          <button className="ad-breadcrumb__link" onClick={onBack}>Action Center</button>
        </nav>
        <div className="ad-content" style={{ padding: '2rem' }}>
          <p style={{ color: '#525252' }}>No detail page for type: {action.type}</p>
        </div>
      </div>
    );
  }

  return <DetailPage actionId={actionId} onBack={onBack} onOpen={onOpen} />;
}
