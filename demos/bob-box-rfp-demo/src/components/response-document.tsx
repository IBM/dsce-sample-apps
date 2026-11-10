'use client'

import { useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Copy, Download, HelpCircle, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RfpOutput, RfpTable } from '@/lib/rfp-schema'
import { cn } from '@/lib/utils'

// ── Status config ────────────────────────────────────────────────────────────

const STATUS = {
  meets: {
    label: 'Meets',
    icon: CheckCircle2,
    cell: 'text-success',
    badge: 'bg-success/10 text-success border-success/20',
  },
  partial: {
    label: 'Partial',
    icon: MinusCircle,
    cell: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  },
  clarify: {
    label: 'Clarify',
    icon: HelpCircle,
    cell: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
  },
} as const

// The LLM occasionally returns a status outside the schema enum (e.g. "open"); treat it as "clarify"
// rather than crashing the whole app on an undefined lookup.
const statusOf = (status: string) => STATUS[status as keyof typeof STATUS] ?? STATUS.clarify

// ── Markdown export ──────────────────────────────────────────────────────────

const mdTable = (t: RfpTable) => [
  ...(t.caption ? [`**${t.caption}**`, ''] : []),
  `| ${t.columns.join(' | ')} |`,
  `| ${t.columns.map(() => '---').join(' | ')} |`,
  ...t.rows.map((r) => `| ${r.join(' | ')} |`),
  '',
]

function toMarkdown(doc: RfpOutput, companyName: string) {
  const lines: string[] = [
    `# ${doc.title}`,
    '',
    `**Prepared for:** ${[doc.clientName, doc.submittedTo].filter(Boolean).join(', ')}`,
    `**Submitted by:** ${doc.submittedBy ?? companyName}`,
    doc.rfpReference ? `**In response to:** ${doc.rfpReference}` : '',
    doc.proposalNumber ? `**Proposal number:** ${doc.proposalNumber}` : '',
    doc.date ? `**Date:** ${doc.date}` : '',
    '',
  ]

  if (doc.coverLetter) {
    const c = doc.coverLetter
    lines.push('---', '', ...c.addressee.map((l) => `${l}  `), '', `**Re: ${c.subject}**`, '', c.salutation, '')
    c.paragraphs.forEach((p) => lines.push(p, ''))
    if (doc.contact) lines.push('Sincerely,', '', `${doc.contact.name}  `, `${doc.contact.title}  `, '')
  }

  lines.push('---', '', '## 1. Executive Summary', '', doc.executiveSummary, '')

  doc.sections.forEach((s, i) => {
    lines.push(`## ${i + 2}. ${s.heading}`, '', s.body, '')
    s.subsections?.forEach((sub) => {
      lines.push(`### ${[sub.number, sub.title].filter(Boolean).join('  ')}`, '')
      if (sub.requirement) lines.push(`_Acme requirement: ${sub.requirement}_`, '')
      lines.push(sub.body, '')
    })
    s.tables?.forEach((t) => lines.push(...mdTable(t)))
    s.notes?.forEach((n) => lines.push(`- ${n}`))
    if (s.notes?.length) lines.push('')
    s.bullets?.forEach((b) => lines.push(`- ${b}`))
    if (s.bullets?.length) lines.push('')
    if (s.keyMetric) {
      lines.push(`> **${s.keyMetric.value}** — ${s.keyMetric.label}${s.keyMetric.source ? ` *(${s.keyMetric.source})*` : ''}`, '')
    }
  })

  if (doc.complianceMatrix.length > 0) {
    lines.push(
      '## Compliance Matrix',
      '',
      '| # | Requirement | RFP Ref | Response | Status | Source |',
      '|---|-------------|---------|----------|--------|--------|',
      ...doc.complianceMatrix.map(
        (r, i) =>
          `| ${i + 1} | ${r.requirement} | ${r.rfpRef ?? '—'} | ${r.response} | ${statusOf(r.status).label} | ${r.sourceRef ?? '—'} |`,
      ),
      '',
    )
  }

  if (doc.exhibits?.length) lines.push('## Exhibits', '', ...doc.exhibits.map((e) => `- ${e}`), '')
  if (doc.confidentialityNotice) lines.push('---', '', `_${doc.confidentialityNotice}_`)

  return lines.join('\n')
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="text-pretty leading-relaxed text-foreground/85">
            {p}
          </p>
        ))}
    </>
  )
}

