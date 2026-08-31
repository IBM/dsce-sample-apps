import React, { useState, useEffect } from "react";
import {
    Box,
    Container,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    AppBar,
    Toolbar,
    IconButton,
    Collapse,
    Button,
} from "@mui/material";

import initialTransactions from "./transactions.json";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ShieldIcon from "@mui/icons-material/Shield";
import StarIcon from "@mui/icons-material/Star";
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import logo from "../static/logo.jpg";
import DeleteIcon from '@mui/icons-material/Delete';
import watsonxlogo from "../static/watsonx.svg";
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";



export default function Dashboard() {

    const [transactions, setTransactions] = useState([]);
    const [expandedRow, setExpandedRow] = useState(null);
    const [clear, setClear] = useState(false);

    const metricDefinitions = {
        "Helpfulness": "Helpfulness measures whether the response provides accurate, actionable information and directly addresses the user’s needs with useful detail.",
        "Conciseness": "Conciseness measures whether the response is short, succinct, and clear in directly addressing the point at hand.",
        "Narrative Quality": "Narrative Quality measures whether the narrative accurately extracts and summarizes all relevant data from the JSON table, directly answering the question with correct facts and figures.",
        "HAP": "HAP measures whether the text contains any toxic content, including hate, abuse, or profanity.",
        "Social Bias": "Social Bias identifies the presence of biased or discriminatory language.",
        "Jailbreak": "Jailbreak measures the risk of deliberate circumvention of an AI system’s built-in safeguards or ethical guidelines, such as prompts designed to elicit restricted or inappropriate content.",
        "PII": "PII measures whether the text contains personally identifiable information.",
        "Context Relevance": "Context Relevance measures how relevant the retrieved context is to the user’s question.",
        "Answer Relevance": "Answer Relevance measures how relevant the AI-generated response is to the user’s question.",
        "Faithfulness": "Faithfulness measures whether the AI - generated response is grounded in facts present in the retrieved context.",
    }

    const loadTransactions = () => {
        const newTransactions = JSON.parse(localStorage.getItem('watsonTransactions') || '[]');
        const combined = [...initialTransactions.transactions, ...newTransactions];
        combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(combined);
    };

    useEffect(() => {
        loadTransactions();
    }, []);

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    const toggleExpand = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    useEffect(() => {
        if (clear == true) {
            localStorage.removeItem('watsonTransactions');
            setClear(false)
            window.location.reload()
        }
    }, [clear])

    const clearLocalStorage = () => {
        setClear(true)
    }

    // Calculate aggregate metrics from transactions
    const calculateMetrics = () => {
        const inputMetrics = {
            hap: { total: 0, count: 0, violations: 0 },
            pii: { total: 0, count: 0, violations: 0 },
            jailbreak: { total: 0, count: 0, violations: 0 },
            socialBias: { total: 0, count: 0, violations: 0 }
        };

        const outputMetrics = {
            narrative_quality: { total: 0, count: 0, violations: 0 },
            conciseness: { total: 0, count: 0, violations: 0 },
            helpfulness: { total: 0, count: 0, violations: 0 }
        };

        const ragMetrics = {
            // conciseness: { total: 0, count: 0, violations: 0 },
            // helpfulness: { total: 0, count: 0, violations: 0 },
            answer_relevance: { total: 0, count: 0, violations: 0 },
            faithfulness: { total: 0, count: 0, violations: 0 },
            context_relevance: { total: 0, count: 0, violations: 0 }
        };

        let ragCount = 0;
        let nonRagCount = 0;

        transactions.forEach(t => {
            // Track RAG vs non-RAG
            if (t.isRag) {
                ragCount++;
            } else {
                nonRagCount++;
            }

            // Process input eval
            const inputGov = t.output?.input_governance;
            const outputData = t.output?.data;

            if (inputGov) {
                Object.entries(inputGov).forEach(([metric, data]) => {
                    if (metric.includes('HAP')) {
                        inputMetrics.hap.total += data.score || 0;
                        inputMetrics.hap.count++;
                        if (data.guardrail_action === 'Block') inputMetrics.hap.violations++;
                    } else if (metric.includes('PII')) {
                        inputMetrics.pii.total += data.score || 0;
                        inputMetrics.pii.count++;
                        if (data.guardrail_action === 'Block') inputMetrics.pii.violations++;
                    } else if (metric.includes('Jailbreak')) {
                        inputMetrics.jailbreak.total += data.score || 0;
                        inputMetrics.jailbreak.count++;
                        if (data.guardrail_action === 'Block') inputMetrics.jailbreak.violations++;
                    } else if (metric.includes('Social Bias')) {
                        inputMetrics.socialBias.total += data.score || 0;
                        inputMetrics.socialBias.count++;
                        if (data.guardrail_action === 'Block') inputMetrics.socialBias.violations++;
                    }
                });
            } else if (outputData && Array.isArray(outputData)) {
                outputData.forEach(item => {
                    if (item.check_type === 'Output') return;

                    const metric = item.metric;
                    if (metric?.includes('HAP')) {
                        inputMetrics.hap.total += item.score || 0;
                        inputMetrics.hap.count++;
                        if (item.guardrail_action === 'Block') inputMetrics.hap.violations++;
                    } else if (metric?.includes('PII')) {
                        inputMetrics.pii.total += item.score || 0;
                        inputMetrics.pii.count++;
                        if (item.guardrail_action === 'Block') inputMetrics.pii.violations++;
                    } else if (metric?.includes('Jailbreak')) {
                        inputMetrics.jailbreak.total += item.score || 0;
                        inputMetrics.jailbreak.count++;
                        if (item.guardrail_action === 'Block') inputMetrics.jailbreak.violations++;
                    } else if (metric?.includes('Social Bias')) {
                        inputMetrics.socialBias.total += item.score || 0;
                        inputMetrics.socialBias.count++;
                        if (item.guardrail_action === 'Block') inputMetrics.socialBias.violations++;
                    }
                });
            }

            // Process output eval
            const outputGov = t.output?.output_governance;
            if (outputGov) {
                Object.entries(outputGov).forEach(([metric, data]) => {
                    // Conciseness and Helpfulness go to outputMetrics for ALL transactions
                    if (metric.includes('Conciseness')) {
                        outputMetrics.conciseness.total += data.score || 0;
                        outputMetrics.conciseness.count++;
                        if (data.guardrail_action === 'Block') outputMetrics.conciseness.violations++;
                    } else if (metric.includes('Helpfulness')) {
                        outputMetrics.helpfulness.total += data.score || 0;
                        outputMetrics.helpfulness.count++;
                        if (data.guardrail_action === 'Block') outputMetrics.helpfulness.violations++;
                    } else if (metric.includes('Narrative Quality')) {
                        // Narrative Quality only for non-RAG
                        outputMetrics.narrative_quality.total += data.score || 0;
                        outputMetrics.narrative_quality.count++;
                        if (data.guardrail_action === 'Block') outputMetrics.narrative_quality.violations++;
                    }

                    // RAG-specific metrics only for RAG transactions
                    if (t.isRag) {
                        if (metric.includes('Answer Relevance')) {
                            ragMetrics.answer_relevance.total += data.score || 0;
                            ragMetrics.answer_relevance.count++;
                            if (data.guardrail_action === 'Block') ragMetrics.answer_relevance.violations++;
                        } else if (metric.includes('Faithfulness')) {
                            ragMetrics.faithfulness.total += data.score || 0;
                            ragMetrics.faithfulness.count++;
                            if (data.guardrail_action === 'Block') ragMetrics.faithfulness.violations++;
                        } else if (metric.includes('Context Relevance')) {
                            ragMetrics.context_relevance.total += data.score || 0;
                            ragMetrics.context_relevance.count++;
                            if (data.guardrail_action === 'Block') ragMetrics.context_relevance.violations++;
                        }
                    }
                });
            }
        });

        const calcAvg = (m) => m.count > 0 ? m.total / m.count : 0;

        return {
            input: {
                hap: { avg: calcAvg(inputMetrics.hap), violations: inputMetrics.hap.violations },
                pii: { avg: calcAvg(inputMetrics.pii), violations: inputMetrics.pii.violations },
                jailbreak: { avg: calcAvg(inputMetrics.jailbreak), violations: inputMetrics.jailbreak.violations },
                socialBias: { avg: calcAvg(inputMetrics.socialBias), violations: inputMetrics.socialBias.violations }
            },
            output: {
                narrative_quality: { avg: calcAvg(outputMetrics.narrative_quality), violations: outputMetrics.narrative_quality.violations, count: outputMetrics.narrative_quality.count },
                conciseness: { avg: calcAvg(outputMetrics.conciseness), violations: outputMetrics.conciseness.violations, count: outputMetrics.conciseness.count },
                helpfulness: { avg: calcAvg(outputMetrics.helpfulness), violations: outputMetrics.helpfulness.violations, count: outputMetrics.helpfulness.count }
            },
            rag: {
                answer_relevance: { avg: calcAvg(ragMetrics.answer_relevance), violations: ragMetrics.answer_relevance.violations, count: ragMetrics.answer_relevance.count },
                faithfulness: { avg: calcAvg(ragMetrics.faithfulness), violations: ragMetrics.faithfulness.violations, count: ragMetrics.faithfulness.count },
                context_relevance: { avg: calcAvg(ragMetrics.context_relevance), violations: ragMetrics.context_relevance.violations, count: ragMetrics.context_relevance.count }
            },
            counts: {
                ragCount,
                nonRagCount,
                totalCount: ragCount + nonRagCount
            }
        };
    };

    const metrics = calculateMetrics();

    // Get color based on score (lower is better for safety metrics)
    const getBarColor = (score, isQualityMetric = false) => {
        if (isQualityMetric) {
            if (score >= 0.7) return '#4caf50';
            if (score >= 0.4) return '#ff9800';
            return '#f44336';
        } else {
            if (score < 0.3) return '#4caf50';
            if (score < 0.6) return '#ff9800';
            return '#f44336';
        }
    };

    // Progress bar component
    const MetricRow = ({ label, score, violations, violationLabel, count, isQualityMetric = false, definition }) => (
        <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    {definition && (
                        <Tooltip title={definition} placement="right" arrow slotProps={{
                            tooltip: {
                                sx: {
                                    fontSize: 14,
                                    padding: '10px 14px',
                                    maxWidth: 300
                                }
                            }
                        }}>
                            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        </Tooltip>
                    )}
                </Box>
                <Typography variant="body2" fontWeight={600}>{score.toFixed(3)}</Typography>
            </Box>
            <Box sx={{ width: '100%', height: 6, bgcolor: '#e0e0e0', borderRadius: 3, mb: 1.5 }}>
                <Box sx={{
                    width: `${Math.min(score * 100, 100)}%`,
                    height: '100%',
                    bgcolor: getBarColor(score, isQualityMetric),
                    borderRadius: 3
                }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" fontWeight={500}>{violationLabel}: {violations}/{count}</Typography>
            </Box>
        </>
    );
    return (
        <Box
            sx={{
                minHeight: "100vh",
                background: "linear-gradient(180deg, #ffffff 0%, #e3f2fd 50%, #bbdefb 100%)",
            }}
        >
            {/* Navbar */}
            <AppBar
                position="static"
                elevation={0}
                sx={{
                    bgcolor: "white",
                    borderBottom: "1px solid #e0e0e0",
                }}
            >
                <Toolbar sx={{ justifyContent: "space-between" }}>
                    <Box
                        component="img"
                        sx={{
                            height: 50,
                            width: 115,
                        }}
                        src={logo}
                    />
                </Toolbar>
            </AppBar>

            {/* Hero Section */}
            <Container maxWidth="md" sx={{ textAlign: "center", mt: 4, mb: 4 }}>
                <Typography
                    variant="h2"
                    fontWeight={700}
                    sx={{ mb: 2, fontSize: { xs: 36, md: 56 } }}
                >
                    <Box component="span" sx={{ color: "#1976d2" }}>
                        Trusted AI Dashboard
                    </Box>
                </Typography>
            </Container>

            {/* Aggregate Metrics Cards */}
            <Box sx={{ display: "flex", gap: 3, mb: 4, mx: 5, flexWrap: "wrap" }}>

                {/* Safety Guardrails - Input */}
                <Paper sx={{ p: 3, flex: 1, minWidth: 300, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <ShieldIcon sx={{ color: '#d32f2f' }} />
                        <Typography variant="h6" fontWeight={700} color="#1976d2">
                            Safety Guardrails
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Input Safety Checks
                    </Typography>

                    <MetricRow
                        label="HAP (Hate, Abuse, Profanity)"
                        score={metrics.input.hap.avg}
                        violations={metrics.input.hap.violations}
                        violationLabel="HAP Violations"
                        count={metrics.counts.totalCount}
                        definition={metricDefinitions['HAP']}
                    />
                    <MetricRow
                        label="PII Detection"
                        score={metrics.input.pii.avg}
                        violations={metrics.input.pii.violations}
                        violationLabel="PII Violations"
                        count={metrics.counts.totalCount}
                        definition={metricDefinitions['PII']}
                    />
                    <MetricRow
                        label="Jailbreak Attempts"
                        score={metrics.input.jailbreak.avg}
                        violations={metrics.input.jailbreak.violations}
                        violationLabel="Jailbreak Violations"
                        count={metrics.counts.totalCount}
                        definition={metricDefinitions['Jailbreak']}
                    />
                    <MetricRow
                        label="Social Bias"
                        score={metrics.input.socialBias.avg}
                        violations={metrics.input.socialBias.violations}
                        violationLabel="Bias Violations"
                        count={metrics.counts.totalCount}
                        definition={metricDefinitions['Social Bias']}
                    />
                </Paper>

                {/* Response Quality - Output */}
                <Paper sx={{ p: 3, flex: 1, minWidth: 300, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <StarIcon sx={{ color: '#ffc107' }} />
                        <Typography variant="h6" fontWeight={700} color="#1976d2">
                            Response Quality
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Output Quality Evaluation
                    </Typography>

                    <MetricRow
                        label="Narrative Quality"
                        score={metrics.output.narrative_quality.avg}
                        violations={metrics.output.narrative_quality.violations}
                        violationLabel="Narrative Quality Violations"
                        isQualityMetric={true}
                        count={metrics.output.narrative_quality.count}
                        definition={metricDefinitions['Narrative Quality']}

                    />
                    <MetricRow
                        label="Conciseness"
                        score={metrics.output.conciseness.avg}
                        violations={metrics.output.conciseness.violations}
                        violationLabel="Conciseness Violations"
                        isQualityMetric={true}
                        count={metrics.output.conciseness.count}
                        definition={metricDefinitions['Conciseness']}

                    />
                    <MetricRow
                        label="Helpfulness"
                        score={metrics.output.helpfulness.avg}
                        violations={metrics.output.helpfulness.violations}
                        violationLabel="Helpfulness Violations"
                        isQualityMetric={true}
                        count={metrics.output.helpfulness.count}
                        definition={metricDefinitions['Helpfulness']}

                    />
                </Paper>

                {/* RAG Quality Metrics */}
                <Paper sx={{ p: 3, flex: 1, minWidth: 300, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TipsAndUpdatesIcon sx={{ color: '#0096FF' }} />
                        <Typography variant="h6" fontWeight={700} color="#1976d2">
                            RAG Quality
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        RAG Evaluation
                    </Typography>
                    {metrics.counts.ragCount > 0 ? (
                        <>
                            <MetricRow
                                label="Answer Relevance"
                                score={metrics.rag.answer_relevance.avg}
                                violations={metrics.rag.answer_relevance.violations}
                                violationLabel="Relevance Violations"
                                isQualityMetric={true}
                                count={metrics.counts.ragCount}
                                definition={metricDefinitions['Answer Relevance']}

                            />
                            <MetricRow
                                label="Faithfulness"
                                score={metrics.rag.faithfulness.avg}
                                violations={metrics.rag.faithfulness.violations}
                                violationLabel="Faithfulness Violations"
                                isQualityMetric={true}
                                count={metrics.counts.ragCount}
                                definition={metricDefinitions['Faithfulness']}

                            />
                            <MetricRow
                                label="Context Relevance"
                                score={metrics.rag.context_relevance.avg}
                                violations={metrics.rag.context_relevance.violations}
                                violationLabel="Context Relevance Violations"
                                isQualityMetric={true}
                                count={metrics.counts.ragCount}
                                definition={metricDefinitions['Context Relevance']}

                            />
                            {/* <MetricRow
                                label="Conciseness"
                                score={metrics.rag.conciseness.avg}
                                violations={metrics.rag.conciseness.violations}
                                violationLabel="Conciseness Violations"
                                isQualityMetric={true}
                                count={metrics.counts.ragCount}
                            />
                            <MetricRow
                                label="Helpfulness"
                                score={metrics.rag.helpfulness.avg}
                                violations={metrics.rag.helpfulness.violations}
                                violationLabel="Helpfulness Violations"
                                isQualityMetric={true}
                                count={metrics.counts.ragCount}
                            /> */}
                        </>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            No RAG interactions recorded yet.
                        </Typography>
                    )}
                </Paper>


                {/* Summary Stats - Stacked Bar Chart */}
                <Paper sx={{ p: 3, flex: 1, minWidth: 300, borderRadius: 3 }}>
                    <Typography variant="h6" fontWeight={700} color="#1976d2" mb={2}>
                        Summary
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                        <Typography variant="body2" color="text.secondary">Total Evaluations</Typography>
                        <Typography variant="h5" fontWeight={600}>{transactions.length}</Typography>
                    </Box>

                    {/* Input Bar */}
                    {(() => {
                        const inputBlocked = transactions.filter(t => t.blocked_at === 'input').length;
                        const inputPassed = transactions.filter(t => t.blocked_at !== 'input').length;
                        const inputTotal = inputBlocked + inputPassed;
                        const inputBlockedPct = inputTotal > 0 ? (inputBlocked / inputTotal) * 100 : 0;
                        const inputPassedPct = inputTotal > 0 ? (inputPassed / inputTotal) * 100 : 0;

                        return (
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" fontWeight={600}>User Input</Typography>
                                    <Typography variant="body2" color="text.secondary">{inputTotal} total</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', width: '100%', height: 24, borderRadius: 2, overflow: 'hidden', bgcolor: '#e0e0e0' }}>
                                    {inputBlockedPct > 0 && (
                                        <Box sx={{
                                            width: `${inputBlockedPct}%`,
                                            bgcolor: '#f44336',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {inputBlocked > 0 && (
                                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                                    {inputBlocked}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                    {inputPassedPct > 0 && (
                                        <Box sx={{
                                            width: `${inputPassedPct}%`,
                                            bgcolor: '#4caf50',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {inputPassed > 0 && (
                                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                                    {inputPassed}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f44336' }} />
                                        <Typography variant="caption" color="text.secondary">Blocked ({inputBlocked})</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4caf50' }} />
                                        <Typography variant="caption" color="text.secondary">Passed ({inputPassed})</Typography>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })()}

                    {/* Output Bar */}
                    {(() => {
                        const outputBlocked = transactions.filter(t => t.blocked_at === 'output').length;
                        const outputPassed = transactions.filter(t => t.status === 'passed').length;
                        // Output total only counts transactions that made it past input
                        const outputTotal = transactions.filter(t => t.blocked_at !== 'input').length;
                        const outputBlockedPct = outputTotal > 0 ? (outputBlocked / outputTotal) * 100 : 0;
                        const outputPassedPct = outputTotal > 0 ? (outputPassed / outputTotal) * 100 : 0;

                        return (
                            <Box sx={{ mb: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" fontWeight={600}>Agent Output</Typography>
                                    <Typography variant="body2" color="text.secondary">{outputTotal} evaluated</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', width: '100%', height: 24, borderRadius: 2, overflow: 'hidden', bgcolor: '#e0e0e0' }}>
                                    {outputBlockedPct > 0 && (
                                        <Box sx={{
                                            width: `${outputBlockedPct}%`,
                                            bgcolor: '#f44336',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {outputBlocked > 0 && (
                                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                                    {outputBlocked}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                    {outputPassedPct > 0 && (
                                        <Box sx={{
                                            width: `${outputPassedPct}%`,
                                            bgcolor: '#4caf50',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {outputPassed > 0 && (
                                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                                                    {outputPassed}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f44336' }} />
                                        <Typography variant="caption" color="text.secondary">Blocked ({outputBlocked})</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4caf50' }} />
                                        <Typography variant="caption" color="text.secondary">Passed ({outputPassed})</Typography>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })()}
                </Paper>
            </Box>

            {/* Query History Table */}
            <Box sx={{ px: 5, mb: 4 }}>
                <Typography variant="h6" fontWeight={600} mb={2}>
                    Query History
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 3 }}>
                    <Table size="small" sx={{ tableLayout: 'fixed' }}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                                <TableCell sx={{ fontWeight: 600, width: 40, p: 1 }}></TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 100 }}>Timestamp</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 210 }}>Query</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 90 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 30 }}>Blocked At</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {transactions.length > 0 ? (
                                transactions.map((transaction) => {
                                    // Derive status if missing
                                    let status = transaction.status;
                                    if (!status) {
                                        if (transaction.blocked_at === 'input') {
                                            status = 'blocked';
                                        } else if (transaction.blocked_at === 'output') {
                                            status = 'output_violation';
                                        } else if (transaction.output?.data?.some(d => d.guardrail_action === 'Block')) {
                                            status = 'blocked';
                                        } else {
                                            status = 'passed';
                                        }
                                    }

                                    const blockedAt = transaction.blocked_at || null;
                                    const isBlocked = status === 'blocked' || status === 'output_violation';

                                    return (
                                        <React.Fragment key={transaction.id}>
                                            <TableRow
                                                hover
                                                sx={{
                                                    bgcolor: "white",
                                                    cursor: "pointer",
                                                    "& > *": { borderBottom: expandedRow === transaction.id ? 'none' : undefined }
                                                }}
                                                onClick={() => toggleExpand(transaction.id)}
                                            >
                                                <TableCell>
                                                    <IconButton size="small">
                                                        {expandedRow === transaction.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    </IconButton>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {formatDate(transaction.timestamp)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 0 }}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap"
                                                        }}
                                                    >
                                                        {transaction.input}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={
                                                            status === 'output_blocked' ? 'OUTPUT VIOLATION' :
                                                                status === 'blocked' ? 'BLOCKED' :
                                                                    status === 'passed' ? 'PASSED' :
                                                                        (status || 'unknown').toUpperCase()
                                                        }
                                                        size="small"
                                                        sx={{
                                                            bgcolor: status === 'output_blocked' ? '#fff3e0' :
                                                                status === 'blocked' ? '#ffebee' : '#e8f5e9',
                                                            color: status === 'output_blocked' ? '#e65100' :
                                                                status === 'blocked' ? '#c62828' : '#2e7d32',
                                                            fontWeight: 600,
                                                        }}

                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {blockedAt ? (
                                                        <Chip
                                                            label={blockedAt.toUpperCase()}
                                                            size="small"
                                                            variant="outlined"
                                                            color={blockedAt === 'input' ? 'error' : 'warning'}
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">-</Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>

                                            {/* Expanded Row */}
                                            <TableRow>
                                                <TableCell colSpan={5} sx={{ p: 0, bgcolor: "#fafafa" }}>
                                                    <Collapse in={expandedRow === transaction.id}>
                                                        <Box sx={{ p: 3 }}>
                                                            <Typography variant="subtitle2" fontWeight={600} mb={1}>
                                                                Full Query:
                                                            </Typography>
                                                            <Typography variant="body2" mb={2} sx={{ bgcolor: "white", p: 2, borderRadius: 1 }}>
                                                                {transaction.input}
                                                            </Typography>

                                                            {/* Input Evaluation */}
                                                            {transaction.output?.input_governance && (
                                                                <>
                                                                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                                                                        User Input Evaluation:
                                                                    </Typography>
                                                                    <Box sx={{ bgcolor: "white", borderRadius: 1, overflow: "hidden", mb: 2 }}>
                                                                        <Table size="small">
                                                                            <TableHead>
                                                                                <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                                                                                    <TableCell sx={{ fontWeight: 600 }}>Metric</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 600 }}>Guardrail Action</TableCell>
                                                                                </TableRow>
                                                                            </TableHead>
                                                                            <TableBody>
                                                                                {Object.entries(transaction.output.input_governance).map(([metric, data], idx) => {
                                                                                    const isBlocked = data.guardrail_action === 'Block';
                                                                                    return (
                                                                                        <TableRow
                                                                                            key={idx}
                                                                                            sx={{ bgcolor: isBlocked ? '#ffebee' : 'inherit' }}
                                                                                        >
                                                                                            <TableCell sx={{ color: isBlocked ? '#c62828' : 'inherit', fontWeight: isBlocked ? 600 : 400 }}>
                                                                                                {metric}
                                                                                            </TableCell>
                                                                                            <TableCell sx={{ color: isBlocked ? '#c62828' : '#2e7d32' }}>
                                                                                                {data.score}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                <Typography
                                                                                                    variant="body2"
                                                                                                    sx={{
                                                                                                        color: isBlocked ? '#c62828' : '#2e7d32',
                                                                                                        fontWeight: 500
                                                                                                    }}
                                                                                                >
                                                                                                    {isBlocked ? 'Block Input' : 'Pass Input'}
                                                                                                </Typography>
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    );
                                                                                })}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </Box>
                                                                </>
                                                            )}

                                                            {/* Output Evaluation */}
                                                            {transaction.output?.output_governance && (
                                                                <>
                                                                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                                                                        Agent Output Evaluation:
                                                                    </Typography>
                                                                    <Box sx={{ bgcolor: "white", borderRadius: 1, overflow: "hidden", mb: 2 }}>
                                                                        <Table size="small">
                                                                            <TableHead>
                                                                                <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                                                                                    <TableCell sx={{ fontWeight: 600 }}>Metric</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                                                                                    <TableCell sx={{ fontWeight: 600 }}>Guardrail Action</TableCell>
                                                                                </TableRow>
                                                                            </TableHead>
                                                                            <TableBody>
                                                                                {Object.entries(transaction.output.output_governance).map(([metric, data], idx) => {
                                                                                    const isBlocked = data.guardrail_action === 'Block';
                                                                                    return (
                                                                                        <TableRow
                                                                                            key={idx}
                                                                                            sx={{ bgcolor: isBlocked ? '#ffebee' : 'inherit' }}
                                                                                        >
                                                                                            <TableCell sx={{ color: isBlocked ? '#c62828' : 'inherit', fontWeight: isBlocked ? 600 : 400 }}>
                                                                                                {metric}
                                                                                            </TableCell>
                                                                                            <TableCell sx={{ color: isBlocked ? '#c62828' : '#2e7d32' }}>
                                                                                                {data.score}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                <Typography
                                                                                                    variant="body2"
                                                                                                    sx={{
                                                                                                        color: isBlocked ? '#c62828' : '#2e7d32',
                                                                                                        fontWeight: 500
                                                                                                    }}
                                                                                                >
                                                                                                    {isBlocked ? 'Block Output' : 'Pass Output'}
                                                                                                </Typography>
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    );
                                                                                })}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </Box>
                                                                </>
                                                            )}

                                                            {/* Agent Response */}
                                                            {transaction.agent_response && (
                                                                <>
                                                                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                                                                        Agent Response:
                                                                    </Typography>
                                                                    <Box sx={{ bgcolor: "white", p: 2, borderRadius: 1, overflow: "auto", maxHeight: 300 }}>
                                                                        <pre style={{ margin: 0, fontSize: 12 }}>
                                                                            {JSON.stringify(transaction.agent_response, null, 2)}
                                                                        </pre>
                                                                    </Box>
                                                                </>
                                                            )}
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                                        No queries yet. Use the Smart Supplier Selection page to query suppliers.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                </Paper>
                <Box sx={{
                    justifyContent: 'space-between', display: 'flex'
                }}>
                    <Box sx={{
                        bottom: 16,
                        left: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'text.primary',
                        fontSize: '1rem',
                        opacity: 0.7,
                        paddingTop: 5,
                    }}>
                        <img src={watsonxlogo} style={{ width: 20, height: 20 }} />
                        Built with watsonx
                    </Box>

                    <Box sx={{
                        bottom: 16,
                        left: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'text.primary',
                        fontSize: '1rem',
                        opacity: 0.7,
                        paddingTop: 5,
                    }}>
                        <Button
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => { clearLocalStorage() }}
                        >
                            Clear local storage
                        </Button>
                    </Box>
                </Box>
            </Box>

        </Box>
    );
}