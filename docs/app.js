// ---- CONFIG (shared) ----
var SUPABASE_URL = "https://kduahomjytwviokyvqvp.supabase.co";
var SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkdWFob21qeXR3dmlva3l2cXZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDkzNTIsImV4cCI6MjA5NzE4NTM1Mn0.ZwRemPh4GPsEE_lioue8e5uxHotjfMzXJdOjN1373dc";
var INITIAL_COMMENTS = 2;
var COMMENTS_PER_LOAD = 2;
var RECO_COUNT = 5;

var REPORT_REASONS = [
  { id: "spam_misleading", label: "Spam or misleading" },
  { id: "hate_harassment", label: "Hate speech or harassment" },
  { id: "abusive_language", label: "Abusive or harmful language" },
  { id: "violent_content", label: "Threatening or violent content" },
  { id: "other", label: "Other" },
];

// ---- ICON SVG STRINGS ----
var SVG_LIKE =
  '<svg fill="none" height="18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="18"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"></path><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>';
var SVG_REPLY =
  '<svg fill="none" height="18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
var SVG_REPOST =
  '<svg fill="none" height="18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="18"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>';
var SVG_REPORT =
  '<svg fill="none" height="18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="18"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" x2="4" y1="22" y2="15"></line></svg>';

// ---- SUPABASE + URL PARAMS ----
var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
var params = new URLSearchParams(window.location.search);
var PID = params.get("pid") || "test_" + Date.now();
var GROUP = params.get("group") || "A1";

// ---- SHARED STATE ----
// SESSION_TYPE and CONTINUE_DELAY_MS are declared by each page script.
var currentItem = null;
var allComments = [];
var recoItems = [];
var condition = null;
var visibleCount = INITIAL_COMMENTS;
var expansionIdx = 0;
var recoClickOrder = 0;
var postLiked = false;
var postReposted = false;
var postReplyCount = 0;
var commentStates = {};
var renderedCmtIds = new Set();
var pendingWrites = [];
var reportTarget = null;
var continueFired = false;

// ---- INTERACTION TRACKING ----
// trackInteraction(type, data) is defined by each page script.
function queueWrite(table, data) {
  trackInteraction(table, data);
}

function flushWrites() {}

// ---- UI HELPERS ----
function mkAction(icon) {
  var b = document.createElement("button");
  b.type = "button";
  b.style.cssText =
    "background:none; border:none; cursor:pointer; color:inherit; display:flex; align-items:center; gap:6px; font-size:13px; padding:6px; margin:-6px; border-radius:999px; transition:background-color .16s ease, color .16s ease, transform .08s ease;";
  b.innerHTML = '<span class="ico">' + icon + "</span>";
  addButtonFeedback(b);
  return b;
}

function mkActionText(label) {
  var b = document.createElement("button");
  b.type = "button";
  b.style.cssText =
    "background:none; border:none; cursor:pointer; color:#536471; font-size:13px; padding:4px 6px; margin:-4px -6px; border-radius:999px; font-family:inherit; transition:background-color .16s ease, color .16s ease, transform .08s ease;";
  b.textContent = label;
  addButtonFeedback(b);
  return b;
}

function addButtonFeedback(el) {
  var activeBg = "rgba(15,20,25,.06)";
  el.addEventListener("mouseenter", function () {
    el.style.background = activeBg;
  });
  el.addEventListener("mouseleave", function () {
    el.style.background = "none";
    el.style.transform = "scale(1)";
  });
  el.addEventListener("mousedown", function () {
    el.style.transform = "scale(.96)";
  });
  el.addEventListener("mouseup", function () {
    el.style.transform = "scale(1)";
  });
}

function styleTextarea(ta) {
  ta.style.transition =
    "border-color .16s ease, box-shadow .16s ease, min-height .16s ease";
  ta.addEventListener("focus", function () {
    ta.style.borderColor = "#1d9bf0";
    ta.style.boxShadow = "0 0 0 2px rgba(29,155,240,.18)";
  });
  ta.addEventListener("blur", function () {
    ta.style.borderColor = "#cfd9de";
    ta.style.boxShadow = "none";
  });
}

function stylePrimaryButton(btn) {
  btn.style.transition = "background-color .16s ease, transform .08s ease";
  btn.addEventListener("mouseenter", function () {
    btn.style.background = "#272c30";
  });
  btn.addEventListener("mouseleave", function () {
    btn.style.background = "#0f1419";
    btn.style.transform = "scale(1)";
  });
  btn.addEventListener("mousedown", function () {
    btn.style.transform = "scale(.97)";
  });
  btn.addEventListener("mouseup", function () {
    btn.style.transform = "scale(1)";
  });
}