function KeyMetricCallout({ value, label, source }: { value: string; label: string; source?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
      <span className="shrink-0 text-3xl font-bold tracking-tight text-primary">{value}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {source && <span className="text-xs text-muted-foreground">{source}</span>}
      </div>
    </div>
  )
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
      {n}
    </span>
  )
}

function StatusCell({ value }: { value: string }) {
  const v = value.trim().toLowerCase()
  const cfg = v === 'compliant' ? STATUS.meets : v === 'partial' ? STATUS.partial : v === 'not compliant' ? STATUS.clarify : null
  if (!cfg) return <>{value}</>
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', cfg.badge)}>
      <Icon className="size-3" aria-hidden="true" />
      {value}
    </span>
  )
}

function DocTable({ table }: { table: RfpTable }) {
  return (
    <div className="flex flex-col gap-2">
      {table.caption && <h4 className="text-sm font-semibold text-foreground">{table.caption}</h4>}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/60">
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className={cn('border-t border-border align-top', ri % 2 === 1 && 'bg-muted/20')}>
                {row.map((cell, ci) => (
                  <td key={ci} className={cn('px-4 py-3 leading-relaxed', ci === 0 ? 'font-medium text-foreground' : 'text-foreground/80')}>
                    <StatusCell value={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OpenItemBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
      <AlertCircle className="size-3" aria-hidden="true" />
      Open item
    </span>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ResponseDocument({ doc, companyName }: { doc: RfpOutput; companyName: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(toMarkdown(doc, companyName))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function download() {
    const blob = new Blob([toMarkdown(doc, companyName)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const meetsCount = doc.complianceMatrix.filter((r) => r.status === 'meets').length
  const partialCount = doc.complianceMatrix.filter((r) => r.status === 'partial').length
  const clarifyCount = doc.complianceMatrix.length - meetsCount - partialCount

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download aria-hidden="true" />
          Markdown
        </Button>
      </div>

      <article className="flex flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">

        {/* Cover page */}
        <header className="flex flex-col gap-8 border-b border-border bg-card px-8 py-10 md:px-14 md:py-12">
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold tracking-tight text-primary">{doc.submittedBy ?? companyName}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Proposal Response{doc.rfpReference ? ` · ${doc.rfpReference}` : ''}
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {doc.title}
            </h2>
          </div>

          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Prepared for</dt>
              <dd className="font-medium text-foreground">{doc.clientName}</dd>
              {doc.submittedTo && <dd className="text-muted-foreground">{doc.submittedTo}</dd>}
            </div>
            {doc.rfpReference && (
              <div className="flex flex-col gap-0.5">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">In response to</dt>
                <dd className="font-mono text-foreground">{doc.rfpReference}</dd>
              </div>
            )}
            {doc.proposalNumber && (
              <div className="flex flex-col gap-0.5">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Proposal number</dt>
                <dd className="font-mono text-foreground">{doc.proposalNumber}</dd>
              </div>
            )}
            {doc.date && (
              <div className="flex flex-col gap-0.5">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Date</dt>
                <dd className="text-foreground">{doc.date}</dd>
              </div>
            )}
            {doc.contact && (
              <div className="flex flex-col gap-0.5">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">IBM contact</dt>
                <dd className="font-medium text-foreground">{doc.contact.name}, {doc.contact.title}</dd>
                {(doc.contact.email || doc.contact.phone) && (
                  <dd className="text-muted-foreground">{[doc.contact.email, doc.contact.phone].filter(Boolean).join('  |  ')}</dd>
                )}
              </div>
            )}
            {doc.complianceMatrix.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Compliance</dt>
                <dd className="flex items-center gap-2 text-foreground">
                  <span className="text-success">{meetsCount} Meets</span>
                  {partialCount > 0 && <span className="text-amber-600 dark:text-amber-400">{partialCount} Partial</span>}
                  {clarifyCount > 0 && <span className="text-muted-foreground">{clarifyCount} Clarify</span>}
                </dd>
              </div>
            )}
          </dl>

          {doc.confidentialityNotice && (
            <p className="text-xs leading-relaxed text-muted-foreground">{doc.confidentialityNotice}</p>
          )}
        </header>

        <div className="flex flex-col divide-y divide-border px-8 md:px-14">
          {/* Cover letter */}
          {doc.coverLetter && (
            <section id="cover-letter" className="flex flex-col gap-4 py-10">
              {doc.date && <p className="text-sm text-foreground/85">{doc.date}</p>}
              <div className="flex flex-col text-sm text-foreground/85">
                {doc.coverLetter.addressee.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
              <p className="text-sm font-semibold text-foreground">Re: {doc.coverLetter.subject}</p>
              <p className="text-foreground/85">{doc.coverLetter.salutation}</p>
              {doc.coverLetter.paragraphs.map((p, i) => (
                <p key={i} className="text-pretty leading-relaxed text-foreground/85">{p}</p>
              ))}
              {doc.contact && (
                <div className="flex flex-col text-sm text-foreground/85">
                  <span className="mb-3">Sincerely,</span>
                  <span className="font-medium text-foreground">{doc.contact.name}</span>
                  <span>{doc.contact.title}</span>
                  <span>{doc.submittedBy ?? companyName}</span>
                </div>
              )}
            </section>
          )}

          {/* Executive Summary */}
          <section id="executive-summary" className="flex flex-col gap-5 py-10">
            <div className="flex items-center gap-3">
              <SectionNumber n={1} />
              <h3 className="text-lg font-semibold text-foreground">Executive Summary</h3>
            </div>
            <div className="flex flex-col gap-3">
              <Paragraphs text={doc.executiveSummary} />
            </div>
          </section>

          {/* Body sections */}
          {doc.sections.map((s, i) => (
            <section key={s.heading} id={`section-${i + 2}`} className="flex flex-col gap-5 py-10">
              <div className="flex items-center gap-3">
                <SectionNumber n={i + 2} />
                <h3 className="text-lg font-semibold text-foreground">{s.heading}</h3>
              </div>

              <div className="flex flex-col gap-3">
                <Paragraphs text={s.body} />
              </div>

              {s.subsections?.map((sub) => (
                <div key={`${sub.number}-${sub.title}`} className="flex flex-col gap-2">
                  <h4 className="text-base font-semibold text-foreground">
                    {sub.number && <span className="mr-2 font-mono text-sm text-muted-foreground">{sub.number}</span>}
                    {sub.title}
                  </h4>
                  {sub.requirement && (
                    <p className="text-sm italic text-muted-foreground">Acme requirement: {sub.requirement}</p>
                  )}
                  <Paragraphs text={sub.body} />
                </div>
              ))}

              {s.tables?.map((t, ti) => (
                <DocTable key={ti} table={t} />
              ))}

              {s.notes && s.notes.length > 0 && (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-foreground/85">
                  {s.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}

              {s.bullets && s.bullets.length > 0 && (
                <ul className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-5 py-4">
                  {s.bullets.map((b) => {
                    const isOpenItem = b.startsWith('OPEN ITEM')
                    return (
                      <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed">
                        {isOpenItem ? (
                          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
                        ) : (
                          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                        )}
                        <span className={cn('text-foreground/85', isOpenItem && 'text-amber-700 dark:text-amber-400')}>
                          {b}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}

              {s.keyMetric && (
                <KeyMetricCallout
                  value={s.keyMetric.value}
                  label={s.keyMetric.label}
                  source={s.keyMetric.source}
                />
              )}
            </section>
          ))}

          {/* Compliance Matrix (legacy documents only) */}
          {doc.complianceMatrix.length > 0 && (
            <section id="compliance-matrix" className="flex flex-col gap-4 py-10">
              <h3 className="text-lg font-semibold text-foreground">Compliance Matrix</h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/60">
                    <tr>
                      {['#', 'Requirement', 'RFP Ref', 'Response', 'Status', 'Source'].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {doc.complianceMatrix.map((row, i) => {
                      const cfg = statusOf(row.status)
                      const Icon = cfg.icon
                      const hasOpenItem = row.response.includes('OPEN ITEM')
                      return (
                        <tr key={i} className={cn('border-t border-border align-top', i % 2 === 1 && 'bg-muted/20')}>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{row.requirement}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.rfpRef ?? '—'}</td>
                          <td className="px-4 py-3 leading-relaxed text-foreground/80">
                            {hasOpenItem ? (
                              <span className="flex flex-col gap-1">
                                <span>{row.response.replace(/OPEN ITEM:[^.]*\.?\s*/g, '')}</span>
                                <OpenItemBadge />
                              </span>
                            ) : (
                              row.response
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', cfg.badge)}>
                              <Icon className="size-3" aria-hidden="true" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {row.sourceRef ? row.sourceRef.split('/').pop() : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Exhibits */}
          {doc.exhibits && doc.exhibits.length > 0 && (
            <section id="exhibits" className="flex flex-col gap-3 py-10">
              <h3 className="text-lg font-semibold text-foreground">Exhibits</h3>
              <ul className="flex flex-col gap-1 text-sm text-foreground/85">
                {doc.exhibits.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>
    </div>
  )
}
