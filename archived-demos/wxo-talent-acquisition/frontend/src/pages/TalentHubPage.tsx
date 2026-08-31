/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/TalentHubPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Grid,
  Column,
  Tile,
  Button,
  FileUploader,
  InlineNotification,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Pagination,
  SkeletonText,
} from "@carbon/react";
import { api } from "../lib/api";
import OrchestrateEmbed from "../components/orchestrateEmbed";

type Job = { job_id: string; title: string; details: string };
type Resume = { resume_id: string; title: string; summary: string };

const TalentHubPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);

  // Separate the bool “uploading” from Carbon’s filenameStatus enum
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "edit" | "uploading" | "complete"
  >("edit");

  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function refreshAll() {
    setLoading(true);
    setErr(null);
    try {
      // switched to list endpoints (GET)
      const [jobsR, resR] = await Promise.all([
        api.listJobs(1, 200), // page=1, size=200
        api.listResumes(1, 200), // page=1, size=200
      ]);
      setJobs(jobsR);
      setResumes(resR);
    } catch (e: any) {
      setErr(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const resumeRows = useMemo(
    () =>
      resumes.map((r) => ({
        id: r.resume_id,
        name: r.title,
        summary: r.summary,
      })),
    [resumes]
  );

  const headers = useMemo(
    () => [
      { key: "name", header: "Filename" },
      { key: "summary", header: "AI Summary" },
    ],
    []
  );

  const [page, setPage] = useState({ page: 1, pageSize: 10 });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return resumeRows.filter((r) =>
      `${r.name ?? ""} ${r.summary ?? ""}`.toLowerCase().includes(q)
    );
  }, [resumeRows, query]);

  const start = (page.page - 1) * page.pageSize;
  const pageRows = filtered.slice(start, start + page.pageSize);

  async function handleUpload() {
    if (!file) {
      setErr("Please attach a PDF");
      return;
    }
    setUploading(true);
    setUploadStatus("uploading");
    setOk(null);
    setErr(null);
    try {
      await api.uploadResume(file);
      setOk("Resume uploaded successfully.");
      setFile(null);
      setUploadStatus("complete");
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
      setUploadStatus("edit");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Grid fullWidth>
        <Column lg={16} md={8} sm={4}>
          <h2 style={{ margin: "1rem 0" }}>TalentHub — Dashboard</h2>
        </Column>

        <Column lg={8} md={4} sm={4}>
          <Tile className="p-5">
            <h4>Upload Resume</h4>
            {ok && (
              <InlineNotification
                title={ok}
                kind="success"
                onCloseButtonClick={() => setOk(null)}
              />
            )}
            {err && (
              <InlineNotification
                title="Error"
                subtitle={err}
                kind="error"
                onCloseButtonClick={() => setErr(null)}
              />
            )}
            <div style={{ marginTop: 12 }}>
              <FileUploader
                labelTitle="Resume PDF"
                filenameStatus={uploadStatus}
                labelDescription="Upload a single PDF (or DOCX if backend supports)"
                buttonKind="primary"
                multiple={false}
                accept={[".pdf"]}
                onChange={(e: any) => {
                  const f = e?.target?.files?.[0] as File | undefined;
                  setFile(f ?? null);
                  setUploadStatus(f ? "edit" : "edit");
                }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Button disabled={uploading || !file} onClick={handleUpload}>
                {uploading ? "Uploading..." : "Submit"}
              </Button>
            </div>
          </Tile>
        </Column>

        <Column lg={8} md={4} sm={4}>
          <Tile className="p-5">
            <h4>Open Jobs</h4>
            {loading ? (
              <SkeletonText paragraph lineCount={5} />
            ) : jobs.length === 0 ? (
              <div>No jobs found</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {jobs.map((j) => (
                  <div
                    key={j.job_id}
                    style={{
                      borderBottom: "1px solid var(--cds-border-subtle)",
                      paddingBottom: 8,
                    }}
                  >
                    <strong>{j.title}</strong>
                    <div
                      style={{
                        color: "var(--cds-text-secondary)",
                        marginTop: 4,
                      }}
                    >
                      {(j.details ?? "").slice(0, 160)}
                      {j.details && j.details.length > 160 ? "…" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tile>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="p-5" style={{ marginTop: 16 }}>
            <h4>Resumes</h4>
            {loading ? (
              <SkeletonText paragraph lineCount={8} />
            ) : (
              <>
                <TableToolbar>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      persistent
                      onChange={(e: any) => setQuery(e.target.value)}
                    />
                  </TableToolbarContent>
                </TableToolbar>

                <DataTable rows={pageRows} headers={headers}>
                  {({ rows, headers, getHeaderProps, getRowProps }) => (
                    <Table size="lg">
                      <TableHead>
                        <TableRow>
                          {headers.map((h) => (
                            <TableHeader {...getHeaderProps({ header: h })}>
                              {h.header}
                            </TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow {...getRowProps({ row })}>
                            {row.cells.map((cell) => {
                              const isSummary = cell.info.header === "summary";
                              const val = String(cell.value ?? "");
                              const short =
                                isSummary && val.length > 240
                                  ? `${val.slice(0, 240)}…`
                                  : val;
                              return (
                                <TableCell key={cell.id}>{short}</TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </DataTable>

                <Pagination
                  page={page.page}
                  pageSize={page.pageSize}
                  pageSizes={[10, 20, 50]}
                  totalItems={filtered.length}
                  onChange={(p) =>
                    setPage({ page: p.page, pageSize: p.pageSize })
                  }
                />
              </>
            )}
          </Tile>
        </Column>
      </Grid>
      <div id="wxo-chat-root" />
      <OrchestrateEmbed rootElementId="wxo-chat-root" />
    </>
  );
};

export default TalentHubPage;