function animateReplyBox(box) {
  box.style.opacity = "0";
  box.style.transform = "translateY(-4px)";
  box.style.transition = "opacity .16s ease, transform .16s ease";
  setTimeout(function () {
    box.style.opacity = "1";
    box.style.transform = "translateY(0)";
  }, 0);
}

function addDismissOnOutside(box, textarea, onDismiss) {
  setTimeout(function () {
    document.addEventListener("mousedown", handleOutside);
  }, 0);
  function handleOutside(e) {
    if (!box.parentNode) {
      document.removeEventListener("mousedown", handleOutside);
      return;
    }
    if (box.contains(e.target)) return;
    if (textarea.value.trim()) return;
    document.removeEventListener("mousedown", handleOutside);
    onDismiss();
  }
}

// ---- RENDER ----
// renderSidebar() is defined by each page script.
function render() {
  renderPost();
  renderComments();
  renderSidebar();
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "block";
}

function renderPost() {
  var postUser = (currentItem.author || "user").replace(/^@/, "");
  document.getElementById("post-avatar").textContent = postUser[0].toUpperCase();
  document.getElementById("post-name").textContent = "@" + postUser;
  document.getElementById("post-handle").textContent = "";
  document.getElementById("post-title").textContent =
    currentItem.title && currentItem.title !== "nan" ? currentItem.title : "";
  var media = document.getElementById("stim-media");
  media.innerHTML = "";
  if (condition === "video" && currentItem.video_url) {
    var vid = youtubeId(currentItem.video_url);
    if (vid) {
      media.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' +
        vid +
        '?rel=0" allowfullscreen></iframe>';
    } else {
      media.innerHTML =
        '<video src="' +
        esc(currentItem.video_url) +
        '" controls style="width:100%;display:block;border:none;max-height:560px;background:#000;"></video>';
    }
  } else if (currentItem.transcript) {
    try {
      var paras = JSON.parse(currentItem.transcript);
      media.innerHTML =
        '<div class="transcript-box">' +
        (Array.isArray(paras) ? paras : [paras])
          .map(function (p) {
            return '<p style="margin-bottom:10px">' + esc(p) + "</p>";
          })
          .join("") +
        "</div>";
    } catch (e) {
      media.innerHTML =
        '<div class="transcript-box">' + esc(currentItem.transcript) + "</div>";
    }
  }
}

function renderComments() {
  var list = document.getElementById("comment-list");
  allComments.slice(0, visibleCount).forEach(function (c) {
    if (!renderedCmtIds.has(c.id)) {
      renderedCmtIds.add(c.id);
      list.appendChild(buildComment(c));
    }
  });
  document.getElementById("view-more-btn").style.display =
    visibleCount < allComments.length ? "block" : "none";
}

