/* ═══════════════════════════════════════════════════════════════════════════
   Seller-persona delivery surfaces — Salesforce & Slack
   ---------------------------------------------------------------------------
   One nudge + action list (GET /api/actions/<seller_id>) rendered into the two
   surfaces a BIW seller already works in. Both panes read the *same* payload —
   that's the point of the demo, not two separate mockups.

   Usage:
     SellerSurfaces.mount(document.getElementById("host"), {
       apiBase:  "http://localhost:5050",
       sellerId: "seller-rachel-001",
     });
     surface.setSeller("seller-marcus-001");

   Degrades to a pinned offline plan when the API is unreachable, so the demo
   still runs with no backend.
   ═══════════════════════════════════════════════════════════════════════════ */

window.SellerSurfaces = (function () {
  "use strict";

  var CH_SF = "salesforce";
  var CH_SLACK = "slack";
  var CH_BP = "bluepoints";      // Thanks@IBM — the live Elevate deployment

  var SELLER_UI = {
    "seller-rachel-001": { first: "Rachel", last: "Okafor",  color: "#6c43e0", role: "Senior Account Executive", team: "Enterprise North" },
    "seller-marcus-001": { first: "Marcus", last: "Delgado", color: "#10b39e", role: "Account Executive",        team: "Mid-Market West"  },
    "seller-maya-001":   { first: "Maya",   last: "Lindqvist", color: "#e8517f", role: "Account Executive",      team: "Enterprise North" },
  };

  // Open opportunities shown on the Salesforce record page — context only, so
  // the Elevate component reads as one card inside a real working screen.
  var SF_PIPELINE = {
    "seller-rachel-001": [
      { name: "Meridian Health — Platform renewal", amt: "$84,000", stage: "Closed Won",     close: "Aug 1"  },
      { name: "Northwind Logistics — Expansion",    amt: "$46,500", stage: "Negotiation",    close: "Aug 22" },
      { name: "Calder Group — Net new",             amt: "$120,000", stage: "Proposal",      close: "Sep 12" },
    ],
    "seller-marcus-001": [
      { name: "Aldridge Manufacturing — Net new",   amt: "$27,000", stage: "Negotiation",    close: "Aug 8"  },
      { name: "Bexley Retail — Seat expansion",     amt: "$18,400", stage: "Proposal",       close: "Aug 19" },
      { name: "Trellis Foods — Renewal",            amt: "$31,200", stage: "Qualification",  close: "Sep 5"  },
    ],
    "seller-maya-001": [
      { name: "Hartwell Clinics — Net new",         amt: "$12,800", stage: "Closed Won",     close: "Jul 29" },
      { name: "Pinecrest Systems — Net new",        amt: "$22,000", stage: "Discovery",      close: "Sep 2"  },
      { name: "Orion Labs — Pilot",                 amt: "$9,500",  stage: "Qualification",  close: "Sep 18" },
    ],
  };

  // ── Offline fallback plans (identical numbers to app/actions.py) ──────────
  var OFFLINE = {
    "seller-rachel-001": {
      goal: { label: "Executive Summit stage invite", kind: "Q3 recognition tier", icon: "🏆", target_points: 12000, points_to_go: 800, points_earned: 11200, percent: 93.3 },
      nudge: { headline: "Rachel, your mentorship moved the whole team this week", body: "Two reps closed deals right after your enablement session. That kind of lift is exactly what the Summit stage is for.", framing: "Your influence" },
      tasks: [
        { task_id: "rachel-coaching",   points: 300, title: "Log a coaching session",  subtitle: "Record the enablement time you already gave", why: "Two reps on your team closed within 48h of your last session — that lift only counts toward Summit if it's logged.", source_short: "Databricks · historical influence", channel: CH_SF,    cta: "Log session",  est_minutes: 4,  due: "This week", completed: false },
        { task_id: "rachel-win-story",  points: 250, title: "Submit a win story",      subtitle: "Write up the close the field keeps asking about", why: "Salesforce has 28 closes under your name. Win stories from veteran AEs are the most-reused enablement asset on the team.", source_short: "Salesforce · deal closed", channel: CH_SF, cta: "Write story", est_minutes: 10, due: "Fri", completed: false },
        { task_id: "rachel-crm-audit",  points: 150, title: "Complete CRM audit",      subtitle: "Clear next-step dates on open opportunities", why: "You've logged 33 CRM updates this cycle — the audit closes the last gaps before quarter-end forecasting.", source_short: "Salesforce CDC · pipeline hygiene", channel: CH_SF, cta: "Open audit", est_minutes: 12, due: "Fri", completed: false },
        { task_id: "rachel-peer-kudos", points: 100, title: "Post a peer recognition", subtitle: "Pass on some of what you've been getting", why: "You've received 14 recognitions this cycle. Recognition you give travels further than recognition you get.", source_short: "Slack Events · peer recognition", channel: CH_SLACK, cta: "Give kudos", est_minutes: 2, due: "Today", completed: false },
      ],
    },
    "seller-marcus-001": {
      goal: { label: "Smartwatch", kind: "Wishlist reward · 14,000 pts", icon: "⌚", target_points: 14000, points_to_go: 1600, points_earned: 12400, percent: 88.6 },
      nudge: { headline: "Marcus, you're one win away from your smartwatch", body: "Your pipeline hygiene held all four weeks and a $27K deal is one signature out. Close it and the smartwatch is yours.", framing: "Weekly milestone" },
      tasks: [
        { task_id: "marcus-close-deal",       points: 500, title: "Close a deal this week",    subtitle: "Your top opportunity is one signature out", why: "Salesforce has 10 closes under your name and your late-stage pipeline is the healthiest it's been all quarter.", source_short: "Salesforce CDC · late-stage pipeline", channel: CH_SF, cta: "Open pipeline", est_minutes: 30, due: "Fri", completed: false },
        { task_id: "marcus-pipeline-records", points: 400, title: "Update 5 pipeline records", subtitle: "Stale opportunities are dragging your forecast", why: "You've logged 38 CRM updates — your hygiene streak is the team's best. Five records are still missing amounts.", source_short: "Salesforce CDC · CRM updates", channel: CH_SF, cta: "Update records", est_minutes: 15, due: "Wed", completed: false },
        { task_id: "marcus-cert",             points: 400, title: "Complete a sales cert",     subtitle: "Advanced Negotiation — you're most of the way there", why: "Databricks history shows 2 deals closed in 90 days. Negotiation certification is the step that moves deal size, not count.", source_short: "Databricks · 90-day velocity", channel: CH_SF, cta: "Resume cert", est_minutes: 45, due: "Next Tue", completed: false },
        { task_id: "marcus-best-practice",    points: 300, title: "Share a best practice",     subtitle: "Post how you keep pipeline hygiene at 100%", why: "Your CRM discipline is measurably above the team median — the rest of the floor would use it if you wrote it down.", source_short: "Slack Events · team channel", channel: CH_SLACK, cta: "Post to #sales-floor", est_minutes: 6, due: "This week", completed: false },
      ],
    },
    "seller-maya-001": {
      goal: { label: "Team Dinner Experience", kind: "Wishlist reward · 6,000 pts", icon: "🎉", target_points: 6000, points_to_go: 2100, points_earned: 3900, percent: 65.0 },
      nudge: { headline: "Maya, your team wants to celebrate your first win with you", body: "Your first deal on the new team just closed. Deal #2 is where the ramp really turns — and dinner's on the program.", framing: "Team connection" },
      tasks: [
        { task_id: "maya-second-deal",     points: 700, title: "Close your 2nd deal",       subtitle: "First one landed — the second one sets the pattern", why: "Your first close on the new team already landed in Salesforce. Databricks ramp curves say deal #2 is the real inflection point.", source_short: "Salesforce CDC · first close", channel: CH_SF, cta: "Open pipeline", est_minutes: 30, due: "This month", completed: false },
        { task_id: "maya-discovery-calls", points: 500, title: "Log 3 discovery calls",     subtitle: "Top of funnel is where ramp speed is decided", why: "Databricks ramp data shows reps who log 3+ discovery calls a week in month 6 hit quota a full quarter earlier.", source_short: "Databricks · ramp curve", channel: CH_SF, cta: "Log calls", est_minutes: 8, due: "Fri", completed: false },
        { task_id: "maya-onboarding-cert", points: 500, title: "Complete onboarding cert",  subtitle: "Last two modules of the new-team track", why: "You've consumed more enablement than anyone in your cohort — finishing the track converts that into territory credit.", source_short: "Databricks · enablement history", channel: CH_SF, cta: "Resume cert", est_minutes: 40, due: "Next Fri", completed: false },
        { task_id: "maya-peer-kudos",      points: 400, title: "Get 2 more peer kudos",     subtitle: "Pair up on a live deal this week", why: "Slack is where this team keeps score of each other. Two shout-outs after a paired deal and you're fully on their recognition map.", source_short: "Slack Events · peer recognition", channel: CH_SLACK, cta: "Open #new-team", est_minutes: 5, due: "This week", completed: false },
      ],
    },
  };

  // ── helpers ───────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function num(n) { return Number(n || 0).toLocaleString("en-US"); }

  function srcDot(src) {
    var t = String(src || "").toLowerCase();
    if (t.indexOf("databricks") >= 0) return "#f5a800";       // federated, in place
    if (t.indexOf("slack") >= 0) return "#9a5ce6";            // collaboration
    return "#10b39e";                                          // live CRM
  }

  function offlineFor(sellerId) {
    var base = OFFLINE[sellerId] || OFFLINE["seller-rachel-001"];
    var plan = JSON.parse(JSON.stringify(base));
    var who = SELLER_UI[sellerId] || SELLER_UI["seller-rachel-001"];
    plan.seller_id = sellerId;
    plan.display_name = who.first;
    plan.totals = {
      task_count: plan.tasks.length, completed_count: 0,
      points_available: plan.goal.points_to_go, points_remaining: plan.goal.points_to_go,
    };
    plan._offline = true;
    return plan;
  }

  // Minimal JSON syntax highlighter for the payload viewer
  function hl(obj) {
    var json = esc(JSON.stringify(obj, null, 2));
    return json
      .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="s">"$1"</span>')
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
      .replace(/: (true|false|null)/g, ': <span class="n">$1</span>');
  }

  // ── shared fragments ──────────────────────────────────────────────────────

  // `unit` lets the Thanks@IBM surface say "BluePoints" where the others say "pts".
  function goalHtml(plan, unit) {
    var g = plan.goal;
    unit = unit || "pts";
    return '' +
      '<div class="sx-goal">' +
        '<div class="sx-goal-top">' +
          '<div>' +
            '<div class="sx-goal-name">' + esc(g.icon) + ' ' + esc(g.label) + '</div>' +
            '<div class="sx-goal-kind">' + esc(g.kind) + '</div>' +
          '</div>' +
          '<div class="sx-goal-togo">' + num(g.points_to_go) + ' ' + esc(unit) + ' to go</div>' +
        '</div>' +
        '<div class="sx-meter"><div class="sx-meter-fill" style="width:' + g.percent + '%"></div></div>' +
        '<div class="sx-meter-num"><span>' + num(g.points_earned) + ' ' + esc(unit) + '</span>' +
          '<span>' + num(g.target_points) + ' ' + esc(unit) + '</span></div>' +
      '</div>';
  }

  function sfTaskHtml(t) {
    var done = t.completed;
    return '' +
      '<div class="sx-task' + (done ? " is-done" : "") + '" data-task="' + esc(t.task_id) + '">' +
        '<div class="sx-pts">' + (done ? "✓ " : "+") + t.points + '</div>' +
        '<div class="sx-task-main">' +
          '<div class="sx-task-title">' + esc(t.title) + '</div>' +
          '<div class="sx-task-sub">' + esc(t.subtitle) + '</div>' +
          '<div class="sx-task-why">' + esc(t.why) + '</div>' +
          '<div class="sx-task-foot">' +
            '<span class="sx-src"><span class="sx-src-dot" style="background:' + srcDot(t.source_short) + '"></span>' + esc(t.source_short) + '</span>' +
            '<span class="sx-meta">~' + t.est_minutes + ' min · ' + esc(t.due) + '</span>' +
          '</div>' +
          '<div class="sx-task-act">' +
            '<button class="sx-do" data-do="' + esc(t.task_id) + '"' + (done ? " disabled" : "") + '>' +
              (done ? "✓ Done" : esc(t.cta)) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ── Thanks@IBM (BluePoints) surface ───────────────────────────────────────

  function bluepointsHtml(plan) {
    var who = SELLER_UI[plan.seller_id] || SELLER_UI["seller-rachel-001"];
    var n = plan.nudge || {};
    var unit = plan.currency || "BluePoints";
    var open = plan.totals.task_count - plan.totals.completed_count;
    var balance = plan.points_balance || plan.goal.points_earned;

    var TILES = [
      { label: "Merchandise<br>Marketplace", bg: "linear-gradient(135deg,#b7a99a,#8d7f6f 60%,#5c5147)" },
      { label: "Experiences<br>Marketplace", bg: "linear-gradient(135deg,#7fb2d9,#3d6f9e 60%,#274d70)" },
      { label: "Mastery<br>Marketplace",     bg: "linear-gradient(135deg,#e0b64f,#a8763a 60%,#6d4a26)" },
    ];

    var NAV = [
      { ic: "⌂", t: "Home", on: true },
      { ic: "🏆", t: "Trophy Case" },
      { ic: "⚑", t: "Challenges", badge: open },
      { ic: "◎", t: "Help Center" },
      { ic: "▤", t: "Resources", chev: true },
      { ic: "◔", t: "Activity" },
    ];

    // Feed: the seller's real Slack recognition signal, shown where the
    // program already surfaces it.
    var FEED = [
      { from: "Dana Whitfield", ago: "2d", to: who.first.toUpperCase() + " " + who.last.toUpperCase(),
        color: "#8a3ffc",
        msg: "Thanks for the assist on the Meridian deal — the whole team felt that one. Great work this quarter." },
      { from: "Priya Raman", ago: "6d", to: who.first.toUpperCase() + " " + who.last.toUpperCase(),
        color: "#007d79",
        msg: "Your enablement session changed how I run discovery calls. Passing the credit back to you!" },
    ];

    return '' +
    '<div class="bp">' +
      '<div class="bp-top">' +
        '<div class="bp-brand">Thanks@IBM</div>' +
        '<div class="bp-top-right">' +
          '<span class="bp-bal"><span class="ic">▦</span>' + num(balance) + '</span>' +
          '<span class="bp-bell">🔔<span class="bp-bell-dot" id="bpBell">1</span></span>' +
          '<span class="bp-ava" style="background:' + who.color + '">' + esc(who.first[0] + who.last[0]) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="bp-body">' +
        '<div class="bp-side">' +
          NAV.map(function (i) {
            return '<div class="bp-nav' + (i.on ? " on" : "") + '">' +
              '<span class="ic">' + i.ic + '</span>' + esc(i.t) +
              (i.badge ? '<span class="bp-nav-badge">' + i.badge + '</span>' : "") +
              (i.chev ? '<span class="chev">▼</span>' : "") + '</div>';
          }).join("") +
        '</div>' +

        '<div class="bp-main">' +
          '<div class="bp-welcome">' +
            '<h2>Welcome back, ' + esc(plan.display_name) + '!</h2>' +
            '<button class="bp-send">Send Recognition ✎</button>' +
          '</div>' +

          '<div class="bp-cols">' +
            '<div>' +
              // balance + marketplaces — the program's normal home content
              '<div class="bp-card"><div class="bp-card-pad">' +
                '<div class="bp-card-t">My Personal Balance</div>' +
                '<div class="bp-balance-v">' + num(balance) + '<span class="u">' + esc(unit) + '</span></div>' +
                '<div class="bp-tiles">' +
                  TILES.map(function (t) {
                    return '<div class="bp-tile" style="background:' + t.bg + '"><span>' + t.label + '</span></div>';
                  }).join("") +
                '</div>' +
              '</div></div>' +

              // the nudge, as a native home card
              '<div class="bp-card bp-nudge">' +
                '<div class="bp-card-pad">' +
                  '<div class="bp-eyebrow">Your next move</div>' +
                  '<div class="bp-headline">' + esc(n.headline || (plan.display_name + ", here's your next move")) + '</div>' +
                  (n.body ? '<div class="bp-bodytext">' + esc(n.body) + '</div>' : "") +
                '</div>' +
                goalHtml(plan, unit) +
                '<div class="sx-tasks-h"><span>Challenges · +' + num(plan.totals.points_available) + ' ' + esc(unit) + '</span>' +
                  '<span>' + plan.totals.completed_count + '/' + plan.totals.task_count + ' done</span></div>' +
                '<div class="sx-tasks">' + plan.tasks.map(sfTaskHtml).join("") + '</div>' +
                whyFootHtml(plan) +
              '</div>' +
            '</div>' +

            // recognition feed
            '<div>' +
              '<div class="bp-card"><div class="bp-card-pad">' +
                '<div class="bp-feed-h">Recognition Feed</div>' +
                '<div class="bp-select">Recommended <span>▼</span></div>' +
              '</div></div>' +
              '<div class="bp-card">' +
                FEED.map(function (f) {
                  return '<div class="bp-rec">' +
                    '<div class="bp-rec-top">' +
                      '<span class="bp-rec-ava" style="background:' + f.color + '">' + esc(f.from[0]) + '</span>' +
                      '<span><span class="bp-rec-nm">' + esc(f.from) + '</span>' +
                        '<span class="bp-rec-ago">' + esc(f.ago) + '</span></span>' +
                      '<span class="bp-rec-dots">•••</span>' +
                    '</div>' +
                    '<div class="bp-rec-lbl">Recognizing</div>' +
                    '<div class="bp-rec-who">' + esc(f.to) + '</div>' +
                    '<div class="bp-chip"><span class="hex"></span>Team Focused</div>' +
                    '<div class="bp-rec-msg">' + esc(f.msg) + '</div>' +
                    '<div class="bp-rec-foot">💬 Comment</div>' +
                  '</div>';
                }).join("") +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function whyFootHtml(plan) {
    return '<div class="sx-why-foot"><b>Why these four?</b> Assembled in the lakehouse from three ' +
      'sources that don\'t share a system — Salesforce CDC (live), Slack Events (live), and ' +
      'Databricks history read in place. Points shown add up to exactly the gap.</div>';
  }

  // ── Salesforce surface ────────────────────────────────────────────────────

  function salesforceHtml(plan) {
    var who = SELLER_UI[plan.seller_id] || SELLER_UI["seller-rachel-001"];
    var pipe = SF_PIPELINE[plan.seller_id] || SF_PIPELINE["seller-rachel-001"];
    var n = plan.nudge || {};
    var g = plan.goal;

    var rows = pipe.map(function (o) {
      return '<div class="sf-row"><div><div style="color:#0b5cab;font-weight:600">' + esc(o.name) + '</div>' +
        '<div style="color:#747474;font-size:11px;margin-top:1px">Close ' + esc(o.close) + '</div></div>' +
        '<div style="text-align:right"><div style="font-weight:600">' + esc(o.amt) + '</div>' +
        '<div class="sf-stage" style="margin-top:3px">' + esc(o.stage) + '</div></div></div>';
    }).join("");

    return '' +
    '<div class="sf sf-stagewrap">' +
      '<div class="sf-topbar">' +
        '<div class="sf-waffle"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="sf-appname">Sales</div>' +
        '<div class="sf-search">🔍 Search Salesforce</div>' +
        '<div class="sf-topicons">' +
          '<span class="sf-icon">＋</span>' +
          '<span class="sf-icon">🔔<span class="sf-bell-badge" id="sfBell">1</span></span>' +
          '<span class="sf-icon">？</span>' +
          '<span class="sf-avatar" style="background:' + who.color + '">' + esc(who.first[0] + who.last[0]) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="sf-tabs">' +
        '<div class="sf-tab on">Home</div><div class="sf-tab">Opportunities</div>' +
        '<div class="sf-tab">Accounts</div><div class="sf-tab">Leads</div>' +
        '<div class="sf-tab">Tasks</div><div class="sf-tab">Reports</div>' +
        '<div class="sf-tab">Elevate</div>' +
      '</div>' +

      // Custom notification toast (bell / mobile push)
      '<div class="sf-toast" id="sfToast">' +
        '<div class="sf-toast-h"><span class="sf-toast-app">E</span> Elevate · just now</div>' +
        '<div class="sf-toast-t">' + esc(g.icon) + ' ' + num(g.points_to_go) + ' pts to your ' + esc(g.label) + '</div>' +
        '<div class="sf-toast-b">' + esc(n.headline || "") + '</div>' +
      '</div>' +

      '<div class="sf-body">' +
        // ── Left: the seller's normal working screen ──
        '<div>' +
          '<div class="sf-card">' +
            '<div class="sf-card-head"><span class="sf-card-ico" style="background:#f5a623">👤</span>' +
              esc(who.first + " " + who.last) + '</div>' +
            '<div class="sf-card-body"><div class="sf-field-grid">' +
              '<div><div class="sf-field-l">Title</div><div class="sf-field-v plain">' + esc(who.role) + '</div></div>' +
              '<div><div class="sf-field-l">Team</div><div class="sf-field-v">' + esc(who.team) + '</div></div>' +
              '<div><div class="sf-field-l">Quota attainment</div><div class="sf-field-v plain">' + (plan.seller_id === "seller-maya-001" ? "41%" : plan.seller_id === "seller-marcus-001" ? "78%" : "112%") + '</div></div>' +
              '<div><div class="sf-field-l">Elevate points</div><div class="sf-field-v">' + num(plan.points_balance || g.points_earned) + '</div></div>' +
            '</div></div>' +
          '</div>' +
          '<div class="sf-card">' +
            '<div class="sf-card-head"><span class="sf-card-ico" style="background:#ff9a3c">💼</span>' +
              'My Opportunities <span style="font-weight:400;color:#747474;font-size:11px">(' + pipe.length + ')</span></div>' +
            '<div class="sf-card-body" style="padding-top:2px">' + rows + '</div>' +
          '</div>' +
        '</div>' +

        // ── Right rail: the Elevate Lightning component ──
        '<div class="sf-elev">' +
          '<div class="sf-elev-head">' +
            '<div class="sf-elev-eyebrow">Elevate · your next move</div>' +
            '<div class="sf-elev-title">' + esc(n.headline || (plan.display_name + ", here's your next move")) + '</div>' +
            (n.body ? '<div class="sf-elev-body">' + esc(n.body) + '</div>' : "") +
          '</div>' +
          goalHtml(plan) +
          '<div class="sx-tasks-h"><span>Earn the gap</span>' +
            '<span>' + plan.totals.completed_count + '/' + plan.totals.task_count + ' done</span></div>' +
          '<div class="sx-tasks">' + plan.tasks.map(sfTaskHtml).join("") + '</div>' +
          whyFootHtml(plan) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Slack surface ─────────────────────────────────────────────────────────

  function slackTaskHtml(t, isFirst) {
    var done = t.completed;
    return '' +
      '<div class="slk-task' + (done ? " is-done" : "") + '" data-task="' + esc(t.task_id) + '">' +
        '<div class="slk-task-main">' +
          '<div class="slk-task-t">' + (done ? "✅ " : "") +
            '<span class="pts">+' + t.points + ' pts</span> · ' + esc(t.title) + '</div>' +
          '<div class="slk-task-s">' + esc(t.subtitle) + '</div>' +
          '<div class="slk-task-w">' + esc(t.why) + '</div>' +
          '<div class="slk-b-context">⏱ ~' + t.est_minutes + ' min · due ' + esc(t.due) +
            ' · <span class="sx-src"><span class="sx-src-dot" style="background:' + srcDot(t.source_short) + '"></span>' +
            esc(t.source_short) + '</span></div>' +
        '</div>' +
        '<button class="slk-btn' + (isFirst && !done ? " primary" : "") + '" data-do="' + esc(t.task_id) + '"' +
          (done ? " disabled" : "") + '>' + (done ? "✓ Done" : esc(t.cta)) + '</button>' +
      '</div>';
  }

  function slackHtml(plan) {
    var who = SELLER_UI[plan.seller_id] || SELLER_UI["seller-rachel-001"];
    var n = plan.nudge || {};
    var g = plan.goal;
    var filled = Math.round(g.percent / 10);
    var meter = new Array(filled + 1).join("█") + new Array(11 - filled).join("░");

    return '' +
    '<div class="slk">' +
      '<div class="slk-side">' +
        '<div class="slk-ws"><div>BIW Sales<div class="slk-ws-sub"><span class="slk-presence"></span>' +
          esc(who.first + " " + who.last) + '</div></div><div style="font-size:15px">✎</div></div>' +
        '<div class="slk-group">Channels</div>' +
        '<div class="slk-item"><span class="hash">#</span> sales-floor</div>' +
        '<div class="slk-item"><span class="hash">#</span> sales-wins</div>' +
        '<div class="slk-item"><span class="hash">#</span> enterprise-north</div>' +
        '<div class="slk-item"><span class="hash">#</span> enablement</div>' +
        '<div class="slk-group">Direct messages</div>' +
        '<div class="slk-item on">🟪 Elevate <span class="slk-app-tag">APP</span><span class="slk-unread">1</span></div>' +
        '<div class="slk-item">🟢 Dana Whitfield <span style="font-size:10px;opacity:.7">(manager)</span></div>' +
        '<div class="slk-item">⚪ Priya Raman</div>' +
      '</div>' +

      '<div class="slk-main">' +
        '<div class="slk-head"><span class="slk-head-t">Elevate <span class="slk-app-tag" style="background:#e8e8e8;color:#616061">APP</span></span>' +
          '<span class="slk-head-s">Motivation nudges · powered by your activity across Salesforce, Slack &amp; Databricks</span></div>' +

        '<div class="slk-msgs">' +
          '<div class="slk-msg">' +
            '<div class="slk-ava elevate">E</div>' +
            '<div class="slk-body">' +
              '<div class="slk-by"><span class="slk-name">Elevate</span>' +
                '<span class="slk-app-tag" style="background:#e8e8e8;color:#616061">APP</span>' +
                '<span class="slk-time">9:04 AM</span></div>' +

              '<div class="slk-blocks">' +
                '<div class="slk-b-header">' + esc(g.icon) + ' ' +
                  esc(n.headline || (plan.display_name + ", here's your next move")) + '</div>' +
                (n.body ? '<div class="slk-b-text">' + esc(n.body) + '</div>' : "") +

                '<div class="slk-goal">' +
                  '<div style="font-weight:800;margin-bottom:5px">' + esc(g.label) + '</div>' +
                  '<div><span class="slk-code">' + meter + '</span> ' +
                    num(g.points_earned) + ' / ' + num(g.target_points) + ' pts</div>' +
                  '<div style="font-weight:800;margin-top:5px">' + num(g.points_to_go) +
                    ' pts to go <span style="font-weight:400;color:#616061">— the tasks below add up to exactly that.</span></div>' +
                '</div>' +

                '<div class="slk-b-divider"></div>' +
                plan.tasks.map(function (t, i) { return slackTaskHtml(t, i === 0); }).join('<div class="slk-b-divider"></div>') +
                '<div class="slk-b-divider"></div>' +

                '<div class="slk-b-context">Assembled from 3 unified sources: ' +
                  '<span class="sx-src"><span class="sx-src-dot" style="background:#10b39e"></span>Salesforce CDC</span>' +
                  '<span class="sx-src"><span class="sx-src-dot" style="background:#9a5ce6"></span>Slack Events</span>' +
                  '<span class="sx-src"><span class="sx-src-dot" style="background:#f5a800"></span>Databricks (in place)</span>' +
                  ' · Simulated data</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="slk-composer">💬 Message Elevate</div>' +
      '</div>' +
    '</div>';
  }

  // ── mount ─────────────────────────────────────────────────────────────────

  function mount(host, opts) {
    opts = opts || {};
    var apiBase = opts.apiBase || "";
    var sellerId = opts.sellerId || "seller-rachel-001";
    var channel = opts.channel || CH_SF;
    // Hosts that already have their own channel picker (the demo console's
    // Act 3 nav) mount with showChannels:false and drive it via setChannel().
    var showChannels = opts.showChannels !== false;
    var plan = null;
    var lastDelivery = null;

    host.classList.add("sx-root");
    host.innerHTML = '<div class="sx-loading">Loading seller view…</div>';

    function apiUrl(path) { return apiBase + path; }

    function shellHtml() {
      var pills = [
        { ch: CH_SF,    logo: SF_LOGO,    name: "Salesforce", sub: "Lightning component + bell" },
        { ch: CH_SLACK, logo: SLACK_LOGO, name: "Slack",      sub: "Block Kit DM from Elevate" },
        { ch: CH_BP,    logo: BP_LOGO,    name: "BluePoints", sub: "Thanks@IBM home + Challenges" },
      ];
      return '' +
      '<div class="sx-channels">' +
        (showChannels
          ? pills.map(function (p) {
              return '<button class="sx-ch' + (channel === p.ch ? " is-active" : "") + '" data-ch="' + p.ch + '">' +
                '<span class="sx-ch-mark">' + p.logo + '</span>' +
                '<span>' + p.name + '<span class="sx-ch-sub" style="display:block">' + p.sub + '</span></span>' +
              '</button>';
            }).join("")
          : '') +
        '<div class="sx-deliver-bar">' +
          '<span id="sxDeliverMsg"></span>' +
          '<button class="sx-btn" id="sxReset">Reset</button>' +
          '<button class="sx-btn sx-btn-primary" id="sxDeliver">Send nudge →</button>' +
        '</div>' +
      '</div>' +

      '<div class="sx-frame">' +
        '<div class="sx-chrome">' +
          '<span class="sx-dot" style="background:#ff5f57"></span>' +
          '<span class="sx-dot" style="background:#febc2e"></span>' +
          '<span class="sx-dot" style="background:#28c840"></span>' +
          '<span class="sx-url" id="sxUrl"></span>' +
        '</div>' +
        '<div class="sx-surface' + (channel === CH_SF ? " is-active" : "") + '" id="sxSf"></div>' +
        '<div class="sx-surface' + (channel === CH_SLACK ? " is-active" : "") + '" id="sxSlack"></div>' +
        '<div class="sx-surface' + (channel === CH_BP ? " is-active" : "") + '" id="sxBp"></div>' +
      '</div>' +

      '<details class="sx-payload" id="sxPayload">' +
        '<summary>Show the payload that ships to this channel</summary>' +
        '<pre id="sxPayloadPre">loading…</pre>' +
      '</details>' +

      (plan && plan._offline
        ? '<div class="sx-note">⚠ API unreachable — showing the pinned offline plan. Start the backend with ' +
          '<code>python api.py</code> to drive these surfaces from live signals.</div>'
        : '') +
      '<div class="sx-note">ⓘ All three surfaces are faithful renderings of the payloads in ' +
        '<code>/api/actions/&lt;seller&gt;/payload/&lt;channel&gt;</code>. Nothing is posted to a real workspace ' +
        'or program unless <code>SLACK_WEBHOOK_URL</code>, <code>SF_ACCESS_TOKEN</code> or ' +
        '<code>ELEVATE_API_KEY</code> are configured. Seller data is 100% synthetic.</div>';
    }

    var URLS = {};
    URLS[CH_SF]    = "biw-sales.lightning.force.com/lightning/page/home";
    URLS[CH_SLACK] = "app.slack.com/client/T0BIWSALES/D-elevate";
    URLS[CH_BP]    = "thanks.ibm.com/home";

    function render() {
      host.innerHTML = shellHtml();
      document.getElementById("sxSf").innerHTML = salesforceHtml(plan);
      document.getElementById("sxSlack").innerHTML = slackHtml(plan);
      document.getElementById("sxBp").innerHTML = bluepointsHtml(plan);
      document.getElementById("sxUrl").textContent = URLS[channel];
      loadPayload();
      wire();
    }

    function wire() {
      host.querySelectorAll(".sx-ch").forEach(function (b) {
        b.addEventListener("click", function () { setChannel(b.dataset.ch); });
      });
      host.querySelectorAll("[data-do]").forEach(function (b) {
        b.addEventListener("click", function () { complete(b.dataset.do); });
      });
      var d = document.getElementById("sxDeliver");
      if (d) d.addEventListener("click", deliver);
      var r = document.getElementById("sxReset");
      if (r) r.addEventListener("click", resetTasks);
    }

    function setChannel(ch) {
      if (ch === channel) return;
      channel = ch;
      host.querySelectorAll(".sx-ch").forEach(function (b) {
        b.classList.toggle("is-active", b.dataset.ch === ch);
      });
      document.getElementById("sxSf").classList.toggle("is-active", ch === CH_SF);
      document.getElementById("sxSlack").classList.toggle("is-active", ch === CH_SLACK);
      document.getElementById("sxBp").classList.toggle("is-active", ch === CH_BP);
      document.getElementById("sxUrl").textContent = URLS[ch];
      loadPayload();
    }

    // Optimistic local completion, reconciled with the server response.
    function applyLocalComplete(taskId) {
      plan.tasks.forEach(function (t) { if (t.task_id === taskId) t.completed = true; });
      var total = plan.tasks.reduce(function (a, t) { return a + t.points; }, 0);
      var earned = plan.tasks.reduce(function (a, t) { return a + (t.completed ? t.points : 0); }, 0);
      var target = plan.goal.target_points;
      plan.goal.points_to_go = total - earned;
      plan.goal.points_earned = target - total + earned;
      plan.goal.percent = Math.round(1000 * plan.goal.points_earned / target) / 10;
      plan.totals.completed_count = plan.tasks.filter(function (t) { return t.completed; }).length;
      plan.totals.points_remaining = plan.goal.points_to_go;
    }

    function complete(taskId) {
      applyLocalComplete(taskId);
      var nudgeCache = plan.nudge;
      render();
      host.querySelectorAll('[data-task="' + taskId + '"]').forEach(function (el) {
        el.classList.add("just-done");
      });

      fetch(apiUrl("/api/actions/" + sellerId + "/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (fresh) {
          if (!fresh || fresh.error) return;
          fresh.nudge = nudgeCache;          // keep the LLM text stable mid-session
          plan = fresh;
        })
        .catch(function () { /* offline — optimistic state stands */ });
    }

    function resetTasks() {
      plan.tasks.forEach(function (t) { t.completed = false; });
      var total = plan.tasks.reduce(function (a, t) { return a + t.points; }, 0);
      plan.goal.points_to_go = total;
      plan.goal.points_earned = plan.goal.target_points - total;
      plan.goal.percent = Math.round(1000 * plan.goal.points_earned / plan.goal.target_points) / 10;
      plan.totals.completed_count = 0;
      plan.totals.points_remaining = total;
      lastDelivery = null;
      render();
      fetch(apiUrl("/api/actions/" + sellerId + "/reset"), { method: "POST" }).catch(function () {});
    }

    function deliver() {
      var msg = document.getElementById("sxDeliverMsg");
      msg.textContent = "sending…";
      fetch(apiUrl("/api/actions/" + sellerId + "/deliver"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channel }),
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          lastDelivery = res;
          msg.textContent = res.delivered
            ? "✓ delivered to " + channel
            : "✓ payload built · " + (res.reason || "preview only");
          showArrival();
          if (res.payload) {
            document.getElementById("sxPayloadPre").innerHTML = hl(res.payload);
            document.getElementById("sxPayload").open = true;
          }
        })
        .catch(function () {
          msg.textContent = "✓ payload built · API offline, preview only";
          showArrival();
        });
    }

    // The visible "it arrived" beat: SF bell + toast, or Slack unread ping.
    function showArrival() {
      if (channel === CH_BP) {
        var bpBell = document.getElementById("bpBell");
        if (bpBell) bpBell.classList.add("on");
        var card = host.querySelector(".bp-nudge");
        if (card) {
          card.classList.add("just-done");
          setTimeout(function () { card.classList.remove("just-done"); }, 900);
        }
        return;
      }
      if (channel === CH_SF) {
        var bell = document.getElementById("sfBell");
        var toast = document.getElementById("sfToast");
        if (bell) bell.classList.add("on");
        if (toast) {
          toast.classList.add("show");
          setTimeout(function () { toast.classList.remove("show"); }, 6000);
        }
      } else {
        var item = host.querySelector(".slk-item.on");
        if (item) {
          item.style.transition = "background .25s";
          item.style.background = "#cd2553";
          setTimeout(function () { item.style.background = ""; }, 900);
        }
      }
    }

    function loadPayload() {
      var pre = document.getElementById("sxPayloadPre");
      if (!pre) return;
      pre.textContent = "loading…";
      fetch(apiUrl("/api/actions/" + sellerId + "/payload/" + channel))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) throw new Error(d.error);
          pre.innerHTML = hl(d.payload);
        })
        .catch(function () {
          var shapes = {};
          shapes[CH_SLACK] = {
            note: "API offline — this is the shape of the chat.postMessage body",
            channel: "@" + (plan.display_name || "").toLowerCase(),
            blocks: "[header, section, divider, 4 × (section + accessory button), context]",
          };
          shapes[CH_SF] = {
            note: "API offline — this is the shape of the CustomNotification body",
            customNotifTypeId: "Elevate_Nudge",
            title: plan.goal.icon + " " + num(plan.goal.points_to_go) + " pts to your " + plan.goal.label,
          };
          shapes[CH_BP] = {
            note: "API offline — this is the shape of the Thanks@IBM payload",
            program: "Thanks@IBM",
            currency: plan.currency || "BluePoints",
            home_card: { headline: (plan.nudge || {}).headline || "", goal: plan.goal.label },
            challenges: plan.tasks.length + " × { title, award, reason, evidence_source }",
          };
          pre.innerHTML = hl(shapes[channel] || shapes[CH_SF]);
        });
    }

    function load() {
      host.innerHTML = '<div class="sx-loading">Loading seller view…</div>';
      fetch(apiUrl("/api/actions/" + sellerId))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) throw new Error(d.error);
          plan = d;
          render();
        })
        .catch(function () {
          plan = offlineFor(sellerId);
          render();
        });
    }

    load();

    return {
      setSeller: function (id) { sellerId = id; lastDelivery = null; load(); },
      setChannel: setChannel,
      reload: load,
      getPlan: function () { return plan; },
    };
  }

  // ── brand marks (inline SVG — no external assets, CSP-safe) ───────────────

  var SF_LOGO =
    '<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" aria-label="Salesforce">' +
    '<path fill="#00A1E0" d="M41.6 12.3a17 17 0 0 1 12.3-5.3c6.4 0 12 3.6 15 8.9a20.7 20.7 0 0 1 8.5-1.8c11.5 0 20.9 9.4 20.9 21.1 0 11.6-9.4 21-20.9 21-1.4 0-2.8-.1-4.1-.4a15.3 15.3 0 0 1-13.4 7.9c-2.3 0-4.5-.5-6.5-1.5a17.5 17.5 0 0 1-16.2 10.9c-7.3 0-13.6-4.5-16.2-10.9-1.6.4-3.3.5-5 .5C7 62.7 0 55.6 0 46.8c0-5.9 3.2-11 7.9-13.8a18.1 18.1 0 0 1-1.5-7.2C6.4 15.4 14.6 7.2 24.7 7.2c5.9 0 11.2 2.8 14.6 7.2l2.3-2.1z"/></svg>';

  var SLACK_LOGO =
    '<svg viewBox="0 0 122 122" xmlns="http://www.w3.org/2000/svg" aria-label="Slack">' +
    '<path fill="#E01E5A" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 0 1 25.8 0v32.3a12.9 12.9 0 0 1-25.8 0V77.6z"/>' +
    '<path fill="#36C5F0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 0 1 0 25.8H12.9a12.9 12.9 0 0 1 0-25.8h32.3z"/>' +
    '<path fill="#2EB67D" d="M96.9 45.2a12.9 12.9 0 1 1 12.9 12.9H96.9V45.2zm-6.5 0a12.9 12.9 0 0 1-25.8 0V12.9a12.9 12.9 0 0 1 25.8 0v32.3z"/>' +
    '<path fill="#ECB22E" d="M77.6 96.9a12.9 12.9 0 1 1-12.9 12.9V96.9h12.9zm0-6.5a12.9 12.9 0 0 1 0-25.8h32.3a12.9 12.9 0 0 1 0 25.8H77.6z"/></svg>';

  // Thanks@IBM mark — the 8-bar motif in IBM interactive blue.
  var BP_LOGO =
    '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-label="Thanks@IBM">' +
    '<rect width="32" height="32" rx="7" fill="#0f62fe"/>' +
    '<g fill="#fff">' +
    '<rect x="7" y="9"  width="18" height="2.2" rx="1.1"/>' +
    '<rect x="7" y="13" width="18" height="2.2" rx="1.1"/>' +
    '<rect x="7" y="17" width="12" height="2.2" rx="1.1"/>' +
    '<rect x="7" y="21" width="8"  height="2.2" rx="1.1"/>' +
    '</g></svg>';

  return {
    mount: mount,
    SELLER_UI: SELLER_UI,
    SF_LOGO: SF_LOGO,
    SLACK_LOGO: SLACK_LOGO,
    BP_LOGO: BP_LOGO,
  };
})();
