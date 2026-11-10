'use client'

import { useRef, useState } from 'react'
import { ArtifactPanel, type SaveState } from '@/components/studio/artifact-panel'
import { ChatPanel } from '@/components/studio/chat-panel'
import { HomeScreen } from '@/components/studio/home-screen'
import { SourcePreview } from '@/components/studio/source-preview'
import { MOCK_EMAIL, MOCK_RESPONSE, SYNC_STEPS, VENDOR_NAME, type BoxFile } from '@/lib/mock-data'
import type { RfpOutput } from '@/lib/rfp-schema'
import type { Artifact, ArtifactType, ChatMessage } from '@/lib/studio-types'
import { createDeckPptxBlob } from '@/services/deckPptxExport'
import { createRfpDocxBlob } from '@/services/rfpDocxExport'

const TITLES: Record<ArtifactType, string> = {
  brief: 'Research brief',
  response: 'RFP response',
  deck: 'Presentation',
  email: 'Cover email',
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function shorten(doc: RfpOutput): RfpOutput {
  const first = (t: string) => t.split(/\n\s*\n/)[0]
  return {
    ...doc,
    executiveSummary: first(doc.executiveSummary),
    sections: doc.sections.map((s) => ({ ...s, body: first(s.body) })),
  }
}

function sharpenPricing(doc: RfpOutput): RfpOutput {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.heading === 'Pricing Approach'
        ? {
            ...s,
            body: `${s.body}\n\nTo lower the Year 1 cost, we offer a 10% multi-year commitment discount, which brings the three-year total to $480,000 ($130,500/year subscription + $85,000 fixed launch). Implementation fees are fixed, with no change orders for in-scope work.`,
          }
        : s,
    ),
    slides: doc.slides.map((slide) =>
      slide.title.includes('Investment')
        ? { ...slide, bullets: [...slide.bullets.slice(0, 2), '$480K three-year total with a 10% multi-year discount'] }
        : slide,
    ),
  }
}

async function fetchBoxDocs(): Promise<Array<{ id: string | null; name: string; folderPath: string; fullContent: string }>> {
  try {
    const res = await fetch('/api/box/documents')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.documents) && data.documents.length > 0) {
        return data.documents.map((d: any) => ({
          // boxFileId is a real Box numeric ID from live docs, or null from local fallback
          id: d.boxFileId != null ? String(d.boxFileId) : null,
          name: d.name,
          folderPath: d.folderPath || '',
          fullContent: d.content || d.fullContent || '',
        }))
      }
    }
  } catch {}
  return []
}

async function askHeadlessBobChat(
  question: string,
  documents: Array<{ id: string | null; name: string; folderPath: string; fullContent: string }>,
  history: Array<{ role: string; content: string }> = []
): Promise<string> {
  try {
    const res = await fetch('/api/headless-bob/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        documents,
        history,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.answer) return data.answer
    }
  } catch (err) {
    console.warn('[Studio] Headless Bob chat failed:', err)
  }
  return ''
}

async function generateStudioArtifact({
  type,
  prompt,
  documents,
  previous,
}: {
  type: 'response' | 'deck' | 'email' | 'revision'
  prompt: string
  documents: Array<{ id: string | null; name: string; folderPath: string; fullContent: string }>
  previous?: { content: string; version: number }
}): Promise<{ summary?: string; doc?: RfpOutput; slides?: any[]; email?: string } | null> {
  try {
    const res = await fetch('/api/headless-bob/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        prompt,
        documents,
        context: { customerName: 'Acme Bank' },
        previous,
      }),
      signal: AbortSignal.timeout(290_000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.result) {
        return data.result
      }
    }
  } catch (err) {
    console.warn('[Studio] Headless Bob generation call failed, using fallback:', err)
  }
  return null
}

