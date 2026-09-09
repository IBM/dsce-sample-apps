"""Tool handlers — one function per MCP tool, all returning JSON-serialisable dicts.

Each handler is a pure async function that receives validated ``args``, calls
the appropriate service(s), and returns a result dict. No HTTP or MCP protocol
concerns live here — those belong in ``server/``.

Fan-out architecture of ``handle_intelligent_query``:
    1. Maximo Live API   — real-time asset / WO / SR data
    2. Document RAG      — uploaded PDF chunks (``maximo-documents`` index)
    3. Web Knowledge     — crawled IBM/community docs (``maximo_web_knowledge`` index)
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Optional

from mcp_server.src.services.opensearch_service import opensearch_service
from mcp_server.src.services.maximo_service import maximo_service
from shared.watsonx import client as wx
from shared.logging import get_logger

logger = get_logger(__name__)


# ── Helper: wrap a result as an MCP text content object ──────────────────────

def _ok(payload: Any) -> dict:
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=2)}]}


def _err(message: str) -> dict:
    return {"content": [{"type": "text", "text": message}], "isError": True}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_maximo_svc_inner(
    mx_url: Optional[str],
    mx_api_key: Optional[str],
    mx_username: Optional[str],
    mx_password: Optional[str],
):
    """Return an ephemeral MaximoService configured with per-request credentials,
    or the module singleton if no override is provided."""
    if not (mx_url or mx_api_key):
        return maximo_service
    from mcp_server.src.services.maximo_service import MaximoService as _MS
    from mcp_server.src.config import maximo as _cfg
    import types as _t
    override = _t.SimpleNamespace(
        base_url=mx_url or _cfg.base_url,
        api_key=mx_api_key if mx_api_key is not None else _cfg.api_key,
        username=mx_username if mx_username is not None else _cfg.username,
        password=mx_password if mx_password is not None else _cfg.password,
        timeout=_cfg.timeout,
        verify_ssl=_cfg.verify_ssl,
    )
    svc = _MS.__new__(_MS)
    svc._timeout = override.timeout
    svc._verify_ssl = override.verify_ssl
    base = override.base_url.rstrip("/")
    if not (base.endswith("/api") or base.endswith("/oslc")):
        base = base + "/maximo/api"
    svc._base_url = base
    svc._cfg = override
    def _auth_headers(self=svc, cfg=override):
        if cfg.api_key:
            return {"apikey": cfg.api_key}
        if cfg.username and cfg.password:
            import base64
            token = base64.b64encode(f"{cfg.username}:{cfg.password}".encode()).decode()
            return {"Authorization": f"Basic {token}"}
        return {}
    svc._auth_headers = _t.MethodType(_auth_headers, svc)
    return svc


# ─────────────────────────────────────────────────────────────────────────────
# 1. Intelligent (3-source) query
# ─────────────────────────────────────────────────────────────────────────────

async def handle_intelligent_query(args: dict) -> dict:
    """Fan-out query across Maximo Live, Documents, and Web Knowledge.

    The LLM (ibm/granite-3-8b-instruct) decides which sources to call.
    Only selected sources run — no unnecessary API calls are made.
    Results are synthesised into a single answer.

    Optional per-request Maximo override keys:
        maximo_url, maximo_api_key, maximo_username, maximo_password
    """
    query: str = args["query"]
    assetnum: Optional[str] = args.get("assetnum")
    max_results: int = int(args.get("maxResults", 20))

    mx_url      = args.get("maximo_url")
    mx_api_key  = args.get("maximo_api_key")
    mx_username = args.get("maximo_username")
    mx_password = args.get("maximo_password")

    # Feature flags from the frontend Settings page (default True = enabled)
    flag_maximo = bool(args.get("enableMaximo", True))
    flag_docs   = bool(args.get("enableDocs",   True))
    flag_web    = bool(args.get("enableWeb",     True))
    flag_synth  = bool(args.get("enableSynth",   True))

    logger.info("=" * 60)
    logger.info("▶ Intelligent query received", extra={"query": query, "maximo_url": mx_url})
    logger.info(
        "Feature flags (from Settings)",
        extra={"enableMaximo": flag_maximo, "enableDocs": flag_docs, "enableWeb": flag_web, "enableSynth": flag_synth},
    )

    # ── Step 1: LLM routing decision ─────────────────────────────────────────
    logger.info("Step 1/3 — LLM routing decision…")
    routing = wx.route_query(query)
    # AND-gate: LLM wants the source AND the user hasn't disabled it
    use_maximo    = routing["use_maximo"]    and flag_maximo
    use_documents = routing["use_documents"] and flag_docs
    use_web       = routing["use_web"]       and flag_web
    obj_struct    = routing.get("object_structure")

    # If LLM chose Maximo but gave no object structure, derive it from keyword mapper
    if use_maximo and not obj_struct:
        kw_routing = maximo_service.determine_routing(query)
        obj_struct = kw_routing.get("objectStructure") or "MXAPIWODETAIL"
        logger.info("Object structure derived from keyword mapper", extra={"object_structure": obj_struct})

    intent        = routing.get("intent", "read")
    record_id     = routing.get("record_id")
    update_fields = routing.get("update_fields")

    logger.info(
        "Routing decided by LLM",
        extra={
            "intent": intent,
            "use_maximo": use_maximo,
            "use_documents": use_documents,
            "use_web": use_web,
            "object_structure": obj_struct,
            "record_id": record_id,
            "update_fields": update_fields,
            "reason": routing.get("reason"),
        },
    )

    # ── Step 1b: Handle WRITE intent immediately ──────────────────────────────
    if intent == "update" and record_id and update_fields and obj_struct:
        logger.info(
            "▶ Write intent detected — executing Maximo update",
            extra={"object_structure": obj_struct, "record_id": record_id, "fields": update_fields},
        )
        svc_write = _build_maximo_svc_inner(mx_url, mx_api_key, mx_username, mx_password)
        try:
            update_result = svc_write.update_object(
                object_structure=obj_struct,
                record_id=record_id,
                id_field="wonum" if "WO" in obj_struct else "assetnum",
                fields=update_fields,
            )
            logger.info("✔ Maximo update succeeded", extra={"record_id": record_id, "fields": update_fields})

            # Generate a friendly confirmation message
            fields_str = ", ".join(f"{k} = {v}" for k, v in update_fields.items())
            confirm_prompt = (
                f"The user asked: {query}\n\n"
                f"The update was successfully applied to {obj_struct} record {record_id}.\n"
                f"Fields updated: {fields_str}\n"
                "Write a short, friendly confirmation message."
            )
            confirmation = _safe_generate(
                confirm_prompt,
                system_message="You are a helpful IBM Maximo assistant. Confirm a successful update concisely.",
                max_new_tokens=150,
                temperature=0.2,
            )
            logger.info("=" * 60)
            return _ok({
                "query": query,
                "synthesizedAnswer": confirmation,
                "sections": [{
                    "source": "maximo-live",
                    "label": "Maximo Update",
                    "answer": confirmation,
                    "recordId": record_id,
                    "objectStructure": obj_struct,
                    "updated": update_fields,
                }],
                "sourcesQueried": {"maximoLive": True, "documents": False, "webKnowledge": False},
                "routing": {
                    "route": "maximo",
                    "intent": "update",
                    "objectStructure": obj_struct,
                    "reason": routing.get("reason"),
                    "decidedBy": "llm",
                },
                "apiUrl": f"{maximo_service._base_url}/os/{obj_struct}/{record_id}",
                "whereClause": None,
                "orderBy": None,
            })
        except Exception as exc:
            logger.error("✘ Maximo update FAILED", extra={"record_id": record_id, "fields": update_fields, "error": str(exc)}, exc_info=True)
            error_prompt = (
                f"The user asked: {query}\n\n"
                f"The update to {obj_struct} record {record_id} FAILED with error: {exc}\n"
                "Inform the user clearly and suggest they check their permissions or the record ID."
            )
            error_msg = _safe_generate(
                error_prompt,
                system_message="You are a helpful IBM Maximo assistant.",
                max_new_tokens=150,
                temperature=0.2,
            )
            logger.info("=" * 60)
            return _ok({
                "query": query,
                "synthesizedAnswer": error_msg,
                "sections": [],
                "sourcesQueried": {"maximoLive": True, "documents": False, "webKnowledge": False},
                "routing": {"route": "maximo", "intent": "update", "objectStructure": obj_struct, "decidedBy": "llm"},
                "apiUrl": None, "whereClause": None, "orderBy": None,
            })

    # ── Step 2: Build ephemeral Maximo service if per-request creds given ────
    def _build_maximo_svc():
        return _build_maximo_svc_inner(mx_url, mx_api_key, mx_username, mx_password)

    # ── Step 3: Run only selected sources concurrently ───────────────────────
    logger.info(
        "Step 2/3 — Running selected sources",
        extra={"maximo": use_maximo, "documents": use_documents, "web": use_web},
    )
    loop = asyncio.get_event_loop()

    def _maximo_call():
        if not use_maximo:
            return None
        svc = _build_maximo_svc()
        # The LLM may return a comma-separated list of object structures
        # (e.g. "MXAPIWODETAIL, MXAPIASSET").  Split, query each, merge members.
        os_list = [s.strip() for s in (obj_struct or "MXAPIWODETAIL").split(",") if s.strip()]
        merged_data: list = []
        last_result: dict = {}
        for os_name in os_list:
            try:
                select_cols = svc._get_important_columns(os_name, query)
                logger.info("⬇ Maximo API call", extra={"base_url": svc._base_url, "object_structure": os_name})
                result = svc.query_object_structure(os_name, select=select_cols, page_size=max_results, query=query)
                logger.info("✔ Maximo API response", extra={"object_structure": os_name, "records": result.get("totalCount", 0)})
                merged_data.extend(result.get("data", []))
                last_result = result
            except Exception as exc:
                logger.error("✘ Maximo API call failed", extra={"error": str(exc), "object_structure": os_name}, exc_info=True)
        if not last_result:
            return None
        # Return a single merged result so the caller sees one unified dataset
        last_result["data"] = merged_data
        last_result["totalCount"] = len(merged_data)
        last_result["objectStructure"] = ", ".join(os_list)
        return last_result

    def _rag_call():
        if not use_documents:
            return []
        embedding = None
        try:
            embedding = wx.embed([query])[0]
        except Exception as emb_exc:
            logger.warning("Embedding failed — falling back to keyword search", extra={"error": str(emb_exc)})
        filters = {"assetnum": assetnum} if assetnum else {}
        hits = opensearch_service.hybrid_search(query, embedding, filters, max_results)
        logger.info("✔ Document search response", extra={"hits": len(hits)})
        return hits

    def _web_call():
        if not use_web:
            return []
        hits = opensearch_service.web_knowledge_search(query, max_results)
        logger.info("✔ Web knowledge search response", extra={"hits": len(hits)})
        return hits

    maximo_result, rag_result, web_result = await asyncio.gather(
        loop.run_in_executor(None, _maximo_call),
        loop.run_in_executor(None, _rag_call),
        loop.run_in_executor(None, _web_call),
        return_exceptions=True,
    )

    logger.info(
        "Step 3/3 — Generating answers from source results",
        extra={
            "maximo": f"{maximo_result.get('totalCount', 0)} records" if isinstance(maximo_result, dict) else str(type(maximo_result).__name__),
            "rag":    f"{len(rag_result)} hits"    if isinstance(rag_result, list) else str(type(rag_result).__name__),
            "web":    f"{len(web_result)} hits"    if isinstance(web_result, list) else str(type(web_result).__name__),
        },
    )

    # ── Build answer sections from each source ────────────────────────────────
    sections: list[dict] = []
    maximo_zero_answer: Optional[str] = None

    # ── Maximo Live section ───────────────────────────────────────────────────
    if use_maximo and isinstance(maximo_result, dict):
        records = maximo_result.get("data", [])
        rec_count = maximo_result.get("totalCount", len(records))

        if rec_count == 0:
            logger.info("Maximo returned 0 records — generating friendly fallback")
            prompt = (
                f"{query}\n\n"
                f"I searched Maximo {obj_struct} and found no matching records.\n"
                "Politely inform the user, suggest they refine their query, and mention "
                "they can check the Maximo instance connection."
            )
            maximo_zero_answer = _safe_generate(
                prompt,
                system_message="You are a helpful IBM Maximo assistant.",
                max_new_tokens=150,
                temperature=0.2,
            )
        else:
            def _clean_record(r: dict) -> dict:
                """Strip Maximo collection-ref noise; keep only human-readable fields."""
                return {
                    k: v for k, v in r.items()
                    if v not in (None, "")
                    and "collectionref" not in k
                    and "href" not in k
                    and not k.startswith("_")
                }

            ctx = "\n\n".join(
                "Record {}:\n{}".format(
                    i + 1,
                    "\n".join(
                        f"  {k}: {v}"
                        for k, v in list(_clean_record(r).items())[:12]
                    ),
                )
                for i, r in enumerate(records[:10])
            )
            if rec_count == 1:
                sys_msg = "You are a helpful IBM Maximo assistant. Describe Maximo records in plain language."
                prompt  = f"{query}\n\nMAXIMO RECORD:\n{ctx}"
                tokens  = 400
            elif rec_count <= 5:
                sys_msg = ("You are a helpful IBM Maximo assistant. Summarise Maximo records concisely, "
                           "highlighting key statuses and descriptions.")
                prompt  = f"{query}\n\nMAXIMO RECORDS ({rec_count} total):\n{ctx}"
                tokens  = 400
            else:
                sys_msg = ("You are a helpful IBM Maximo assistant. Summarise a dataset of Maximo records, "
                           "highlight key findings, patterns, and important statuses.")
                prompt  = f"{query}\n\nMAXIMO RECORDS ({rec_count} total, showing first 10):\n{ctx}"
                tokens  = 500
            answer = _safe_generate(prompt, system_message=sys_msg, max_new_tokens=tokens, temperature=0.2)
            logger.info("✔ Maximo section answer generated", extra={"rec_count": rec_count, "tokens": tokens})
            sections.append({
                "source": "maximo-live",
                "label": "Maximo Live Data",
                "answer": answer,
                "recordCount": rec_count,
                "records": [_clean_record(r) for r in records[:20]],
                "objectStructure": obj_struct,
            })

    # ── Documents section ─────────────────────────────────────────────────────
    doc_hits = rag_result if isinstance(rag_result, list) else []
    if use_documents and doc_hits:
        ctx = "\n\n---\n\n".join(
            f"[Doc {i+1}] {r['fileName']}:\n{r['content']}"
            for i, r in enumerate(doc_hits)
        )
        answer = _safe_generate(
            f"{query}\n\nMAINTENANCE DOCUMENTS:\n{ctx}",
            system_message=("You are an expert maintenance engineer for IBM Maximo assets. "
                            "Answer ONLY using the maintenance documents provided. "
                            "Use numbered steps for procedures. Cite the document name."),
            max_new_tokens=700, temperature=0.2,
        )
        logger.info("✔ Documents section answer generated", extra={"doc_hits": len(doc_hits)})
        sections.append({
            "source": "documents",
            "label": "Uploaded Documents",
            "answer": answer,
            "sources": [
                {
                    "fileName": r["fileName"],
                    "assetnum": r["metadata"].get("assetnum"),
                    "category": r["metadata"].get("category"),
                    "score": round(r.get("score", 0), 4),
                    "highlight": r["highlights"][0] if r.get("highlights") else "",
                }
                for r in doc_hits
            ],
        })
    elif use_documents and not doc_hits:
        logger.info("Documents search returned 0 hits — index may be empty")

    # ── Web Knowledge section ─────────────────────────────────────────────────
    web_hits = web_result if isinstance(web_result, list) else []
    if use_web and web_hits:
        ctx = "\n\n---\n\n".join(
            f"[Web {i+1}] {r['title']} ({r.get('siteLabel','')}):\n{r['content']}"
            for i, r in enumerate(web_hits)
        )
        answer = _safe_generate(
            f"{query}\n\nWEB DOCUMENTATION:\n{ctx}",
            system_message=("You are an IBM Maximo documentation expert. "
                            "Answer ONLY using the web documentation provided. "
                            "Use numbered steps where applicable. Do not include links."),
            max_new_tokens=700, temperature=0.2,
        )
        logger.info("✔ Web knowledge section answer generated", extra={"web_hits": len(web_hits)})
        sections.append({
            "source": "web-knowledge",
            "label": "Web Knowledge",
            "answer": answer,
            "sources": [
                {
                    "url": r["url"],
                    "title": r["title"],
                    "siteLabel": r.get("siteLabel"),
                    "topic": r.get("topic"),
                    "score": round(r.get("score", 0), 4),
                    "highlight": r["highlights"][0] if r.get("highlights") else "",
                }
                for r in web_hits
            ],
        })
    elif use_web and not web_hits:
        logger.info("Web knowledge search returned 0 hits — index may be empty")

    # ── Synthesis ─────────────────────────────────────────────────────────────
    synthesized: Optional[str] = None
    if len(sections) > 1 and flag_synth:
        combined = "\n\n".join(f"[{s['label']}]:\n{s['answer']}" for s in sections)
        synthesized = _safe_generate(
            f"{query}\n\nSOURCE ANSWERS:\n{combined}",
            system_message=("You are a helpful IBM Maximo assistant. Synthesise multiple source answers "
                            "into ONE clear, accurate, unified response. "
                            "If sources conflict, prefer Maximo Live data. Use numbered steps for procedures."),
            max_new_tokens=600, temperature=0.2,
        )
        logger.info("✔ Synthesis answer generated")
    elif sections:
        synthesized = sections[0]["answer"]
    elif maximo_zero_answer:
        synthesized = maximo_zero_answer
    else:
        synthesized = (
            "No relevant information found. "
            + (f"Maximo ({obj_struct}) was queried but returned no records. " if use_maximo else "")
            + ("The document index appears to be empty — please run the S3 ingestion pipeline. " if use_documents else "")
            + ("The web knowledge index appears to be empty — please run the spiderbot crawler." if use_web else "")
        )

    logger.info("✔ Query complete", extra={"sections": len(sections), "sources_with_results": [s["source"] for s in sections]})
    logger.info("=" * 60)

    # ── Provenance for UI transparency panel ──────────────────────────────────
    # Only expose Maximo API details when Maximo was actually queried
    api_url      = None
    where_clause = None
    order_by_val = None
    if use_maximo and obj_struct:
        _svc = maximo_service
        api_url = f"{_svc._base_url}/os/{obj_struct}"
        try:
            where_clause = _svc._build_where(query, obj_struct) or None
            order_by_val = _svc._build_order_by(query, obj_struct) or None
        except Exception:
            pass

    return _ok({
        "query": query,
        "synthesizedAnswer": synthesized,
        "sections": sections,
        "sourcesQueried": {
            "maximoLive":    use_maximo,
            "documents":     use_documents,
            "webKnowledge":  use_web,
        },
        "routing": {
            "route":           "maximo" if use_maximo else "rag",
            "objectStructure": obj_struct if use_maximo else None,
            "reason":          routing.get("reason"),
            "decidedBy":       "llm",
        },
        "apiUrl":      api_url,
        "whereClause": where_clause,
        "orderBy":     order_by_val,
    })


# ─────────────────────────────────────────────────────────────────────────────
# 2. RAG-only query
# ─────────────────────────────────────────────────────────────────────────────

async def handle_rag_query(args: dict) -> dict:
    """Search the documents index and generate a grounded answer."""
    query: str = args["query"]
    assetnum: Optional[str] = args.get("assetnum")
    category: Optional[str] = args.get("category")
    max_results: int = int(args.get("maxResults", 5))

    filters: dict = {}
    if assetnum:
        filters["assetnum"] = assetnum
    if category:
        filters["category"] = category

    loop = asyncio.get_event_loop()
    embedding = await loop.run_in_executor(None, lambda: wx.embed([query])[0])
    results = await loop.run_in_executor(
        None, lambda: opensearch_service.hybrid_search(query, embedding, filters, max_results)
    )

    formatted = [
        {
            "rank": i + 1,
            "fileName": r["fileName"],
            "content": r["content"],
            "score": round(r.get("score", 0), 4),
            "assetnum": r["metadata"].get("assetnum", "N/A"),
            "category": r["metadata"].get("category", "N/A"),
            "highlights": r.get("highlights", []),
        }
        for i, r in enumerate(results)
    ]
    answer = await loop.run_in_executor(None, lambda: wx.generate_rag_response(query, formatted))
    return _ok({"query": query, "answer": answer, "filters": filters, "resultCount": len(formatted), "results": formatted})


# ─────────────────────────────────────────────────────────────────────────────
# 3–5. OpenSearch utility handlers
# ─────────────────────────────────────────────────────────────────────────────

async def handle_search_by_asset(args: dict) -> dict:
    assetnum: str = args["assetnum"]
    limit: int = int(args.get("limit", 10))
    results = opensearch_service.search_by_asset(assetnum, limit)
    formatted = [
        {
            "rank": i + 1,
            "documentId": r.get("documentId"),
            "fileName": r.get("fileName"),
            "content": (r.get("content") or "")[:200] + "...",
            "category": r.get("metadata", {}).get("category", "N/A"),
        }
        for i, r in enumerate(results)
    ]
    return _ok({"assetnum": assetnum, "resultCount": len(formatted), "results": formatted})


async def handle_get_document_chunks(args: dict) -> dict:
    doc_id: str = args["documentId"]
    chunks = opensearch_service.get_document_chunks(doc_id)
    return _ok({"documentId": doc_id, "chunkCount": len(chunks), "chunks": chunks})


async def handle_list_assets(_args: dict) -> dict:
    assets = opensearch_service.get_unique_assets()
    return _ok({"totalAssets": len(assets), "assets": sorted(assets, key=lambda a: -a["documentCount"])})


async def handle_get_index_stats(_args: dict) -> dict:
    stats = opensearch_service.get_index_stats()
    return _ok({**stats, "sizeInMB": round(stats["sizeInBytes"] / (1024 * 1024), 2)})


async def handle_test_connection(_args: dict) -> dict:
    return _ok(opensearch_service.test_connection())


# ─────────────────────────────────────────────────────────────────────────────
# 6–11. Maximo API handlers
# ─────────────────────────────────────────────────────────────────────────────

async def handle_maximo_test_connection(_args: dict) -> dict:
    return _ok(maximo_service.test_connection())


async def handle_maximo_get_asset(args: dict) -> dict:
    result = maximo_service.get_asset(args["assetnum"], args.get("siteid"))
    return _ok(result)


async def handle_maximo_get_work_orders(args: dict) -> dict:
    result = maximo_service.get_work_orders(
        assetnum=args.get("assetnum"),
        status=args.get("status"),
        worktype=args.get("worktype"),
        limit=int(args.get("limit", 50)),
    )
    return _ok(result)


async def handle_maximo_get_service_requests(args: dict) -> dict:
    result = maximo_service.get_service_requests(
        status=args.get("status"),
        assetnum=args.get("assetnum"),
        limit=int(args.get("limit", 50)),
    )
    return _ok(result)


async def handle_maximo_query_object(args: dict) -> dict:
    result = maximo_service.query_object_structure(
        args["objectStructure"],
        select=args.get("select"),
        page_size=int(args.get("pageSize", 100)),
    )
    return _ok(result)


async def handle_maximo_list_object_structures(args: dict) -> dict:
    search = args.get("search")
    limit = int(args.get("limit", 50))
    structs = (
        maximo_service.search_object_structures(search) if search
        else maximo_service.get_available_object_structures()
    )
    limited = structs[:limit]
    return _ok({
        "totalAvailable": len(structs),
        "returned": len(limited),
        "objectStructures": [{"name": s["name"], "description": s.get("description"), "path": s.get("path")} for s in limited],
    })


async def handle_maximo_find_object_structure(args: dict) -> dict:
    routing = maximo_service.determine_routing(args["query"])
    if routing["route"] == "rag":
        return _ok({"query": args["query"], "result": "Query is for documentation/RAG, not Maximo API", "routing": routing})
    return _ok({
        "query": args["query"],
        "objectStructure": routing.get("objectStructure"),
        "confidence": routing.get("objectStructureConfidence"),
        "alternatives": routing.get("alternatives", []),
    })


async def handle_maximo_intelligent_query(args: dict) -> dict:
    result = maximo_service.intelligent_query(
        args["query"],
        assetnum=args.get("assetnum"),
        limit=int(args.get("pageSize", 20)),
    )
    return _ok(result or {"message": "Query was routed to RAG — use intelligent-query tool instead."})


async def handle_maximo_update_object(args: dict) -> dict:
    """Update any Maximo record.

    Required args: objectStructure, recordId, idField, fields (dict)
    """
    result = maximo_service.update_object(
        object_structure=args["objectStructure"],
        record_id=str(args["recordId"]),
        id_field=args.get("idField", "wonum"),
        fields=args["fields"],
    )
    return _ok(result)


# ─────────────────────────────────────────────────────────────────────────────
# Dispatch table
# ─────────────────────────────────────────────────────────────────────────────

TOOL_HANDLERS: dict[str, Any] = {
    "intelligent-query":              handle_intelligent_query,
    "rag-query":                      handle_rag_query,
    "search-by-asset":                handle_search_by_asset,
    "get-document-chunks":            handle_get_document_chunks,
    "list-assets":                    handle_list_assets,
    "get-index-stats":                handle_get_index_stats,
    "test-connection":                handle_test_connection,
    "maximo-test-connection":         handle_maximo_test_connection,
    "maximo-get-asset":               handle_maximo_get_asset,
    "maximo-get-workorders":          handle_maximo_get_work_orders,
    "maximo-get-service-requests":    handle_maximo_get_service_requests,
    "maximo-query-object":            handle_maximo_query_object,
    "maximo-list-object-structures":  handle_maximo_list_object_structures,
    "maximo-find-object-structure":   handle_maximo_find_object_structure,
    "maximo-intelligent-query":       handle_maximo_intelligent_query,
    "maximo-update-object":           handle_maximo_update_object,
}


# ─────────────────────────────────────────────────────────────────────────────
# Private helper
# ─────────────────────────────────────────────────────────────────────────────

def _safe_generate(prompt: str, **kwargs) -> str:
    """Call WatsonX text generation, returning an error string on failure."""
    try:
        return wx.generate(prompt, **kwargs)
    except Exception as exc:
        logger.error("WatsonX generation failed", extra={"error": str(exc)})
        return f"Error: {exc}"
