import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stage6ComplianceProps {
  onReportGenerated?: () => void;
}

interface Grievance {
  id: string;
  customerName: string;
  email: string;
  issue: string;
  description: string;
  status: 'submitted' | 'under_review' | 'resolved';
  submittedAt: string;
  resolvedAt?: string;
}

const Stage6Compliance: React.FC<Stage6ComplianceProps> = ({ onReportGenerated }) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [showGrievanceForm, setShowGrievanceForm] = useState(false);
  const [grievances, setGrievances] = useState<Grievance[]>([
    {
      id: 'GRV-001',
      customerName: 'Amit Patel',
      email: 'amit.patel@example.com',
      issue: 'Data Access Request Delay',
      description: 'DSAR request submitted 20 days ago, no response received',
      status: 'resolved',
      submittedAt: '2026-02-25 10:30:00',
      resolvedAt: '2026-03-05 14:20:00'
    }
  ]);
  const [newGrievance, setNewGrievance] = useState({
    customerName: '',
    email: '',
    issue: '',
    description: ''
  });

  const complianceMetrics = [
    { id: 'consent', name: 'Consent Controls', score: 98, status: 'excellent', icon: '✓' },
    { id: 'protection', name: 'Protection Controls', score: 95, status: 'excellent', icon: '🛡️' },
    { id: 'encryption', name: 'Encryption Status', score: 100, status: 'excellent', icon: '🔒' },
    { id: 'breach', name: 'Breach Response', score: 92, status: 'good', icon: '🚨' },
    { id: 'rights', name: 'Rights Requests', score: 94, status: 'excellent', icon: '📋' },
  ];

  const overallScore = Math.round(
    complianceMetrics.reduce((sum, m) => sum + m.score, 0) / complianceMetrics.length
  );

  const auditLogs = [
    { timestamp: '2026-03-15 14:23:45', user: 'Priya Sharma', action: 'Consent granted', category: 'Consent', status: 'success' },
    { timestamp: '2026-03-15 14:25:12', user: 'System', action: 'PII discovery scan completed', category: 'Discovery', status: 'success' },
    { timestamp: '2026-03-15 14:30:22', user: 'Ravi Kumar', action: 'Data query with masking', category: 'Protection', status: 'success' },
    { timestamp: '2026-03-15 14:35:18', user: 'Arjun Mehta', action: 'Key rotation initiated', category: 'Encryption', status: 'success' },
    { timestamp: '2026-03-15 23:47:32', user: 'System', action: 'Breach detected and contained', category: 'Security', status: 'warning' },
    { timestamp: '2026-03-16 09:15:44', user: 'Kavitha Iyer', action: 'DSAR request processed', category: 'Rights', status: 'success' },
  ];

  const generateReport = () => {
    setReportGenerated(true);
    if (onReportGenerated) {
      onReportGenerated();
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Generate comprehensive DPDP compliance report
    const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DPDP Act 2023 - Comprehensive Compliance Assessment Report</title>
    <style>
        :root {
            --primary-color: #0f172a;
            --secondary-color: #1e293b;
            --accent-success: #10b981;
            --accent-blue: #3b82f6;
            --accent-warning: #f59e0b;
            --accent-red: #ef4444;
            --bg-light: #f8fafc;
            --border-color: #e2e8f0;
            --text-dark: #0f172a;
            --text-muted: #64748b;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-light);
            color: var(--text-dark);
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }
        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            border: 1px solid var(--border-color);
            overflow: hidden;
        }
        .report-header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #ffffff;
            padding: 40px;
            border-bottom: 4px solid var(--accent-success);
        }
        .header-top { display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; }
        .header-title h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; }
        .header-title p { margin: 0; color: #94a3b8; font-size: 14px; }
        .badge-compliant {
            background-color: rgba(16, 185, 129, 0.2);
            color: var(--accent-success);
            border: 2px solid var(--accent-success);
            padding: 8px 20px;
            border-radius: 24px;
            font-weight: 700;
            font-size: 14px;
            text-transform: uppercase;
        }
        .header-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .meta-item { background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; }
        .meta-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
        .meta-value { font-size: 18px; font-weight: 700; }
        .report-body { padding: 40px; }
        .section { margin-bottom: 48px; page-break-inside: avoid; }
        .section-title {
            font-size: 18px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--primary-color);
            margin: 0 0 24px 0;
            padding-bottom: 12px;
            border-bottom: 3px solid var(--accent-blue);
        }
        .subsection-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--secondary-color);
            margin: 24px 0 16px 0;
        }
        .executive-summary {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-left: 4px solid var(--accent-blue);
            padding: 24px;
            border-radius: 8px;
            margin-bottom: 32px;
        }
        .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px; }
        .score-card {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: white;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
        }
        .score-number { font-size: 48px; font-weight: 800; color: var(--accent-success); margin-bottom: 8px; }
        .score-label { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
        .metric-card { background: #ffffff; border: 2px solid var(--border-color); border-radius: 8px; padding: 20px; }
        .metric-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .metric-name { font-weight: 600; color: var(--text-dark); }
        .metric-score { font-size: 24px; font-weight: 700; color: var(--accent-success); }
        .metric-bar-bg { background-color: #f1f5f9; height: 10px; border-radius: 5px; overflow: hidden; }
        .metric-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }
        .metric-bar-fill.excellent { background: linear-gradient(90deg, #10b981 0%, #059669 100%); }
        .metric-bar-fill.good { background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%); }
        .metric-bar-fill.fair { background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%); }
        .compliance-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .compliance-table th {
            background-color: var(--primary-color);
            color: white;
            font-weight: 600;
            padding: 16px;
            text-align: left;
            font-size: 13px;
            text-transform: uppercase;
        }
        .compliance-table td {
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            font-size: 14px;
        }
        .compliance-table tr:last-child td { border-bottom: none; }
        .compliance-table tr:hover { background-color: #f8fafc; }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-compliant { background-color: #d1fae5; color: #065f46; }
        .status-partial { background-color: #fef3c7; color: #92400e; }
        .status-non-compliant { background-color: #fee2e2; color: #991b1b; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 32px; }
        .info-card { background: #ffffff; border: 2px solid var(--border-color); border-radius: 8px; padding: 24px; }
        .info-card ul { margin: 0; padding-left: 20px; }
        .info-card li { margin-bottom: 12px; font-size: 14px; color: #334155; line-height: 1.6; }
        .risk-matrix { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .risk-card { border-radius: 8px; padding: 20px; text-align: center; }
        .risk-low { background-color: #d1fae5; border: 2px solid #10b981; }
        .risk-medium { background-color: #fef3c7; border: 2px solid #f59e0b; }
        .risk-high { background-color: #fee2e2; border: 2px solid #ef4444; }
        .risk-number { font-size: 36px; font-weight: 800; margin-bottom: 8px; }
        .risk-label { font-size: 13px; font-weight: 600; text-transform: uppercase; }
        .data-inventory { background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
        .inventory-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .inventory-item { background: white; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid var(--border-color); }
        .inventory-number { font-size: 28px; font-weight: 700; color: var(--accent-blue); margin-bottom: 4px; }
        .inventory-label { font-size: 12px; color: var(--text-muted); }
        .report-footer {
            background-color: var(--primary-color);
            color: white;
            padding: 32px 40px;
            border-top: 4px solid var(--accent-blue);
        }
        .footer-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .footer-section h4 { margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #94a3b8; }
        .footer-section p { margin: 4px 0; font-size: 13px; }
        @media print {
            body { padding: 0; background: white; }
            .report-container { box-shadow: none; border: none; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>

<div class="report-container">
    <!-- Header -->
    <header class="report-header">
        <div class="header-top">
            <div class="header-title">
                <h1>IBM OpenPages GRC Platform</h1>
                <p>Digital Personal Data Protection Act 2023 - Comprehensive Compliance Assessment Report</p>
            </div>
            <div><span class="badge-compliant">✓ DPDP COMPLIANT</span></div>
        </div>
        <div class="header-meta">
            <div class="meta-item">
                <div class="meta-label">Report Date</div>
                <div class="meta-value">${formattedDate}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Assessment Period</div>
                <div class="meta-value">Q1-Q2 2026</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Organization</div>
                <div class="meta-value">Your Organization</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">DPO</div>
                <div class="meta-value">Kavitha Iyer</div>
            </div>
        </div>
    </header>

    <div class="report-body">
        <!-- Executive Summary -->
        <div class="section">
            <h2 class="section-title">Executive Summary</h2>
            <div class="executive-summary">
                <p><strong>Assessment Overview:</strong> This comprehensive compliance assessment evaluates the organization's adherence to the Digital Personal Data Protection Act, 2023 (DPDP Act). The assessment covers all critical aspects of data protection including consent management, data discovery, security safeguards, encryption, breach response, and data principal rights.</p>
                <p style="margin-top: 16px;"><strong>Key Finding:</strong> The organization demonstrates strong compliance with DPDP Act requirements, achieving an overall compliance score of <strong>${overallScore}%</strong>. The organization has implemented robust technical and organizational measures leveraging IBM's comprehensive data protection suite.</p>
                <p style="margin-top: 16px;"><strong>Compliance Status:</strong> <span style="color: var(--accent-success); font-weight: 700;">COMPLIANT</span> - All mandatory requirements under DPDP Act 2023 are met with documented evidence and continuous monitoring in place.</p>
            </div>

            <div class="score-grid">
                <div class="score-card">
                    <div class="score-number">${overallScore}%</div>
                    <div class="score-label">Overall Compliance</div>
                </div>
                <div class="score-card">
                    <div class="score-number">2.3M</div>
                    <div class="score-label">Records Protected</div>
                </div>
                <div class="score-card">
                    <div class="score-number">0</div>
                    <div class="score-label">Data Breaches</div>
                </div>
            </div>
        </div>

        <!-- Compliance Metrics -->
        <div class="section">
            <h2 class="section-title">Detailed Compliance Metrics</h2>
            <div class="metrics-grid">
                ${complianceMetrics.map(m => `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-name">${m.name}</span>
                        <span class="metric-score">${m.score}%</span>
                    </div>
                    <div class="metric-bar-bg">
                        <div class="metric-bar-fill ${m.score >= 95 ? 'excellent' : m.score >= 85 ? 'good' : 'fair'}" style="width: ${m.score}%;"></div>
                    </div>
                </div>`).join('')}
            </div>
        </div>

        <!-- DPDP Act Section Mapping -->
        <div class="section">
            <h2 class="section-title">DPDP Act 2023 - Section-wise Compliance Mapping</h2>
            <table class="compliance-table">
                <thead>
                    <tr>
                        <th>Section</th>
                        <th>Requirement</th>
                        <th>Implementation</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>§6</strong></td>
                        <td>Consent of Data Principal</td>
                        <td>IBM Verify - Consent Management Framework with granular controls and audit trail</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                    <tr>
                        <td><strong>§8</strong></td>
                        <td>Security Safeguards</td>
                        <td>IBM Guardium Data Protection - Role-based access, dynamic masking, encryption</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                    <tr>
                        <td><strong>§8(5)</strong></td>
                        <td>Data Retention & Erasure</td>
                        <td>Automated data lifecycle management with 12K records purged in compliance window</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                    <tr>
                        <td><strong>§8(6)</strong></td>
                        <td>Breach Notification (72 hours)</td>
                        <td>IBM QRadar SIEM - Real-time detection with automated DPO notification</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                    <tr>
                        <td><strong>§11</strong></td>
                        <td>Rights of Data Principal (DSAR)</td>
                        <td>IBM Guardium DSPM - 156 DSAR requests processed with 94% satisfaction rate</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                    <tr>
                        <td><strong>§13</strong></td>
                        <td>Grievance Redressal</td>
                        <td>IBM OpenPages - Grievance tracking system with resolution SLA monitoring</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                    <tr>
                        <td><strong>§14</strong></td>
                        <td>Data Protection Officer</td>
                        <td>Designated DPO (Kavitha Iyer) with direct board reporting and independence</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                    <tr>
                        <td><strong>§16</strong></td>
                        <td>Data Audit & Accountability</td>
                        <td>Comprehensive audit trail maintained across all data processing activities</td>
                        <td><span class="status-badge status-compliant">Compliant</span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Data Inventory -->
        <div class="section">
            <h2 class="section-title">Personal Data Inventory & Classification</h2>
            <div class="data-inventory">
                <div class="inventory-grid">
                    <div class="inventory-item">
                        <div class="inventory-number">2.3M</div>
                        <div class="inventory-label">Total Records</div>
                    </div>
                    <div class="inventory-item">
                        <div class="inventory-number">34</div>
                        <div class="inventory-label">Sensitive Fields</div>
                    </div>
                    <div class="inventory-item">
                        <div class="inventory-number">7</div>
                        <div class="inventory-label">Data Sources</div>
                    </div>
                    <div class="inventory-item">
                        <div class="inventory-number">100%</div>
                        <div class="inventory-label">Encrypted</div>
                    </div>
                </div>
            </div>
            <h3 class="subsection-title">Sensitive Personal Data Categories</h3>
            <ul style="columns: 2; column-gap: 32px;">
                <li>Aadhaar Numbers (Biometric ID)</li>
                <li>PAN Numbers (Tax ID)</li>
                <li>Reference / Account Numbers</li>
                <li>Payment Instrument Identifiers</li>
                <li>Activity & Usage History</li>
                <li>Contact Information (Email, Phone)</li>
                <li>Demographic Data</li>
                <li>Employment Information</li>
            </ul>
        </div>

        <!-- Technical & Organizational Measures -->
        <div class="section">
            <h2 class="section-title">Technical & Organizational Measures</h2>
            <div class="info-grid">
                <div class="info-card">
                    <h3 class="subsection-title">Technical Controls</h3>
                    <ul>
                        <li><strong>Encryption:</strong> AES-256 encryption for data at rest and in transit with 90-day key rotation</li>
                        <li><strong>Access Control:</strong> Role-based access control (RBAC) with least privilege principle</li>
                        <li><strong>Data Masking:</strong> Dynamic data masking based on user roles and context</li>
                        <li><strong>Monitoring:</strong> 24/7 SIEM monitoring with real-time threat detection</li>
                        <li><strong>Backup & Recovery:</strong> Automated backups with 99.9% recovery SLA</li>
                        <li><strong>Network Security:</strong> Firewall, IDS/IPS, and DDoS protection</li>
                    </ul>
                </div>
                <div class="info-card">
                    <h3 class="subsection-title">Organizational Controls</h3>
                    <ul>
                        <li><strong>Policies:</strong> Comprehensive data protection policies reviewed quarterly</li>
                        <li><strong>Training:</strong> Annual DPDP Act training for all employees (100% completion)</li>
                        <li><strong>DPO Oversight:</strong> Independent DPO with direct board access</li>
                        <li><strong>Vendor Management:</strong> Data processing agreements with all third parties</li>
                        <li><strong>Incident Response:</strong> Documented IR plan with 72-hour breach notification</li>
                        <li><strong>Audit Program:</strong> Monthly internal audits and annual external assessments</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Risk Assessment -->
        <div class="section">
            <h2 class="section-title">Data Protection Risk Assessment</h2>
            <div class="risk-matrix">
                <div class="risk-card risk-low">
                    <div class="risk-number">2</div>
                    <div class="risk-label">Low Risk</div>
                    <p style="margin-top: 12px; font-size: 13px;">Mitigated with controls</p>
                </div>
                <div class="risk-card risk-medium">
                    <div class="risk-number">1</div>
                    <div class="risk-label">Medium Risk</div>
                    <p style="margin-top: 12px; font-size: 13px;">Under monitoring</p>
                </div>
                <div class="risk-card risk-high">
                    <div class="risk-number">0</div>
                    <div class="risk-label">High Risk</div>
                    <p style="margin-top: 12px; font-size: 13px;">None identified</p>
                </div>
            </div>
            <h3 class="subsection-title">Identified Risks & Mitigation</h3>
            <table class="compliance-table">
                <thead>
                    <tr>
                        <th>Risk Category</th>
                        <th>Description</th>
                        <th>Mitigation Strategy</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Unauthorized Access</td>
                        <td>Potential insider threat or credential compromise</td>
                        <td>MFA, RBAC, continuous monitoring, and behavioral analytics</td>
                        <td><span class="status-badge status-compliant">Mitigated</span></td>
                    </tr>
                    <tr>
                        <td>Data Breach</td>
                        <td>External attack or system vulnerability</td>
                        <td>SIEM, automated response, encryption, and incident response plan</td>
                        <td><span class="status-badge status-compliant">Mitigated</span></td>
                    </tr>
                    <tr>
                        <td>Consent Management</td>
                        <td>Incomplete or invalid consent records</td>
                        <td>Automated consent framework with audit trail and validation</td>
                        <td><span class="status-badge status-compliant">Mitigated</span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Key Achievements & Recommendations -->
        <div class="section">
            <h2 class="section-title">Key Achievements & Strategic Recommendations</h2>
            <div class="info-grid">
                <div class="info-card">
                    <h3 class="subsection-title">Notable Achievements</h3>
                    <ul>
                        <li><strong>100% Encryption Coverage:</strong> All PII data encrypted with AES-256 standard</li>
                        <li><strong>98% Consent Capture Rate:</strong> Industry-leading consent management implementation</li>
                        <li><strong>Zero Data Breaches:</strong> No incidents resulting in customer data exposure</li>
                        <li><strong>92% Breach Response:</strong> Automated response within regulatory timelines</li>
                        <li><strong>156 DSAR Processed:</strong> 94% satisfaction rate with average 5-day turnaround</li>
                        <li><strong>Full Audit Trail:</strong> Immutable logs maintained for all data operations</li>
                    </ul>
                </div>
                <div class="info-card">
                    <h3 class="subsection-title">Strategic Recommendations</h3>
                    <ul>
                        <li><strong>Continuous Monitoring:</strong> Maintain monthly compliance reviews and quarterly policy updates</li>
                        <li><strong>Training Enhancement:</strong> Implement role-specific DPDP training modules</li>
                        <li><strong>Automation Expansion:</strong> Extend automated controls to legacy systems</li>
                        <li><strong>Third-Party Assessment:</strong> Conduct annual external DPDP compliance audits</li>
                        <li><strong>Privacy by Design:</strong> Integrate DPDP requirements in SDLC processes</li>
                        <li><strong>Stakeholder Communication:</strong> Regular board updates on compliance posture</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Audit Activity Log -->
        <div class="section">
            <h2 class="section-title">Recent Audit Activity & Continuous Monitoring</h2>
            <table class="compliance-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Actor / System</th>
                        <th>Activity Description</th>
                        <th>Category</th>
                    </tr>
                </thead>
                <tbody>
                    ${auditLogs.map(log => `
                    <tr>
                        <td style="font-family: monospace; color: var(--text-muted);">${log.timestamp}</td>
                        <td style="${log.user === 'System' ? 'color: var(--accent-blue); font-weight: 600;' : 'font-weight: 500;'}">${log.user}</td>
                        <td>${log.action}</td>
                        <td><span class="status-badge ${log.status === 'success' ? 'status-compliant' : 'status-partial'}">${log.category}</span></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>

        <!-- Conclusion -->
        <div class="section">
            <h2 class="section-title">Conclusion & Certification</h2>
            <div class="executive-summary">
                <p><strong>Compliance Certification:</strong> Based on this comprehensive assessment, the organization is certified as <strong>COMPLIANT</strong> with the Digital Personal Data Protection Act, 2023. The organization has demonstrated robust implementation of technical and organizational measures to protect personal data of Indian citizens.</p>
                <p style="margin-top: 16px;"><strong>Continuous Improvement:</strong> While current compliance status is strong, the organization should continue to monitor regulatory updates, enhance automation, and maintain vigilance against emerging threats to personal data.</p>
                <p style="margin-top: 16px;"><strong>Next Assessment:</strong> Scheduled for Q3 2026 (3 months) with interim monthly compliance reviews.</p>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="report-footer">
        <div class="footer-grid">
            <div class="footer-section">
                <h4>Document Classification</h4>
                <p><strong>CONFIDENTIAL</strong></p>
                <p>Internal Compliance Use Only</p>
                <p>Not for External Distribution</p>
            </div>
            <div class="footer-section">
                <h4>Regulatory Framework</h4>
                <p>Digital Personal Data Protection Act, 2023</p>
                <p>Ministry of Electronics & IT, Govt. of India</p>
                <p>Compliance Period: Q1-Q2 2026</p>
            </div>
            <div class="footer-section">
                <h4>Assessment Team</h4>
                <p>DPO: Kavitha Iyer</p>
                <p>Security Admin: Arjun Mehta</p>
                <p>Platform: IBM OpenPages GRC</p>
            </div>
        </div>
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.2); text-align: center; font-size: 12px; color: #94a3b8;">
            <p>© 2026 Your Organization. Generated by IBM OpenPages GRC Platform. Report ID: DPDP-2026-Q2-${Date.now().toString().slice(-6)}</p>
        </div>
    </footer>
</div>

</body>
</html>`;

    const blob = new Blob([htmlReport], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DPDP_Compliance_Report_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* KPMG DPDPA Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white text-center">
        <h2 className="text-2xl font-bold mb-2">DPDP Compliance Demo</h2>
        <p className="text-lg opacity-90">Powered by IBM OpenPages GRC</p>
      </div>

      {/* Overall Compliance Score */}
      <div className="bg-gradient-to-br from-ibm-blue to-blue-600 rounded-2xl p-8 shadow-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-bold mb-2">DPDP Act 2023 Compliance Dashboard</h3>
            <p className="text-lg opacity-90">IBM OpenPages GRC</p>
          </div>
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-7xl font-bold mb-2"
            >
              {overallScore}%
            </motion.div>
            <div className="text-lg font-semibold">Overall Compliance</div>
          </div>
        </div>
      </div>

      {/* Compliance Metrics Grid */}
      <div className="grid grid-cols-5 gap-4">
        {complianceMetrics.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => setSelectedMetric(metric.id)}
            className={`bg-white rounded-xl p-6 shadow-lg cursor-pointer transition-all hover:shadow-xl ${
              selectedMetric === metric.id ? 'ring-4 ring-ibm-blue' : ''
            }`}
          >
            <div className="text-4xl mb-3 text-center">{metric.icon}</div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">{metric.score}%</div>
              <div className="text-sm font-semibold text-gray-700">{metric.name}</div>
            </div>
            <div className="mt-3">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${
                    metric.score >= 95 ? 'bg-ibm-green' :
                    metric.score >= 85 ? 'bg-yellow-500' :
                    'bg-ibm-red'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.score}%` }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Audit Log Viewer */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xl font-bold text-gray-900">Audit Trail</h4>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all">
              Filter
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all">
              Export
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {auditLogs.map((log, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-lg border-2 ${
                log.status === 'success' ? 'border-gray-200 hover:border-ibm-green' :
                log.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                'border-red-200 bg-red-50'
              } transition-all`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`text-2xl ${
                    log.status === 'success' ? 'text-ibm-green' :
                    log.status === 'warning' ? 'text-yellow-600' :
                    'text-ibm-red'
                  }`}>
                    {log.status === 'success' ? '✓' : '⚠️'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{log.action}</div>
                    <div className="text-sm text-gray-600">
                      {log.user} • {log.timestamp}
                    </div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                  {log.category}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Data Lifecycle Management */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="text-xl font-bold text-gray-900 mb-4">Data Lifecycle Management</h4>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-ibm-blue bg-opacity-10 rounded-xl">
            <div className="text-3xl mb-2">📥</div>
            <div className="text-2xl font-bold text-ibm-blue">2.3M</div>
            <div className="text-sm text-gray-700 font-semibold">Records Collected</div>
          </div>
          <div className="text-center p-4 bg-ibm-green bg-opacity-10 rounded-xl">
            <div className="text-3xl mb-2">🛡️</div>
            <div className="text-2xl font-bold text-ibm-green">100%</div>
            <div className="text-sm text-gray-700 font-semibold">Protected</div>
          </div>
          <div className="text-center p-4 bg-purple-100 rounded-xl">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-2xl font-bold text-purple-600">156</div>
            <div className="text-sm text-gray-700 font-semibold">DSAR Processed</div>
          </div>
          <div className="text-center p-4 bg-yellow-100 rounded-xl">
            <div className="text-3xl mb-2">🗑️</div>
            <div className="text-2xl font-bold text-yellow-600">12K</div>
            <div className="text-sm text-gray-700 font-semibold">Records Purged</div>
          </div>
        </div>
      </div>

      {/* Consent Withdrawal Statistics */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="text-xl font-bold text-gray-900 mb-4">Consent Management Statistics</h4>
        
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Active Consents</span>
              <span className="text-lg font-bold text-ibm-green">98%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-ibm-green" style={{ width: '98%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Partial Consents</span>
              <span className="text-lg font-bold text-yellow-600">15%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500" style={{ width: '15%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Revoked</span>
              <span className="text-lg font-bold text-ibm-red">2%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-ibm-red" style={{ width: '2%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Grievance Redressal Section */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xl font-bold text-gray-900">Grievance Redressal Mechanism</h4>
            <p className="text-sm text-gray-600">DPDP Act Section §13 - Data Principal Rights & Grievances</p>
          </div>
          <button
            onClick={() => setShowGrievanceForm(!showGrievanceForm)}
            className="bg-ibm-blue text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all"
          >
            {showGrievanceForm ? 'View Grievances' : '+ Submit Grievance'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {showGrievanceForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="p-6 bg-gray-50 rounded-xl">
                <h5 className="font-semibold text-gray-900 mb-4">Submit a Grievance</h5>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={newGrievance.customerName}
                      onChange={(e) => setNewGrievance({ ...newGrievance, customerName: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newGrievance.email}
                      onChange={(e) => setNewGrievance({ ...newGrievance, email: e.target.value })}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Issue Type
                    </label>
                    <select
                      value={newGrievance.issue}
                      onChange={(e) => setNewGrievance({ ...newGrievance, issue: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none"
                    >
                      <option value="">Select an issue type</option>
                      <option value="Data Access Request Delay">Data Access Request Delay</option>
                      <option value="Incorrect Data">Incorrect Data</option>
                      <option value="Consent Withdrawal Not Processed">Consent Withdrawal Not Processed</option>
                      <option value="Unauthorized Data Usage">Unauthorized Data Usage</option>
                      <option value="Data Deletion Request">Data Deletion Request</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newGrievance.description}
                      onChange={(e) => setNewGrievance({ ...newGrievance, description: e.target.value })}
                      placeholder="Please describe your grievance in detail..."
                      rows={4}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-ibm-blue focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (newGrievance.customerName && newGrievance.email && newGrievance.issue && newGrievance.description) {
                        const grievance: Grievance = {
                          id: `GRV-${String(grievances.length + 1).padStart(3, '0')}`,
                          ...newGrievance,
                          status: 'submitted',
                          submittedAt: new Date().toLocaleString()
                        };
                        setGrievances([...grievances, grievance]);
                        setNewGrievance({ customerName: '', email: '', issue: '', description: '' });
                        setShowGrievanceForm(false);
                      }
                    }}
                    disabled={!newGrievance.customerName || !newGrievance.email || !newGrievance.issue || !newGrievance.description}
                    className="w-full bg-ibm-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
                  >
                    Submit Grievance
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              {grievances.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No grievances submitted yet
                </div>
              ) : (
                grievances.map((grievance, index) => (
                  <motion.div
                    key={grievance.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-lg border-2 ${
                      grievance.status === 'resolved' ? 'border-ibm-green bg-ibm-green bg-opacity-5' :
                      grievance.status === 'under_review' ? 'border-yellow-500 bg-yellow-50' :
                      'border-ibm-blue bg-ibm-blue bg-opacity-5'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-gray-900">{grievance.id}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            grievance.status === 'resolved' ? 'bg-ibm-green text-white' :
                            grievance.status === 'under_review' ? 'bg-yellow-500 text-white' :
                            'bg-ibm-blue text-white'
                          }`}>
                            {grievance.status === 'resolved' ? '✓ Resolved' :
                             grievance.status === 'under_review' ? '⏳ Under Review' :
                             '📝 Submitted'}
                          </span>
                        </div>
                        <div className="font-semibold text-gray-900 mb-1">{grievance.issue}</div>
                        <div className="text-sm text-gray-600 mb-2">{grievance.description}</div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>👤 {grievance.customerName}</span>
                          <span>📧 {grievance.email}</span>
                          <span>📅 {grievance.submittedAt}</span>
                        </div>
                      </div>
                      {grievance.status === 'submitted' && (
                        <button
                          onClick={() => {
                            const updated = grievances.map(g =>
                              g.id === grievance.id
                                ? { ...g, status: 'under_review' as const }
                                : g
                            );
                            setGrievances(updated);
                            setTimeout(() => {
                              const resolved = updated.map(g =>
                                g.id === grievance.id
                                  ? { ...g, status: 'resolved' as const, resolvedAt: new Date().toLocaleString() }
                                  : g
                              );
                              setGrievances(resolved);
                            }, 3000);
                          }}
                          className="px-4 py-2 bg-ibm-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
                        >
                          Process
                        </button>
                      )}
                    </div>
                    
                    {grievance.status === 'resolved' && grievance.resolvedAt && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="flex items-center gap-2 text-sm text-ibm-green">
                          <span className="text-lg">✓</span>
                          <span className="font-semibold">Resolved on {grievance.resolvedAt}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Resolution: Issue addressed and customer notified. DSAR processed within statutory timeline.
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {grievances.filter(g => g.status === 'submitted').length}
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {grievances.filter(g => g.status === 'under_review').length}
                    </div>
                    <div className="text-sm text-gray-600">Under Review</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-ibm-green">
                      {grievances.filter(g => g.status === 'resolved').length}
                    </div>
                    <div className="text-sm text-gray-600">Resolved</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Generate Report */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xl font-bold text-gray-900">Board-Level Compliance Report</h4>
            <p className="text-sm text-gray-600">Generate comprehensive DPDP compliance documentation</p>
          </div>
          <button
            onClick={generateReport}
            className="bg-ibm-blue text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <span>📊</span>
            Generate Report
          </button>
        </div>

        {reportGenerated && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-ibm-green bg-opacity-10 border-2 border-ibm-green rounded-lg"
          >
            <div className="flex items-center gap-2 text-ibm-green font-semibold">
              <span className="text-xl">✓</span>
              Report generated and downloaded successfully
            </div>
          </motion.div>
        )}
      </div>

      {/* Compliance Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h4 className="text-xl font-bold text-gray-900 mb-4">DPDP Act Compliance Summary</h4>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-ibm-green bg-opacity-5 border-2 border-ibm-green rounded-lg">
            <span className="text-2xl text-ibm-green">✓</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Section §6 - Consent Requirements</div>
              <div className="text-sm text-gray-600">98% consent capture rate with full audit trail</div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-ibm-green bg-opacity-5 border-2 border-ibm-green rounded-lg">
            <span className="text-2xl text-ibm-green">✓</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Section §8 - Security Safeguards</div>
              <div className="text-sm text-gray-600">100% encryption coverage and role-based access controls</div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-ibm-green bg-opacity-5 border-2 border-ibm-green rounded-lg">
            <span className="text-2xl text-ibm-green">✓</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Section §11 - Rights of Data Principal</div>
              <div className="text-sm text-gray-600">156 DSAR requests processed with 94% satisfaction</div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-ibm-green bg-opacity-5 border-2 border-ibm-green rounded-lg">
            <span className="text-2xl text-ibm-green">✓</span>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Section §8(6) - Breach Notification</div>
              <div className="text-sm text-gray-600">Real-time detection with automated response protocols</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stage6Compliance;

// Made with Bob
