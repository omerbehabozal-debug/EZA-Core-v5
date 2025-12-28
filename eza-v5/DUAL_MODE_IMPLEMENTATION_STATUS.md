# Dual Analysis Mode (FAST vs PRO) - Implementation Status

## ✅ COMPLETED

### 1. Policy Schema
- ✅ Organization model: `analysis_mode` field added (default: "fast")
- ✅ PolicyInfo model: `analysis_mode` support added
- ✅ `get_analysis_mode_for_org()` function: Reads from database

### 2. Pipeline Routing
- ✅ `proxy_analyze` endpoint: FAST vs PRO routing logic
- ✅ Priority: User override > Org setting > Default "fast"
- ✅ Assertion: `analysis_mode` must be "fast" or "pro"

### 3. FAST Pipeline
- ✅ Stage-0: Immediate scan (unchanged)
- ✅ Stage-1: Light/deep (rate limit aware, unchanged)
- ✅ Stage-2: Fast rewrite (unchanged)
- ✅ Rate limit → depth downgrade, never block

### 4. PRO Pipeline
- ✅ Stage-0: Informational only
- ✅ Stage-1: ALWAYS full deep (no light mode, no rate limit downgrade)
- ✅ Stage-2: Rewrite depends on Stage-1 completion
- ✅ Assertions: PRO mode must not use light Stage-1
- ✅ PRO mode: analyze ALL paragraphs

### 5. Risk-Aware PRO Rewrite
- ✅ Risk-type-specific prompts created:
  - `build_discrimination_rewrite_prompt()`
  - `build_manipulation_rewrite_prompt()`
  - `build_political_rewrite_prompt()`
  - `build_misinformation_rewrite_prompt()`
  - `build_hate_rewrite_prompt()`
  - `build_other_rewrite_prompt()` (fallback)
- ✅ `build_span_rewrite_prompt()` updated to route based on `analysis_mode`
- ✅ PRO mode routes to risk-specific prompts
- ✅ FAST mode uses generic prompt (unchanged)

### 6. Telemetry & IntentLog
- ✅ `log_analysis()`: `analysis_mode` parameter added
- ✅ IntentLog: `analysis_mode` stored in flags JSON
- ✅ Rewrite IntentLog: `analysis_mode` included

### 7. Response Models
- ✅ `ProxyAnalyzeResponse`: `analysis_mode` field added
- ✅ `ProxyAnalyzeRequest`: Optional `analysis_mode` override added

### 8. Stage-2 Rewrite (PRO mode)
- ✅ PRO mode: Rewrite depends on Stage-1 deep completion
- ✅ Assertion: PRO mode rewrite requires deep Stage-1 analysis
- ✅ PRO mode: `stage1_mode="deep"` enforced

## 🔄 IN PROGRESS

### 9. Rewrite Explanation Generation (PRO mode)
- ⏳ Need to add `generate_rewrite_explanation()` function
- ⏳ Need to add `rewrite_explanation` to `ProxyRewriteResponse`
- ⏳ Need to generate explanation in `proxy_rewrite` endpoint

### 10. Update Function Signatures
- ⏳ `rewrite_span()`: Add `analysis_mode` parameter
- ⏳ `stage2_span_based_rewrite()`: Add `analysis_mode` parameter
- ⏳ `proxy_rewrite()`: Pass `analysis_mode` to rewrite functions

## 📋 TODO

### 11. UI Differentiation Messages
- ⏳ Backend: Add `ui_status_message` to response (FAST vs PRO)
- ⏳ Frontend: Display different messages based on mode

### 12. Additional Assertions
- ⏳ Add assertion: PRO mode MUST NOT call light Stage-1
- ⏳ Add assertion: PRO rewrite MUST NOT run before deep Stage-1
- ⏳ Add assertion: FAST mode MUST NOT block for deep analysis
- ⏳ Add assertion: `analysis_mode` must exist in response & telemetry

### 13. Admin UI
- ⏳ Policy Settings → Analysis Mode selector
- ⏳ Display rewrite explanations (PRO mode only, org admin only)

## 🎯 NEXT STEPS

1. Complete rewrite explanation generation
2. Update function signatures to pass `analysis_mode`
3. Add UI differentiation messages
4. Add remaining assertions
5. Test FAST vs PRO behavior separation