// ---- BUILD COMMENT ----
function buildComment(c) {
  var st = commentStates[c.id];
  var username = (c.author || "user").replace(/^@/, "");

  var wrap = document.createElement("div");
  wrap.style.cssText = "padding:18px 16px 14px; border-top:1px solid #eff3f4;";

  var topRow = document.createElement("div");
  topRow.style.cssText = "display:flex; gap:10px;";

  var avatar = document.createElement("div");
  avatar.style.cssText =
    "flex:0 0 36px; height:36px; border-radius:50%; background:#cfd9de; display:flex; align-items:center; justify-content:center; font-size:14px; color:#536471; font-weight:700; flex-shrink:0;";
  avatar.textContent = username[0].toUpperCase();

  var body = document.createElement("div");
  body.style.cssText = "flex:1; min-width:0;";

  var header = document.createElement("div");
  header.style.cssText = "font-size:14px;";
  header.innerHTML =
    '<span style="font-weight:700; color:#0f1419;">@' + esc(username) + "</span>";

  var textEl = document.createElement("div");
  textEl.style.cssText =
    "font-size:14px; color:#0f1419; margin:2px 0 8px; word-wrap:break-word;";
  textEl.textContent = c.body;

  var threadEl = document.createElement("div");

  var actions = document.createElement("div");
  actions.style.cssText =
    "display:flex; justify-content:space-around; align-items:center; color:#536471; font-size:13px; padding:8px 0 2px;";

  var likeBtn = mkAction(SVG_LIKE);
  var replyBtn = mkAction(SVG_REPLY);
  var repostBtn = mkAction(SVG_REPOST);
  var reportBtn = mkAction(SVG_REPORT);

  likeBtn.style.color = st.liked ? "#f91880" : "#536471";
  repostBtn.style.color = st.reposted ? "#00ba7c" : "#536471";

  likeBtn.addEventListener("click", function () {
    st.liked = !st.liked;
    likeBtn.style.color = st.liked ? "#f91880" : "#536471";
    queueWrite("comment_likes", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      comment_id: c.id,
      liked: st.liked,
    });
  });

  repostBtn.addEventListener("click", function () {
    st.reposted = !st.reposted;
    repostBtn.style.color = st.reposted ? "#00ba7c" : "#536471";
    queueWrite("comment_reposts", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      comment_id: c.id,
      reposted: st.reposted,
    });
  });

  replyBtn.addEventListener("click", function () {
    if (body.querySelector(".reply-box-cmt")) {
      body.querySelector(".reply-box-cmt textarea").focus();
      return;
    }
    var box = document.createElement("div");
    box.className = "reply-box-cmt";
    box.style.cssText =
      "margin-top:8px; display:flex; gap:6px; align-items:flex-start;";
    var ta = document.createElement("textarea");
    ta.placeholder = "Post your reply";
    ta.rows = 1;
    ta.style.cssText =
      "flex:1; border:1px solid #cfd9de; border-radius:8px; padding:8px; font-size:14px; font-family:inherit; resize:none; min-height:70px; box-sizing:border-box; overflow:hidden;";
    styleTextarea(ta);
    ta.addEventListener("focus", function () {
      ta.style.minHeight = "70px";
    });
    ta.addEventListener("input", function () {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
    var send = document.createElement("button");
    send.type = "button";
    send.textContent = "Reply";
    send.style.cssText =
      "background:#0f1419; color:#fff; border:none; border-radius:18px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;";
    stylePrimaryButton(send);
    send.addEventListener("click", function () {
      var txt = ta.value.trim();
      if (!txt) return;
      st.replyCount++;
      var replyObj = { index: st.replyCount, text: txt };
      queueWrite("comment_replies", {
        pid: PID,
        session_type: SESSION_TYPE,
        item_id: currentItem.id,
        comment_id: c.id,
        body: txt,
        reply_index: st.replyCount,
      });
      renderCommentReply(threadEl, replyObj, st, c.id);
      box.remove();
    });
    box.appendChild(ta);
    box.appendChild(send);
    body.appendChild(box);
    animateReplyBox(box);
    addDismissOnOutside(box, ta, function () {
      box.remove();
    });
    ta.focus();
  });

  reportBtn.addEventListener("click", function () {
    reportTarget = { type: "comment", commentId: c.id, btn: reportBtn };
    openReportModal();
  });

  actions.appendChild(likeBtn);
  actions.appendChild(replyBtn);
  actions.appendChild(repostBtn);
  actions.appendChild(reportBtn);
  body.appendChild(header);
  body.appendChild(textEl);
  topRow.appendChild(avatar);
  topRow.appendChild(body);
  wrap.appendChild(topRow);
  wrap.appendChild(actions);
  threadEl.style.cssText = "padding-left: 46px;";
  wrap.appendChild(threadEl);
  return wrap;
}

function renderCommentReply(container, replyObj, cmtState, commentId) {
  var editing = false;
  var liked = false,
    reposted = false;

  var wrap = document.createElement("div");
  wrap.style.cssText =
    "margin-top:14px; padding:10px 0 0 12px; border-left:2px solid #eff3f4;";

  var topRow = document.createElement("div");
  topRow.style.cssText = "display:flex; gap:8px;";

  var avatar = document.createElement("div");
  avatar.style.cssText =
    "flex:0 0 28px; height:28px; border-radius:50%; background:#cfd9de; display:flex; align-items:center; justify-content:center; font-size:12px; color:#536471; font-weight:700; flex-shrink:0;";
  avatar.textContent = "Y";

  var body = document.createElement("div");
  body.style.cssText = "flex:1; min-width:0;";

  var header = document.createElement("div");
  header.style.cssText = "font-size:13px;";
  header.innerHTML =
    '<span style="font-weight:700; color:#0f1419;">You</span> <span style="color:#536471;">@you</span>';

  var textEl = document.createElement("div");
  textEl.style.cssText =
    "font-size:13px; color:#0f1419; margin:3px 0 0; word-wrap:break-word;";
  textEl.textContent = replyObj.text;

  var actions = document.createElement("div");
  actions.style.cssText =
    "display:flex; justify-content:space-around; align-items:center; color:#536471; font-size:13px; padding:7px 0 2px;";

  var likeBtn = mkAction(SVG_LIKE);
  var replyBtn = mkAction(SVG_REPLY);
  var repostBtn = mkAction(SVG_REPOST);
  var editBtn = mkActionText("Edit");
  var deleteBtn = mkActionText("Delete");

  likeBtn.addEventListener("click", function () {
    liked = !liked;
    likeBtn.style.color = liked ? "#f91880" : "#536471";
    queueWrite("comment_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      comment_id: commentId,
      reply_index: replyObj.index,
      action_type: liked ? "like" : "unlike",
    });
  });

  repostBtn.addEventListener("click", function () {
    reposted = !reposted;
    repostBtn.style.color = reposted ? "#00ba7c" : "#536471";
    queueWrite("comment_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      comment_id: commentId,
      reply_index: replyObj.index,
      action_type: reposted ? "repost" : "unrepost",
    });
  });

  replyBtn.addEventListener("click", function () {
    if (body.querySelector(".reply-box-nested")) {
      body.querySelector(".reply-box-nested textarea").focus();
      return;
    }
    var box = document.createElement("div");
    box.className = "reply-box-nested";
    box.style.cssText =
      "margin-top:6px; display:flex; gap:6px; align-items:flex-start;";
    var ta = document.createElement("textarea");
    ta.placeholder = "Post your reply";
    ta.rows = 1;
    ta.style.cssText =
      "flex:1; border:1px solid #cfd9de; border-radius:8px; padding:6px 8px; font-size:13px; font-family:inherit; resize:none; min-height:60px; box-sizing:border-box; overflow:hidden;";
    styleTextarea(ta);
    ta.addEventListener("input", function () {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
    var send = document.createElement("button");
    send.type = "button";
    send.textContent = "Reply";
    send.style.cssText =
      "background:#0f1419; color:#fff; border:none; border-radius:18px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;";
    stylePrimaryButton(send);
    send.addEventListener("click", function () {
      var t = ta.value.trim();
      if (!t) return;
      cmtState.replyCount++;
      queueWrite("comment_replies", {
        pid: PID,
        session_type: SESSION_TYPE,
        item_id: currentItem.id,
        comment_id: commentId,
        body: t,
        reply_index: cmtState.replyCount,
      });
      renderCommentReply(
        container,
        { index: cmtState.replyCount, text: t },
        cmtState,
        commentId,
      );
      box.remove();
    });
    box.appendChild(ta);
    box.appendChild(send);
    body.appendChild(box);
    animateReplyBox(box);
    addDismissOnOutside(box, ta, function () {
      box.remove();
    });
    ta.focus();
  });

  editBtn.addEventListener("click", function () {
    if (editing) return;
    editing = true;
    var editBox = document.createElement("div");
    editBox.style.cssText =
      "margin:2px 0 4px; display:flex; gap:6px; align-items:flex-start;";
    var ta = document.createElement("textarea");
    ta.value = replyObj.text;
    ta.rows = 1;
    ta.style.cssText =
      "flex:1; border:1px solid #cfd9de; border-radius:8px; padding:6px 8px; font-size:13px; font-family:inherit; resize:none; min-height:32px; box-sizing:border-box; overflow:hidden;";
    ta.addEventListener("input", function () {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
    var save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save";
    save.style.cssText =
      "background:#0f1419; color:#fff; border:none; border-radius:18px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;";
    save.addEventListener("click", function () {
      var t = ta.value.trim();
      if (!t) return;
      queueWrite("comment_reply_interactions", {
        pid: PID,
        session_type: SESSION_TYPE,
        item_id: currentItem.id,
        comment_id: commentId,
        reply_index: replyObj.index,
        action_type: "edit",
        value: t,
      });
      replyObj.text = t;
      textEl.textContent = t;
      body.replaceChild(textEl, editBox);
      editing = false;
    });
    editBox.appendChild(ta);
    editBox.appendChild(save);
    body.replaceChild(editBox, textEl);
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
    ta.focus();
  });

  deleteBtn.addEventListener("click", function () {
    queueWrite("comment_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      comment_id: commentId,
      reply_index: replyObj.index,
      action_type: "delete",
    });
    wrap.remove();
  });

  actions.appendChild(likeBtn);
  actions.appendChild(replyBtn);
  actions.appendChild(repostBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  body.appendChild(header);
  body.appendChild(textEl);
  topRow.appendChild(avatar);
  topRow.appendChild(body);
  wrap.appendChild(topRow);
  wrap.appendChild(actions);
  container.appendChild(wrap);
  return wrap;
}

function renderPostReply(container, replyObj, atTop) {
  var editing = false;
  var liked = false,
    reposted = false;

  var wrap = document.createElement("div");
  wrap.style.cssText = "padding:18px 16px 14px; border-top:1px solid #eff3f4;";

  var topRow = document.createElement("div");
  topRow.style.cssText = "display:flex; gap:10px;";

  var avatar = document.createElement("div");
  avatar.style.cssText =
    "flex:0 0 36px; height:36px; border-radius:50%; background:#cfd9de; display:flex; align-items:center; justify-content:center; font-size:14px; color:#536471; font-weight:700; flex-shrink:0;";
  avatar.textContent = "Y";

  var body = document.createElement("div");
  body.style.cssText = "flex:1; min-width:0;";

  var header = document.createElement("div");
  header.style.cssText = "font-size:14px;";
  header.innerHTML =
    '<span style="font-weight:700; color:#0f1419;">You</span> <span style="color:#536471;">@you</span>';

  var textEl = document.createElement("div");
  textEl.style.cssText =
    "font-size:14px; color:#0f1419; margin:3px 0 0; word-wrap:break-word;";
  textEl.textContent = replyObj.text;

  var actions = document.createElement("div");
  actions.style.cssText =
    "display:flex; justify-content:space-around; align-items:center; color:#536471; font-size:13px; padding:8px 0 2px;";

  var likeBtn = mkAction(SVG_LIKE);
  var replyBtn = mkAction(SVG_REPLY);
  var repostBtn = mkAction(SVG_REPOST);
  var editBtn = mkActionText("Edit");
  var deleteBtn = mkActionText("Delete");

  likeBtn.addEventListener("click", function () {
    liked = !liked;
    likeBtn.style.color = liked ? "#f91880" : "#536471";
    queueWrite("post_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      reply_index: replyObj.index,
      action_type: liked ? "like" : "unlike",
    });
  });

  repostBtn.addEventListener("click", function () {
    reposted = !reposted;
    repostBtn.style.color = reposted ? "#00ba7c" : "#536471";
    queueWrite("post_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      reply_index: replyObj.index,
      action_type: reposted ? "repost" : "unrepost",
    });
  });

  replyBtn.addEventListener("click", function () {
    if (body.querySelector(".reply-box-nested")) {
      body.querySelector(".reply-box-nested textarea").focus();
      return;
    }
    var box = document.createElement("div");
    box.className = "reply-box-nested";
    box.style.cssText =
      "margin-top:8px; display:flex; gap:6px; align-items:flex-start;";
    var ta = document.createElement("textarea");
    ta.placeholder = "Post your reply";
    ta.rows = 1;
    ta.style.cssText =
      "flex:1; border:1px solid #cfd9de; border-radius:8px; padding:8px; font-size:14px; font-family:inherit; resize:none; min-height:70px; box-sizing:border-box; overflow:hidden;";
    styleTextarea(ta);
    ta.addEventListener("focus", function () {
      ta.style.minHeight = "70px";
    });
    ta.addEventListener("input", function () {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
    var send = document.createElement("button");
    send.type = "button";
    send.textContent = "Reply";
    send.style.cssText =
      "background:#0f1419; color:#fff; border:none; border-radius:18px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;";
    stylePrimaryButton(send);
    send.addEventListener("click", function () {
      var t = ta.value.trim();
      if (!t) return;
      postReplyCount++;
      queueWrite("post_replies", {
        pid: PID,
        session_type: SESSION_TYPE,
        item_id: currentItem.id,
        body: t,
        reply_index: postReplyCount,
      });
      renderPostSubReply(subThread, { index: postReplyCount, text: t });
      box.remove();
    });
    box.appendChild(ta);
    box.appendChild(send);
    body.appendChild(box);
    animateReplyBox(box);
    addDismissOnOutside(box, ta, function () {
      box.remove();
    });
    ta.focus();
  });

  editBtn.addEventListener("click", function () {
    if (editing) return;
    editing = true;
    var editBox = document.createElement("div");
    editBox.style.cssText =
      "margin:2px 0 8px; display:flex; gap:6px; align-items:flex-start;";
    var ta = document.createElement("textarea");
    ta.value = replyObj.text;
    ta.rows = 1;
    ta.style.cssText =
      "flex:1; border:1px solid #cfd9de; border-radius:8px; padding:8px; font-size:14px; font-family:inherit; resize:none; min-height:38px; box-sizing:border-box; overflow:hidden;";
    ta.addEventListener("input", function () {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
    var save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save";
    save.style.cssText =
      "background:#0f1419; color:#fff; border:none; border-radius:18px; padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;";
    save.addEventListener("click", function () {
      var t = ta.value.trim();
      if (!t) return;
      queueWrite("post_reply_interactions", {
        pid: PID,
        session_type: SESSION_TYPE,
        item_id: currentItem.id,
        reply_index: replyObj.index,
        action_type: "edit",
        value: t,
      });
      replyObj.text = t;
      textEl.textContent = t;
      body.replaceChild(textEl, editBox);
      editing = false;
    });
    editBox.appendChild(ta);
    editBox.appendChild(save);
    body.replaceChild(editBox, textEl);
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
    ta.focus();
  });

  deleteBtn.addEventListener("click", function () {
    queueWrite("post_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      reply_index: replyObj.index,
      action_type: "delete",
    });
    wrap.remove();
  });

  var subThread = document.createElement("div");

  actions.appendChild(likeBtn);
  actions.appendChild(replyBtn);
  actions.appendChild(repostBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  body.appendChild(header);
  body.appendChild(textEl);
  topRow.appendChild(avatar);
  topRow.appendChild(body);
  wrap.appendChild(topRow);
  wrap.appendChild(actions);
  subThread.style.cssText = "padding-left: 46px;";
  wrap.appendChild(subThread);
  if (atTop && container.firstChild)
    container.insertBefore(wrap, container.firstChild);
  else container.appendChild(wrap);
  return wrap;
}

function renderPostSubReply(container, replyObj) {
  var editing = false;
  var liked = false,
    reposted = false;

  var wrap = document.createElement("div");
  wrap.style.cssText =
    "margin-top:14px; padding:10px 0 0 12px; border-left:2px solid #eff3f4;";

  var topRow = document.createElement("div");
  topRow.style.cssText = "display:flex; gap:8px;";

  var avatar = document.createElement("div");
  avatar.style.cssText =
    "flex:0 0 28px; height:28px; border-radius:50%; background:#cfd9de; display:flex; align-items:center; justify-content:center; font-size:12px; color:#536471; font-weight:700; flex-shrink:0;";
  avatar.textContent = "Y";

  var body = document.createElement("div");
  body.style.cssText = "flex:1; min-width:0;";

  var header = document.createElement("div");
  header.style.cssText = "font-size:13px;";
  header.innerHTML =
    '<span style="font-weight:700; color:#0f1419;">You</span> <span style="color:#536471;">@you</span>';

  var textEl = document.createElement("div");
  textEl.style.cssText =
    "font-size:13px; color:#0f1419; margin:3px 0 0; word-wrap:break-word;";
  textEl.textContent = replyObj.text;

  var actions = document.createElement("div");
  actions.style.cssText =
    "display:flex; justify-content:space-around; align-items:center; color:#536471; font-size:13px; padding:7px 0 2px;";

  var likeBtn = mkAction(SVG_LIKE);
  var replyBtn = mkAction(SVG_REPLY);
  var repostBtn = mkAction(SVG_REPOST);
  var editBtn = mkActionText("Edit");
  var deleteBtn = mkActionText("Delete");

  likeBtn.addEventListener("click", function () {
    liked = !liked;
    likeBtn.style.color = liked ? "#f91880" : "#536471";
    queueWrite("post_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      reply_index: replyObj.index,
      action_type: liked ? "like" : "unlike",
    });
  });

  repostBtn.addEventListener("click", function () {
    reposted = !reposted;
    repostBtn.style.color = reposted ? "#00ba7c" : "#536471";
    queueWrite("post_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      reply_index: replyObj.index,
      action_type: reposted ? "repost" : "unrepost",
    });
  });

  replyBtn.addEventListener("click", function () {
    if (body.querySelector(".reply-box-nested")) {
      body.querySelector(".reply-box-nested textarea").focus();
      return;
    }
    var box = document.createElement("div");
    box.className = "reply-box-nested";
    box.style.cssText =
      "margin-top:6px; display:flex; gap:6px; align-items:flex-start;";
    var ta = document.createElement("textarea");
    ta.placeholder = "Post your reply";
    ta.rows = 1;
    ta.style.cssText =
      "flex:1; border:1px solid #cfd9de; border-radius:8px; padding:6px 8px; font-size:13px; font-family:inherit; resize:none; min-height:60px; box-sizing:border-box; overflow:hidden;";
    styleTextarea(ta);
    ta.addEventListener("input", function () {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
    var send = document.createElement("button");
    send.type = "button";
    send.textContent = "Reply";
    send.style.cssText =
      "background:#0f1419; color:#fff; border:none; border-radius:18px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;";
    stylePrimaryButton(send);
    send.addEventListener("click", function () {
      var t = ta.value.trim();
      if (!t) return;
      postReplyCount++;
      queueWrite("post_replies", {
        pid: PID,
        session_type: SESSION_TYPE,
        item_id: currentItem.id,
        body: t,
        reply_index: postReplyCount,
      });
      renderPostSubReply(container, { index: postReplyCount, text: t });
      box.remove();
    });
    box.appendChild(ta);
    box.appendChild(send);
    body.appendChild(box);
    animateReplyBox(box);
    addDismissOnOutside(box, ta, function () {
      box.remove();
    });
    ta.focus();
  });

  editBtn.addEventListener("click", function () {
    if (editing) return;
    editing = true;
    var editBox = document.createElement("div");
    editBox.style.cssText =
      "margin:2px 0 4px; display:flex; gap:6px; align-items:flex-start;";
    var ta = document.createElement("textarea");
    ta.value = replyObj.text;
    ta.rows = 1;
    ta.style.cssText =
      "flex:1; border:1px solid #cfd9de; border-radius:8px; padding:6px 8px; font-size:13px; font-family:inherit; resize:none; min-height:32px; box-sizing:border-box; overflow:hidden;";
    ta.addEventListener("input", function () {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
    var save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save";
    save.style.cssText =
      "background:#0f1419; color:#fff; border:none; border-radius:18px; padding:4px 10px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;";
    save.addEventListener("click", function () {
      var t = ta.value.trim();
      if (!t) return;
      queueWrite("post_reply_interactions", {
        pid: PID,
        session_type: SESSION_TYPE,
        item_id: currentItem.id,
        reply_index: replyObj.index,
        action_type: "edit",
        value: t,
      });
      replyObj.text = t;
      textEl.textContent = t;
      body.replaceChild(textEl, editBox);
      editing = false;
    });
    editBox.appendChild(ta);
    editBox.appendChild(save);
    body.replaceChild(editBox, textEl);
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
    ta.focus();
  });

  deleteBtn.addEventListener("click", function () {
    queueWrite("post_reply_interactions", {
      pid: PID,
      session_type: SESSION_TYPE,
      item_id: currentItem.id,
      reply_index: replyObj.index,
      action_type: "delete",
    });
    wrap.remove();
  });

  actions.appendChild(likeBtn);
  actions.appendChild(replyBtn);
  actions.appendChild(repostBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  body.appendChild(header);
  body.appendChild(textEl);
  topRow.appendChild(avatar);
  topRow.appendChild(body);
  wrap.appendChild(topRow);
  wrap.appendChild(actions);
  container.appendChild(wrap);
  return wrap;
}

function recoPreview(item) {
  if (!item.transcript) return "";
  var text;
  try {
    var paras = JSON.parse(item.transcript);
    text = Array.isArray(paras) ? paras.join(" ") : String(paras);
  } catch (e) {
    text = item.transcript;
  }
  var words = text.trim().split(/\s+/);
  return words.length > 100 ? words.slice(0, 100).join(" ") + "…" : text;
}

// ---- POST BAR ----
function wirePostBar() {
  ["like", "reply", "repost", "report"].forEach(function (name) {
    var btn = document.getElementById("btn-" + name);
    if (!btn) return;
    addButtonFeedback(btn);
  });
  styleTextarea(document.getElementById("post-reply-input"));
  stylePrimaryButton(document.getElementById("post-reply-send"));
}

function handlePostLike() {
  postLiked = !postLiked;
  document.getElementById("btn-like").style.color = postLiked ? "#f91880" : "#536471";
  document.getElementById("like-label").textContent = postLiked ? "Liked" : "Like";
  queueWrite("post_likes", {
    pid: PID,
    session_type: SESSION_TYPE,
    item_id: currentItem.id,
    liked: postLiked,
  });
}

function handlePostRepost() {
  postReposted = !postReposted;
  document.getElementById("btn-repost").style.color = postReposted ? "#00ba7c" : "#536471";
  document.getElementById("repost-label").textContent = postReposted ? "Reposted" : "Repost";
  queueWrite("post_reposts", {
    pid: PID,
    session_type: SESSION_TYPE,
    item_id: currentItem.id,
    reposted: postReposted,
  });
}

function handlePostReply() {
  var ta = document.getElementById("post-reply-input");
  var send = document.getElementById("post-reply-send");
  var text = ta.value.trim();
  if (!text) return;
  postReplyCount++;
  var replyObj = { index: postReplyCount, text: text };
  queueWrite("post_replies", {
    pid: PID,
    session_type: SESSION_TYPE,
    item_id: currentItem.id,
    body: text,
    reply_index: postReplyCount,
  });
  renderPostReply(document.getElementById("comment-list"), replyObj, true);
  ta.value = "";
  ta.style.height = "auto";
  ta.style.minHeight = "38px";
  send.style.display = "none";
}

// ---- REPORT MODAL ----
function openReportModal() {
  document.getElementById("report-body").style.display = "block";
  document.getElementById("report-thanks").style.display = "none";
  var list = document.getElementById("report-reasons");
  list.innerHTML = "";
  REPORT_REASONS.forEach(function (r) {
    var btn = document.createElement("button");
    btn.className = "report-reason-btn";
    btn.innerHTML =
      "<span>" + esc(r.label) + '</span><span style="color:#536471;">&rsaquo;</span>';
    btn.addEventListener("click", function () {
      if (reportTarget.type === "post") {
        queueWrite("post_reports", {
          pid: PID,
          session_type: SESSION_TYPE,
          item_id: currentItem.id,
          reason: r.id,
        });
      } else {
        queueWrite("comment_reports", {
          pid: PID,
          session_type: SESSION_TYPE,
          item_id: currentItem.id,
          comment_id: reportTarget.commentId,
          reason: r.id,
        });
      }
      if (reportTarget.btn) reportTarget.btn.style.color = "#f4212e";
      document.getElementById("report-body").style.display = "none";
      document.getElementById("report-thanks").style.display = "block";
      setTimeout(closeReportModal, 1400);
    });
    list.appendChild(btn);
  });
  document.getElementById("report-modal").classList.add("open");
}

function closeReportModal() {
  document.getElementById("report-modal").classList.remove("open");
  reportTarget = null;
}

// ---- CONTINUE TIMER ----
// handleContinue() is defined by each page script.
function startContinueTimer() {
  setTimeout(handleContinue, CONTINUE_DELAY_MS);
}

// ---- UTILS ----
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function youtubeId(url) {
  var m = String(url).match(/(?:youtu\.be\/|[?&]v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
function showError(msg) {
  document.getElementById("loading").style.display = "none";
  var el = document.getElementById("error-msg");
  el.textContent = msg;
  el.style.display = "flex";
}

// ---- STATIC EVENT LISTENERS ----
document.getElementById("view-more-btn").addEventListener("click", function () {
  if (!currentItem) return;
  expansionIdx++;
  visibleCount = Math.min(visibleCount + COMMENTS_PER_LOAD, allComments.length);
  queueWrite("comment_expansions", {
    pid: PID,
    session_type: SESSION_TYPE,
    item_id: currentItem.id,
    expansion_index: expansionIdx,
    comments_visible: visibleCount,
  });
  renderComments();
});

document.getElementById("btn-like").addEventListener("click", handlePostLike);
document.getElementById("btn-repost").addEventListener("click", handlePostRepost);
document.getElementById("btn-report").addEventListener("click", function () {
  reportTarget = {
    type: "post",
    commentId: null,
    btn: document.getElementById("btn-report"),
  };
  openReportModal();
});
document.getElementById("btn-reply").addEventListener("click", function () {
  var ta = document.getElementById("post-reply-input");
  var send = document.getElementById("post-reply-send");
  ta.focus();
  ta.style.minHeight = "70px";
  send.style.display = "inline-block";
});

var postTa = document.getElementById("post-reply-input");
var postSend = document.getElementById("post-reply-send");
postTa.addEventListener("input", function () {
  postSend.style.display = postTa.value.trim() ? "inline-block" : "none";
  postTa.style.height = "auto";
  postTa.style.height = postTa.scrollHeight + "px";
});
postSend.addEventListener("click", handlePostReply);

document.getElementById("report-close").addEventListener("click", closeReportModal);
document.getElementById("report-modal").addEventListener("click", function (e) {
  if (e.target.id === "report-modal") closeReportModal();
});