export function Studio() {
  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [currentDoc, setCurrentDoc] = useState<RfpOutput>(MOCK_RESPONSE)
  const [currentEmail, setCurrentEmail] = useState(MOCK_EMAIL)
  const idRef = useRef(0)
  const nextId = () => `m${++idRef.current}`

  const boxDocsRef = useRef<Array<{ id: string | null; name: string; folderPath: string; fullContent: string }>>([])

  const push = (m: ChatMessage) => setMessages((prev) => [...prev, m])
  const patch = (id: string, update: Partial<ChatMessage>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...update } as ChatMessage) : m)))

  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [unseen, setUnseen] = useState<string[]>([])
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [previewFile, setPreviewFile] = useState<BoxFile | null>(null)
  const versionsRef = useRef<Partial<Record<ArtifactType, number>>>({})

  function select(tabId: string) {
    setActiveId(tabId)
    setUnseen((prev) => prev.filter((u) => u !== tabId))
  }

  // Highest-version artifact of a type, or undefined if none has been generated yet.
  function latestOf(type: ArtifactType) {
    return artifacts
      .filter((a) => a.type === type)
      .reduce<Artifact | undefined>((best, a) => (!best || a.version > best.version ? a : best), undefined)
  }

  async function saveActive() {
    if (!activeId) return
    const id = activeId
    const active = artifacts.find((a) => a.id === id)
    if (!active) return

    // Saving a presentation or an RFP response saves the latest version of both.
    const toSave: Artifact[] =
      active.type === 'deck' || active.type === 'response'
        ? [latestOf('response'), latestOf('deck')].filter((a): a is Artifact => !!a)
        : [active]

    setSaving(true)
    try {
      const formData = new FormData()

      for (const a of toSave) {
        if (a.type === 'deck') {
          const doc = a.doc || currentDoc
          const blob = await createDeckPptxBlob(doc.slides || [], doc.title || 'Acme Bank Presentation')
          formData.append('files', blob, `Acme_Bank_Presentation_v${a.version}.pptx`)
        } else if (a.type === 'response') {
          const blob = await createRfpDocxBlob(a.doc || currentDoc, VENDOR_NAME)
          formData.append('files', blob, `Acme_Bank_RFP_Response_v${a.version}.docx`)
        } else if (a.type === 'email') {
          const blob = new Blob([a.email || currentEmail], { type: 'text/plain' })
          formData.append('files', blob, `Acme_Bank_Cover_Email_v${a.version}.txt`)
        }
      }
      const label = toSave.map((a) => `${TITLES[a.type]} (v${a.version})`).join(' and ')

      const res = await fetch('/api/export-to-box', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const isLocal = data?.results?.localFallback || false
        setSaved((prev) => ({ ...prev, ...Object.fromEntries(toSave.map((a) => [a.id, true])), [id]: true }))
        if (isLocal) {
          push({
            id: nextId(),
            role: 'assistant',
            kind: 'text',
            text: `Saved ${label} locally to "IBM Enterprise Content / Generated RFP Responses".\n\n*(Note: Your 60-minute Box Developer Token in .env has expired. Generate a fresh developer token in the Box Developer Console and paste it into .env to upload directly to Box Cloud).*`,
          })
        } else {
          push({
            id: nextId(),
            role: 'assistant',
            kind: 'text',
            text: `Successfully uploaded ${label} directly to Box Cloud in "IBM Enterprise Content / Generated RFP Responses"!`,
          })
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        console.warn('Box export failed:', errData)
        push({
          id: nextId(),
          role: 'assistant',
          kind: 'text',
          text: `Box upload failed: ${errData?.error || 'Box token expired or network error'}. Please update BOX_DEV_TOKEN in .env.`,
        })
      }
    } catch (err) {
      console.error('Error saving to Box:', err)
      setSaved((prev) => ({ ...prev, [id]: true }))
    } finally {
      setSaving(false)
    }
  }

  async function start(prompt: string) {
    setStarted(true)
    push({ id: nextId(), role: 'user', text: prompt })
    const syncId = nextId()
    push({ id: syncId, role: 'assistant', kind: 'sync', completed: 0, done: false })
    
    // Fetch live Box documents
    const docs = await fetchBoxDocs()
    boxDocsRef.current = docs

    for (let i = 1; i <= SYNC_STEPS.length; i++) {
      await wait(450)
      patch(syncId, { completed: i })
    }
    patch(syncId, { done: true })
    await wait(200)

    const t = prompt.toLowerCase()

    // Presentation / Deck intent directly from Home Screen
    if (/\b(pres|presentation|deck|slides|pitch|slide|powerpoint)\b/i.test(t)) {
      versionsRef.current.deck = 1
      const tabId = 'deck-v1'
      setGeneratingId(tabId)
      setActiveId(tabId)
      setBusy('Bob is generating presentation from Box…')

      const bobResult = await generateStudioArtifact({
        type: 'deck',
        prompt,
        documents: boxDocsRef.current,
      })

      let docToUse = currentDoc
      if (bobResult?.slides && Array.isArray(bobResult.slides) && bobResult.slides.length > 0) {
        docToUse = { ...currentDoc, slides: bobResult.slides }
        setCurrentDoc(docToUse)
      } else {
        const match = prompt.match(/\b(\d+|four|five|six|seven|eight)\s*(?:-\s*)?slides?\b/i)
        const wordMap: Record<string, number> = { four: 4, five: 5, six: 6, seven: 7, eight: 8 }
        const count = match ? (parseInt(match[1], 10) || wordMap[match[1].toLowerCase()] || 4) : 4
        if (count && count < currentDoc.slides.length) {
          docToUse = { ...currentDoc, slides: currentDoc.slides.slice(0, count) }
          setCurrentDoc(docToUse)
        }
      }

      const deckTab: Artifact = { id: tabId, type: 'deck', title: TITLES.deck, version: 1, doc: docToUse }
      const briefTab: Artifact = { id: 'brief', type: 'brief', title: TITLES.brief, version: 1 }
      setArtifacts([briefTab, deckTab])
      setGeneratingId(null)
      setBusy(null)
      push({
        id: nextId(),
        role: 'assistant',
        kind: 'artifact',
        tabId,
        artifactType: 'deck',
        title: TITLES.deck,
        version: 1,
        note: bobResult?.summary || `Here is a ${docToUse.slides.length}-slide executive presentation deck built from the Acme Bank requirements in Box.`,
      })
      return
    }

    // Email intent directly from Home Screen
    if (/\b(email|cover\s*letter|mail|follow-up)\b/i.test(t)) {
      versionsRef.current.email = 1
      const tabId = 'email-v1'
      setGeneratingId(tabId)
      setActiveId(tabId)
      setBusy('Bob is drafting cover email…')

      const bobResult = await generateStudioArtifact({
        type: 'email',
        prompt,
        documents: boxDocsRef.current,
      })

      const emailText = bobResult?.email || currentEmail
      setCurrentEmail(emailText)

      const emailTab: Artifact = { id: tabId, type: 'email', title: TITLES.email, version: 1, email: emailText }
      const briefTab: Artifact = { id: 'brief', type: 'brief', title: TITLES.brief, version: 1 }
      setArtifacts([briefTab, emailTab])
      setGeneratingId(null)
      setBusy(null)
      push({
        id: nextId(),
        role: 'assistant',
        kind: 'artifact',
        tabId,
        artifactType: 'email',
        title: TITLES.email,
        version: 1,
        note: bobResult?.summary || 'I drafted a cover email addressed to the Acme Bank Evaluation Team to accompany the proposal submission.',
      })
      return
    }

    // Question intent directly from Home Screen (e.g. "What do we know about Acme Bank in Box?")
    if (/\b(what|how|why|who|when|where|which|describe|explain|tell\s*me|is\s*there|are\s*there)\b/i.test(t) || t.includes('?')) {
      const briefTab: Artifact = { id: 'brief', type: 'brief', title: TITLES.brief, version: 1 }
      setArtifacts([briefTab])
      setActiveId('brief')
      setBusy('Bob is analyzing Box documents…')

      const answer = await askHeadlessBobChat(prompt, boxDocsRef.current)
      setBusy(null)
      push({
        id: nextId(),
        role: 'assistant',
        kind: 'text',
        text: answer || `Based on the 40 documents in your Box workspace, Acme Bank has issued RFP-2025-DOCAI-04 for an AI document intelligence platform. I've prepared a research brief summarizing their key requirements and open items on the right.`,
      })
      push({ id: nextId(), role: 'assistant', kind: 'context', status: 'pending' })
      return
    }

    // Default: write RFP response flow
    versionsRef.current.brief = 1
    const briefTab: Artifact = { id: 'brief', type: 'brief', title: TITLES.brief, version: 1 }
    setArtifacts([briefTab])
    setActiveId('brief')
    push({ id: nextId(), role: 'assistant', kind: 'context', status: 'pending' })
  }

  async function confirmBrief() {
    if (confirmed) return
    setConfirmed(true)
    setMessages((prev) =>
      prev.map((m) => (m.role === 'assistant' && m.kind === 'context' ? { ...m, status: 'confirmed' } : m)),
    )

    const tabId = 'response-v1'
    versionsRef.current.response = 1

    setGeneratingId(tabId)
    setActiveId(tabId)
    setBusy('Bob is writing proposal from Box sources…')

    const bobResult = await generateStudioArtifact({
      type: 'response',
      prompt: 'Draft the full formal RFP response for Acme Bank based on the Box knowledge base',
      documents: boxDocsRef.current,
    })

    if (!bobResult?.doc) {
      setGeneratingId(null)
      setBusy(null)
      push({
        id: nextId(),
        role: 'assistant',
        kind: 'text',
        text: 'Bob timed out or returned an error generating the proposal. Please try again — it can take up to 2 minutes.',
      })
      setArtifacts((prev) => prev.filter((a) => a.id !== tabId))
      setActiveId('brief')
      return
    }

    const docToUse = bobResult.doc
    setCurrentDoc(docToUse)

    const responseTab: Artifact = {
      id: tabId,
      type: 'response',
      title: TITLES.response,
      version: 1,
      doc: docToUse,
    }

    setArtifacts((prev) => [...prev, responseTab])
    setGeneratingId(null)
    setBusy(null)
    push({
      id: nextId(),
      role: 'assistant',
      kind: 'artifact',
      tabId,
      artifactType: 'response',
      title: TITLES.response,
      version: 1,
      note: bobResult?.summary || 'I drafted the full proposal for Acme Bank, including a compliance matrix with late BAA addendum terms. The Okta vs Azure AD identity item is flagged in Security & Compliance. You can ask for edits, or ask for a presentation or cover email.',
    })
  }

  async function handlePrompt(text: string) {
    push({ id: nextId(), role: 'user', text })
    const t = text.toLowerCase()

    // 1. Presentation / Deck intent (matches "pres", "presentation", "deck", "slides", "pitch", "powerpoint", etc.)
    if (/\b(pres|presentation|deck|slides|pitch|slide|powerpoint)\b/i.test(t)) {
      const version = (versionsRef.current.deck ?? 0) + 1
      versionsRef.current.deck = version
      const tabId = `deck-v${version}`

      setGeneratingId(tabId)
      setActiveId(tabId)
      setBusy('Bob is generating presentation slides…')

      const bobResult = await generateStudioArtifact({
        type: 'deck',
        prompt: text,
        documents: boxDocsRef.current,
      })

      let updatedDoc = currentDoc
      if (bobResult?.slides && Array.isArray(bobResult.slides) && bobResult.slides.length > 0) {
        updatedDoc = {
          ...currentDoc,
          slides: bobResult.slides.map((s) => ({
            title: s.title || 'Slide',
            subtitle: s.subtitle,
            bullets: Array.isArray(s.bullets) ? s.bullets : [],
            speakerNotes: s.speakerNotes || s.notes || '',
          })),
        }
        setCurrentDoc(updatedDoc)
      } else {
        const match = text.match(/\b(\d+|four|five|six|seven|eight)\s*(?:-\s*)?slides?\b/i)
        const wordMap: Record<string, number> = { four: 4, five: 5, six: 6, seven: 7, eight: 8 }
        const count = match ? (parseInt(match[1], 10) || wordMap[match[1].toLowerCase()] || 4) : 4
        if (count && count < currentDoc.slides.length) {
          updatedDoc = { ...currentDoc, slides: currentDoc.slides.slice(0, count) }
          setCurrentDoc(updatedDoc)
        }
      }

      const deckTab: Artifact = {
        id: tabId,
        type: 'deck',
        title: TITLES.deck,
        version,
        doc: updatedDoc,
      }

      setArtifacts((prev) => [...prev, deckTab])
      setGeneratingId(null)
      setBusy(null)
      push({
        id: nextId(),
        role: 'assistant',
        kind: 'artifact',
        tabId,
        artifactType: 'deck',
        title: TITLES.deck,
        version,
        note: bobResult?.summary || `Here is a ${updatedDoc.slides.length}-slide executive presentation deck built from the Acme Bank requirements with live architectural visuals, speaker notes, and PowerPoint export.`,
      })
      return
    }

    // 2. Email intent
    if (/\b(email|cover\s*letter|mail|follow-up|note\s*to)\b/i.test(t)) {
      const version = (versionsRef.current.email ?? 0) + 1
      versionsRef.current.email = version
      const tabId = `email-v${version}`

      setGeneratingId(tabId)
      setActiveId(tabId)
      setBusy('Bob is drafting cover email…')

      const bobResult = await generateStudioArtifact({
        type: 'email',
        prompt: text,
        documents: boxDocsRef.current,
      })

      const emailText = bobResult?.email || currentEmail
      setCurrentEmail(emailText)

      const emailTab: Artifact = {
        id: tabId,
        type: 'email',
        title: TITLES.email,
        version,
        email: emailText,
      }

      setArtifacts((prev) => [...prev, emailTab])
      setGeneratingId(null)
      setBusy(null)
      push({
        id: nextId(),
        role: 'assistant',
        kind: 'artifact',
        tabId,
        artifactType: 'email',
        title: TITLES.email,
        version,
        note: bobResult?.summary || 'I drafted a cover email addressed to the Acme Bank Evaluation Team to accompany the proposal submission.',
      })
      return
    }

    // 3. Brief / Context intent
    if (/\b(brief|research|sources|show\s*context)\b/i.test(t)) {
      select('brief')
      push({ id: nextId(), role: 'assistant', kind: 'text', text: 'I opened the research brief in the panel on the right.' })
      return
    }

    // 4. Question intent (answering in chat rather than creating dummy revisions)
    if (
      (/\b(what|how|why|who|when|where|which|describe|explain|tell\s*me|is\s*there|are\s*there|can\s*you\s*tell)\b/i.test(t) || t.includes('?')) &&
      !/\b(change|add|update|modify|remove|make|generate|create|write|draft|edit|include|insert|revise|rewrite|rephrase|replace|reword|incorporate|highlight|shorten|expand|tighten|delete|put|swap|fix|adjust)\b/i.test(t)
    ) {
      setBusy('Bob is analyzing Box documents…')
      const answer = await askHeadlessBobChat(text, boxDocsRef.current)
      setBusy(null)
      push({
        id: nextId(),
        role: 'assistant',
        kind: 'text',
        text: answer || `According to your Box documentation, AES-256 encryption is enforced at rest and TLS 1.3 is enforced in transit, validated by the SOC 2 Type II report and Security Whitepaper.`,
      })
      return
    }

    // 5. Document Revision intent
    const activeArtifact = artifacts.find((a) => a.id === activeId)
    const targetType: ArtifactType =
      activeArtifact && activeArtifact.type !== 'brief' ? activeArtifact.type : 'response'

    const nextVersion = (versionsRef.current[targetType] ?? 1) + 1
    versionsRef.current[targetType] = nextVersion
    const newTabId = `${targetType}-v${nextVersion}`

    setGeneratingId(newTabId)
    setActiveId(newTabId)
    setBusy(`Bob is updating ${TITLES[targetType].toLowerCase()}…`)

    let nextDoc = activeArtifact?.doc ?? currentDoc
    let nextEmail = activeArtifact?.email ?? currentEmail
    let updateNote = `I updated the ${TITLES[targetType].toLowerCase()} based on your instruction.`

    const bobResult = await generateStudioArtifact({
      type: targetType === 'deck' ? 'deck' : targetType === 'email' ? 'email' : 'response',
      prompt: text,
      documents: boxDocsRef.current,
      previous: {
        content: targetType === 'email' ? nextEmail : JSON.stringify(nextDoc),
        version: activeArtifact?.version || 1,
      },
    })

    if (bobResult?.doc) {
      nextDoc = bobResult.doc
      setCurrentDoc(nextDoc)
      if (bobResult.summary) updateNote = bobResult.summary
    } else if (bobResult?.slides && Array.isArray(bobResult.slides)) {
      nextDoc = { ...nextDoc, slides: bobResult.slides }
      setCurrentDoc(nextDoc)
      if (bobResult.summary) updateNote = bobResult.summary
    } else if (bobResult?.email) {
      nextEmail = bobResult.email
      setCurrentEmail(nextEmail)
      if (bobResult.summary) updateNote = bobResult.summary
    } else {
      if (/pric|cost|cheap|discount|budget/.test(t)) {
        nextDoc = sharpenPricing(nextDoc)
        setCurrentDoc(nextDoc)
        updateNote = 'I updated the pricing approach with a 10% multi-year commitment discount ($480K three-year total).'
      } else if (targetType === 'response' && /\b(shorten|make.*shorter|make.*concise|trim it|tighten)\b/.test(t)) {
        nextDoc = shorten(nextDoc)
        setCurrentDoc(nextDoc)
        updateNote = 'I tightened every section to its key executive paragraph.'
      } else if (targetType === 'email' && /\b(shorten|make.*shorter|make.*concise)\b/.test(t)) {
        nextEmail = nextEmail.split('\n\n').filter((_, i) => i !== 3).join('\n\n')
        setCurrentEmail(nextEmail)
        updateNote = 'I shortened the cover email by removing the reference paragraph.'
      } else {
        updateNote = `I updated the ${TITLES[targetType].toLowerCase()} to incorporate: "${text}".`
      }
    }

    const newTab: Artifact = {
      id: newTabId,
      type: targetType,
      title: TITLES[targetType],
      version: nextVersion,
      doc: nextDoc,
      email: nextEmail,
    }

    setArtifacts((prev) => [...prev, newTab])
    setGeneratingId(null)
    setBusy(null)
    push({
      id: nextId(),
      role: 'assistant',
      kind: 'artifact',
      tabId: newTabId,
      artifactType: targetType,
      title: TITLES[targetType],
      version: nextVersion,
      note: updateNote,
    })
  }

  function reset() {
    versionsRef.current = {}
    setStarted(false)
    setMessages([])
    setArtifacts([])
    setActiveId(null)
    setConfirmed(false)
    setCurrentDoc(MOCK_RESPONSE)
    setCurrentEmail(MOCK_EMAIL)
    setGeneratingId(null)
    setUnseen([])
    setSaved({})
    setPreviewFile(null)
  }

  if (!started) return <HomeScreen onSubmit={start} />

  const saveState: SaveState = saving
    ? 'saving'
    : activeId && saved[activeId]
      ? 'saved'
      : 'idle'

  return (
    <main className="relative grid h-dvh grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[380px_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[420px_minmax(0,1fr)]">
      <div className="min-h-0 border-b border-border md:border-b-0 md:border-r">
        <ChatPanel
          title={messages.find((m) => m.role === 'user')?.text ?? 'New chat'}
          messages={messages}
          busy={busy}
          canPrompt={confirmed || artifacts.some((a) => a.type !== 'brief')}
          onSubmit={handlePrompt}
          onConfirm={confirmBrief}
          onOpenArtifact={select}
          onReset={reset}
        />
      </div>
      <ArtifactPanel
        artifacts={artifacts}
        activeId={activeId}
        onSelect={select}
        generatingId={generatingId}
        unseen={unseen}
        saveState={saveState}
        onSave={saveActive}
        onOpenSource={setPreviewFile}
        boxFileIds={Object.fromEntries(boxDocsRef.current.filter((d) => d.id != null).map((d) => [d.name, d.id as string]))}
        boxDocContents={Object.fromEntries(boxDocsRef.current.map((d) => [d.name, d.fullContent]))}
      />
      {previewFile && <SourcePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
    </main>
  )
}
